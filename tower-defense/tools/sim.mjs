#!/usr/bin/env node
/**
 * sim.mjs — 无浏览器玩法仿真
 *
 * 用最小 WebGL / DOM mock 在 Node 里加载全部 gameplay 代码，跑真实主循环，
 * 用脚本化操作验证：能量积攒、拖卡布阵、丢卡、刷怪、结算。
 *
 * 用法：node tools/sim.mjs [--seconds 180] [--seed 1] [--hero-radius-scale 1] [--hero-action-scale 1] [--hero-stat-scale 1] [--base-hp-scale 1] [--assert-bodies] [--verbose]
 */

import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PKG = path.join(ROOT, 'package')

const args = process.argv.slice(2)
const verbose = args.includes('--verbose')
const seconds = Number(args[args.indexOf('--seconds') + 1]) || 180
const seedArg = Number(args[args.indexOf('--seed') + 1])
const heroRadiusScale = Number(args[args.indexOf('--hero-radius-scale') + 1]) || 1
const heroActionScale = Number(args[args.indexOf('--hero-action-scale') + 1]) || 1
const heroStatScale = Number(args[args.indexOf('--hero-stat-scale') + 1]) || 1
const baseHpScale = Number(args[args.indexOf('--base-hp-scale') + 1]) || 1
const assertBodies = args.includes('--assert-bodies')

// 可选固定随机序列：用于比较同一波次与同一卡池下的数值差异。
let random = Math.random
if (Number.isFinite(seedArg)) {
  let state = (seedArg >>> 0) || 1
  random = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}
const sandboxMath = Object.create(Math)
sandboxMath.random = random

// ── 最小 WebGL mock ────────────────────────────────────────────
const GL_ENUM = {
  VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
  ARRAY_BUFFER: 5, ELEMENT_ARRAY_BUFFER: 6, STATIC_DRAW: 7, DYNAMIC_DRAW: 8,
  FLOAT: 9, UNSIGNED_SHORT: 10, UNSIGNED_BYTE: 11, RGBA: 12, TEXTURE_2D: 13,
  TEXTURE_WRAP_S: 14, TEXTURE_WRAP_T: 15, CLAMP_TO_EDGE: 16, TEXTURE_MIN_FILTER: 17,
  TEXTURE_MAG_FILTER: 18, LINEAR: 19, NEAREST: 20, TRIANGLES: 21,
  COLOR_BUFFER_BIT: 22, DEPTH_TEST: 23, CULL_FACE: 24, BLEND: 25,
  SRC_ALPHA: 26, ONE_MINUS_SRC_ALPHA: 27, ONE: 28, TEXTURE0: 29,
  UNPACK_PREMULTIPLY_ALPHA_WEBGL: 30,
}

function makeGL() {
  const gl = {}
  for (const k of Object.keys(GL_ENUM)) gl[k] = GL_ENUM[k]
  const noop = () => {}
  const ret = {
    createShader: () => ({}),
    shaderSource: noop,
    compileShader: noop,
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    createProgram: () => ({}),
    attachShader: noop,
    linkProgram: noop,
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    useProgram: noop,
    getAttribLocation: () => 0,
    getUniformLocation: () => ({}),
    createBuffer: () => ({}),
    bindBuffer: noop,
    bufferData: noop,
    bufferSubData: noop,
    createTexture: () => ({}),
    bindTexture: noop,
    texImage2D: noop,
    texParameteri: noop,
    pixelStorei: noop,
    activeTexture: noop,
    enable: noop,
    disable: noop,
    blendFunc: noop,
    depthMask: noop,
    viewport: noop,
    clearColor: noop,
    clear: noop,
    enableVertexAttribArray: noop,
    vertexAttribPointer: noop,
    drawElements: noop,
    drawArrays: noop,
    uniform1i: noop,
    uniform1f: noop,
    uniform2f: noop,
    uniform4f: noop,
    flush: noop,
    finish: noop,
  }
  Object.assign(gl, ret)
  return gl
}

