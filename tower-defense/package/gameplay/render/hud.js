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
    healer: '#79dcb5',
  };
  // 透明按钮图的有效像素范围；源图保留透明边，采样时只取按钮本身。
  var MENU_BUTTONS = {
    avatar: { asset: 'home-avatar-button', crop: [35, 22, 309, 324] },
    stamina: { asset: 'home-stamina-button', crop: [46, 31, 417, 123] },
    settings: { asset: 'home-settings-button', crop: [69, 60, 241, 252] },
    rank: { asset: 'home-rank-button', crop: [49, 37, 280, 291] },
    start: { asset: 'home-start-button', crop: [44, 24, 424, 126] },
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

    // 基地血量：固定在屏幕中线略左，给右侧金币区留出空间
    var hpRatio = Math.max(0, S.baseHp) / C.BASE_HP;
    var cx = u.w * 0.36;
    icon('ui-heart', cx - 26, top + 16, 26);
    D.text(String(Math.ceil(Math.max(0, S.baseHp))), cx - 8, top + 2, 28,
      hpRatio > 0.4 ? COL.textMain : COL.hpRed, 0);
    D.roundRect(cx - 30, top + 38, 76, 7, 4, COL.hpBack);
    D.roundRect(cx - 29, top + 39, Math.max(0, 74 * hpRatio), 5, 3,
      hpRatio > 0.5 ? COL.hpGreen : hpRatio > 0.25 ? COL.hpOrange : COL.hpRed);
    D.text('基地', cx - 30, top + 50, 18, COL.textDim, 0);

    // 金币与上场席位：整体靠右对齐到暂停按钮左侧。
    // 席位文字贴右边界，金币数字和图标依次往左排，互不覆盖。
    var rightEdge = u.pauseBtn.x - 10;
    var slotLabel = '席位 ' + S.liveUnits() + '/' + S.heroCap;
    D.text(slotLabel, rightEdge, top + 38, 18, COL.textDim, 2);
    // 金币和席位都右对齐到同一条竖线：金币在上、席位在下，避免互相挤占
    var goldText = fmt(S.gold);
    var goldW = D.textWidth(goldText, A.FontAtlas['28']);
    D.text(goldText, rightEdge, top + 2, 28, COL.gold, 2);
    icon('ui-coin', rightEdge - goldW - 16, top + 16, 26);

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

    if (S.dragging && S.dragging.kind === 'unit' && S.dragging.active) {
      var sell = u.sellZone;
      var price = A.Battle.sellPrice(S.dragging.unit);
      var inside = S.dragging.x >= sell.x && S.dragging.x <= sell.x + sell.w &&
        S.dragging.y >= sell.y && S.dragging.y <= sell.y + sell.h;
      D.roundRect(sell.x, sell.y, sell.w, sell.h, 12,
        D.color(inside ? '#306f49' : '#4d3521', 0.96));
      D.text(price ? '松手出售 +' + price + ' 金币' : '角色已退场，无法出售',
        sell.x + sell.w / 2, sell.y + 12, 18, D.color('#ffe5ac'), 1);
    } else {
      D.text('点卡上阵 · 拖动固定角色到底部出售',
        u.w / 2, u.contentBottom - 18, 18, D.color('#8a8172'), 1);
    }
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
      : def.cls === 'healer' ? def.clsName + ' · 回血 ' + def.heal
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
    var extra = def.cls === 'healer' ? '治疗半径 ' + def.range + ' · 回血 ' + def.heal
      : def.cls === 'tank'
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

  function drawButton(label, rectOrY, primary, fontSize, subtle) {
    var u = L.ui;
    var r = rectOrY && rectOrY.w !== undefined
      ? rectOrY
      : {
        x: u.safeLeft + (u.safeRight - u.safeLeft - u.btnW) / 2,
        y: rectOrY, w: u.btnW, h: u.btnH,
      };
    var size = fontSize || 28;
    var bg = primary ? D.color('#f0a02a')
      : subtle ? D.color('#1b2333', 0.86) : D.color('#2a3040');
    D.roundRect(r.x, r.y, r.w, r.h, r.h / 2, bg);
    if (primary) {
      D.roundRect(r.x + 3, r.y + 3, r.w - 6, r.h * 0.42, r.h / 2, D.color('#ffcf6a', 0.55));
      D.strokeRect(r.x, r.y, r.w, r.h, 2, D.color('#a86a14'));
    } else if (subtle) {
      D.strokeRect(r.x, r.y, r.w, r.h, 1.4, D.color('#3b4a66'));
    }
    D.text(label, r.x + r.w / 2, r.y + (r.h - size) / 2,
      size, primary ? D.color('#5a3208') : COL.textMain, 1);
  }

  // ── 首页（参考图：客厅 + 头像 + 体力 + 设置 / 排行榜 + 章节卡 + 开始） ──
  function drawMenu() {
    var u = L.ui;
    var m = u.menu;
    if (!m) { drawMenuFallback(); return; }
    var art = A.Assets.entry('figma-home');
    var frame = u.menuArtwork;
    if (!art || !frame) { drawMenuFallback(); return; }

    // 原图的 0..45.77 与 45.77..845 连续拼接；上段拉伸到安全区顶部。
    var split = 45.77 / 845 * art.h;
    D.texture(art.tex, art.w, art.h, 0, 0, art.w, split,
      frame.x, 0, frame.w, u.contentTop);
    D.texture(art.tex, art.w, art.h, 0, split, art.w, art.h - split,
      frame.x, u.contentTop, frame.w, frame.h - 45.77 * frame.scale);
    if (frame.x > 0) {
      D.rect(0, 0, frame.x, u.h, D.color('#f3dec0'));
      D.rect(frame.x + frame.w, 0, u.w - frame.x - frame.w, u.h, D.color('#f3dec0'));
    }

    var keys = ['avatar', 'stamina', 'settings', 'rank', 'start'];
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var target = m[key];
      var spec = MENU_BUTTONS[key];
      var sprite = A.Assets.entry(spec.asset);
      if (!target || !sprite) continue;
      var active = S.menuPressed === key;
      var feedback = S.menuFeedback && S.menuFeedback.key === key && S.menuFeedback.life > 0;
      var progress = feedback ? 1 - S.menuFeedback.life / 0.18 : 1;
      var scale = active ? 1.045 : feedback ?
        1 + 0.045 * (1 - progress) + 0.03 * Math.sin(progress * Math.PI * 2) * (1 - progress) : 1;
      // 体力条紧邻头像，必须内接原槽位，避免等比铺满时横向溢出。
      var fit = key === 'stamina'
        ? Math.min(target.w / spec.crop[2], target.h / spec.crop[3])
        : Math.max(target.w / spec.crop[2], target.h / spec.crop[3]);
      var w = spec.crop[2] * fit * scale;
      var h = spec.crop[3] * fit * scale;
      D.texture(sprite.tex, sprite.w, sprite.h,
        spec.crop[0], spec.crop[1], spec.crop[2], spec.crop[3],
        target.x + (target.w - w) / 2, target.y + (target.h - h) / 2, w, h);
    }
    // 首页原图上的章节文字是静态的，用同风格牌匾覆盖后绘制真实选关。
    var banner = m.banner;
    D.roundRect(banner.x + 22, banner.y + 6, banner.w - 44, banner.h - 12, 24, D.color('#8a4b22'));
    D.strokeRect(banner.x + 22, banner.y + 6, banner.w - 44, banner.h - 12, 2, D.color('#ffdfac'));
    var level = C.LEVELS[S.selectedLevel - 1];
    D.text('第 ' + S.selectedLevel + ' 关 · ' + level.name,
      banner.x + banner.w / 2, banner.y + (banner.h - 18) / 2, 18, D.color('#fff0d4'), 1);
    var unlocked = A.Profile.isLevelUnlocked(S.selectedLevel);
    var nav = [m.levelPrev, m.levelNext];
    for (var ni = 0; ni < nav.length; ni++) {
      var nr = nav[ni];
      D.roundRect(nr.x, nr.y, nr.w, nr.h, 18, D.color('#fff0d4', 0.94));
      D.text(ni === 0 ? '<' : '>', nr.x + nr.w / 2, nr.y + 8, 28, D.color('#784323'), 1);
    }
    var status = m.levelStatus;
    D.roundRect(status.x, status.y, status.w, status.h, 16, D.color('#fff0d4', 0.94));
    D.text(S.selectedLevel + '/10 · ' + (unlocked ?
      (S.selectedLevel <= A.Profile.data.completedLevel ? '已通关' : '可挑战') : '未解锁'),
      status.x + status.w / 2, status.y + 8, 18, D.color('#784323'), 1);
    if (!unlocked) {
      D.roundRect(m.start.x, m.start.y, m.start.w, m.start.h, 32, D.color('#fff0d4', 0.93));
      D.text('先通过第 ' + (S.selectedLevel - 1) + ' 关',
        m.start.x + m.start.w / 2, m.start.y + (m.start.h - 28) / 2, 28, D.color('#784323'), 1);
    }
    if (S.toast) {
      D.text(S.toast.text, m.card.x + m.card.w / 2, m.card.y + 12, 18, D.color('#fff0d4'), 1);
    }
    if (S.menuPanel) drawMenuPanel(m);
  }

  function drawMenuPanel(m) {
    var p = m.panel;
    D.rect(0, 0, L.ui.w, L.ui.h, D.color('#321d15', 0.55));
    D.roundRect(p.x, p.y, p.w, p.h, 22, D.color('#fff1d9'));
    D.strokeRect(p.x, p.y, p.w, p.h, 3, D.color('#bd7c39'));
    var title = S.menuPanel === 'settings' ? '设置' :
      S.menuPanel === 'rank' ? '排行榜' : S.menuPanel === 'stamina' ? '体力' : '头像';
    D.text(title, p.x + p.w / 2, p.y + 24, 28, D.color('#6b4222'), 1);
    var detail = S.menuPanel === 'settings' ?
      (S.menuSoundEnabled ? '音效：开启' : '音效：关闭') :
      S.menuPanel === 'rank' ? '单机版暂无排行榜' :
      S.menuPanel === 'stamina' ? '体力 30/30' : '客厅守护队';
    D.text(detail, p.x + p.w / 2, p.y + p.h * 0.48, 18, D.color('#6b4222'), 1);
    D.roundRect(m.panelAction.x, m.panelAction.y, m.panelAction.w, m.panelAction.h,
      18, D.color('#f4aa3d'));
    D.text(S.menuPanel === 'settings' ? '切换音效' : '关闭',
      m.panelAction.x + m.panelAction.w / 2, m.panelAction.y + 10, 18,
      D.color('#5a3208'), 1);
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
    var y = u.contentTop + u.contentH * 0.16;
    D.text('已暂停', u.w / 2, y, 48, COL.textMain, 1);
    D.text('点击右上角按钮继续游戏', u.w / 2, y + 62, 18, COL.textDim, 1);


    // 主操作与设置/主页入口都从 layout 取几何，绘制与命中一致
    drawButton('继续游戏', u.pausePanel.btn('resume'), true, 28);
    drawButton('设置', u.pausePanel.btn('settings'), false, 28);
    drawButton('重新开始', u.pausePanel.btn('restart'), false, 28);
    drawButton('返回主页', u.pausePanel.btn('home'), false, 28, true);
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
    drawButton('返回选关', u.resultHome, false, 18);
    D.text('第 ' + S.currentLevel + ' 关' + (win && S.currentLevel < C.LEVELS.length ? ' · 下一关已解锁' : ''),
      u.w / 2, y - 30, 18, COL.textDim, 1);
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
