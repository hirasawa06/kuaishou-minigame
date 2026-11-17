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
  const layout = sandbox.AIGCUtils.Layout
  const ui = layout.calc()
  ui.checkShopParts = Array.from({ length: 4 }, (_, i) => layout.shopCardParts(i))
  ui.checkShopLockRects = Array.from({ length: 4 }, (_, i) => layout.shopLockRect(i))
  ui.checkShopDragRects = [
    layout.shopDragRect(0, 0, ui.tray.y, ui.shop.x + 16, ui.shop.y + 16),
    layout.shopDragRect(1, width, ui.tray.y, ui.shop.x + ui.shop.cellW + ui.shop.gap + 16, ui.shop.y + 16),
    layout.shopDragRect(2, 0, ui.contentBottom, ui.shop.x + 16, ui.shop.y + ui.shop.cellH + ui.shop.gap + 16),
    layout.shopDragRect(3, width, ui.contentBottom, ui.shop.x + ui.shop.cellW + ui.shop.gap + 16,
      ui.shop.y + ui.shop.cellH + ui.shop.gap + 16),
  ]
  const startCard = layout.shopRect(0)
  ui.checkShopGrip = layout.shopDragRect(0, ui.shop.x + 86, ui.shop.y + 28,
    startCard.x + 30, startCard.y + 20)
  return ui
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function check(name, input, expected) {
  const ui = loadLayout(input)
  assert(ui.systemTop === expected.systemTop, `${name}: systemTop ${ui.systemTop}`)
  assert(ui.contentTop === expected.contentTop, `${name}: contentTop ${ui.contentTop}`)
  assert(ui.contentBottom === expected.contentBottom, `${name}: contentBottom ${ui.contentBottom}`)
  assert(ui.interactiveRect.x === ui.safeLeft && ui.interactiveRect.y === ui.contentTop, `${name}: interactive origin`)
  assert(ui.interactiveRect.x + ui.interactiveRect.w === ui.safeRight, `${name}: interactive right edge`)
  assert(ui.interactiveRect.y + ui.interactiveRect.h === ui.contentBottom, `${name}: interactive bottom edge`)
  assert(ui.platformBand.y >= ui.systemTop + 32, `${name}: platform gap`)
  assert(ui.platformBand.h >= 64, `${name}: platform band height`)
  assert(ui.hud.y >= ui.contentTop, `${name}: HUD entered reserved top area`)
  assert(ui.pauseBtn.y >= ui.contentTop, `${name}: pause button entered reserved top area`)
  assert(ui.pauseBtn.y + ui.pauseBtn.h <= ui.hud.y + ui.hud.h, `${name}: pause button left HUD`)
  assert(ui.cards.y >= ui.contentTop, `${name}: cards above content area`)
  assert(ui.cards.y + ui.cards.h <= ui.contentBottom, `${name}: cards entered bottom safe area`)
  assert(ui.field.y >= ui.hud.y + ui.hud.h, `${name}: field overlaps HUD`)
  assert(ui.field.y + ui.field.h <= ui.tray.y, `${name}: field overlaps tray`)
  const pause = ui.pausePanel.panel
  assert(pause.x >= ui.safeLeft && pause.x + pause.w <= ui.safeRight &&
    pause.y >= ui.contentTop && pause.y + pause.h <= ui.contentBottom,
  `${name}: pause panel outside interactive area`)
  let previousPauseButton = null
  for (const key of ['resume', 'settings', 'restart', 'home']) {
    const button = ui.pausePanel.btn(key)
    assert(button.x >= pause.x + 12 && button.x + button.w <= pause.x + pause.w - 12 &&
      button.y >= pause.y + ui.pausePanel.headerH &&
      button.y + button.h <= pause.y + pause.h - 12,
    `${name}: pause ${key} button outside panel`)
    if (previousPauseButton) assert(button.y >= previousPauseButton.y + previousPauseButton.h + 6,
      `${name}: pause buttons overlap`)
    previousPauseButton = button
  }
  const rp = ui.result.panel
  assert(rp.x >= ui.safeLeft && rp.x + rp.w <= ui.safeRight &&
    rp.y >= ui.contentTop && rp.y + rp.h <= ui.contentBottom,
  `${name}: result panel outside interactive area`)
  for (const button of [ui.resultNext, ui.resultReplay, ui.resultHome]) {
    assert(button.x >= rp.x + 8 && button.x + button.w <= rp.x + rp.w - 8 &&
      button.y >= rp.y + 8 && button.y + button.h <= rp.y + rp.h - 8,
    `${name}: result button outside panel`)
  }
  const notice = ui.result.notice
  assert(notice.x >= rp.x + 8 && notice.x + notice.w <= rp.x + rp.w - 8 &&
    notice.y >= rp.y + ui.result.headerH && notice.y + notice.h <= ui.resultNext.y - 8,
  `${name}: unlock notice outside result content`)
  assert(ui.result.statsY + ui.result.statsGap * 5 <= ui.resultNext.y,
    `${name}: result stats overlap buttons`)
  for (const kind of ['menu', 'paused', 'result']) {
    const button = ui.btnRect(kind)
    assert(button.x >= ui.safeLeft && button.x + button.w <= ui.safeRight, `${name}: ${kind} button outside safe width`)
    assert(button.y >= ui.contentTop && button.y + button.h <= ui.contentBottom, `${name}: ${kind} button outside safe height`)
  }
  assert(!Object.prototype.hasOwnProperty.call(ui.menu, 'rank'), `${name}: removed rank entry still has a layout rect`)
  // stamina is a display rect, not a button; it still must remain in the safe area.
  for (const key of ['avatar', 'stamina', 'settings', 'collection', 'start']) {
    const rect = ui.menu[key]
    assert(rect && [rect.x, rect.y, rect.w, rect.h].every(Number.isFinite) && rect.w > 0 && rect.h > 0,
      `${name}: menu ${key} missing or invalid rect`)
    assert(rect.x >= ui.safeLeft - 0.01 && rect.x + rect.w <= ui.safeRight + 0.01,
      `${name}: menu ${key} outside safe width`)
    assert(rect.y >= ui.contentTop - 0.01 && rect.y + rect.h <= ui.contentBottom + 0.01,
      `${name}: menu ${key} outside safe height`)
  }
  const settings = ui.settings
  const sheet = settings.sheet
  assert(sheet.x >= ui.safeLeft && sheet.x + sheet.w <= ui.safeRight &&
    sheet.y >= ui.contentTop && sheet.y + sheet.h <= ui.contentBottom,
  `${name}: settings sheet outside interactive area`)
  for (const control of [settings.close, settings.musicRow, settings.sfxRow, settings.shareBtn]) {
    assert(control.x >= sheet.x + 6 && control.x + control.w <= sheet.x + sheet.w - 6 &&
      control.y >= sheet.y + 6 && control.y + control.h <= sheet.y + sheet.h - 6,
    `${name}: settings control outside sheet`)
  }
  assert(settings.musicRow.y >= sheet.y + settings.head + 8 &&
    settings.sfxRow.y >= settings.musicRow.y + settings.musicRow.h + 8 &&
    settings.shareBtn.y >= settings.sfxRow.y + settings.sfxRow.h + 10 &&
    settings.versionY >= settings.shareBtn.y + settings.shareBtn.h + 8 &&
    settings.versionY + 18 <= sheet.y + sheet.h - 10,
  `${name}: settings rows or version overlap`)
  const m = ui.menu
  const close = (a, b) => Math.abs(a - b) < 0.01
  // The avatar/stamina group no longer shares the old four-button grid.
  for (const key of ['avatar', 'settings', 'collection']) {
    assert(close(m[key].w, m[key].h), `${name}: ${key} is not square`)
  }
  assert(close(m.settings.w, m.collection.w) && close(m.settings.h, m.collection.h),
    `${name}: settings and collection button sizes differ`)
  const topItems = ['avatar', 'stamina', 'settings', 'collection']
  for (const [index, key] of topItems.entries()) {
    const a = m[key]
    assert(a.y + a.h < m.card.y, `${name}: ${key} overlaps chapter card`)
    for (const other of topItems.slice(index + 1)) {
      const b = m[other]
      assert(a.x + a.w <= b.x + 0.01 || b.x + b.w <= a.x + 0.01 ||
        a.y + a.h <= b.y + 0.01 || b.y + b.h <= a.y + 0.01,
      `${name}: ${key} overlaps ${other}`)
    }
  }
  for (const [index, part] of ui.checkShopParts.entries()) {
    const r = part.rect
    const p = part.portrait
    const c = part.cost
    const l = part.lock
    assert(r.x >= ui.safeLeft && r.x + r.w <= ui.safeRight &&
      r.y >= ui.contentTop && r.y + r.h <= ui.contentBottom,
    `${name}: shop card outside interactive area`)
    assert(p.x >= r.x && p.y >= r.y && p.x + p.w <= r.x + r.w && p.y + p.h <= r.y + r.h,
    `${name}: portrait outside shop card`)
    assert(c.x - c.r >= r.x && c.x + c.r <= r.x + r.w &&
      c.y - c.r >= r.y && c.y + c.r <= r.y + r.h,
    `${name}: cost badge outside shop card`)
    assert(l.x >= r.x && l.y >= r.y && l.x + l.w <= r.x + r.w && l.y + l.h <= r.y + r.h,
    `${name}: lock button outside shop card`)
    const hit = ui.checkShopLockRects[index]
    assert(hit.x >= r.x && hit.y >= r.y && hit.x + hit.w <= r.x + r.w && hit.y + hit.h <= r.y + r.h,
    `${name}: lock hit target outside shop card`)
    assert(hit.x <= l.x && hit.y <= l.y && hit.x + hit.w >= l.x + l.w && hit.y + hit.h >= l.y + l.h,
    `${name}: lock hit target misses visual button`)
    assert(part.textX > p.x + p.w && part.textX < c.x - c.r,
    `${name}: shop card title has no space`)
    assert(part.textX + 8 < l.x,
    `${name}: shop card attribute has no space before lock button`)
  }
  for (const ghost of ui.checkShopDragRects) {
    assert(ghost.x >= ui.safeLeft && ghost.x + ghost.w <= ui.safeRight &&
      ghost.y >= ui.contentTop && ghost.y + ghost.h + 5 <= ui.contentBottom,
    `${name}: floating shop card or shadow outside interactive area`)
  }
  assert(Math.abs(ui.checkShopGrip.x + 30 - (ui.shop.x + 86)) < 0.01 &&
    Math.abs(ui.checkShopGrip.y + 20 - (ui.shop.y + 28)) < 0.01,
  `${name}: floating card no longer follows the touched point`)
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