// ── 沙箱 ───────────────────────────────────────────────────────
const listeners = {}
const canvas = {
  width: 828,
  height: 1792,
  getContext: () => makeGL(),
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 414, height: 896 }),
  addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn) },
  removeEventListener: () => {},
  style: {},
}

const sandbox = {
  console: {
    log: (...a) => { if (verbose) console.log('[game]', ...a) },
    info: () => {},
    warn: (...a) => { if (verbose) console.warn('[warn]', ...a) },
    error: (...a) => console.error('[error]', ...a),
  },
  requestAnimationFrame: (cb) => { sandbox.__raf = cb; return 1 },
  cancelAnimationFrame: () => {},
  setTimeout: (cb) => { const id = setTimeout(cb, 0); return id },
  clearTimeout,
  setInterval: () => 0,
  clearInterval: () => {},
  navigator: { vibrate: () => {}, userAgent: 'node' },
  location: { search: '' },
  performance: { now: () => Number(process.hrtime.bigint() / 1000000n) },
  URLSearchParams,
  Uint16Array,
  Uint8Array,
  Float32Array,
  Math: sandboxMath,
  Date,
  JSON,
  parseInt,
  parseFloat,
  isNaN,
  String,
  Number,
  Array,
  Object,
}
sandbox.window = sandbox
sandbox.globalThis = sandbox
sandbox.devicePixelRatio = 2
sandbox.innerWidth = 414
sandbox.innerHeight = 896
sandbox.document = {
  documentElement: { getAttribute: () => null, setAttribute: () => {}, classList: { add: () => {} } },
  getElementById: () => canvas,
  createElement: () => canvas,
  addEventListener: () => {},
  removeEventListener: () => {},
  body: {},
}
sandbox.canvas = canvas

const ctx = vm.createContext(sandbox)

// 快手侧没有 DOM：这里只加载 gameplay 需要的模块
const FILES = [
  'kwaiStandard/core/aigc-init.js',
  'kwaiOpenApi/kwai-render.js',
  'kwaiOpenApi/kwai-media.js',
  'gameplay/data/font-atlas.js',
  'gameplay/data/sprites.js',
  'gameplay/config.js',
  'gameplay/layout.js',
  'gameplay/state.js',
  'gameplay/profile.js',
  'gameplay/render/gl.js',
  'gameplay/render/draw.js',
  'gameplay/assets.js',
  'gameplay/audio.js',
  'gameplay/play/battle.js',
  'gameplay/input.js',
  'gameplay/render/scene.js',
  'gameplay/render/hud.js',
  'gameplay/game.js',
]

for (const f of FILES) {
  const code = fs.readFileSync(path.join(PKG, f), 'utf8')
  vm.runInContext(code, ctx, { filename: f })
}

const A = sandbox.AIGCUtils

if (baseHpScale !== 1) A.Config.BASE_HP *= baseHpScale
if (heroRadiusScale !== 1) {
  for (const hero of A.Config.HEROES) hero.radius *= heroRadiusScale
}
if (heroActionScale !== 1) {
  for (const hero of A.Config.HEROES) {
    hero.range *= heroActionScale
    if (hero.taunt) hero.taunt *= heroActionScale
    if (hero.aggro) hero.aggro *= heroActionScale
    if (hero.splash) hero.splash *= heroActionScale
  }
}
if (heroStatScale !== 1) {
  for (const hero of A.Config.HEROES) {
    hero.hp *= heroStatScale
    hero.atk *= heroStatScale
  }
}

// 图片加载 mock：直接回调成功，宽高用真实图集尺寸
const imageDims = {
  'font-48.png': [2048, 2048],
  'font-28.png': [512, 2048],
  'font-18.png': [512, 1024],
  'sprites.png': [1056, 2048],
  'home-bg.png': [640, 1400],
}
sandbox.KwaiRender.loadImage = (opts) => {
  const base = (opts.src || '').split('/').pop()
  const d = imageDims[base] || [64, 64]
  opts.onSuccess({ width: d[0], height: d[1], src: opts.src })
}
sandbox.KwaiMedia.Audio.playSfx = () => {}

// 虚拟时钟：每帧推进 1/60 秒，避免依赖真实时间
let clockMs = 0
A._now = () => clockMs
sandbox.AIGCUtils._now = A._now

