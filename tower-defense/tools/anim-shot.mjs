#!/usr/bin/env node
/**
 * anim-shot.mjs — 定格动画帧截图
 *
 * 用 CDP 打开本地预览，定格英雄、台灯小怪或通用退场烟雾。
 *
 * 用法：node tools/anim-shot.mjs [--port 8099] [--hero tank|war|arch|mage] [--smoke|--lamp] [--out /tmp/tdanim]
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const args = process.argv.slice(2)
const port = Number(args[args.indexOf('--port') + 1]) || 8099
const outDir = args[args.indexOf('--out') + 1] || '/tmp/tdanim'
const heroId = args.includes('--hero') ? args[args.indexOf('--hero') + 1] : 'tank'
const smokeOnly = args.includes('--smoke')
if (!['tank', 'war', 'arch', 'mage'].includes(heroId)) throw new Error('未知英雄 ID')
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
  S.cardsPlaced = 1;
  S.waveState = 'fighting';
  var card = S.heroById(${JSON.stringify(heroId)});
  var un = {
    uid: 900, def: card,
    x: u.field.x + u.field.w * 0.40, y: u.field.y + u.field.h * 0.58,
    hp: card.hp, maxHp: card.hp, atkTimer: 9999, hitFlash: 0, slowT: 0,
    spawnT: 0, dead: false, facing: 1, anim: 'idle', animT: 0, pendingHit: -1, pendingTarget: 0,
  };
  S.units.push(un);
  S.enemies.push({
    uid: 901, def: A.Config.ENEMIES.small,
    x: un.x + 34, y: un.y - 30, hp: 400, maxHp: 400, atk: 1, speed: 0,
    slowT: 0, slowFactor: 1, atkTimer: 9999, hitFlash: 0, spawnT: 0, dead: false,
    anim: 'idle', animT: 0, pendingHit: -1, pendingTarget: 0,
  });
  window.__un = un;
  window.__enemy = S.enemies[0];
  // 冻结逻辑推进：只保留渲染，才能定格到精确帧
  window.__battleUpdate = A.Battle.update;
  A.Battle.update = function () {};
  return { x: Math.round(un.x), y: Math.round(un.y), phase: S.phase };
})()`

const POSE = (state, t, facing = 1) => `(function () {
  var A = window.AIGCUtils, S = A.State, un = window.__un;
  un.anim = ${JSON.stringify(state)};
  un.animT = ${t};
  un.facing = ${facing};
  window.__enemy.x = un.x + ${facing} * 34;
  S.effects.length = 0;
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
  for (let i = 0; i < 50; i++) {
    if (await evaluate(`window.AIGCUtils && window.AIGCUtils.Assets && window.AIGCUtils.Assets.isReady()`)) break
    await sleep(200)
  }
  const failures = await evaluate(`window.AIGCUtils.Assets.failures()`)
  if (failures.length) throw new Error('资源加载失败: ' + JSON.stringify(failures))

  const pos = await evaluate(SETUP)
  console.log('unit at', pos)
  const renderCheck = await evaluate(`(function () {
    var A = window.AIGCUtils, errors = [], old = console.error;
    console.error = function () { errors.push(Array.prototype.join.call(arguments, ' ')); };
    A.Game.render.__logged = false;
    A.Game.render();
    console.error = old;
    return { errors: errors, units: A.State.units.length, phase: A.State.phase };
  })()`)
  if (renderCheck.errors.length) throw new Error(renderCheck.errors.join('\n'))
  const spriteCheck = await evaluate(`(function () {
    var A = window.AIGCUtils;
    var artKey = { war: 'melee-cat-back', mage: 'mage-dog-back' }[${JSON.stringify(heroId)}];
    if (artKey) return !!A.Assets.entry(artKey);
    var name = A.Rigs[${JSON.stringify(heroId)}].parts[0].icon;
    var sp = A.Assets.sprite(name);
    return !!sp && !!A.Assets.tex('game') && !!A.GameAtlas.icons[name];
  })()`)
  if (!spriteCheck) throw new Error('角色战场帧未加载')

  if (args.includes('--lamp')) {
    const lampReady = await evaluate(`(function () {
      var A = window.AIGCUtils;
      if (!A.Assets.entry('lamp-small')) return false;
      var u = A.Layout.ui, e = A.State.enemies[0];
      e.x = u.field.x + u.field.w * 0.57;
      e.y = u.field.y + u.field.h * 0.45;
      e.spawnT = 0;
      return true;
    })()`)
    if (!lampReady) throw new Error('台灯小怪素材未加载')
    await shot('01-lamp-in-battle')
    console.log('台灯截图目录:', outDir)
    ws.close()
    chrome.kill()
    process.exit(0)
  }

  if (smokeOnly) {
    const smokeReady = await evaluate(`(function () {
      var A = window.AIGCUtils;
      return ['fx-smoke', 'fx-smoke-2', 'fx-smoke-3'].every(function (name) {
        return !!A.Assets.sprite(name);
      });
    })()`)
    if (!smokeReady) throw new Error('退场烟雾三帧未加载')
    for (const [name, progress] of [
      ['01-smoke-start', 0.08],
      ['02-smoke-middle', 0.50],
      ['03-smoke-end', 0.84],
    ]) {
      await evaluate(`(function () {
        var A = window.AIGCUtils, S = A.State, un = window.__un;
        S.units.length = 0;
        S.enemies.length = 0;
        S.effects.length = 0;
        S.addEffect({ type: 'smoke', x: un.x, y: un.y, r: un.def.radius,
          life: 0.55 * (1 - ${progress}), max: 0.55, color: '#fff0e3' });
      })()`)
      await shot(name)
    }
    console.log('烟雾截图目录:', outDir)
    ws.close()
    chrome.kill()
    process.exit(0)
  }

  await evaluate(POSE('idle', 1.2))
  await shot('01-idle')

  const frames = heroId === 'arch' ? [
    ['02-aim', 'atk', 0.04, 1],
    ['03-fire-right', 'atk', 0.07, 1],
    ['04-recoil', 'atk', 0.26, 1],
    ['05-fire-left', 'atk', 0.07, -1],
    ['06-hurt', 'hurt', 0.06, 1],
    ['07-die', 'die', 0.30, 1],
  ] : [
    ['02-hurt', 'hurt', 0.06, 1],
    ['03-die', 'die', 0.30, 1],
  ]
  for (const [name, state, t, facing] of frames) {
    await evaluate(POSE(state, t, facing))
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
