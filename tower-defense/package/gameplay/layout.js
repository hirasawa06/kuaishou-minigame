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

    // ── 商店托盘：金币条 + 两块功能按钮 + 4 格英雄卡池 ──
    var shopTop = tray.y + Math.max(8, Math.round(trayH * 0.045));
    var headH = Math.max(26, Math.round(trayH * 0.14));
    var goldBar = {
      x: metrics.safeLeft + pad,
      y: shopTop,
      w: Math.round(safeW * 0.44),
      h: headH,
    };
    var btnGap = Math.round(Math.max(6, pad * 0.55));
    var btnW2 = Math.round((safeW - pad * 2 - btnGap) / 2);
    ui.shopBtnH = headH;
    ui.refreshBtn = {
      x: metrics.safeLeft + pad,
      y: goldBar.y + headH + 6,
      w: btnW2,
      h: headH,
    };
    ui.capBtn = {
      x: ui.refreshBtn.x + btnW2 + btnGap,
      y: ui.refreshBtn.y,
      w: safeW - pad * 2 - btnW2 - btnGap,
      h: headH,
    };
    var gridTop = ui.refreshBtn.y + headH + 10;
    var cardGap2 = Math.round(Math.max(6, pad * 0.6));
    var gridW = safeW - pad * 2;
    var cellW = Math.round((gridW - cardGap2) / 2);
    // 底部留一行提示的位置，2 行卡片均分剩余高度
    var shopFooter = 24;
    var cellH = Math.max(44, Math.round((contentBottom - shopFooter - gridTop - cardGap2) / 2));
    ui.goldBar = goldBar;
    ui.shop = {
      x: metrics.safeLeft + pad,
      y: gridTop,
      w: gridW,
      h: cellH * 2 + cardGap2,
      cellW: cellW,
      cellH: cellH,
      gap: cardGap2,
      cols: 2,
      footer: shopFooter,
    };
    // 卡池 4 格（2×2），供绘制与命中共用
    L.shopRect = function (i) {
      var s = ui.shop;
      var col = i % s.cols;
      var row = (i - col) / s.cols;
      return {
        x: s.x + col * (s.cellW + s.gap),
        y: s.y + row * (s.cellH + s.gap),
        w: s.cellW,
        h: s.cellH,
      };
    };
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
    // ── Figma 首页：以 390×845 原图坐标映射，所有热区进入安全区 ──
    var figmaScale = Math.min(safeW / 390, contentH / (691.66 - 45.77));
    var figmaX = metrics.safeLeft + (safeW - 390 * figmaScale) / 2;
    var figmaY = contentTop - 45.77 * figmaScale;
    function figmaRect(x, y, width, height) {
      return { x: figmaX + x * figmaScale, y: figmaY + y * figmaScale,
        w: width * figmaScale, h: height * figmaScale };
    }
    ui.menuArtwork = { x: figmaX, y: figmaY, w: 390 * figmaScale,
      h: 845 * figmaScale, scale: figmaScale };
    var mTop = contentTop;
    var mH = contentH;
    var av = Math.round(Math.max(46, Math.min(66, safeW * 0.15)));
    ui.menu = {
      avatar: { x: metrics.safeLeft + pad, y: mTop + 6, w: av, h: av },
      stamina: {
        x: metrics.safeLeft + pad + av + 10,
        y: mTop + 12,
        w: Math.min(180, safeW - av - pad * 2 - 10),
        h: Math.round(av * 0.46),
      },
      settings: {
        x: metrics.safeRight - pad - 62,
        y: mTop + 8,
        w: 62,
        h: 62,
      },
      rank: {
        x: metrics.safeLeft + pad,
        y: mTop + av + 14,
        w: 62,
        h: 62,
      },
      banner: {
        x: metrics.safeLeft + pad,
        y: mTop + Math.round(Math.max(96, mH * 0.185)),
        h: 56,
      },
      card: {
        x: metrics.safeLeft + pad,
        y: 0, // 依赖 banner，下面计算
        h: 0,
      },
      start: { w: Math.round(Math.min(300, safeW - pad * 2)), h: 66 },
    };
    ui.menu.banner.w = safeW - pad * 2;
    ui.menu.card.w = safeW - pad * 2;
    ui.menu.card.y = ui.menu.banner.y + ui.menu.banner.h + 10;
    var startY = Math.min(contentBottom - 26 - ui.menu.start.h, ui.menu.card.y + Math.round(mH * 0.52));
    ui.menu.card.h = Math.max(120, startY - ui.menu.card.y - 14);
    ui.menu.start.x = metrics.safeLeft + (safeW - ui.menu.start.w) / 2;
    ui.menu.start.y = startY;
    ui.menu.avatar = figmaRect(11.44, 45.77, 80.56, 82.4);
    ui.menu.stamina = figmaRect(93.84, 63.17, 141.9, 45.78);
    ui.menu.settings = figmaRect(308.98, 45.77, 73.24, 82.4);
    ui.menu.rank = figmaRect(10.99, 137.32, 82.4, 84.68);
    ui.menu.banner = figmaRect(8.24, 244.89, 373.06, 64.09);
    ui.menu.card = figmaRect(8.24, 308.98, 373.06, 286.09);
    ui.menu.start = figmaRect(64.08, 606.06, 260.92, 85.6);
    var panelW = Math.min(300, safeW - pad * 2);
    var panelH = Math.min(210, contentH * 0.45);
    ui.menu.panel = { x: metrics.safeLeft + (safeW - panelW) / 2,
      y: contentTop + (contentH - panelH) / 2, w: panelW, h: panelH };
    ui.menu.panelAction = { x: ui.menu.panel.x + (panelW - 126) / 2,
      y: ui.menu.panel.y + panelH - 60, w: 126, h: 42 };

    ui.btnRect = function (kind) {
      if (kind === 'menu') return ui.menu.start;
      if (kind === 'shopRefresh') return ui.refreshBtn;
      if (kind === 'shopCap') return ui.capBtn;
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
