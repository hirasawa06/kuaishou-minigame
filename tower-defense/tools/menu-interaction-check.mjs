import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package')
const listeners = {}
const rect = (x, y, w, h) => ({ x, y, w, h })
const ui = {
  interactiveRect: rect(0, 140, 414, 688),
  menu: {
    avatar: rect(12, 140, 85, 87),
    stamina: rect(100, 159, 150, 48),
    settings: rect(328, 140, 78, 87),
    rank: rect(12, 237, 87, 90),
    start: rect(68, 735, 277, 91),
    panelAction: rect(144, 530, 126, 42),
  },
  btnRect(kind) { return kind === 'menu' ? this.menu.start : rect(100, 400, 180, 54) },
}
const state = { phase: 'menu', menuPanel: null, menuSoundEnabled: true }
let starts = 0
const soundChanges = []
const sandbox = {
  console,
  AIGCUtils: {
    Config: { cardCount: 4 },
    State: state,
    Layout: { w: 414, h: 896, ui },
    Game: { start() { starts++ } },
    GameAudio: { setEnabled(value) { soundChanges.push(value) } },
  },
}
sandbox.window = sandbox
vm.runInContext(fs.readFileSync(path.join(root, 'gameplay/input.js'), 'utf8'), vm.createContext(sandbox))
const canvas = {
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 414, height: 896 }),
  addEventListener(name, handler) { listeners[name] = handler },
}
sandbox.AIGCUtils.Input.bind(canvas)

function tap(x, y) {
  const event = { clientX: x, clientY: y }
  listeners.mousedown(event)
  listeners.mouseup(event)
}
function assert(ok, message) { if (!ok) throw new Error(message) }

tap(350, 180)
assert(state.menuPanel === 'settings', '设置面板未打开')
tap(207, 550)
assert(state.menuSoundEnabled === false && soundChanges[0] === false, '音效开关未生效')
tap(207, 550)
assert(state.menuSoundEnabled === true && soundChanges[1] === true, '音效未恢复')
tap(350, 180)
assert(state.menuPanel === null, '面板未关闭')
tap(44, 275)
assert(state.menuPanel === 'rank', '排行榜说明未打开')
tap(200, 800)
assert(starts === 0 && state.menuPanel === null, '弹层下的开始按钮被误触')
tap(50, 180)
assert(state.menuPanel === 'avatar', '头像入口未响应')
tap(200, 600)
tap(150, 180)
assert(state.menuPanel === 'stamina', '体力入口未响应')
tap(200, 600)
tap(200, 80)
assert(starts === 0, '安全区外触发了交互')
tap(200, 780)
assert(starts === 1, '开始按钮未触发')
console.log('menu interactions: ok')
