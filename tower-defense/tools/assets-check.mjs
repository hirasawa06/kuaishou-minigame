import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ASSETS_FILE = path.join(HERE, '..', 'package', 'gameplay', 'assets.js')

function makeGl(textureMode) {
  return {
    TEXTURE_2D: 1,
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: 2,
    RGBA: 3,
    UNSIGNED_BYTE: 4,
    TEXTURE_WRAP_S: 5,
    TEXTURE_WRAP_T: 6,
    CLAMP_TO_EDGE: 7,
    TEXTURE_MIN_FILTER: 8,
    TEXTURE_MAG_FILTER: 9,
    LINEAR: 10,
    createTexture() {
      if (textureMode === 'null') return null
      return {}
    },
    bindTexture() {},
    pixelStorei() {},
    texImage2D() {
      if (textureMode === 'throw') throw new Error('upload failed')
    },
    texParameteri() {},
  }
}

function createHarness(textureMode = 'ok') {
  const requests = []
  const timers = []
  const sandbox = {
    console,
    setTimeout(callback) { timers.push(callback) },
    KwaiRender: { loadImage: (options) => requests.push(options) },
    AIGCUtils: {
      FontAtlas: { 18: { src: 'font-18.png' } },
      GameAtlas: { src: 'game.png', icons: {} },
      SpriteAtlas: { icons: {} },
      Render: {
        gl: makeGl(textureMode),
        invalidateTexture() {},
      },
    },
  }
  sandbox.window = sandbox
  const context = vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(path.join(HERE, '..', 'package', 'gameplay', 'config.js'), 'utf8'), context)
  vm.runInContext(fs.readFileSync(ASSETS_FILE, 'utf8'), context, {
    filename: 'gameplay/assets.js',
  })
  return { sandbox, requests, timers }
}

function complete(mode, textureMode) {
  const harness = createHarness(textureMode)
  let result = null
  harness.sandbox.AIGCUtils.Assets.init((value) => { result = value })
  let next = 0
  while (next < harness.requests.length || harness.timers.length) {
    while (next < harness.requests.length) {
      const request = harness.requests[next++]
      if (mode === '404') request.onFail(new Error(`404 ${request.src}`))
      else request.onSuccess({ width: 64, height: 64, src: request.src })
    }
    while (harness.timers.length) harness.timers.shift()()
  }
  return { result, harness }
}

const failed = complete('404').result
const expectedCount = complete('success').harness.requests.length
if (!failed || failed.ok !== false || failed.failed.length !== expectedCount) {
  throw new Error(`404 未被阻断：${JSON.stringify(failed)}`)
}
console.log('asset failure gate: ok', failed.failed.map((item) => item.key))

for (const mode of ['null', 'throw']) {
  const upload = complete('success', mode).result
  if (!upload || upload.ok !== false || upload.failed.length !== expectedCount) {
    throw new Error(`纹理上传失败未被阻断 (${mode})：${JSON.stringify(upload)}`)
  }
}
console.log('texture upload gate: ok')

const successHarness = createHarness('ok')
function runSuccessRound() {
  successHarness.requests.length = 0
  let result = null
  successHarness.sandbox.AIGCUtils.Assets.init((value) => { result = value })
  for (const request of successHarness.requests) {
    request.onSuccess({ width: 64, height: 64, src: request.src })
  }
  return result
}
const first = runSuccessRound()
const second = runSuccessRound()
if (!first || !first.ok || !second || !second.ok) {
  throw new Error(`成功或重复初始化失败：${JSON.stringify({ first, second })}`)
}
console.log('success and repeated init: ok')

const state = { phase: 'loading', assetErrors: [] }
const gameSandbox = {
  console,
  requestAnimationFrame() {},
  canvas: {},
  AIGCUtils: {
    Config: { designW: 414, designH: 896 },
    State: state,
    Layout: { ui: { ready: true }, calc() {} },
    Scene: {},
    Hud: {},
    Render: {},
  },
}
gameSandbox.window = gameSandbox
vm.runInContext(
  fs.readFileSync(path.join(HERE, '..', 'package', 'gameplay', 'game.js'), 'utf8'),
  vm.createContext(gameSandbox),
  { filename: 'gameplay/game.js' },
)
gameSandbox.AIGCUtils.Game.applyAssetResult(failed)
if (state.phase !== 'error' || state.assetErrors.length !== expectedCount) {
  throw new Error(`游戏未进入资源错误状态：${JSON.stringify(state)}`)
}
console.log('game error phase gate: ok')
