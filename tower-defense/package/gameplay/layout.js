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
    var hudH = adaptationError ? Math.max(1, Math.floor(contentH * 0.16)) : 52;
    var trayH = adaptationError
      ? Math.max(1, contentH - hudH - Math.max(1, Math.floor(contentH * 0.43)))
      : Math.round(Math.max(272, Math.min(304, contentH * 0.38)));
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
    var headH = Math.max(36, Math.round(trayH * 0.14));
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
    L.shopCardParts = function (i, drawnRect) {
      var r = drawnRect || L.shopRect(i);
      var inset = Math.max(4, Math.min(7, Math.round(r.h * 0.08)));
      var portraitW = Math.min(48, r.h - inset * 2, Math.round(r.w * 0.29));
      var portrait = { x: r.x + inset, y: r.y + inset,
        w: portraitW, h: r.h - inset * 2 };
      var costR = Math.max(10, Math.min(14, Math.round(r.h * 0.18)));
      var cost = { x: r.x + r.w - inset - costR,
        y: r.y + inset + costR, r: costR };
      var lockSize = Math.max(16, Math.min(24, Math.round(r.h * 0.31)));
      var lock = { x: r.x + r.w - inset - lockSize,
        y: r.y + r.h - inset - lockSize, w: lockSize, h: lockSize };
      return { rect: r, inset: inset, portrait: portrait,
        textX: portrait.x + portrait.w + 7, cost: cost, lock: lock };
    };
    L.shopLockRect = function (i) {
      var parts = L.shopCardParts(i);
      var r = parts.rect;
      var size = Math.min(32, r.h - parts.inset * 2);
      return { x: r.x + r.w - parts.inset - size,
        y: r.y + r.h - parts.inset - size,
        w: size, h: size };
    };
    L.shopDragRect = function (i, x, y, startX, startY) {
      var base = L.shopRect(i);
      // 保留按下点在原卡片内的相对位置；拖动时同一点始终对齐触点。
      var gripX = Math.max(0, Math.min(base.w, startX - base.x));
      var gripY = Math.max(0, Math.min(base.h, startY - base.y));
      var w = base.w, h = base.h;
      return {
        x: Math.max(metrics.safeLeft + 4, Math.min(x - gripX, metrics.safeRight - w - 4)),
        y: Math.max(contentTop + 4, Math.min(y - gripY, contentBottom - h - 9)),
        w: w, h: h,
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
    ui.speedBtn = { x: metrics.safeLeft + pad, y: fieldTop + 6, w: 44, h: 44 };
    ui.hudCenterX = metrics.safeLeft + safeW * 0.47;
    // 主按钮几何：按钮实际绘制在 h*btnY 处，点击判定复用同一份数据
    ui.btnW = 184;
    ui.btnH = 54;
    ui.btnY = {
      menu: Math.min(contentBottom - 78, contentTop + contentH * 0.63),
      paused: Math.min(contentBottom - 78, contentTop + contentH * 0.60),
      result: Math.min(contentBottom - 78, contentTop + contentH * 0.64),
    };
    // 暂停面板按标题与四枚按钮的实际高度收拢，避免整图拉伸和底部按钮贴框。
    var pauseCompact = contentH < 540;
    var pausePanelW = Math.min(340, safeW - pad * 2);
    var pauseBtnW = Math.min(260, pausePanelW - 36);
    var pauseBtnH = pauseCompact ? 40 : 48;
    var pauseGap = pauseCompact ? 8 : 12;
    var pauseHeaderH = pauseCompact ? 84 : 110;
    var pauseHeaderGap = pauseCompact ? 18 : 26;
    var pauseBottomPad = pauseCompact ? 20 : 26;
    var pauseList = ['resume', 'settings', 'restart', 'home'];
    var pauseButtonsH = pauseBtnH * pauseList.length + pauseGap * (pauseList.length - 1);
    var pausePanelH = pauseHeaderH + pauseHeaderGap + pauseButtonsH + pauseBottomPad;
    pausePanelH = Math.min(pausePanelH, Math.max(1, contentH - 16));
    var pausePanel = {
      x: metrics.safeLeft + (safeW - pausePanelW) / 2,
      y: contentTop + (contentH - pausePanelH) / 2,
      w: pausePanelW, h: pausePanelH,
    };
    var pauseTop = pausePanel.y + pauseHeaderH + pauseHeaderGap;
    var pauseX = pausePanel.x + (pausePanelW - pauseBtnW) / 2;
    var pauseRects = {};
    for (var pi = 0; pi < pauseList.length; pi++) {
      pauseRects[pauseList[pi]] = {
        x: pauseX,
        y: pauseTop + pi * (pauseBtnH + pauseGap),
        w: pauseBtnW,
        h: pauseBtnH,
      };
    }
    ui.pausePanel = {
      panel: pausePanel, compact: pauseCompact, headerH: pauseHeaderH,
      btn: function (kind) { return pauseRects[kind]; },
    };
    ui.sellZone = { x: metrics.safeLeft + pad, y: contentBottom - 44,
      w: safeW - pad * 2, h: 44 };
    // 结算页使用一张完整的安全区内面板；标题、解锁、战绩、三个按钮顺序排布。
    var resultPanelH = Math.min(620, Math.max(1, contentH - 16));
    var resultPanelW = Math.min(340, safeW - pad * 2);
    var resultPanel = {
      x: metrics.safeLeft + (safeW - resultPanelW) / 2,
      y: contentTop + (contentH - resultPanelH) / 2,
      w: resultPanelW, h: resultPanelH,
    };
    var resultCompact = resultPanelH < 500;
    var resultHeaderH = resultCompact ? 82 : 116;
    var resultBtnH = resultCompact ? 40 : 44;
    var resultGap = resultCompact ? 6 : 8;
    var resultW = Math.min(240, resultPanelW - 36);
    var resultTop = resultPanel.y + resultPanel.h - (resultCompact ? 10 : 16) -
      resultBtnH * 3 - resultGap * 2;
    var resultBtnX = resultPanel.x + (resultPanelW - resultW) / 2;
    ui.resultNext = { x: resultBtnX, y: resultTop, w: resultW, h: resultBtnH };
    // 失败复活复用胜利“下一关”的一行，不增加结算面板高度。
    ui.resultRevive = { x: resultBtnX, y: resultTop, w: resultW, h: resultBtnH };
    ui.resultReplay = { x: resultBtnX, y: resultTop + resultBtnH + resultGap,
      w: resultW, h: resultBtnH };
    ui.resultHome = { x: resultBtnX, y: resultTop + (resultBtnH + resultGap) * 2,
      w: resultW, h: resultBtnH };
    ui.btnY.result = ui.resultReplay.y;
    var resultInfoTop = resultPanel.y + resultHeaderH + 8;
    var resultInfoH = Math.max(1, resultTop - 8 - resultInfoTop);
    var resultNoticeH = resultCompact ? 56 : 78;
    var resultStatsGap = Math.max(18, Math.min(28,
      (resultInfoH - resultNoticeH - 8) / 5));
    var resultGroupH = resultNoticeH + 8 + 5 * resultStatsGap;
    var resultNoticeY = resultInfoTop + Math.max(0, (resultInfoH - resultGroupH) / 2);
    ui.result = {
      panel: resultPanel, compact: resultCompact, headerH: resultHeaderH,
      infoTop: resultInfoTop, infoH: resultInfoH,
      notice: { x: resultPanel.x + 12, y: resultNoticeY,
        w: resultPanel.w - 24, h: resultNoticeH },
      statsY: resultNoticeY + resultNoticeH + 8,
      statsGap: resultStatsGap,
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
    ui.menu = {};
    // 顶部方牌同尺寸；收藏在头像下方同左列，体力与头像顶部对齐。
    var navSize = 78, navMargin = 11.5, navRowGap = 12;
    var navTop = 45.77, navLeft = navMargin, navRight = 390 - navMargin - navSize;
    var navBottom = navTop + navSize + navRowGap;
    ui.menu.avatar = figmaRect(navLeft, navTop, navSize, navSize);
    ui.menu.settings = figmaRect(navRight, navTop, navSize, navSize);
    ui.menu.collection = figmaRect(navLeft, navBottom, navSize, navSize);
    ui.menu.stamina = figmaRect(navLeft + navSize + 10, navTop, 142, 44);
    ui.menu.card = figmaRect(8.24, 258.5, 373.06, 315);
    ui.menu.start = figmaRect(64.08, 606.06, 260.92, 85.6);
    ui.menu.levelPrev = { x: ui.menu.card.x + 8, y: ui.menu.card.y + ui.menu.card.h / 2 - 22, w: 44, h: 44 };
    ui.menu.levelNext = { x: ui.menu.card.x + ui.menu.card.w - 52, y: ui.menu.levelPrev.y, w: 44, h: 44 };
    ui.menu.levelStatus = { x: ui.menu.card.x + 48, y: ui.menu.card.y + ui.menu.card.h - 82,
      w: ui.menu.card.w - 96, h: 78 };

    // ── 设置 / 名片 / 头像 / 昵称 / 邀请 的界面几何 ──
    // 所有弹窗与全屏页都从同一份可交互区域派生：标题栏、按钮、行高都由 contentH 缩放。
    var sheetW = Math.round(Math.min(340, safeW - pad * 2 - 8));
    var sheetX = Math.round(metrics.safeLeft + (safeW - sheetW) / 2);
    // 设置弹窗按内部内容定高；其他资料页继续沿用 rowH 的原尺寸体系。
    var rowH = Math.round(Math.max(68, Math.min(78, contentH * 0.14)));
    var setCompact = contentH < 500;
    var setHead = setCompact ? 64 : 80;
    var setRowH = setCompact ? 56 : 68;
    var setTopGap = setCompact ? 12 : 18;
    var setRowGap = setCompact ? 8 : 12;
    var setShareGap = setCompact ? 12 : 20;
    var setBtnH = setCompact ? 42 : 48;
    var setVersionGap = setCompact ? 10 : 16;
    var setBottomPad = setCompact ? 14 : 18;
    var setH = setHead + setTopGap + setRowH * 2 + setRowGap +
      setShareGap + setBtnH + setVersionGap + 18 + setBottomPad;
    var setY = Math.round(contentTop + (contentH - setH) / 2);
    var setInnerY = setY + setHead + setTopGap;
    var musicRow = { x: sheetX + 14, y: setInnerY, w: sheetW - 28, h: setRowH };
    var sfxRow = { x: musicRow.x, y: musicRow.y + setRowH + setRowGap, w: musicRow.w, h: setRowH };
    var shareBtn = {
      x: musicRow.x,
      y: sfxRow.y + setRowH + setShareGap,
      w: musicRow.w,
      h: setBtnH,
    };
    ui.settings = {
      sheet: { x: sheetX, y: setY, w: sheetW, h: setH },
      head: setHead, compact: setCompact,
      musicRow: musicRow,
      sfxRow: sfxRow,
      shareBtn: shareBtn,
      close: { x: sheetX + sheetW - 44, y: setY + (setHead - 32) / 2, w: 32, h: 32 },
      versionY: shareBtn.y + shareBtn.h + setVersionGap,
    };

    // 体力弹窗：安全区居中，倒计时与广告入口各占独立一行。
    var staminaH = Math.min(300, Math.max(1, contentH - 16));
    var staminaY = contentTop + (contentH - staminaH) / 2;
    var staminaHead = staminaH < 280 ? 64 : 80;
    ui.stamina = {
      sheet: { x: sheetX, y: staminaY, w: sheetW, h: staminaH },
      head: staminaHead,
      close: { x: sheetX + sheetW - 44, y: staminaY + (staminaHead - 32) / 2, w: 32, h: 32 },
      valueY: staminaY + staminaHead + 18,
      timerY: staminaY + staminaHead + 56,
      noteY: staminaY + staminaH - 30,
      ad: { x: sheetX + 20, y: staminaY + staminaH - 94, w: sheetW - 40, h: 48 },
    };

    // 名片：整页卡片，标题带 + 头像 + 昵称 + ID + 两个入口
    var cardH = Math.round(Math.min(470, contentH * 0.78));
    var cardY = contentTop + Math.round(Math.max(14, contentH * 0.16));
    var profHead = Math.round(Math.max(40, rowH * 0.8));
    var avatarSize = Math.round(Math.max(64, Math.min(92, cardH * 0.22)));
    var profRowH = Math.round(Math.max(42, Math.min(52, cardH * 0.12)));
    var profRowX = sheetX + 26;
    var profRowW = sheetW - 52;
    var profAvatar = {
      x: Math.round(sheetX + (sheetW - avatarSize) / 2),
      y: cardY + profHead + Math.round(cardH * 0.06),
      w: avatarSize,
      h: avatarSize,
    };
    var profNameY = profAvatar.y + avatarSize + Math.round(cardH * 0.06);
    var profAvatarBtn = {
      x: profRowX,
      y: profNameY + Math.round(cardH * 0.16),
      w: profRowW,
      h: profRowH,
    };
    var profNickBtn = {
      x: profRowX,
      y: profAvatarBtn.y + profRowH + Math.round(rowH * 0.22),
      w: profRowW,
      h: profRowH,
    };
    ui.profile = {
      card: { x: sheetX, y: cardY, w: sheetW, h: cardH },
      head: profHead,
      close: { x: sheetX + sheetW - 38, y: cardY + 6, w: 32, h: 32 },
      avatar: profAvatar,
      nameY: profNameY,
      idY: profNameY + 36,
      avatarBtn: profAvatarBtn,
      nickBtn: profNickBtn,
    };

    // 选择头像：标题 + 3×3 网格 + 当前名称 + 保存
    var pickH = Math.round(Math.min(452, contentH * 0.76));
    var pickY = contentTop + Math.round(Math.max(16, (contentH - pickH) * 0.28));
    var pickHead = Math.max(38, Math.round(rowH * 0.74));
    var gridPad = 18;
    var subLineY = pickY + pickHead + 12;
    var gridTop = subLineY + 30;
    var btnH = Math.round(Math.max(38, Math.min(48, pickH * 0.12)));
    var cellMax = Math.floor((sheetW - gridPad * 2 - 2 * 12) / 3);
    var cellSize = Math.round(Math.min(cellMax, (pickH * 0.5) / 3 - 8));
    var cellGap = 12;
    var gridW = cellSize * 3 + cellGap * 2;
    var gridX = Math.round(sheetX + (sheetW - gridW) / 2);
    var pickCurY = gridTop + cellSize * 3 + cellGap * 2 + 12;
    var pickSave = {
      x: sheetX + 22,
      y: Math.round(Math.min(pickY + pickH - btnH - 14, pickCurY + 34)),
      w: sheetW - 44,
      h: btnH,
    };
    ui.avatarPick = {
      sheet: { x: sheetX, y: pickY, w: sheetW, h: pickH },
      head: pickHead,
      close: { x: sheetX + sheetW - 38, y: pickY + 6, w: 32, h: 32 },
      grid: { x: gridX, y: gridTop, cell: cellSize, gap: cellGap, cols: 3, rows: 3 },
      currentY: pickCurY,
      save: pickSave,
      subY: subLineY,
    };
    ui.avatarPick.rect = function (i) {
      var g = ui.avatarPick.grid;
      var col = i % g.cols;
      var row = (i - col) / g.cols;
      return {
        x: g.x + col * (g.cell + g.gap),
        y: g.y + row * (g.cell + g.gap),
        w: g.cell,
        h: g.cell,
      };
    };

    // 修改昵称：输入框 + 计数 + 提示 + 保存
    var nickH = Math.round(Math.min(330, contentH * 0.56));
    var nickY = contentTop + Math.round(Math.max(16, (contentH - nickH) * 0.3));
    var nickHead = Math.max(38, Math.round(rowH * 0.74));
    var nickFieldY = nickY + nickHead + Math.round(nickH * 0.12);
    var nickFieldH = Math.round(Math.max(40, Math.min(50, nickH * 0.17)));
    ui.nickname = {
      sheet: { x: sheetX, y: nickY, w: sheetW, h: nickH },
      head: nickHead,
      close: { x: sheetX + sheetW - 38, y: nickY + 6, w: 32, h: 32 },
      labelY: nickY + nickHead + Math.round(nickH * 0.06),
      field: { x: sheetX + 20, y: nickFieldY, w: sheetW - 40, h: nickFieldH },
      hintY: nickFieldY + nickFieldH + 8,
      save: {
        x: sheetX + 22,
        y: Math.round(Math.min(nickY + nickH - 14 - Math.max(40, nickH * 0.15),
          nickFieldY + nickFieldH + Math.round(nickH * 0.3))),
        w: sheetW - 44,
        h: Math.round(Math.max(40, Math.min(50, nickH * 0.15))),
      },
    };

    // 邀请好友：两只伙伴 + 标题 + 文案 + 复制按钮 + 说明
    var invH = Math.round(Math.min(430, contentH * 0.74));
    var invY = contentTop + Math.round(Math.max(16, (contentH - invH) * 0.24));
    var invHead = Math.max(38, Math.round(rowH * 0.74));
    var invBodyY = invY + invHead + 12;
    var invBodyH = Math.round(invH * 0.38);
    var invTitleY = invBodyY + invBodyH + 8;
    var invSubY = invTitleY + 38;
    var invCopyH = Math.round(Math.max(42, Math.min(50, invH * 0.115)));
    var invCopyY = invSubY + Math.round(invH * 0.1);
    ui.invite = {
      sheet: { x: sheetX, y: invY, w: sheetW, h: invH },
      head: invHead,
      close: { x: sheetX + sheetW - 38, y: invY + 6, w: 32, h: 32 },
      body: { x: sheetX + 24, y: invBodyY, w: sheetW - 48, h: invBodyH },
      titleY: invTitleY,
      subY: invSubY,
      copy: { x: sheetX + 22, y: invCopyY, w: sheetW - 44, h: invCopyH },
      noteY: invCopyY + invCopyH + 12,
    };

    // 英雄收藏：同一立绘，仅星章与数值不同。
    var collectionX = metrics.safeLeft + pad;
    var collectionW = safeW - pad * 2;
    var collectionTop = contentTop + 98;
    var collectionGap = 10;
    var collectionCellW = (collectionW - collectionGap) / 2;
    var collectionCellH = Math.min(150, (contentBottom - 14 - collectionTop - collectionGap * 2) / 3);
    ui.collection = {
      back: { x: collectionX, y: contentTop + 8, w: 44, h: 44 },
      titleY: contentTop + 60,
      rect: function (i) { return { x: collectionX + (i % 2) * (collectionCellW + collectionGap),
        y: collectionTop + Math.floor(i / 2) * (collectionCellH + collectionGap),
        w: collectionCellW, h: collectionCellH }; },
      detailNameY: contentTop + 66,
      forms: function (i) { var fw = collectionW / 3; return {
        x: collectionX + fw * i + 3, y: contentTop + 112,
        w: fw - 6, h: Math.min(340, contentH - 138) }; }
    };
    var tutorialW = safeW - pad * 2;
    ui.tutorial = {
      caption: { x: metrics.safeLeft + pad, y: contentTop + 4, w: tutorialW, h: 96 },
      start: { x: metrics.safeLeft + (safeW - 200) / 2,
        y: Math.min(contentBottom - 48, Math.max(field.y + 104, base.y - 54)), w: 200, h: 48 }
    };

    ui.btnRect = function (kind) {
      if (kind === 'result') return ui.resultReplay;
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
