import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PKG = path.join(HERE, '..', 'package')

function loadLayout({ width, height, safeTop, systemInfo }) {
  const sandbox = {
    console,
    innerWidth: width,
    innerHeight: height,
    devicePixelRatio: 1,
  }
  sandbox.window = sandbox
  sandbox.globalThis = sandbox
  sandbox.AIGCUtils = {
    Layout: { w: width, h: height, safeTop, usableH: height - safeTop },
  }
  if (systemInfo) {
    sandbox.KwaiBase = { getSystemInfo: () => systemInfo }
  }

  const context = vm.createContext(sandbox)
  for (const file of ['gameplay/config.js', 'gameplay/layout.js']) {
    vm.runInContext(fs.readFileSync(path.join(PKG, file), 'utf8'), context, { filename: file })
  }
  return sandbox.AIGCUtils.Layout.calc()
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function check(name, input, expected) {
  const ui = loadLayout(input)
  assert(ui.systemTop === expected.systemTop, `${name}: systemTop ${ui.systemTop}`)
  assert(ui.contentTop === expected.contentTop, `${name}: contentTop ${ui.contentTop}`)
  assert(ui.contentBottom === expected.contentBottom, `${name}: contentBottom ${ui.contentBottom}`)
  assert(ui.platformBand.y >= ui.systemTop + 32, `${name}: platform gap`)
  assert(ui.platformBand.h >= 64, `${name}: platform band height`)
  assert(ui.hud.y >= ui.contentTop, `${name}: HUD entered reserved top area`)
  assert(ui.pauseBtn.y >= ui.contentTop, `${name}: pause button entered reserved top area`)
  assert(ui.pauseBtn.y + ui.pauseBtn.h <= ui.hud.y + ui.hud.h, `${name}: pause button left HUD`)
  assert(ui.cards.y >= ui.contentTop, `${name}: cards above content area`)
  assert(ui.cards.y + ui.cards.h <= ui.contentBottom, `${name}: cards entered bottom safe area`)
  assert(ui.field.y >= ui.hud.y + ui.hud.h, `${name}: field overlaps HUD`)
  assert(ui.field.y + ui.field.h <= ui.tray.y, `${name}: field overlaps tray`)
  console.log(`${name}: ok`, {
    content: [ui.contentTop, ui.contentBottom],
    field: [ui.field.y, ui.field.h],
    tray: [ui.tray.y, ui.tray.h],
  })
}

check('iOS portrait', {
  width: 414,
  height: 896,
  safeTop: 44,
  systemInfo: {
    platform: 'ios',
    windowWidth: 414,
    windowHeight: 896,
    safeArea: { left: 0, right: 414, top: 44, bottom: 828, width: 414, height: 784 },
  },
}, { systemTop: 44, contentTop: 140, contentBottom: 828 })

check('Android portrait', {
  width: 414,
  height: 896,
  safeTop: 40,
  systemInfo: {
    platform: 'android',
    windowWidth: 414,
    windowHeight: 896,
    safeArea: { left: 0, right: 414, top: 40, bottom: 896, width: 414, height: 856 },
  },
}, { systemTop: 40, contentTop: 136, contentBottom: 896 })

check('H5 conservative fallback', {
  width: 414,
  height: 896,
  safeTop: 0,
}, { systemTop: 0, contentTop: 96, contentBottom: 896 })

check('narrow Android portrait', {
  width: 360,
  height: 780,
  safeTop: 35,
  systemInfo: {
    platform: 'android',
    windowWidth: 360,
    windowHeight: 780,
    safeArea: { left: 0, right: 360, top: 35, bottom: 780, width: 360, height: 745 },
  },
}, { systemTop: 35, contentTop: 131, contentBottom: 780 })

check('tall iOS portrait', {
  width: 430,
  height: 932,
  safeTop: 47,
  systemInfo: {
    platform: 'ios',
    windowWidth: 430,
    windowHeight: 932,
    safeArea: { left: 0, right: 430, top: 47, bottom: 898, width: 430, height: 851 },
  },
}, { systemTop: 47, contentTop: 143, contentBottom: 898 })

check('short iOS portrait', {
  width: 320,
  height: 568,
  safeTop: 24,
  systemInfo: {
    platform: 'ios',
    windowWidth: 320,
    windowHeight: 568,
    safeArea: { left: 0, right: 320, top: 24, bottom: 548, width: 320, height: 524 },
  },
}, { systemTop: 24, contentTop: 120, contentBottom: 548 })

const extreme = loadLayout({
  width: 320,
  height: 300,
  safeTop: 20,
  systemInfo: {
    platform: 'ios',
    windowWidth: 320,
    windowHeight: 300,
    safeArea: { left: 0, right: 320, top: 20, bottom: 280, width: 320, height: 260 },
  },
})
assert(extreme.adaptationError === true, 'extreme short: missing adaptation defect flag')
assert(extreme.field.h > 0 && extreme.tray.h > 0 && extreme.cards.h > 0,
  'extreme short: negative or zero layout region')
console.log('extreme short defect flag: ok')
