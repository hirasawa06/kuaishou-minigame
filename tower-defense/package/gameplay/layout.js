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
    // --- 弹窗统一相对居中位置上移，内部控件由弹窗坐标派生 ---
    var dialogOffsetY = -24;
    var adaptationError = contentH < 322;
    var metricKey = [w, h, st, metrics.safeLeft, metrics.safeRight, contentBottom].join(':');
    if (ui.ready && ui.metricKey === metricKey) return ui;

    var safeW = metrics.safeRight - metrics.safeLeft;
    // ┌──────────────────────────────────────────────────────────────┐
    // │ 战斗页以 Figma 414×896 为唯一基准；横向按安全区等比缩放。     │
    // │ 交互热区与画面共用同一套几何，避免“看着对、点不到”。          │
    // └──────────────────────────────────────────────────────────────┘
    // 779 是 Figma 顶部控件到第二排卡片底部的有效高度。
    // 标准 414×896 不缩放；有刘海/底部安全区时只等比收紧整套战斗 UI。
    var battleScale = Math.min(safeW / 414, Math.max(0.01, (contentH - 0.5) / 779));
    var battleTop = Math.max(contentTop - 96 * battleScale,
      contentBottom - 896 * battleScale);
    var pad = Math.round(Math.max(10, Math.min(22, w * 0.033)));
    var hudH = Math.max(36, 40 * battleScale);
    var fieldTop = Math.max(contentTop + hudH, battleTop + 136 * battleScale);
    var trayY = battleTop + 636 * battleScale;
    // 极短屏幕优先保证 160px 战场和 136px 托盘，正常机型完全命中 Figma 坐标。
    var fieldReserve = adaptationError ? 1 : 160;
    var trayReserve = adaptationError ? 1 : 136;
    trayY = Math.max(fieldTop + fieldReserve, Math.min(trayY, contentBottom - trayReserve));
    var trayH = Math.max(1, contentBottom - trayY);
    var fieldBottom = trayY;
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

    var gap = 12 * battleScale;

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
    ui.battleScale = battleScale;
    ui.battleTop = battleTop;
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
    ui.energyBar = energyBar;
    ui.cardGap = gap;

    // ── Figma 275:246 底部托盘：金币、两个操作键与 2×2 卡池 ──
    var goldBar = {
      x: metrics.safeLeft + 20 * battleScale,
      y: tray.y + 22 * battleScale,
      w: 71 * battleScale,
      h: 38 * battleScale,
    };
    ui.shopBtnH = 48 * battleScale;
    ui.refreshBtn = {
      x: metrics.safeLeft + 160 * battleScale,
      y: tray.y + 18 * battleScale,
      w: 114 * battleScale,
      h: 48 * battleScale,
    };
    ui.capBtn = {
      x: metrics.safeLeft + 286 * battleScale,
      y: tray.y + 18 * battleScale,
      w: 114 * battleScale,
      h: 48 * battleScale,
    };
    ui.goldBar = goldBar;
    ui.shop = {
      x: metrics.safeLeft + 14 * battleScale,
      y: tray.y + 83 * battleScale,
      w: 386 * battleScale,
      h: 156 * battleScale,
      cellW: 187 * battleScale,
      cellH: 72 * battleScale,
      gap: 12 * battleScale,
      cols: 2,
      footer: 0,
    };
    ui.cards = ui.shop;
    ui.cardW = ui.shop.cellW;
    ui.cardH = ui.shop.cellH;
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
      var s = ui.battleScale;
      var portrait = { x: r.x + 3 * s, y: r.y + 3 * s,
        w: 80 * s, h: r.h - 5 * s };
      // ── 锁底板与卡片右下圆角同心，底板自然落在卡内 ──
      var lockCenterX = r.x + r.w - 20 * s;
      var lockCenterY = r.y + r.h - 20 * s;
      var lock = { x: lockCenterX - 9 * s, y: lockCenterY - 12 * s,
        w: 18 * s, h: 24 * s };
      return { rect: r, inset: 2 * s, portrait: portrait,
        textX: r.x + 86 * s,
        cost: { x: r.x + 86 * s, y: r.y + 33 * s, r: 0 }, lock: lock,
        lockBackground: { x: lockCenterX - 18 * s, y: lockCenterY - 18 * s,
          w: 36 * s, h: 36 * s } };
    };
    L.shopLockRect = function (i) {
      var parts = L.shopCardParts(i);
      var r = parts.rect;
      return parts.lock;
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
    ui.wavePlate = { x: metrics.safeLeft + 12 * battleScale,
      y: battleTop + 96 * battleScale, w: 99 * battleScale, h: 40 * battleScale };
    ui.pauseBtn = { x: metrics.safeLeft + 360 * battleScale,
      y: battleTop + 96 * battleScale, w: 40 * battleScale, h: 40 * battleScale };
    ui.speedBtn = ui.wavePlate;
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
    var pauseHeaderH = pauseCompact ? 54 : 62;
    var pauseHeaderGap = 20;
    var pauseBottomPad = 20;
    var pauseList = ['resume', 'settings', 'restart', 'home'];
    var pauseButtonsH = pauseBtnH * pauseList.length + pauseGap * (pauseList.length - 1);
    var pausePanelH = pauseHeaderH + pauseHeaderGap + pauseButtonsH + pauseBottomPad;
    pausePanelH = Math.min(pausePanelH, Math.max(1, contentH - 16));
    var pausePanel = {
      x: metrics.safeLeft + (safeW - pausePanelW) / 2,
      y: contentTop + (contentH - pausePanelH) / 2 + dialogOffsetY,
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
    // ── 结算弹窗：标题、提示和三个按钮按内容收紧，不再预留战绩区 ──
    var resultPanelH = Math.min(340, Math.max(1, contentH - 16));
    var resultPanelW = Math.min(340, safeW - pad * 2);
    var resultPanel = {
      x: metrics.safeLeft + (safeW - resultPanelW) / 2,
      y: contentTop + (contentH - resultPanelH) / 2 + dialogOffsetY,
      w: resultPanelW, h: resultPanelH,
    };
    var resultCompact = resultPanelH < 320;
    var resultHeaderH = resultCompact ? 54 : 62;
    var resultBtnH = resultCompact ? 40 : 48;
    var resultGap = resultCompact ? 8 : 12;
    var resultW = resultPanelW - 44;
    var resultTop = resultPanel.y + resultPanel.h - 20 -
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
    var resultInfoTop = resultPanel.y + resultHeaderH + 20;
    var resultInfoH = Math.max(1, resultTop - 20 - resultInfoTop);
    var resultNoticeH = Math.min(resultCompact ? 56 : 64, resultInfoH);
    var resultNoticeY = resultInfoTop + (resultInfoH - resultNoticeH) / 2;
    ui.result = {
      panel: resultPanel, compact: resultCompact, headerH: resultHeaderH,
      infoTop: resultInfoTop, infoH: resultInfoH,
      notice: { x: resultPanel.x + 12, y: resultNoticeY,
        w: resultPanel.w - 24, h: resultNoticeH },
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
    ui.menu.start = figmaRect(83.649, 612.48, 221.782, 72.76);
    ui.menu.levelPrev = { x: ui.menu.card.x + 8, y: ui.menu.card.y + ui.menu.card.h / 2 - 22, w: 44, h: 44 };
    ui.menu.levelNext = { x: ui.menu.card.x + ui.menu.card.w - 52, y: ui.menu.levelPrev.y, w: 44, h: 44 };
    // ── 容器连续两次缩小15%，文字保持原字号 ──────────────
    var statusBaseW = ui.menu.card.w - 96;
    var statusBaseH = statusBaseW * 319 / 1024;
    var statusScale = 0.85 * 0.85;
    ui.menu.levelStatus = {
      x: ui.menu.card.x + 48 + statusBaseW * (1 - statusScale) / 2,
      y: ui.menu.card.y - statusBaseH * statusScale / 2,
      w: statusBaseW * statusScale, h: statusBaseH * statusScale,
    };

    // ── Boss 动作场：预览区和六枚动作键共用安全区布局 ─────────
    var labW = safeW - pad * 2;
    var labX = metrics.safeLeft + pad;
    var labHeaderH = contentH < 500 ? 42 : 50;
    var labButtonH = contentH < 500 ? 36 : 42;
    var labGap = 8;
    var labRowsH = labButtonH * 2 + labGap;
    var labStageY = contentTop + labHeaderH + 10;
    var labButtonsY = contentBottom - labRowsH;
    var labStageH = Math.max(120, labButtonsY - labStageY - 10);
    var labButtonW = (labW - labGap * 2) / 3;
    var labActions = ['idle', 'move', 'atk', 'aoe', 'hurt', 'die'];
    var labButtons = {};
    for (var li = 0; li < labActions.length; li++) {
      var col = li % 3;
      var row = Math.floor(li / 3);
      labButtons[labActions[li]] = {
        x: labX + col * (labButtonW + labGap),
        y: labButtonsY + row * (labButtonH + labGap),
        w: labButtonW,
        h: labButtonH,
      };
    }
    ui.bossLab = {
      header: { x: labX, y: contentTop, w: labW, h: labHeaderH },
      stage: { x: labX, y: labStageY, w: labW, h: labStageH },
      close: { x: labX + labW - labHeaderH, y: contentTop, w: labHeaderH, h: labHeaderH },
      buttons: labButtons,
    };

    // ── 设置 / 名片 / 头像 / 昵称 / 排行榜 / 邀请 的界面几何 ──
    // 所有弹窗与全屏页都从同一份可交互区域派生：标题栏、按钮、行高都由 contentH 缩放。
    var sheetW = Math.round(Math.min(340, safeW - pad * 2 - 8));
    var sheetX = Math.round(metrics.safeLeft + (safeW - sheetW) / 2);
    // 设置弹窗按内部内容定高；其他资料页继续沿用 rowH 的原尺寸体系。
    var rowH = Math.round(Math.max(68, Math.min(78, contentH * 0.14)));
    var setCompact = contentH < 500;
    var setHead = Math.round(Math.max(40, rowH * 0.8));
    var setRowH = setCompact ? 56 : 68;
    var setTopGap = setCompact ? 12 : 18;
    var setRowGap = setCompact ? 8 : 12;
    var setShareGap = setCompact ? 12 : 20;
    var setBtnH = setCompact ? 42 : 48;
    var setVersionGap = setCompact ? 10 : 16;
    var setBottomPad = setCompact ? 14 : 18;
    var setH = setHead + setTopGap + setRowH * 2 + setRowGap +
      setShareGap + setBtnH + setVersionGap + 18 + setBottomPad;
    var setY = Math.round(contentTop + (contentH - setH) / 2) + dialogOffsetY;
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
      close: { x: sheetX + sheetW - 44, y: setY + 12, w: 32, h: 32 },
      versionY: shareBtn.y + shareBtn.h + setVersionGap,
    };

    // 体力弹窗：安全区居中，倒计时与广告入口各占独立一行。
    var staminaH = Math.min(300, Math.max(1, contentH - 16));
    var staminaY = contentTop + (contentH - staminaH) / 2 + dialogOffsetY;
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

    // 选择头像：标题 + 3×3 网格 + 保存
    var pickHead = Math.round(Math.max(40, rowH * 0.8));
    var gridPad = 18;
    var pickMaxH = Math.round(Math.min(452, contentH - 32));
    var btnH = Math.round(Math.max(38, Math.min(48, pickMaxH * 0.12)));
    var cellMax = Math.floor((sheetW - gridPad * 2 - 2 * 12) / 3);
    var cellGap = 12;
    // ── 标题至头像、头像至按钮、按钮至底边均留20逻辑像素 ──
    var cellSize = Math.floor(Math.min(cellMax,
      (pickMaxH - pickHead - btnH - 60 - cellGap * 2) / 3));
    var pickH = pickHead + cellSize * 3 + cellGap * 2 + btnH + 60;
    var pickY = contentTop + Math.round((contentH - pickH) / 2) + dialogOffsetY;
    var gridTop = pickY + pickHead + 20;
    var gridW = cellSize * 3 + cellGap * 2;
    var gridX = Math.round(sheetX + (sheetW - gridW) / 2);
    var gridBottom = gridTop + cellSize * 3 + cellGap * 2;
    var pickSave = {
      x: sheetX + 22,
      y: gridBottom + 20,
      w: sheetW - 44,
      h: btnH,
    };
    ui.avatarPick = {
      sheet: { x: sheetX, y: pickY, w: sheetW, h: pickH },
      head: pickHead,
      close: { x: sheetX + sheetW - 44, y: pickY + 12, w: 32, h: 32 },
      grid: { x: gridX, y: gridTop, cell: cellSize, gap: cellGap, cols: 3, rows: 3 },
      save: pickSave,
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

    // 邀请好友：图片区、主标题、按钮统一间距，弹窗按内容收紧
    var invMaxH = Math.min(360, contentH - 32);
    var invHead = Math.round(Math.max(40, rowH * 0.8));
    var invGap = Math.round(Math.max(8, Math.min(20, invMaxH * 0.06)));
    var invCopyH = 44;
    var invBodyH = Math.round(Math.max(32, Math.min(140,
      invMaxH - invHead - 36 - invCopyH - invGap * 4)));
    var invH = invHead + invBodyH + 36 + invCopyH + invGap * 4;
    var invY = contentTop + Math.round((contentH - invH) / 2) + dialogOffsetY;
    var invBodyY = invY + invHead + invGap;
    var invTitleY = invBodyY + invBodyH + invGap;
    var invCopyY = invTitleY + 36 + invGap;
    ui.invite = {
      sheet: { x: sheetX, y: invY, w: sheetW, h: invH },
      head: invHead,
      close: { x: sheetX + sheetW - 44, y: invY + 12, w: 32, h: 32 },
      body: { x: sheetX + 24, y: invBodyY, w: sheetW - 48, h: invBodyH },
      titleY: invTitleY,
      copy: { x: sheetX + 22, y: invCopyY, w: sheetW - 44, h: invCopyH },
    };

    // ┌─ 萌宠收藏：Figma 263:161 的固定竖卡比例，网格从可用高度反推宽度 ─┐
    var collectionX = metrics.safeLeft + Math.max(pad, safeW * 0.11);
    var collectionW = safeW - (collectionX - metrics.safeLeft) * 2;
    var collectionTop = contentTop + 80;
    var collectionGap = 12;
    var collectionAspect = 329.521 / 502.404;
    var collectionCellH = Math.min(200, (contentBottom - 64 - collectionTop - collectionGap * 2) / 3);
    var collectionCellW = collectionCellH * collectionAspect;
    var collectionMaxW = (safeW - pad * 2 - collectionGap) / 2;
    if (collectionCellW > collectionMaxW) {
      collectionCellW = collectionMaxW;
      collectionCellH = collectionCellW / collectionAspect;
    }
    var collectionGridW = collectionCellW * 2 + collectionGap;
    var collectionGridX = metrics.safeLeft + (safeW - collectionGridW) / 2;
    ui.collection = {
      back: { x: collectionX, y: contentTop + 8, w: 44, h: 44 },
      titleY: contentTop + 16,
      countX: collectionX + collectionW - 2,
      rect: function (i) { return { x: collectionGridX + (i % 2) * (collectionCellW + collectionGap),
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
