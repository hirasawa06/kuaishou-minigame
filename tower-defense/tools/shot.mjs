#!/usr/bin/env node
/**
 * shot.mjs — 用 Chrome DevTools Protocol 驱动真实浏览器验证渲染与拖拽
 *
 * 用法：node tools/shot.mjs [--out /tmp/tdshot] [--port 8099]
 * 前置：已用 scaffold-preview.mjs 起好本地服务。
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const args = process.argv.slice(2)
const outDir = args[args.indexOf('--out') + 1] || '/tmp/tdshot'
const port = Number(args[args.indexOf('--port') + 1]) || 8099
const debugPort = 9333
fs.mkdirSync(outDir, { recursive: true })

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const profile = '/tmp/tdcdp-' + Date.now()

const chrome = spawn(CHROME, [
  '--headless=new',
  '--enable-unsafe-swiftshader',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--hide-scrollbars',
  '--window-size=500,1050',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`,
  `http://localhost:${port}/index.html`,
], { stdio: ['ignore', 'ignore', 'ignore'] })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json/list`)
      const list = await res.json()
      const page = list.find((t) => t.type === 'page' && t.url.includes('index.html'))
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
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

async function connect(url) {
  ws = new WebSocket(url)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error)))
      else p.resolve(msg.result)
    }
  }
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Log.enable')
}

const logs = []
function hookLogs() {
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ')
      logs.push(`[${msg.params.type}] ${text}`)
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      logs.push('[exception] ' + JSON.stringify(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text))
    }
    if (msg.method === 'Log.entryAdded') {
      logs.push(`[log:${msg.params.entry.level}] ${msg.params.entry.text}`)
    }
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
    var r=window.canvas.getBoundingClientRect();
    return {x:Math.round(r.left), y:Math.round(r.top), w:Math.round(r.width), h:Math.round(r.height)}
  })()`)
  const res = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: box.x, y: Math.max(0, box.y), width: box.w, height: box.h, scale: 1 },
  })
  const file = path.join(outDir, name + '.png')
  fs.writeFileSync(file, Buffer.from(res.data, 'base64'))
  return file
}

async function touch(type, x, y) {
  // touchEnd 也要告知引擎手指位置：先发一点再抬起，兼容 changedTouches[0]
  if (type === 'touchEnd') {
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x, y, id: 1 }] })
    return
  }
  await send('Input.dispatchTouchEvent', { type, touchPoints: [{ x, y, id: 1 }] })
}

// 布局坐标 -> 视口坐标（H5 预览里画布是居中的，快手真机无需换算）
async function toViewport(x, y) {
  const r = await evaluate(`(function(){var r=window.canvas.getBoundingClientRect();return {l:r.left,t:r.top,w:r.width,h:r.height}})()`)
  const L = await evaluate(`(function(){var l=AIGCUtils.Layout;return {w:l.w,h:l.h}})()`)
  return { x: r.l + x * (r.w / L.w), y: r.t + y * (r.h / L.h) }
}

async function tap(x, y) {
  await touch('touchStart', x, y)
  await sleep(60)
  await touch('touchEnd', x, y)
  await sleep(120)
}

async function drag(lx1, ly1, lx2, ly2, steps = 12) {
  const a = await toViewport(lx1, ly1)
  const b = await toViewport(lx2, ly2)
  await touch('touchStart', a.x, a.y)
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    await touch('touchMove', a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)
    await sleep(16)
  }
  await touch('touchEnd', b.x, b.y)
  await sleep(120)
}

const results = []
function record(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`)
}

async function main() {
  const url = await getTarget()
  await connect(url)
  hookLogs()
  await sleep(1800)

  // 1) 菜单
  const menu = await evaluate(`(function(){var A=window.AIGCUtils;return {phase:A.State.phase,w:A.Layout.w,h:A.Layout.h,ui:A.Layout.ui.ready}})()`)
  record('boot -> menu', menu.phase === 'menu', JSON.stringify(menu))
  await shot('01-menu')

  // 2) 点开始
  const btn = await evaluate(`(function(){var b=AIGCUtils.Layout.ui.btnRect('menu');return {x:b.x+b.w/2,y:b.y+b.h/2}})()`)
  { const v = await toViewport(btn.x, btn.y); await tap(v.x, v.y) }
  await sleep(300)
  const playing = await evaluate(`AIGCUtils.State.phase`)
  record('start -> playing', playing === 'playing', playing)
  await shot('02-start')

  // 3) 拖一张完整可见的卡到战场（传送带会滚动，取当前几何）
  const geo = await evaluate(`(function(){
    var A=window.AIGCUtils, u=A.Layout.ui;
    var pick=null;
    for (var i=0;i<A.State.slots.length;i++){
      var s=A.State.slots[i];
      if (u.cards.x+s.x >= u.cards.x && u.cards.x+s.x+u.cardW <= u.cards.x+u.cards.w) { pick=s; break; }
    }
    if (!pick) return null;
    return {cardX:u.cards.x+pick.x+u.cardW/2, cardY:u.cards.y+u.cardH/2,
            cardId:pick.cardId,
            fieldX:u.field.x+u.field.w*0.5, fieldY:u.field.y+u.field.h*0.55,
            slots:A.State.slots.map(function(x){return [x.cardId, Math.round(x.x)]})}
  })()`)
  if (!geo) throw new Error('传送带上没有完整可见的卡牌')
  await drag(geo.cardX, geo.cardY, geo.fieldX, geo.fieldY)
  const afterDeploy = await evaluate(`(function(){var S=AIGCUtils.State;return {units:S.units.length, energy:+S.energy.toFixed(1), placed:S.cardsPlaced}})()`)
  record('drag card -> deploy', afterDeploy.units === 1, JSON.stringify(afterDeploy))
  await shot('03-placed')

  // 4) 左右滑动丢卡
  await sleep(300)
  const beforeSwipe = await evaluate(`(function(){
    var A=window.AIGCUtils,u=A.Layout.ui;
    var pick=null;
    for (var i=0;i<A.State.slots.length;i++){
      var s=A.State.slots[i];
      if (u.cards.x+s.x >= u.cards.x && u.cards.x+s.x+u.cardW <= u.cards.x+u.cards.w) { pick=s; break; }
    }
    return pick ? {x:u.cards.x+pick.x+u.cardW/2, y:u.cards.y+u.cardH/2, uid:pick.uid, n:A.State.slots.length} : null;
  })()`)
  await drag(beforeSwipe.x, beforeSwipe.y, beforeSwipe.x + 130, beforeSwipe.y + 4, 10)
  const afterDiscard = await evaluate(`(function(){
    var S=AIGCUtils.State;
    return {gone: !S.slots.some(function(s){return s.uid===${beforeSwipe.uid}}), n:S.slots.length};
  })()`)
  record('swipe -> discard', afterDiscard.gone, JSON.stringify(afterDiscard))
  await shot('04-discarded')

  // 4.5) 传送带必须自己滚动
  const scroll = await evaluate(`(function(){
    var S=AIGCUtils.State;
    window.__x0 = S.slots.map(function(s){return s.x});
    return window.__x0;
  })()`)
  await sleep(1200)
  const scroll2 = await evaluate(`(function(){
    var S=AIGCUtils.State;
    return S.slots.map(function(s){return s.x});
  })()`)
  const moved = scroll2.some((x, i) => typeof scroll[i] === 'number' && Math.abs(x - scroll[i]) > 3)
  record('cards keep scrolling', moved, JSON.stringify({before: scroll.map(Math.round), after: scroll2.map(Math.round)}))

  // 5) 快进战斗：直接推进战斗状态机
  await evaluate(`(function(){
    var A=window.AIGCUtils, S=A.State, u=A.Layout.ui;
    S.energy = 10;
    var picks = ['tank-a','war-a','arch-a','mage-a','tank-b','war-b','arch-b','mage-b'];
    for (var i=0;i<8;i++){
      var def = S.cardById(picks[i]);
      S.energy = 10;
      A.Battle.tryDeploy(def, u.field.x + u.field.w*(0.2+0.08*i), u.field.y + u.field.h*(0.55 + (i%3)*0.12));
    }
    S.waveTimer = 0;
    return S.units.length;
  })()`)
  await sleep(6000)
  const mid = await evaluate(`(function(){var S=AIGCUtils.State;return {phase:S.phase,wave:S.waveIndex+1,enemies:S.enemies.length,kills:S.kills,baseHp:Math.round(S.baseHp),units:S.units.length}})()`)
  record('wave spawns enemies', mid.enemies > 0 || mid.kills > 0, JSON.stringify(mid))
  await shot('05-battle')

  await sleep(5000)
  await shot('06-battle2')

  // 6) 暂停
  const pb = await evaluate(`(function(){var p=AIGCUtils.Layout.ui.pauseBtn;return {x:p.x+p.w/2,y:p.y+p.h/2}})()`)
  { const v = await toViewport(pb.x, pb.y); await tap(v.x, v.y) }
  await sleep(200)
  const paused = await evaluate(`AIGCUtils.State.phase`)
  record('pause button', paused === 'paused', paused)
  await shot('07-paused')

  // 暂停页的"重新开始"按钮
  const restart = await evaluate(`(function(){var b=AIGCUtils.Layout.ui.btnRect('paused');return {x:b.x+b.w/2,y:b.y+b.h/2}})()`)
  { const v = await toViewport(restart.x, restart.y); await tap(v.x, v.y) }
  await sleep(300)
  const afterRestart = await evaluate(`(function(){var S=AIGCUtils.State;return {phase:S.phase, wave:S.waveIndex+1, units:S.units.length}})()`)
  record('restart from pause', afterRestart.phase === 'playing' && afterRestart.wave === 1, JSON.stringify(afterRestart))
  await shot('07b-restarted')

  // 7) 结算画面
  await evaluate(`(function(){AIGCUtils.State.phase='win';return 1})()`)
  await sleep(400)
  await shot('08-win')

  // 7.5) 精灵图自检：用独立的 rAF 循环持续绘制，避免被主循环覆盖
  await evaluate(`(function(){
    var A=window.AIGCUtils;
    window.__probeOn = true;
    var names=Object.keys(A.SpriteAtlas.icons);
    function paint(){
      if(!window.__probeOn) return;
      var D = A.Render.draw;
      A.Render.beginFrame([0.05,0.05,0.08]);
      for (var i=0;i<names.length;i++){
        var sp = A.Assets.sprite(names[i]);
        var x = 24 + (i%4)*96, y = 40 + Math.floor(i/4)*96;
        D.texture(sp.tex, sp.texW, sp.texH, sp.x, sp.y, sp.w, sp.h, x, y, 72, 72, {r:1,g:1,b:1,a:1});
        D.text(names[i], x - 4, y + 76, 18, D.color('#9db0d4'), 0);
      }
      A.Render.endFrame();
      requestAnimationFrame(paint);
    }
    requestAnimationFrame(paint);
    return 1;
  })()`)
  await sleep(600)
  await shot('09-icon-probe')
  await evaluate(`(function(){window.__probeOn = false; return 1})()`)

  // 8) 性能与状态
  const perf = await evaluate(`(function(){var S=AIGCUtils.State;return {quads:AIGCUtils.Render.stats.quads, flushes:AIGCUtils.Render.stats.flushes}})()`)
  record('render stats', perf.quads > 0, JSON.stringify(perf))
  const spr = await evaluate(`(function(){
    var A=window.AIGCUtils;
    var sp=A.Assets.sprite('unit-war-1');
    return {has:!!sp, texKeys:Object.keys(A.Assets ? {a:1} : {}),
      spritesEntry: !!(A.Assets.entry && A.Assets.entry('game')),
      entrySize: A.Assets.entry('game') ? [A.Assets.entry('game').w, A.Assets.entry('game').h] : null,
      sp: sp && [sp.x,sp.y,sp.w,sp.h]}
  })()`)
  record('sprite atlas available', !!(spr && spr.has && spr.entrySize), JSON.stringify(spr))

  const audioErrs = logs.filter((l) => /NotAllowedError/.test(l))
  if (audioErrs.length) {
    const when = await evaluate(`(function(){return {sfxEnabled: (window.KwaiMedia && KwaiMedia.Audio) ? 'has' : 'none', inited: !!(AIGCUtils.GameAudio), warmCount: window.__warmCount||0}})()`)
    console.log('audio err context:', JSON.stringify(when), 'count', audioErrs.length)
  }
  const bad = logs.filter((l) => /exception|\[error\]/.test(l) && !/NotAllowedError/.test(l))
  record('no runtime errors', bad.length === 0, bad.slice(0, 3).join(' | '))

  console.log('\n截图目录:', outDir)
  if (logs.length) console.log('控制台日志:\n' + logs.slice(-12).join('\n'))
  const failed = results.filter((r) => !r.ok).length
  console.log(`\n${results.length - failed}/${results.length} 通过`)
}

main()
  .catch((e) => {
    console.error('运行失败:', e.message)
    if (logs.length) console.log(logs.slice(-10).join('\n'))
    process.exitCode = 1
  })
  .finally(() => {
    try { ws && ws.close() } catch {}
    chrome.kill('SIGKILL')
  })
