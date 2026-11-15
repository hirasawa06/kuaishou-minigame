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
    L.shopLockRect = function (i) {
      var r = L.shopRect(i);
      return { x: r.x + r.w - 46, y: r.y + 2, w: 44, h: 44 };
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
    // 暂停面板：继续 / 设置 / 重新开始 / 返回主页，四行竖排。
    // 面板整体居中，按钮高度按 contentH 缩放，短屏也不会挤出安全区。
    var pauseBtnW = Math.round(Math.min(240, safeW - pad * 4));
    var pauseBtnH = Math.round(Math.max(44, Math.min(52, contentH * 0.062)));
    var pauseGap = Math.round(Math.max(10, Math.min(16, contentH * 0.018)));
    var pauseTitleY = contentTop + Math.round(contentH * 0.2);
    var pauseTop = pauseTitleY + 96;
    var pauseList = ['resume', 'settings', 'restart', 'home'];
    var pauseH = pauseBtnH * pauseList.length + pauseGap * (pauseList.length - 1);
    if (pauseTop + pauseH > contentBottom - 12) {
      pauseTop = Math.max(contentTop + 90, contentBottom - 12 - pauseH);
    }
    var pauseX = Math.round(metrics.safeLeft + (safeW - pauseBtnW) / 2);
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
      titleY: pauseTitleY,
      subY: pauseTitleY + 62,
      w: pauseBtnW,
      h: pauseBtnH,
      gap: pauseGap,
      btn: function (kind) { return pauseRects[kind]; },
    };
    ui.sellZone = { x: metrics.safeLeft + pad, y: contentBottom - 44,
      w: safeW - pad * 2, h: 44 };
    var resultGap = 8;
    var resultW = Math.min(240, safeW - pad * 2);
    var resultTop = contentBottom - 12 - 3 * 44 - 2 * resultGap;
    ui.resultNext = { x: metrics.safeLeft + (safeW - resultW) / 2, y: resultTop, w: resultW, h: 44 };
    ui.btnY.result = resultTop + 44 + resultGap;
    ui.resultHome = { x: ui.resultNext.x, y: resultTop + 2 * (44 + resultGap), w: resultW, h: 44 };
    ui.resultReplay = { x: ui.resultNext.x, y: ui.btnY.result, w: resultW, h: 44 };
    var resultInfoH = Math.max(1, resultTop - contentTop - 12);
    var resultTitleY = contentTop + Math.min(38, resultInfoH * 0.05);
    var noticeH = Math.min(84, resultInfoH * 0.24);
    ui.result = {
      titleY: resultTitleY,
      subY: resultTitleY + 52,
      notice: { x: metrics.safeLeft + pad, y: resultTitleY + 86,
        w: safeW - pad * 2, h: noticeH },
      statsY: resultTitleY + 94 + noticeH,
      statsGap: Math.max(18, Math.min(30, (resultTop - resultTitleY - 102 - noticeH) / 5))
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
    // 顶部四个方牌同尺寸、同列线和同排距；体力胶囊以头像的垂直中心对齐。
    var navSize = 78, navMargin = 11.5, navRowGap = 12;
    var navTop = 45.77, navLeft = navMargin, navRight = 390 - navMargin - navSize;
    var navBottom = navTop + navSize + navRowGap;
    ui.menu.avatar = figmaRect(navLeft, navTop, navSize, navSize);
    ui.menu.settings = figmaRect(navRight, navTop, navSize, navSize);
    ui.menu.rank = figmaRect(navLeft, navBottom, navSize, navSize);
    ui.menu.collection = figmaRect(navRight, navBottom, navSize, navSize);
    ui.menu.stamina = figmaRect(navLeft + navSize + 10,
      navTop + (navSize - 44) / 2, 142, 44);
    ui.menu.card = figmaRect(8.24, 258.5, 373.06, 315);
    ui.menu.start = figmaRect(64.08, 606.06, 260.92, 85.6);
    ui.menu.levelPrev = { x: ui.menu.card.x + 8, y: ui.menu.card.y + ui.menu.card.h / 2 - 22, w: 44, h: 44 };
    ui.menu.levelNext = { x: ui.menu.card.x + ui.menu.card.w - 52, y: ui.menu.levelPrev.y, w: 44, h: 44 };
    ui.menu.levelStatus = { x: ui.menu.card.x + 48, y: ui.menu.card.y + ui.menu.card.h - 82,
      w: ui.menu.card.w - 96, h: 78 };
    var panelW = Math.min(300, safeW - pad * 2);
    var panelH = Math.min(210, contentH * 0.45);
    ui.menu.panel = { x: metrics.safeLeft + (safeW - panelW) / 2,
      y: contentTop + (contentH - panelH) / 2, w: panelW, h: panelH };
    ui.menu.panelAction = { x: ui.menu.panel.x + (panelW - 126) / 2,
      y: ui.menu.panel.y + panelH - 60, w: 126, h: 42 };

    // ── 设置 / 名片 / 头像 / 昵称 / 排行榜 / 邀请 的界面几何 ──
    // 所有弹窗与全屏页都从同一份可交互区域派生：标题栏、按钮、行高都由 contentH 缩放。
    var sheetW = Math.round(Math.min(340, safeW - pad * 2 - 8));
    var sheetX = Math.round(metrics.safeLeft + (safeW - sheetW) / 2);
    var sheetTop = contentTop + Math.round(contentH * 0.14);
    var sheetMaxBottom = contentBottom - 12;

    // 设置弹窗：标题 + 两条开关 + 分享按钮 + 版本号
    var setH = Math.round(Math.min(372, sheetMaxBottom - sheetTop));
    var setY = Math.round(sheetTop + Math.max(0, (sheetMaxBottom - sheetTop - setH) * 0.35));
    var rowH = Math.round(Math.max(68, Math.min(78, setH * 0.21)));
    var setHead = Math.round(rowH * 0.92);
    var setBtnH = Math.round(Math.max(40, Math.min(50, setH * 0.14)));
    var setInnerY = setY + setHead + Math.round(setH * 0.075);
    var setRowGap = Math.round(Math.max(8, setH * 0.03));
    var musicRow = { x: sheetX + 14, y: setInnerY, w: sheetW - 28, h: rowH };
    var sfxRow = { x: musicRow.x, y: musicRow.y + rowH + setRowGap, w: musicRow.w, h: rowH };
    var shareBtn = {
      x: sheetX + 22,
      y: sfxRow.y + rowH + Math.round(setH * 0.06),
      w: sheetW - 44,
      h: setBtnH,
    };
    ui.settings = {
      sheet: { x: sheetX, y: setY, w: sheetW, h: setH },
      head: setHead,
      musicRow: musicRow,
      sfxRow: sfxRow,
      shareBtn: shareBtn,
      close: { x: sheetX + sheetW - 38, y: setY + 6, w: 32, h: 32 },
      versionY: shareBtn.y + shareBtn.h + 16,
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

    // 地区排行榜：全屏页（返回 + 标题 + 地区切换 + 前三天梯 + 列表 + 我的名次）
    var rankPad = Math.round(Math.max(14, pad));
    var rankX = metrics.safeLeft + rankPad;
    var rankW = safeW - rankPad * 2;
    var backSize = 40;
    // 顶部：返回键一行，标题与副标题在下方一行，避免窄屏文字压住图标
    var rankTitleY = contentTop + backSize + 4;
    var rankBarY = rankTitleY + 80;
    var rankBarH = Math.round(Math.max(36, Math.min(44, contentH * 0.055)));
    var podiumY = rankBarY + rankBarH + 10;
    var podiumH = Math.round(Math.max(104, Math.min(150, contentH * 0.185)));
    var rowH2 = Math.round(Math.max(34, Math.min(44, contentH * 0.052)));
    var listY = podiumY + podiumH + 8;
    // 底部固定两段：我的名次卡片 + 一行说明，二者之间留 8px，说明贴着安全区底
    // 底部：我的名次卡片 + 一行说明；说明用 18 号字，留足下沿空间
    var footH = 26;
    var mineH = Math.round(Math.max(52, Math.min(62, contentH * 0.076)));
    var mineY = contentBottom - footH - 2 - mineH;
    var listAvail = mineY - 10 - listY;
    var visibleRows = Math.max(1, Math.min(6, Math.floor(listAvail / (rowH2 + 8))));
    ui.rank = {
      x: rankX,
      w: rankW,
      titleX: rankX,
      back: { x: rankX, y: contentTop + 4, w: backSize, h: backSize },
      titleY: rankTitleY,
      subY: rankTitleY + 42,
      barY: rankBarY,
      barH: rankBarH,
      bar: { x: rankX, y: rankBarY, w: Math.round(rankW * 0.62), h: rankBarH },
      badge: {
        x: rankX + Math.round(rankW * 0.62) + 6,
        y: rankBarY + 5,
        w: rankW - Math.round(rankW * 0.62) - 6,
        h: rankBarH - 10,
      },
      podiumY: podiumY,
      podiumH: podiumH,
      rowH: rowH2,
      listY: listY,
      visibleRows: visibleRows,
      mine: { x: rankX, y: mineY, w: rankW, h: mineH },
      footY: contentBottom - 26,
      rowRect: function (i) {
        return { x: rankX, y: listY + i * (rowH2 + 8), w: rankW, h: rowH2 };
      },
    };

    // 选择地区：标题 + 3 个地区行 + 说明
    var regH = Math.round(Math.min(386, contentH * 0.64));
    var regY = contentTop + Math.round(Math.max(16, (contentH - regH) * 0.3));
    var regHead = Math.max(38, Math.round(rowH * 0.74));
    var regRowH = Math.round(Math.max(44, Math.min(54, regH * 0.15)));
    var regRowGap = 10;
    var regTop = regY + regHead + Math.round(regH * 0.09);
    ui.regionPick = {
      sheet: { x: sheetX, y: regY, w: sheetW, h: regH },
      head: regHead,
      close: { x: sheetX + sheetW - 38, y: regY + 6, w: 32, h: 32 },
      subY: regY + regHead + Math.round(regH * 0.03),
      rows: (function () {
        var out = [];
        for (var i = 0; i < 3; i++) {
          out.push({
            x: sheetX + 18,
            y: regTop + i * (regRowH + regRowGap),
            w: sheetW - 36,
            h: regRowH,
          });
        }
        return out;
      })(),
      noteY: regY + regH - 60,
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
