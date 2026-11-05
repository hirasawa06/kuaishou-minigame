#!/usr/bin/env node
/**
 * pause-shot.mjs — 战斗内设置 / 暂停 / 返回主页 的截图与冒烟用例
 *
 * 用法：node tools/pause-shot.mjs [--port 8140] [--out /tmp/tdpause]
 * 前置：本地静态服务指向 package/。
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const args = process.argv.slice(2)
const port = Number(args[args.indexOf('--port') + 1]) || 8140
const outDir = args[args.indexOf('--out') + 1] || '/tmp/tdpause'
const debugPort = 9342
fs.mkdirSync(outDir, { recursive: true })

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const chrome = spawn(CHROME, [
  '--headless=new',
  '--enable-unsafe-swiftshader',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--hide-scrollbars',
  '--window-size=500,1050',
  '--force-device-scale-factor=2',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=/tmp/tdpause-${Date.now()}`,
  `http://localhost:${port}/index.html`,
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${debugPort}/json/list`)
      const list = await r.json()
      const page = list.find((t) => t.type === 'page' && t.url.includes('index.html'))
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {}
    await sleep(200)
  }
  throw new Error('CDP 未就绪')
}

let ws
let msgId = 0
const pending = new Map()

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
  await sleep(260)
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

async function tapRect(expr) {
  const p = await evaluate(`(function(){ return (${expr}); })()`)
  const v = await evaluate(`(function(){
    var c = window.canvas, L = AIGCUtils.Layout;
    var r = c.getBoundingClientRect();
    return { x: r.left + ${p.x + p.w / 2} * (r.width / L.w),
             y: r.top + ${p.y + p.h / 2} * (r.height / L.h) };
  })()`)
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x: v.x, y: v.y, button: 'left', clickCount: 1 })
  }
  await sleep(220)
}

async function main() {
  ws = new WebSocket(await getTarget())
  await new Promise((resolve) => { ws.onopen = resolve })
  ws.onmessage = (ev) => {
    const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString())
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) p.reject(new Error(msg.error.message))
      else p.resolve(msg.result)
    }
  }
  await send('Page.enable')
  await send('Runtime.enable')

  for (let i = 0; i < 80; i++) {
    const ready = await evaluate('!!(window.AIGCUtils && AIGCUtils.Assets && AIGCUtils.Assets.isReady())')
    const phase = await evaluate('window.AIGCUtils && AIGCUtils.State ? AIGCUtils.State.phase : "boot"')
    if (ready && (phase === 'menu' || phase === 'error')) break
    await sleep(250)
  }
  const phase0 = await evaluate('AIGCUtils.State.phase')
  const failed = await evaluate('AIGCUtils.State.assetErrors || []')
  console.log('boot:', phase0, 'assets:', JSON.stringify(failed))
  if (phase0 !== 'menu') { chrome.kill(); process.exit(1) }

  // 开始游戏
  await tapRect('AIGCUtils.Layout.ui.btnRect("menu")')
  await sleep(500)
  console.log('phase after start:', await evaluate('AIGCUtils.State.phase'))
  await shot('01-battle')

  // HUD 只保留暂停按钮：确认设置按钮已移除
  console.log('gearBtn exists:', await evaluate('!!AIGCUtils.Layout.ui.gearBtn'))

  // 暂停面板
  await tapRect('AIGCUtils.Layout.ui.pauseBtn')
  console.log('pause -> phase:', await evaluate('AIGCUtils.State.phase'))
  await shot('02-paused')

  // 暂停面板：设置 → 关闭回暂停
  await tapRect('AIGCUtils.Layout.ui.pausePanel.btn("settings")')
  console.log('pause settings:', await evaluate('AIGCUtils.ProfileUI.top()'))
  await shot('03-settings-from-pause')
  await tapRect('AIGCUtils.Layout.ui.settings.close')
  console.log('after close -> phase:', await evaluate('AIGCUtils.State.phase'),
    'panel:', await evaluate('AIGCUtils.ProfileUI.top()'))

  // 音效开关即时生效
  const sfxBefore = await evaluate('AIGCUtils.Profile.data.sfx')
  await tapRect('AIGCUtils.Layout.ui.pausePanel.btn("settings")')
  await tapRect('AIGCUtils.Layout.ui.settings.sfxRow')
  const sfxAfter = await evaluate('AIGCUtils.Profile.data.sfx')
  const audioOn = await evaluate('AIGCUtils.GameAudio.isSfxOn()')
  console.log('sfx:', sfxBefore, '->', sfxAfter, 'audio:', audioOn)
  await shot('04-settings-sfx-off')
  await tapRect('AIGCUtils.Layout.ui.settings.close')

  await tapRect('AIGCUtils.Layout.ui.pausePanel.btn("resume")')
  console.log('resumed phase:', await evaluate('AIGCUtils.State.phase'))

  // 重新开始
  await tapRect('AIGCUtils.Layout.ui.pauseBtn')
  await tapRect('AIGCUtils.Layout.ui.pausePanel.btn("restart")')
  console.log('restart phase:', await evaluate('AIGCUtils.State.phase'),
    'gold:', await evaluate('AIGCUtils.State.gold'))

  // 返回主页
  await tapRect('AIGCUtils.Layout.ui.pauseBtn')
  await tapRect('AIGCUtils.Layout.ui.pausePanel.btn("home")')
  console.log('home phase:', await evaluate('AIGCUtils.State.phase'),
    'units:', await evaluate('AIGCUtils.State.units.length'))
  await shot('05-menu-after-home')

  chrome.kill()
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  chrome.kill()
  process.exit(1)
})
