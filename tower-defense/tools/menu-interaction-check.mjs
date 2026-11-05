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
const state = { phase: 'menu', menuPanel: null, menuSoundEnabled: true,
  menuPressed: null, menuFeedback: null, menuStartDelay: 0 }
let starts = 0
let openPanel = null
const sandbox = {
  console,
  AIGCUtils: {
    Config: { cardCount: 4 },
    State: state,
    Layout: { w: 414, h: 896, ui },
    Game: { start() { starts++ } },
    ProfileUI: {
      isOpen() { return openPanel !== null },
      open(name) { openPanel = name },
      handleTap() { openPanel = null },
    },
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

listeners.mousedown({ clientX: 350, clientY: 180 })
assert(state.menuPressed === 'settings', '设置按钮按下时缺少高亮状态')
listeners.mouseup({ clientX: 350, clientY: 180 })
assert(openPanel === 'settings', '个人中心设置面板未打开')
assert(state.menuFeedback.key === 'settings', '设置按钮缺少点击反馈')
tap(207, 550)
assert(openPanel === null, '个人中心弹窗未关闭')
tap(44, 275)
assert(openPanel === 'rank', '排行榜未打开')
tap(200, 800)
assert(starts === 0 && openPanel === null, '弹层下的开始按钮被误触')
tap(50, 180)
assert(openPanel === 'profile', '头像入口未响应')
tap(200, 600)
tap(150, 180)
assert(state.menuPanel === 'stamina', '体力入口未响应')
tap(200, 600)
tap(200, 80)
assert(starts === 0, '安全区外触发了交互')
tap(200, 780)
assert(state.menuStartDelay === 0.18 && state.menuFeedback.key === 'start', '开始按钮未进入反馈阶段')
assert(starts === 0, '开始按钮在反馈完成前进入战斗')
console.log('menu interactions: ok')