// ── 运行 ───────────────────────────────────────────────────────
const L = A.Layout
const S = A.State
const step = 1 / 60
let simTime = 0
let frames = 0

A.Game.boot()
console.log('phase after boot:', S.phase, 'layout:', {
  w: L.w, h: L.h, field: L.ui.field, base: L.ui.base,
  tray: L.ui.tray, card: [Math.round(L.ui.cardW), Math.round(L.ui.cardH)],
})

if (S.phase !== 'menu') {
  console.error('启动失败：没有进入 menu，phase =', S.phase)
  process.exit(1)
}

function frames_run(n) {
  for (let i = 0; i < n; i++) {
    clockMs += 1000 / 60
    A.GameLoop.frame()
    if (assertBodies) assertNoBodyOverlap()
    simTime += step
    frames++
  }
}

function assertNoBodyOverlap() {
  const bodies = [
    ...S.units.filter((actor) => !actor.dead),
    ...S.enemies.filter((actor) => !actor.dead),
  ]
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i]
      const b = bodies[j]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const distance = Math.hypot(dx, dy)
      const minimum = a.def.radius + b.def.radius + A.Config.ACTOR_BODY_GAP
      // 0.1 逻辑像素以内只可能来自浮点累计，不会形成可见穿模。
      if (distance + 0.1 < minimum) {
        throw new Error(`角色体积重叠：${a.uid}(${a.def.id}) 与 ${b.uid}(${b.def.id})，距离 ${distance.toFixed(2)} < ${minimum.toFixed(2)}`)
      }
    }
  }
}

frames_run(1)
console.log('menu frame ok, sprites loaded:', !!A.Assets.sprite('enemy-small'))

// 开始游戏（按钮点击链路由 tools/shot.mjs 覆盖，这里直接进玩法）
A.Game.start()
frames_run(1)
console.log('shop:', S.shop.map((x) => x.cardId).join(','), 'gold', S.gold, 'cap', S.heroCap)

// 自动买英雄：按阵容缺口挑卡，买不起就攒；席位满了先扩建
let placed = 0
const report = []
let lastLog = -1
const totalFrames = Math.round(seconds / step)
for (let i = 0; i < totalFrames; i++) {
  clockMs += 1000 / 60
  A.GameLoop.frame()
  if (assertBodies) assertNoBodyOverlap()
  simTime += step
  if (S.phase !== 'playing' && S.phase !== 'paused') break

  if (i % 30 === 0 && S.phase === 'playing') {
    const u = L.ui

    // 阵容缺口：先 2 盾，再补远程，最后近战
    let tanks = 0, melee = 0, ranged = 0
    for (const un of S.units) {
      if (un.dead) continue
      if (un.def.cls === 'tank') tanks++
      else if (un.def.cls === 'warrior') melee++
      else ranged++
    }
    const want = tanks < 2 ? 'tank' : ranged < 4 ? 'ranged' : melee < 2 ? 'warrior' : 'any'

    if (S.liveUnits() >= S.heroCap) {
      S.buyCap()
    } else {
      let pick = null
      for (let k = 0; k < S.shop.length; k++) {
        const slot = S.shop[k]
        if (!slot || slot.sold) continue
        const def = S.heroById(slot.cardId)
        if (!def || S.gold < def.cost) continue
        let score = 0
        if (want === 'tank' && def.cls === 'tank') score += 10
        if (want === 'ranged' && (def.cls === 'archer' || def.cls === 'mage')) score += 10
        if (want === 'warrior' && def.cls === 'warrior') score += 10
        score -= def.cost * 0.5
        if (!pick || score > pick.score) pick = { index: k, def, score }
      }
      let fielded = false
      if (pick) {
        const def = pick.def
        const front = def.cls === 'tank' || def.cls === 'warrior'
        const laneXs = [0.16, 0.36, 0.56, 0.78]
        let bestX = u.field.x + u.field.w * laneXs[0]
        let bestScore = -1
        for (const lx of laneXs) {
          const x = u.field.x + u.field.w * lx
          let crowd = 0
          for (const un of S.units) {
            if (Math.abs(un.x - x) < 40 && Math.abs(un.y - (u.base.y - 60)) < 120) crowd++
          }
          const sc = 1 / (1 + crowd)
          if (sc > bestScore) { bestScore = sc; bestX = x }
        }
        const y = front
          ? u.base.y - 40 - random() * 40
          : u.base.y - 120 - random() * 70
        if (A.Battle.buyCard(pick.index, bestX, y)) {
          placed++
          fielded = true
        }
      }
      // 卡池空了或买不起，就花钱刷新（金币充裕时）
      if (!fielded && S.gold > S.refreshCost + 10) S.refreshShop()
    }
  }

  if (verbose && i % 60 === 0) {
    const ds = S.units.map(u => u.def.name + '@' + u.x.toFixed(0) + ',' + u.y.toFixed(0)).join(' | ')
    const es = S.enemies.map(e => e.def.id + '@' + e.x.toFixed(0) + ',' + e.y.toFixed(0) + ' hp' + Math.round(e.hp)).join(' | ')
    console.log('t=' + (i / 60).toFixed(0), 'U:', ds, '\n   E:', es)
  }
  // 每 10 秒汇报
  const t10 = Math.floor(simTime / 10)
  if (t10 !== lastLog) {
    lastLog = t10
    report.push({
      t: Math.round(simTime),
      phase: S.phase,
      wave: S.waveIndex + 1,
      waveState: S.waveState,
      gold: Math.round(S.gold),
      cap: S.heroCap,
      baseHp: Math.round(S.baseHp),
      units: S.liveUnits(),
      enemies: S.enemies.length,
      kills: S.kills,
    })
  }
}

