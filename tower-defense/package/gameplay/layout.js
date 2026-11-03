/* gameplay/layout.js — 竖屏布局计算（HUD / 战场 / 基地 / 卡牌托盘） */
(function () {
  var A = window.AIGCUtils;
  var L = A.Layout;
  var C = A.Config;

  var ui = { ready: false };

  function calc() {
    var w = L.w || C.designW;
    var h = L.h || C.designH;
    var st = L.safeTop || 0;
    if (ui.ready && ui.w === w && ui.h === h && ui.safeTop === st) return ui;

    var pad = Math.round(Math.max(10, Math.min(22, w * 0.033)));
    var trayH = Math.round(Math.max(196, Math.min(232, h * 0.236)));
    var hudH = 76;
    var fieldTop = st + hudH;
    var fieldBottom = h - trayH;
    var fieldW = w - Math.round(pad * 1.2);
    var field = {
      x: Math.round((w - fieldW) / 2),
      y: fieldTop,
      w: fieldW,
      h: fieldBottom - fieldTop,
    };

    var baseH = Math.round(Math.min(58, field.h * 0.1));
    var base = { x: field.x, y: field.y + field.h - baseH, w: field.w, h: baseH };

    var tray = { x: 0, y: fieldBottom, w: w, h: h - fieldBottom };
    var energyBar = { x: pad, y: tray.y + 12, w: w - pad * 2, h: 20 };

    var gap = Math.round(Math.max(7, Math.min(11, w * 0.022)));
    var cardTop = tray.y + 52;
    var cardsArea = {
      x: pad,
      y: cardTop,
      w: w - pad * 2,
      h: trayH - 52 - 34,
    };
    var cardW = (cardsArea.w - gap * (C.cardCount - 1)) / C.cardCount;
    var cardH = cardsArea.h;

    ui.w = w;
    ui.h = h;
    ui.safeTop = st;
    ui.pad = pad;
    ui.hudH = hudH;
    ui.hud = { x: 0, y: st, w: w, h: hudH };
    ui.field = field;
    ui.base = base;
    ui.baseStopY = base.y + Math.round(baseH * 0.16);
    ui.tray = tray;
    ui.trayH = trayH;
    ui.energyBar = energyBar;
    ui.cards = cardsArea;
    ui.cardW = cardW;
    ui.cardH = cardH;
    ui.cardGap = gap;
    ui.lanes = [
      field.x + field.w * 0.2,
      field.x + field.w * 0.5,
      field.x + field.w * 0.8,
    ];
    ui.spawnY = field.y - 30;
    ui.placeTop = field.y + Math.round(field.h * 0.05);
    ui.placeBottom = base.y - Math.round(baseH * 0.5);
    ui.placeLeft = field.x + 26;
    ui.placeRight = field.x + field.w - 26;
    ui.pauseBtn = { x: w - pad - 44, y: Math.max(st, 0) + 30, w: 44, h: 44 };
    // 主按钮几何：按钮实际绘制在 h*btnY 处，点击判定复用同一份数据
    ui.btnW = 184;
    ui.btnH = 54;
    ui.btnY = {
      menu: h * 0.63,
      paused: h * 0.60,
      result: h * 0.64,
    };
    ui.btnRect = function (kind) {
      var y = ui.btnY[kind];
      return { x: w * 0.5 - ui.btnW / 2, y: y, w: ui.btnW, h: ui.btnH };
    };
    ui.overlayBtn = ui.btnRect('menu');
    ui.ready = true;
    return ui;
  }

  L.calc = calc;
  L.ui = ui;

  // 卡牌槽位几何
  L.cardRect = function (i) {
    var u = L.ui;
    return {
      x: u.cards.x + i * (u.cardW + u.cardGap),
      y: u.cards.y,
      w: u.cardW,
      h: u.cardH,
    };
  };
})();
