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
    // Stamina now opens the rewarded recovery panel; no rank entry.
    stamina: rect(100, 140, 150, 48),
    settings: rect(328, 140, 78, 87),
    collection: rect(12, 237, 78, 90),
    start: rect(68, 735, 277, 91),
    card: rect(9, 423, 396, 305),
    levelPrev: rect(18, 535, 44, 44),
    levelNext: rect(352, 535, 44, 44),
    panelAction: rect(144, 530, 126, 42),
  },
  btnRect(kind) { return kind === 'menu' ? this.menu.start : rect(100, 400, 180, 54) },
}
const state = { phase: 'menu', menuPanel: null, menuSoundEnabled: true,
  menuPressed: null, menuFeedback: null, menuStartDelay: 0, selectedLevel: 1, menuSlide: null }
let starts = 0
let openPanel = null
const selections = []
let unlocked = true
const sandbox = {
  console,
  AIGCUtils: {
    Config: { cardCount: 4, LEVELS: Array(10).fill({}) },
    State: state,
    Layout: { w: 414, h: 896, ui },
    Game: { start() { starts++ }, selectLevel(delta, offset) { selections.push({ delta, offset }) } },
    Profile: { isLevelUnlocked() { return unlocked } },
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
assert(!Object.prototype.hasOwnProperty.call(ui.menu, 'rank'), '首页不应保留排行榜布局入口')
tap(44, 275)
assert(openPanel === 'collection' && state.menuFeedback.key === 'collection', '左侧收藏入口未响应')
tap(200, 800)
assert(starts === 0 && state.menuStartDelay === 0 && openPanel === null, '弹层下的开始按钮被误触')
tap(50, 180)
assert(openPanel === 'avatars' && state.menuFeedback.key === 'avatar', '头像应直接打开选择弹窗并响应点击反馈')
tap(200, 600)
listeners.mousedown({ clientX: 150, clientY: 160 })
assert(state.menuPressed === 'stamina', '体力条缺少按下反馈')
listeners.mouseup({ clientX: 150, clientY: 160 })
assert(openPanel === 'stamina' && state.menuFeedback.key === 'stamina', '体力恢复面板未打开')
tap(200, 600)
assert(openPanel === null, '体力面板弹层未关闭')
tap(200, 80)
assert(starts === 0, '安全区外触发了交互')
tap(36, 557)
assert(selections.length === 0, '首关左箭头应禁用')
tap(375, 557)
assert(selections.length === 1 && selections[0].delta === 1, '右箭头未切换相邻关')
tap(210, 525)
assert(selections.length === 1 && state.menuStartDelay === 0, '轻点卡面不应开战')
listeners.mousedown({ clientX: 280, clientY: 525 })
listeners.mousemove({ clientX: 200, clientY: 526 })
assert(state.menuSwipe.x === 200, '卡片未跟手')
listeners.mouseup({ clientX: 200, clientY: 526 })
assert(selections.length === 2 && selections[1].delta === 1, '横滑未切换相邻关')
unlocked = false
tap(200, 780)
assert(state.menuStartDelay === 0, '锁定关开始按钮不应可点')
unlocked = true
tap(200, 780)
assert(state.menuStartDelay === 0.18 && state.menuFeedback.key === 'start', '开始按钮未进入反馈阶段')
assert(starts === 0, '开始按钮在反馈完成前进入战斗')
console.log('menu interactions: ok')