console.log('\n时间线:')
for (const r of report) {
  console.log(`  t=${String(r.t).padStart(3)}s wave=${r.wave} ${r.waveState.padEnd(9)} gold=${String(r.gold).padStart(4)} cap=${r.cap} base=${String(r.baseHp).padStart(3)} units=${r.units} enemies=${r.enemies} kills=${r.kills}`)
}

console.log('\n结果:', {
  phase: S.phase,
  wave: S.waveIndex + 1,
  kills: S.kills,
  placed,
  cardsPlaced: S.cardsPlaced,
  goldLeft: Math.round(S.gold),
  goldEarned: S.goldEarned,
  cap: S.heroCap,
  baseHp: Math.round(S.baseHp),
  unitsAlive: S.liveUnits(),
  simSeconds: Math.round(simTime),
  frames,
})

// NaN 检查
const bad = []
for (const un of S.units) {
  if (!isFinite(un.x) || !isFinite(un.y) || !isFinite(un.hp)) bad.push(['unit', un.def.name, un.x, un.y, un.hp])
}
for (const e of S.enemies) {
  if (!isFinite(e.x) || !isFinite(e.y) || !isFinite(e.hp)) bad.push(['enemy', e.def.name, e.x, e.y, e.hp])
}
if (bad.length) {
  console.error('数值异常:', bad.slice(0, 5))
  process.exit(1)
}
if (!(S.phase === 'win' || S.phase === 'lose' || simTime > 5)) {
  console.error('仿真提前结束')
  process.exit(1)
}

// 退场姿势结束后才播放烟雾，且只触发一次。
S.reset()
S.waveTimer = 100
S.units.push({ dead: true, dieT: 0.1, animT: 0, x: 120, y: 360,
  def: S.heroById('tank') })
A.Battle.update(0.05)
if (S.units.length !== 1 || S.effects.some((e) => e.type === 'smoke')) {
  console.error('退场姿势结束前出现烟雾')
  process.exit(1)
}
A.Battle.update(0.06)
if (S.units.length !== 0 || S.effects.filter((e) => e.type === 'smoke').length !== 1) {
  console.error('退场姿势结束时未正确播放烟雾')
  process.exit(1)
}
A.Battle.update(0.06)
if (S.effects.filter((e) => e.type === 'smoke').length !== 1) {
  console.error('退场烟雾重复触发')
  process.exit(1)
}
console.log('\nOK')
