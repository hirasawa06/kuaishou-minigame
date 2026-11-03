/* gameplay/render/hud.js — HUD、金币、英雄卡池、首页、暂停与结算 */
(function () {
  var A = window.AIGCUtils;
  var C = A.Config;
  var S = A.State;
  var L = A.Layout;
  var D = A.Render.draw;
  var Scene = A.Scene;
  var COL = Scene.COL;
  var icon = Scene.icon;

  var CLS_COLOR = {
    tank: '#6d9ae0',
    warrior: '#e8873a',
    archer: '#4bd184',
    mage: '#a583f0',
  };

  function fmt(n) {
    return String(Math.floor(n));
  }

  // ── 顶部 HUD：波次 / 基地 / 金币 / 席位 / 暂停 ───────────────
  function drawHud() {
    var u = L.ui;
    var h = u.hud;
    D.vGradient(0, 0, u.w, h.y + h.h + 8, D.color('#1b2233', 0.95), D.color('#121826', 0.62), 10);
    var pad = u.safeLeft + u.pad;
    var top = h.y + 8;

    D.text('波次', pad, top + 2, 18, COL.textDim, 0);
    var waveNo = Math.min(S.waveIndex + 1, C.WAVES.length);
    D.text(waveNo + '/' + C.WAVES.length, pad, top + 24, 28, COL.textMain, 0);
    var remain = A.Battle.remainingEnemies();
    D.text('剩余 ' + remain, pad, top + 56, 18, COL.textDim, 0);

    // 基地血量
    var hpRatio = Math.max(0, S.baseHp) / C.BASE_HP;
    var cx = u.w * 0.46;
    icon('ui-heart', cx - 26, top + 16, 26);
    D.text(String(Math.ceil(Math.max(0, S.baseHp))), cx - 8, top + 2, 28,
      hpRatio > 0.4 ? COL.textMain : COL.hpRed, 0);
    D.roundRect(cx - 30, top + 38, 76, 7, 4, COL.hpBack);
    D.roundRect(cx - 29, top + 39, Math.max(0, 74 * hpRatio), 5, 3,
      hpRatio > 0.5 ? COL.hpGreen : hpRatio > 0.25 ? COL.hpOrange : COL.hpRed);
    D.text('基地', cx - 30, top + 50, 18, COL.textDim, 0);

    // 金币与上场席位：右边界留出暂停按钮的宽度，避免文字被盖住
    var pbx = u.pauseBtn.x - 10;
    var slotLabel = '席位 ' + S.liveUnits() + '/' + S.heroCap;
    D.text(slotLabel, pbx, top + 34, 18, COL.textDim, 2);
    var slotW = D.textWidth(slotLabel, A.FontAtlas['18']);
    icon('ui-coin', pbx - slotW - 26, top + 16, 26);
    D.text(fmt(S.gold), pbx - slotW - 8, top + 2, 28, COL.gold, 0);

    // 暂停
    var pb = u.pauseBtn;
    D.roundRect(pb.x, pb.y, pb.w, pb.h, 12, D.color('#1e2d52', 0.95));
    D.strokeRect(pb.x, pb.y, pb.w, pb.h, 1, D.color('#3a5085'));
    icon(S.phase === 'paused' ? 'ui-play' : 'ui-pause', pb.x + pb.w / 2, pb.y + pb.h / 2, 19);
  }

  // ── 金币条 ────────────────────────────────────────────────
  function drawGoldBar() {
    var u = L.ui;
    var gb = u.goldBar;
    if (!gb) return;
    D.roundRect(gb.x, gb.y, gb.w, gb.h, gb.h / 2, D.color('#2a2118', 0.9));
    icon('ui-coin', gb.x + gb.h * 0.55, gb.y + gb.h / 2, gb.h * 0.78);
    D.text(fmt(S.gold), gb.x + gb.h * 1.05, gb.y + (gb.h - 22) / 2, 28, COL.gold, 0);
    D.text('席位 ' + S.liveUnits() + '/' + S.heroCap,
      gb.x + gb.w - 10, gb.y + (gb.h - 18) / 2, 18, D.color('#c8b49a'), 2);
  }

  // ── 商店按钮 ──────────────────────────────────────────────
  function drawShopButton(rect, label, sub, enabled, accent) {
    var bg = enabled ? D.color(accent, 0.22) : D.color('#1a1a22', 0.55);
    D.roundRect(rect.x, rect.y, rect.w, rect.h, rect.h / 2, bg);
    D.strokeRect(rect.x, rect.y, rect.w, rect.h, 1,
      enabled ? D.color(accent, 0.8) : D.color('#3a3a46'));
    var col = enabled ? D.color(accent) : D.color('#6b6b78');
    if (sub) {
      D.text(label, rect.x + 12, rect.y + 4, 18, col, 0);
      D.text(sub, rect.x + rect.w - 10, rect.y + 6, 18, col, 2);
    } else {
      D.text(label, rect.x + rect.w / 2, rect.y + (rect.h - 22) / 2, 18, col, 1);
    }
  }

  function drawShop() {
    var u = L.ui;
    var t = u.tray;
    D.vGradient(0, t.y, u.w, u.h - t.y, D.color('#191a22'), D.color('#0f1016'), 10);
    D.rect(0, t.y, t.w, 1, D.color('#3a3326'));
    drawGoldBar();

    // 刷新 / 扩建
    drawShopButton(u.refreshBtn,
      '刷新 ' + S.refreshCost,
      null,
      S.gold >= S.refreshCost, '#ffd166');
    var capFull = S.heroCap >= C.UNIT_CAP_MAX;
    drawShopButton(u.capBtn,
      capFull ? '席位已满' : '扩建 +' + C.UNIT_CAP_STEP + '  ' + S.capCost,
      null,
      !capFull && S.gold >= S.capCost, '#7fd1ff');

    // 4 格卡池
    for (var i = 0; i < C.cardCount; i++) {
      var rect = L.shopRect(i);
      var slot = S.shop[i];
      if (!slot) {
        drawEmptyCell(rect);
        continue;
      }
      if (slot.sold) {
        drawSoldCell(rect);
        continue;
      }
      var def = S.heroById(slot.cardId);
      if (!def) { drawEmptyCell(rect); continue; }
      drawHeroCell(def, rect, 1, i);
    }

    D.text('点卡自动落地 · 拖到战场指定位置 · 击杀掉金币',
      u.w / 2, u.contentBottom - 18, 18, D.color('#8a8172'), 1);
  }

  function drawEmptyCell(rect) {
    D.roundRect(rect.x, rect.y, rect.w, rect.h, 12, D.color('#14151d', 0.85));
    D.strokeRect(rect.x, rect.y, rect.w, rect.h, 1, D.color('#262833'));
  }

  function drawSoldCell(rect) {
    drawEmptyCell(rect);
    D.text('已上阵', rect.x + rect.w / 2, rect.y + rect.h / 2 - 9, 18,
      D.color('#3f4354'), 1);
  }

  // 英雄卡：横向紧凑版（约 49~60px 高），左立绘 + 右两行文字 + 右上费用
  function drawHeroCell(def, rect, alpha, index) {
    var afford = S.gold >= def.cost;
    var capFull = S.liveUnits() >= S.heroCap;
    var usable = afford && !capFull;
    var a = alpha === undefined ? 1 : alpha;
    var clsCol = D.color(CLS_COLOR[def.cls] || '#777777');

    D.roundRect(rect.x, rect.y, rect.w, rect.h, 10, D.color('#1d2029', a));
    D.hGradient(rect.x, rect.y, rect.w, rect.h,
      D.color(def.color, 0.30 * a), D.color('#1a1d26', 0.9 * a), 8);
    D.strokeRect(rect.x, rect.y, rect.w, rect.h, 1,
      usable ? D.color(def.color, 0.85) : D.color('#2e3140', a));
    // 左侧职业色条
    D.roundRect(rect.x + 3, rect.y + 7, 4, rect.h - 14, 2, clsCol);

    // 立绘：占满卡片高度，留 3px 内边距
    var iconSize = rect.h - 6;
    icon(def.icon, rect.x + 9 + iconSize / 2, rect.y + rect.h / 2, iconSize, a);

    var tx = rect.x + 14 + iconSize;
    var nameY = rect.y + Math.max(3, rect.h * 0.5 - 20);
    D.text(def.name, tx, nameY, 18, D.color('#f2f6ff', a), 0);
    // 职业 + 关键数值压到一行，避免溢出
    var line1 = def.cls === 'tank'
      ? def.clsName + ' · 生命 ' + def.hp
      : def.clsName + ' · 攻 ' + def.atk;
    D.text(line1, tx, nameY + 21, 18, clsCol, 0);

    // 费用角标
    var cr = Math.max(12, Math.min(16, rect.h * 0.24));
    var ccx = rect.x + rect.w - cr - 6;
    var ccy = rect.y + cr + 4;
    D.circle(ccx, ccy, cr, afford ? D.color('#3a2f16', a) : D.color('#3c1524', a));
    D.ring(ccx, ccy, cr - 0.7, 1.4, afford ? D.color('#ffd166', a) : D.color('#ff6b7f', a));
    D.text(String(def.cost), ccx, ccy - 9, 18,
      afford ? D.color('#ffe8b0', a) : D.color('#ff8598', a), 1);

    if (!usable) D.roundRect(rect.x, rect.y, rect.w, rect.h, 10, D.color('#05080f', 0.35 * a));
  }

  function drawInspect() {
    if (!S.inspect || !S.inspectT || S.inspectT <= 0) return;
    var def = S.inspect;
    var a = Math.min(1, S.inspectT / 0.45);
    var w = 248;
    var h = 132;
    var x = S.inspectX === undefined ? L.ui.safeLeft + 8 : S.inspectX;
    var y = S.inspectY === undefined ? L.ui.contentTop + 90 : S.inspectY;
    x = Math.max(6, Math.min(L.ui.w - w - 6, x));
    y = Math.max(L.ui.contentTop + 6, Math.min(L.ui.tray.y - h - 6, y));
    D.roundRect(x, y, w, h, 14, D.color('#0c1630', 0.96 * a));
    D.strokeRect(x, y, w, h, 1, D.color('#2c4270', a));
    icon(def.icon, x + 42, y + 46, 56, a);
    D.text(def.name, x + 78, y + 10, 28, D.color('#ffffff', a), 0);
    D.text(def.clsName + ' · ' + def.cost + ' 金币', x + 78, y + 42, 18,
      D.color(CLS_COLOR[def.cls], a), 0);
    D.text(def.desc, x + 78, y + 64, 18, D.color('#a8b8d8', a), 0);
    var stats = '生命 ' + def.hp + '  攻击 ' + def.atk +
      '  射程 ' + (def.range || 0) + '  攻速 ' + def.interval + 's';
    D.text(stats, x + 14, y + 92, 18, D.color('#7f92b6', a), 0);
    var extra = def.cls === 'tank'
      ? '嘲讽半径 ' + def.taunt
      : def.splash ? '群攻半径 ' + def.splash
        : def.cls === 'warrior' ? '移动速度 ' + def.moveSpeed : '移动速度 0（驻守）';
    D.text(extra, x + 14, y + 112, 18, D.color('#6f7f9e', a), 0);
  }

  function drawToast() {
    if (!S.toast) return;
    var u = L.ui;
    var a = Math.min(1, S.toast.life / 0.3);
    var w = 244;
    var y = u.field.y + u.field.h * 0.3;
    D.roundRect(u.w / 2 - w / 2, y, w, 42, 21, D.color('#08111f', 0.9 * a));
    D.strokeRect(u.w / 2 - w / 2, y, w, 42, 1, D.color('#2b4470', a));
    D.text(S.toast.text, u.w / 2, y + 10, 18, D.color('#d7e8ff', a), 1);
  }

  function drawButton(label, y, primary) {
    var u = L.ui;
    var w = u.btnW;
    var h = u.btnH;
    var x = u.safeLeft + (u.safeRight - u.safeLeft - w) / 2;
    D.roundRect(x, y, w, h, h / 2,
      primary ? D.color('#f0a02a') : D.color('#2a3040'));
    if (primary) {
      D.roundRect(x + 3, y + 3, w - 6, h * 0.42, h / 2, D.color('#ffcf6a', 0.55));
      D.strokeRect(x, y, w, h, 2, D.color('#a86a14'));
    }
    D.text(label, x + w / 2, y + (h - 28) / 2, 28, primary ? D.color('#5a3208') : COL.textMain, 1);
  }

  // ── 首页（参考图：客厅 + 头像 + 体力 + 设置 / 排行榜 + 章节卡 + 开始） ──
  function drawMenu() {
    var u = L.ui;
    var m = u.menu;
    if (!m) { drawMenuFallback(); return; }

    // 背景：客厅全屏铺满（非交互视觉层）
    var bg = A.Assets.entry('menu-bg');
    if (bg) {
      D.texture(bg.tex, bg.w, bg.h, 0, 0, bg.w, bg.h, 0, 0, u.w, u.h);
    } else {
      D.vGradient(0, 0, u.w, u.h, D.color('#fdf3e4'), D.color('#e9d2b6'), 20);
    }

    // 头像
    var av = m.avatar;
    D.roundRect(av.x - 3, av.y - 3, av.w + 6, av.h + 6, 16, D.color('#fff6e6', 0.95));
    D.roundRect(av.x, av.y, av.w, av.h, 14, D.color('#c98f52'));
    icon('unit-tank-1', av.x + av.w / 2, av.y + av.h / 2, av.w * 0.82);

    // 体力
    var stb = m.stamina;
    D.roundRect(stb.x, stb.y, stb.w, stb.h, stb.h / 2, D.color('#fff7ea', 0.92));
    D.strokeRect(stb.x, stb.y, stb.w, stb.h, 2, D.color('#e2c49a'));
    icon('ui-bolt', stb.x + stb.h * 0.55, stb.y + stb.h / 2, stb.h * 0.72);
    D.text('体力', stb.x + stb.h * 1.0, stb.y + (stb.h - 18) / 2, 18, D.color('#8a6a44'), 0);
    D.text('30/30', stb.x + stb.w - 12, stb.y + (stb.h - 18) / 2, 18, D.color('#5b4126'), 2);

    // 设置
    var sb = m.settings;
    D.roundRect(sb.x, sb.y, sb.w, sb.h, 16, D.color('#fff7ea', 0.92));
    D.strokeRect(sb.x, sb.y, sb.w, sb.h, 2, D.color('#e2c49a'));
    icon('ui-setting', sb.x + sb.w / 2, sb.y + sb.h * 0.38, sb.h * 0.46);
    D.text('设置', sb.x + sb.w / 2, sb.y + sb.h * 0.66, 18, D.color('#6b4a2a'), 1);

    // 排行榜
    var rb = m.rank;
    D.roundRect(rb.x, rb.y, rb.w, rb.h + 18, 16, D.color('#fff7ea', 0.92));
    D.strokeRect(rb.x, rb.y, rb.w, rb.h + 18, 2, D.color('#e2c49a'));
    icon('ui-rank', rb.x + rb.w / 2, rb.y + rb.h * 0.38, rb.h * 0.5);
    D.text('排行榜', rb.x + rb.w / 2, rb.y + rb.h * 0.7, 18, D.color('#6b4a2a'), 1);

    // 章节横幅
    var bn = m.banner;
    D.roundRect(bn.x, bn.y, bn.w, bn.h, bn.h / 2, D.color('#7a5a3a', 0.92));
    D.roundRect(bn.x + 3, bn.y + 3, bn.w - 6, bn.h - 6, (bn.h - 6) / 2, D.color('#fff3df', 0.95));
    icon('ui-coin', bn.x + bn.w * 0.18, bn.y + bn.h / 2, bn.h * 0.42);
    D.text('第3章 · 客厅防线', bn.x + bn.w / 2 + 6, bn.y + (bn.h - 28) / 2, 28,
      D.color('#6b4222'), 1);

    // 章节展示卡
    var cd = m.card;
    var pad = 4;
    D.roundRect(cd.x - pad, cd.y - pad, cd.w + pad * 2, cd.h + pad * 2, 26,
      D.color('#fff3df', 0.96));
    D.strokeRect(cd.x - pad, cd.y - pad, cd.w + pad * 2, cd.h + pad * 2, 3,
      D.color('#d9b98c'));
    var card = A.Assets.entry('menu-card');
    if (card) {
      // 等比填充卡片区域
      var s = Math.max(cd.w / card.w, cd.h / card.h);
      var sw = cd.w / s, sh = cd.h / s;
      var sx = (card.w - sw) / 2, sy = (card.h - sh) / 2;
      D.texture(card.tex, card.w, card.h, sx, sy, sw, sh, cd.x, cd.y, cd.w, cd.h);
    } else {
      D.roundRect(cd.x, cd.y, cd.w, cd.h, 20, D.color('#f7e6cf'));
    }

    // 开始按钮
    drawStartButton(m.start);

    D.text('击杀掉金币 · 买英雄与席位 · 刷新卡池', u.w / 2, m.start.y + m.start.h + 12, 18,
      D.color('#8a6a44'), 1);
  }

  function drawMenuFallback() {
    var u = L.ui;
    D.roundRect(0, 0, u.w, u.h, 0, D.color('#f6ead8', 1));
    D.text('塔防小游戏', u.w / 2, u.contentTop + u.contentH * 0.3, 48, D.color('#5b4126'), 1);
    drawButton('开始游戏', u.btnY.menu, true);
  }

  function drawStartButton(r) {
    D.roundRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, r.h / 2, D.color('#c47a22', 0.35));
    D.roundRect(r.x, r.y, r.w, r.h, r.h / 2, D.color('#f5a623'));
    D.roundRect(r.x + 4, r.y + 4, r.w - 8, r.h * 0.44, r.h / 2, D.color('#ffd07a', 0.9));
    D.strokeRect(r.x, r.y, r.w, r.h, 2, D.color('#c07a18'));
    icon('ui-coin', r.x + 26, r.y + r.h / 2, 26, 0.0);
    D.text('开始游戏', r.x + r.w / 2, r.y + (r.h - 32) / 2, 48, D.color('#5a3208'), 1);
  }

  function drawPaused() {
    var u = L.ui;
    D.roundRect(0, 0, u.w, u.h, 0, D.color('#04080f', 0.72));
    var y = u.contentTop + u.contentH * 0.28;
    D.text('已暂停', u.w / 2, y, 48, COL.textMain, 1);
    D.text('点击右上角按钮继续游戏', u.w / 2, y + 66, 18, COL.textDim, 1);
    drawButton('重新开始', u.btnY.paused, false);
  }

  function drawResult(win) {
    var u = L.ui;
    D.roundRect(0, 0, u.w, u.h, 0, D.color('#04080f', 0.82));
    var y = u.contentTop + u.contentH * 0.16;
    D.text(win ? '胜利' : '失败', u.w / 2, y, 48,
      win ? COL.gold : COL.hpRed, 1);
    D.text(win ? '你守住了客厅！' : '客厅失守了', u.w / 2, y + 62, 28,
      COL.textDim, 1);
    var cleared = win ? C.WAVES.length : S.waveIndex;
    var stats = [
      '抵达波次  ' + Math.max(1, Math.min(cleared, C.WAVES.length)) + '/' + C.WAVES.length,
      '击杀数量  ' + S.kills,
      '累计金币  ' + S.goldEarned,
      '上阵英雄  ' + S.cardsPlaced,
      '剩余基地  ' + Math.max(0, Math.ceil(S.baseHp)) + '/' + C.BASE_HP,
    ];
    for (var i = 0; i < stats.length; i++) {
      D.text(stats[i], u.w / 2, y + 112 + i * 32, 28, COL.textMain, 1);
    }
    drawButton('再玩一次', u.btnY.result, true);
  }

  function drawLoading() {
    var u = L.ui && L.ui.ready ? L.ui : {
      w: C.designW,
      h: C.designH,
      contentTop: 96,
      contentH: C.designH - 96,
    };
    var w = u.w || C.designW;
    var y = u.contentTop + u.contentH * 0.38;
    D.text('塔防小游戏', w / 2, y, 48, COL.textMain, 1);
    D.text(S.phase === 'error' ? '资源加载失败' : '加载中', w / 2, y + 70, 18, COL.textDim, 1);
  }

  A.Hud = {
    CLS_COLOR: CLS_COLOR,
    drawHud: drawHud,
    drawTray: drawShop,
    drawInspect: drawInspect,
    drawToast: drawToast,
    drawMenu: drawMenu,
    drawPaused: drawPaused,
    drawResult: drawResult,
    drawLoading: drawLoading,
    drawDragGhost: Scene.drawDragGhost,
  };
})();
