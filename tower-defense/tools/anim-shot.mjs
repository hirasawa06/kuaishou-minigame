#!/usr/bin/env node
/**
 * anim-shot.mjs — 定格动画帧截图
 *
 * 用 CDP 打开本地预览，直接在运行时摆一个柴犬 + 一个敌人，
 * 按指定 animT 定格，逐帧截图，用于比对分件动画与特效。
 *
 * 用法：node tools/anim-shot.mjs [--entity hero|enemy] [--hero <id>] [--port 8099]
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const args = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const port = Number(option('--port', '8099')) || 8099
const outDir = option('--out', '/tmp/tdanim')
const actorId = option('--hero', 'tank')
const actorType = option('--entity', 'hero')
const targetSide = option('--target', 'right')
const requestedRig = option('--rig', '')
const requestedState = option('--state', '')
const debugPort = 9335
fs.mkdirSync(outDir, { recursive: true })

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const chrome = spawn(CHROME, [
  '--headless=new',
  '--enable-unsafe-swiftshader',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--hide-scrollbars',
  '--window-size=500,1050',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=/tmp/tdanim-${Date.now()}`,
  `http://localhost:${port}/index.html`,
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${debugPort}/json/list`)
      const l = await r.json()
      const p = l.find((t) => t.type === 'page' && t.url.includes('index.html'))
      if (p && p.webSocketDebuggerUrl) return p.webSocketDebuggerUrl
    } catch {}
    await sleep(200)
  }
  throw new Error('CDP 未就绪')
}

let msgId = 0
const pending = new Map()
let ws

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expr) {
  const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.exception?.description || 'eval failed')
  }
  return res.result.value
}

async function shot(name) {
  await sleep(90)
  const box = await evaluate(`(function(){
    var r = window.canvas.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.max(0, Math.round(r.top)),
             w: Math.round(r.width), h: Math.round(r.height) };
  })()`)
  const res = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 1 },
  })
  const file = path.join(outDir, name + '.png')
  fs.writeFileSync(file, Buffer.from(res.data, 'base64'))
  return file
}

// 冻结战斗推进，只保留手动指定的动画状态
// 注意：预览启动后很可能已经自动开局并打到失败，这里必须把结算态一并复位
const SETUP = `(function () {
  var A = window.AIGCUtils, S = A.State, u = A.Layout.ui;
  S.reset();
  S.phase = 'playing';
  S.waveState = 'prep';
  S.waveTimer = 9999;
  S.baseHp = A.Config.BASE_HP;
  S.time = 0;
  S.units.length = 0;
  S.enemies.length = 0;
  S.projectiles.length = 0;
  S.effects.length = 0;
  S.floats.length = 0;
  S.toast = null;
  var isEnemy = ${JSON.stringify(actorType)} === 'enemy';
  var card = isEnemy ? A.Config.ENEMIES[${JSON.stringify(actorId)}] : S.cardById(${JSON.stringify(actorId)});
  if (!card) throw new Error('未知单位：${actorId}');
  var un = {
    uid: 900, def: card,
    x: u.field.x + u.field.w * 0.40, y: u.field.y + u.field.h * 0.58,
    rigId: ${JSON.stringify(requestedRig)} || (card.attackRig ? card.attackRig[${JSON.stringify(targetSide)}] : card.id),
    hp: card.hp, maxHp: card.hp, atkTimer: 9999, hitFlash: 0, slowT: 0,
    spawnT: 0, dead: false, anim: 'idle', animT: 0, pendingHit: -1, pendingTarget: 0,
  };
  var target = {
    uid: 901, def: isEnemy ? S.cardById('tank') : A.Config.ENEMIES.normal,
    x: un.x + 34, y: un.y - 30, hp: 400, maxHp: 400, atk: 1, speed: 0,
    slowT: 0, slowFactor: 1, atkTimer: 9999, hitFlash: 0, spawnT: 0, dead: false,
    anim: 'idle', animT: 0, pendingHit: -1, pendingTarget: 0,
  };
  (isEnemy ? S.enemies : S.units).push(un);
  (isEnemy ? S.units : S.enemies).push(target);
  window.__un = un;
  // 冻结逻辑推进：只保留渲染，才能定格到精确帧
  window.__battleUpdate = A.Battle.update;
  A.Battle.update = function () {};
  return { x: Math.round(un.x), y: Math.round(un.y), phase: S.phase };
})()`

const POSE = (state, t, fx) => `(function () {
  var A = window.AIGCUtils, S = A.State, un = window.__un;
  un.anim = ${JSON.stringify(state)};
  un.animT = ${t};
  if (${fx ? 'true' : 'false'}) {
    var rig = A.Rigs && A.Rigs[un.rigId || un.def.id];
    var muzzle = rig && rig.muzzle || [0, -6];
    var cx = un.x + muzzle[0], cy = un.y + muzzle[1];
    S.effects.length = 0;
    S.projectiles.length = 0;
    S.addEffect({ type: 'glow', x: cx, y: cy, r: 8, life: 0.13, max: 0.16, color: '#ffd9a0' });
    if (un.def.id === 'arch') {
      S.projectiles.push({ kind: 'light', x: cx + 8, y: cy - 7,
        tx: cx + 50, ty: cy - 44, color: un.def.color });
    } else {
      S.addEffect({ type: 'slash', x: un.x, y: un.y, tx: un.x + 34, ty: un.y - 30,
                    life: 0.12, max: 0.18, color: '#ffd9a0' });
    }
  }
  return true;
})()`

const SMOKE = (t) => `(function () {
  var S = window.AIGCUtils.State, un = window.__un;
  S.units.length = 0;
  S.enemies.length = 0;
  S.effects.length = 0;
  S.addEffect({ type: 'smoke', x: un.x, y: un.y, r: un.def.radius,
    life: 0.45 * (1 - ${t}), max: 0.45, color: '#ffffff' });
  return true;
})()`

async function main() {
  ws = new WebSocket(await getTarget())
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id)
      pending.delete(m.id)
      if (m.error) p.reject(new Error(JSON.stringify(m.error)))
      else p.resolve(m.result)
    }
  }
  await send('Runtime.enable')
  await send('Page.enable')
  await sleep(2200)

  const pos = await evaluate(SETUP)
  console.log('unit at', pos)

  if (requestedState) {
    var previewTime = await evaluate(`(function () {
      var A = window.AIGCUtils, un = window.__un;
      var rig = A.Rigs && A.Rigs[un.rigId || un.def.id];
      var state = rig && rig.states && rig.states[${JSON.stringify(requestedState)}];
      if (state && state.hit !== undefined) return state.hit;
      if (${JSON.stringify(requestedState)} === 'die') return 0.30;
      if (${JSON.stringify(requestedState)} === 'hurt') return 0.17;
      return 0.12;
    })()`)
    await evaluate(POSE(requestedState, previewTime, false))
    await shot('preview-' + requestedState)
    console.log('截图目录:', outDir)
    ws.close()
    chrome.kill()
    return
  }

  await evaluate(POSE('idle', 1.2, false))
  await shot('01-idle')

  const frames = [
    ['02-atk-windup', 0.09, false],
    ['03-atk-hit', actorType === 'hero' && actorId === 'arch' ? 0.12 : 0.17, false],
    ['03b-atk-hit-fx', actorType === 'hero' && actorId === 'arch' ? 0.12 : 0.17, true],
    ['04-atk-follow', 0.28, true],
    ['05-hurt', 0.06, false],
    ['06-die', 0.30, false],
  ]
  for (const [name, t, fx] of frames) {
    await evaluate(POSE(name.includes('die') ? 'die' : name.includes('hurt') ? 'hurt' : 'atk', t, fx))
    await shot(name)
  }

  for (const [name, t] of [
    ['07-smoke-1', 0.0],
    ['08-smoke-2', 0.4],
    ['09-smoke-3', 0.8],
  ]) {
    await evaluate(SMOKE(t))
    await shot(name)
  }

  console.log('截图目录:', outDir)
  ws.close()
  chrome.kill()
  process.exit(0)
}

main().catch((e) => {
  console.error('FAIL', e.message)
  chrome.kill()
  process.exit(1)
})
