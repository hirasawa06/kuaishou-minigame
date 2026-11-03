/* gameplay/layout.js — 竖屏布局计算（HUD / 战场 / 基地 / 卡牌托盘） */
(function () {
  var A = window.AIGCUtils;
  var L = A.Layout;
  var C = A.Config;

  var ui = { ready: false };
  var TOP_GAP = 32;
  var PLATFORM_H = 64;

  function finite(v, fallback) {
    return typeof v === 'number' && isFinite(v) ? v : fallback;
  }

  function systemMetrics(w, h) {
    var info = {};
    if (typeof KwaiBase !== 'undefined' && KwaiBase.getSystemInfo) {
      try { info = KwaiBase.getSystemInfo() || {}; } catch (e) { info = {}; }
    }
    var preview = window.__safeAreaPreview || null;
    var safe = info.safeArea || {};
    var systemTop = Math.max(0, finite(safe.top,
      finite(info.statusBarHeight, preview ? preview.top : (L.safeTop || 0))));
    var safeLeft = Math.max(0, finite(safe.left, preview ? (preview.left || 0) : 0));
    var safeRight = Math.min(w, finite(safe.right,
      preview && preview.rightInset ? w - preview.rightInset : w));
    var safeBottom = Math.min(h, finite(safe.bottom,
      preview && preview.bottomInset ? h - preview.bottomInset : h));
    if (safeRight <= safeLeft) { safeLeft = 0; safeRight = w; }
    if (safeBottom <= systemTop) safeBottom = h;
    return {
      systemTop: systemTop,
      safeLeft: safeLeft,
      safeRight: safeRight,
      safeBottom: safeBottom,
      bottomInset: Math.max(0, h - safeBottom),
      platform: info.platform || 'unknown',
    };
  }

  function calc() {
    var w = L.w || C.designW;
    var h = L.h || C.designH;
    var metrics = systemMetrics(w, h);
    var st = metrics.systemTop;
    // 以下边界仅约束可点击内容和命中区；全屏背景使用 L.w / L.h 绘制。
    var contentTop = st + TOP_GAP + PLATFORM_H;
    var contentBottom = metrics.safeBottom;
    var contentH = Math.max(1, contentBottom - contentTop);
    var adaptationError = contentH < 322;
    var metricKey = [w, h, st, metrics.safeLeft, metrics.safeRight, contentBottom].join(':');
    if (ui.ready && ui.metricKey === metricKey) return ui;

    var pad = Math.round(Math.max(10, Math.min(22, w * 0.033)));
    var hudH = adaptationError ? Math.max(1, Math.floor(contentH * 0.22)) : 76;
    var trayH = adaptationError
      ? Math.max(1, contentH - hudH - Math.max(1, Math.floor(contentH * 0.43)))
      : Math.round(Math.max(176, Math.min(232, contentH * 0.27)));
    if (!adaptationError) {
      var maxTrayH = Math.max(138, contentH - hudH - 180);
      trayH = Math.min(trayH, maxTrayH);
    }
    var fieldTop = contentTop + hudH;
    var fieldBottom = contentBottom - trayH;
    var safeW = metrics.safeRight - metrics.safeLeft;
    var fieldW = safeW - Math.round(pad * 1.2);
    var field = {
      x: Math.round(metrics.safeLeft + (safeW - fieldW) / 2),
      y: fieldTop,
      w: fieldW,
      h: fieldBottom - fieldTop,
    };

    var baseH = Math.round(Math.min(58, field.h * 0.1));
    var base = { x: field.x, y: field.y + field.h - baseH, w: field.w, h: baseH };

    var tray = { x: 0, y: fieldBottom, w: w, h: contentBottom - fieldBottom };
    var energyBar = {
      x: metrics.safeLeft + pad,
      y: tray.y + 12,
      w: safeW - pad * 2,
      h: 20,
    };

    var gap = Math.round(Math.max(7, Math.min(11, w * 0.022)));
    var cardTopOffset = Math.min(52, Math.max(28, Math.round(trayH * 0.24)));
    var cardFooter = Math.min(34, Math.max(20, Math.round(trayH * 0.16)));
    var cardTop = tray.y + cardTopOffset;
    var cardsArea = {
      x: metrics.safeLeft + pad,
      y: cardTop,
      w: safeW - pad * 2,
      h: Math.max(1, trayH - cardTopOffset - cardFooter),
    };
    var cardW = (cardsArea.w - gap * (C.cardCount - 1)) / C.cardCount;
    var cardH = cardsArea.h;

    ui.w = w;
    ui.h = h;
    ui.metricKey = metricKey;
    ui.safeTop = st;
    ui.sourceSafeTop = L.safeTop || 0;
    ui.systemTop = st;
    ui.safeLeft = metrics.safeLeft;
    ui.safeRight = metrics.safeRight;
    ui.safeBottom = contentBottom;
    ui.bottomInset = metrics.bottomInset;
    ui.platform = metrics.platform;
    ui.platformBand = { x: 0, y: st + TOP_GAP, w: w, h: PLATFORM_H };
    ui.contentTop = contentTop;
    ui.contentBottom = contentBottom;
    ui.contentH = contentH;
    // 唯一的交互边界：渲染层可使用整屏，输入层必须先通过这里。
    ui.interactiveRect = { x: metrics.safeLeft, y: contentTop, w: safeW, h: contentH };
    ui.adaptationError = adaptationError;
    ui.pad = pad;
    ui.hudH = hudH;
    ui.hud = { x: metrics.safeLeft, y: contentTop, w: safeW, h: hudH };
    ui.field = field;
    ui.base = base;
    ui.baseStopY = base.y + Math.round(baseH * 0.16);
    ui.tray = tray;
    ui.trayH = trayH;
    ui.cardTopOffset = cardTopOffset;
    ui.cardFooter = cardFooter;
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
    ui.pauseBtn = {
      x: metrics.safeRight - pad - 44,
      y: contentTop + Math.round((hudH - 44) / 2),
      w: 44,
      h: 44,
    };
    // 主按钮几何：按钮实际绘制在 h*btnY 处，点击判定复用同一份数据
    ui.btnW = 184;
    ui.btnH = 54;
    ui.btnY = {
      menu: Math.min(contentBottom - 78, contentTop + contentH * 0.63),
      paused: Math.min(contentBottom - 78, contentTop + contentH * 0.60),
      result: Math.min(contentBottom - 78, contentTop + contentH * 0.64),
    };
    ui.btnRect = function (kind) {
      var y = ui.btnY[kind];
      return { x: metrics.safeLeft + (safeW - ui.btnW) / 2, y: y, w: ui.btnW, h: ui.btnH };
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
