#!/usr/bin/env node
/**
 * profile-shot.mjs — 个人中心相关界面的截图与冒烟用例
 *
 * 用法：node tools/profile-shot.mjs [--port 8099] [--out /tmp/tdprofile]
 * 前置：已用本地静态服务指向 package/。
 *
 * 覆盖：首页头像 → 我的名片 → 选择头像 → 保存；设置开关 + 邀请；收藏。
 * 排行榜及地区切换用例已随入口取消而删除；体力仅展示，不再覆盖体力弹窗。
 * 本脚本会启动浏览器；仅在另行获准做 H5 检查时执行。
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const args = process.argv.slice(2)
const port = Number(args[args.indexOf('--port') + 1]) || 8137
const outDir = args[args.indexOf('--out') + 1] || '/tmp/tdprofile'
const debugPort = 9341
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
  `--user-data-dir=/tmp/tdprofile-${Date.now()}`,
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

async function toViewport(x, y) {
  return evaluate(`(function(){
    var c = window.canvas, L = AIGCUtils.Layout;
    var r = c.getBoundingClientRect();
    return { x: r.left + ${x} * (r.width / L.w), y: r.top + ${y} * (r.height / L.h) };
  })()`)
}

async function tapLog(expr) {
  const p = await evaluate(`(function(){ var r = ${expr}; return r; })()`)
  const v = await toViewport(p.x + (p.w || 0) / 2, p.y + (p.h || 0) / 2)
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', {
      type, x: v.x, y: v.y, button: 'left', clickCount: 1,
    })
  }
  await sleep(200)
}

async function main() {
  ws = new WebSocket(await getTarget())
  ws.binaryType = 'arraybuffer'
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
    if ((ready && (phase === 'menu' || phase === 'error'))) break
    await sleep(250)
  }
  const phase = await evaluate('AIGCUtils.State.phase')
  const errors = await evaluate('AIGCUtils.State.assetErrors ? AIGCUtils.State.assetErrors : []')
  console.log('phase:', phase, 'assets:', JSON.stringify(errors))
  await shot('01-menu')

  // 首页头像 → 我的名片
  await tapLog('AIGCUtils.Layout.ui.menu.avatar')
  console.log('open:', await evaluate('AIGCUtils.ProfileUI.top()'))
  await shot('02-profile')

  // 选择头像
  await tapLog('AIGCUtils.Layout.ui.profile.avatarBtn')
  await shot('03-avatars')
  await tapLog('AIGCUtils.Layout.ui.avatarPick.rect(4)')
  await tapLog('AIGCUtils.Layout.ui.avatarPick.save')
  console.log('avatarIndex:', await evaluate('AIGCUtils.Profile.data.avatarIndex'))

  // 修改昵称
  await tapLog('AIGCUtils.Layout.ui.profile.nickBtn')
  console.log('nickname editor:', await evaluate('AIGCUtils.ProfileUI.top()'))
  await shot('04-nickname')

  // 回首页 → 设置
  await tapLog('AIGCUtils.Layout.ui.nickname.close')
  await tapLog('AIGCUtils.Layout.ui.profile.close')
  await tapLog('AIGCUtils.Layout.ui.menu.settings')
  await shot('05-settings')

  // 关音乐、开邀请
  await tapLog('AIGCUtils.Layout.ui.settings.musicRow')
  console.log('music:', await evaluate('AIGCUtils.Profile.data.music'))
  await tapLog('AIGCUtils.Layout.ui.settings.shareBtn')
  await shot('06-invite')
  await tapLog('AIGCUtils.Layout.ui.invite.close')
  console.log('back to:', await evaluate('AIGCUtils.ProfileUI.top()'))
  await tapLog('AIGCUtils.Layout.ui.settings.close')

  // 收藏（排行榜 / 地区切换 / 尚未上榜用例已删除）
  await tapLog('AIGCUtils.Layout.ui.menu.collection')
  console.log('collection:', await evaluate('AIGCUtils.ProfileUI.top()'))
  await shot('07-collection')
  await tapLog('AIGCUtils.Layout.ui.collection.back')
  console.log('stack:', JSON.stringify(await evaluate('AIGCUtils.ProfileUI.top()')))

  chrome.kill()
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  chrome.kill()
  process.exit(1)
})
