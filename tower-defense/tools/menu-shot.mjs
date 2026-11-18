#!/usr/bin/env node
/**
 * menu-shot.mjs — 首页与商店界面截图
 *
 * 用法：node tools/menu-shot.mjs [--port 8099] [--out /tmp/tdmenu]
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const args = process.argv.slice(2)
const port = Number(args[args.indexOf('--port') + 1]) || 8099
const outDir = args[args.indexOf('--out') + 1] || '/tmp/tdmenu'
const debugPort = 9340
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
  `--user-data-dir=/tmp/tdmenu-${Date.now()}`,
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
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || 'eval failed')
  return res.result.value
}

async function shot(name) {
  await sleep(240)
  const box = await evaluate(`(function(){
    var r = window.canvas.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.max(0, Math.round(r.top)),
             w: Math.round(r.width), h: Math.round(r.height) };
  })()`)
  const res = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 1 },
  })
  fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(res.data, 'base64'))
}

const logs = []
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
    if (m.method === 'Runtime.exceptionThrown') {
      logs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)
    }
  }
  await send('Runtime.enable')
  await send('Page.enable')
  // 等脚本挂载完成，避免 evaluate 早于 AIGCUtils 定义
  for (let i = 0; i < 60; i++) {
    const ready = await evaluate('!!(window.AIGCUtils && AIGCUtils.State)')
    if (ready) break
    await sleep(200)
  }
  for (let i = 0; i < 40; i++) {
    const ph = await evaluate('AIGCUtils.State.phase')
    if (ph !== 'loading') break
    await sleep(200)
  }

  console.log('phase:', await evaluate('AIGCUtils.State.phase'),
    'failures:', await evaluate('JSON.stringify(AIGCUtils.Assets.failures())'))
  await shot('01-menu')
  if (args.includes('--covers-only')) {
    const completed = await evaluate('AIGCUtils.Profile.data.completedLevel')
    await evaluate('AIGCUtils.Profile.data.completedLevel = 6')
    for (let level = 1; level <= 6; level++) {
      await evaluate(`AIGCUtils.State.selectedLevel = ${level}`)
      await shot('cover-' + level)
    }
    await evaluate(`AIGCUtils.Profile.data.completedLevel = ${completed}`)
    await evaluate('AIGCUtils.State.selectedLevel = 2')
    await shot('cover-2-locked')
    if (logs.length) throw new Error(logs.join('\n'))
    console.log('六关封面及锁定态截图完成，无运行时异常')
    ws.close()
    chrome.kill()
    process.exit(0)
  }

  // 进游戏并给一点金币，看商店全貌
  await evaluate(`(function(){
    var A = window.AIGCUtils, S = A.State;
    A.Game.start();
    S.gold = 120;
    S.heroCap = 5;
    S.rollShop();
    return S.phase;
  })()`)
  await sleep(500)
  await shot('02-shop')

  // 拖一张卡到战场
  await evaluate(`(function(){
    var A = window.AIGCUtils, S = A.State, L = A.Layout, u = L.ui;
    var r = L.shopRect(0);
    S.inspect = A.State.heroById(S.shop[0].cardId);
    S.inspectT = 0;
    return { x: Math.round(r.x), y: Math.round(r.y) };
  })()`)
  await sleep(200)
  await shot('03-shop-detail')

  // 直接部署几个，看战场
  await evaluate(`(function(){
    var A = window.AIGCUtils, S = A.State, u = A.Layout.ui;
    var ids = ['tank','war','arch','mage'];
    for (var i = 0; i < ids.length; i++) {
      var def = S.heroById(ids[i]);
      A.Battle.placeHero(def, u.field.x + u.field.w * (0.18 + i * 0.2),
        u.field.y + u.field.h * (0.55 + (i % 2) * 0.2));
      S.units[S.units.length-1].spawnT = 0;
    }
    S.waveTimer = 1;
    S.gold = 88;
    return S.liveUnits();
  })()`)
  await sleep(1600)
  await shot('04-battle')

  console.log('exceptions:', logs.slice(0, 3))
  console.log('out:', outDir)
  ws.close()
  chrome.kill()
  process.exit(0)
}

main().catch((e) => {
  console.error('FAIL', e.message, logs.slice(0, 3))
  chrome.kill()
  process.exit(1)
})
