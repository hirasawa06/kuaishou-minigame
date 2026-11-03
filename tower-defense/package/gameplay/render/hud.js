/* gameplay/render/hud.js — HUD、能量条、卡槽、说明、提示、结算界面 */
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

  function drawHud() {
    var u = L.ui;
    var h = u.hud;
    D.vGradient(0, 0, u.w, h.y + h.h + 8, D.color('#16244a', 0.95), D.color('#0d1628', 0.6), 10);
    var pad = u.pad;
    // 顶部状态栏与刘海：HUD 内容整体下移到安全区之内，但按钮位置以 layout 为准
    var top = Math.max(h.y + 12, (u.safeTop || 0) + 8);

    D.text('波次', pad, top + 2, 18, COL.textDim, 0);
    var waveNo = Math.min(S.waveIndex + 1, C.WAVES.length);
    D.text(waveNo + '/' + C.WAVES.length, pad, top + 24, 28, COL.textMain, 0);
    var remain = A.Battle.remainingEnemies();
    D.text('剩余 ' + remain, pad, top + 56, 18, COL.textDim, 0);

    // 基地血量
    var hpRatio = Math.max(0, S.baseHp) / C.BASE_HP;
    var cx = u.w * 0.5;
    icon('ui-heart', cx - 30, top + 18, 30);
    D.text(String(Math.ceil(Math.max(0, S.baseHp))), cx - 12, top + 2, 28,
      hpRatio > 0.4 ? COL.textMain : COL.hpRed, 0);
    D.roundRect(cx - 34, top + 40, 84, 7, 4, COL.hpBack);
    D.roundRect(cx - 33, top + 41, Math.max(0, 82 * hpRatio), 5, 3,
      hpRatio > 0.5 ? COL.hpGreen : hpRatio > 0.25 ? COL.hpOrange : COL.hpRed);
    D.text('基地', cx - 34, top + 52, 18, COL.textDim, 0);

    // 暂停
    var pb = u.pauseBtn;
    D.roundRect(pb.x, pb.y, pb.w, pb.h, 12, D.color('#1e2d52', 0.95));
    D.strokeRect(pb.x, pb.y, pb.w, pb.h, 1, D.color('#3a5085'));
    icon(S.phase === 'paused' ? 'ui-play' : 'ui-pause', pb.x + pb.w / 2, pb.y + pb.h / 2, 19);
  }

  function drawEnergy() {
    var u = L.ui;
    var eb = u.energyBar;
    var ratio = S.energy / C.ENERGY_MAX;

    D.roundRect(eb.x, eb.y, eb.w, eb.h, eb.h / 2, D.color('#0a1322'));
    var fillW = Math.max(0, (eb.w - 2) * ratio);
    if (fillW > 1) {
      D.roundRect(eb.x + 1, eb.y + 1, fillW, eb.h - 2, (eb.h - 2) / 2, D.color('#2fc4ea'));
      D.roundRect(eb.x + 1, eb.y + 1, fillW, (eb.h - 2) * 0.45, (eb.h - 2) / 2, D.color('#8df0ff', 0.5));
    }
    for (var i = 1; i < C.ENERGY_MAX; i++) {
      var x = eb.x + (eb.w / C.ENERGY_MAX) * i;
      D.rect(x - 0.5, eb.y + 4, 1, eb.h - 8, D.color('#081020', 0.5));
    }
    if (ratio >= 0.999) {
      var a = 0.1 + Math.sin(S.time * 5) * 0.06;
      D.roundRect(eb.x - 2, eb.y - 2, eb.w + 4, eb.h + 4, eb.h / 2 + 2, D.color('#4de1ff', a));
    }

    // 左侧图标与当前能量，叠在条形之上，深色文字保证对比
    D.circle(eb.x + 2, eb.y + eb.h / 2, eb.h / 2 + 3, D.color('#0a1322'));
    icon('ui-bolt', eb.x + 2, eb.y + eb.h / 2, 18);
    var label = Math.floor(S.energy) + '/' + C.ENERGY_MAX;
    var lw = D.textWidth(label, A.FontAtlas['18']) + 6;
    D.roundRect(eb.x + eb.w - lw - 8, eb.y + eb.h / 2 - 10, lw + 4, 20, 10, D.color('#08111f', 0.55));
    D.text(label, eb.x + eb.w - 8, eb.y + eb.h / 2 - 9, 18, D.color('#dff4ff'), 2);
  }

  function drawCardFace(def, rect, alpha, costShown) {
    var afford = S.energy >= def.cost;
    var clsCol = D.color(CLS_COLOR[def.cls] || '#777777');
    var a = alpha === undefined ? 1 : alpha;

    var bg = D.color('#1b2744', a);
    var top = D.color('#243356', a);
    D.vGradient(rect.x, rect.y, rect.w, rect.h, top, bg, 8);
    D.roundRect(rect.x, rect.y, rect.w, rect.h, 13, D.color(def.color, 0.07 * a));
    D.strokeRect(rect.x, rect.y, rect.w, rect.h, 1, D.color('#33456e', a));
    // 类别色条
    D.roundRect(rect.x + 8, rect.y + 8, rect.w - 16, 4, 2, clsCol);

    var iconSize = Math.min(rect.w * 0.72, rect.h * 0.4);
    icon(def.icon, rect.x + rect.w / 2, rect.y + rect.h * 0.37, iconSize, a);

    D.text(def.name, rect.x + rect.w / 2, rect.y + rect.h * 0.6, 18,
      D.color('#f2f6ff', a), 1);
    D.text(def.clsName, rect.x + rect.w / 2, rect.y + rect.h * 0.6 + 21, 18,
      D.color(CLS_COLOR[def.cls], a), 1);

    // 费用角标
    var cr = Math.max(11, rect.h * 0.12);
    var ccx = rect.x + cr + 7;
    var ccy = rect.y + cr + 7;
    D.circle(ccx, ccy, cr, afford ? D.color('#123a5c', a) : D.color('#3c1524', a));
    D.ring(ccx, ccy, cr - 0.7, 1.4, afford ? D.color('#4de1ff', a) : D.color('#ff6b7f', a));
    D.text(String(def.cost), ccx, ccy - 9, 18,
      afford ? D.color('#c9f6ff', a) : D.color('#ff8598', a), 1);

    if (!afford) D.roundRect(rect.x, rect.y, rect.w, rect.h, 13, D.color('#05080f', 0.35 * a));
  }

  function drawTray() {
    var u = L.ui;
    var t = u.tray;
    D.vGradient(0, t.y, t.w, t.h, D.color('#0d1527'), D.color('#070c17'), 10);
    D.rect(0, t.y, t.w, 1, D.color('#24365a'));
    drawEnergy();

    var drag = S.dragging;
    for (var i = 0; i < S.slots.length; i++) {
      var slot = S.slots[i];
      var x = u.cards.x + slot.x;
      if (x > u.cards.x + u.cards.w + u.cardW) continue;

      var isDragged = drag && drag.slot === slot && drag.active;

      // 左右两侧做淡出，营造"从右边滑入、从左边滑走"的观感
      var rect = { x: x, y: u.cards.y, w: u.cardW, h: u.cardH };
      var fade = 1;
      if (x + u.cardW > u.cards.x + u.cards.w) {
        fade = Math.max(0, (u.cards.x + u.cards.w - x) / (u.cardW * 0.9));
      } else if (x < u.cards.x) {
        fade = Math.max(0, 1 - (u.cards.x - x) / (u.cardW * 0.9));
      }
      if (fade <= 0.02) continue;

      if (isDragged) {
        // 拖走后原位留一个淡色占位框
        D.roundRect(rect.x, rect.y, rect.w, rect.h, 13, D.color('#111b2e', 0.75));
        D.strokeRect(rect.x, rect.y, rect.w, rect.h, 1, D.color('#243354'));
        D.text('拖到战场', rect.x + rect.w / 2, rect.y + rect.h * 0.42, 18, D.color('#4a5f88'), 1);
        continue;
      }
      var def = S.cardById(slot.cardId);
      if (!def) continue;
      drawCardFace(def, rect, fade);
    }

    // 托盘顶部 / 底部的柔和遮罩，强化"传送带"边界
    D.hGradient(u.cards.x - 6, u.cards.y, 18, u.cards.h, D.color('#070c17', 0.95), D.color('#070c17', 0), 6);
    D.hGradient(u.cards.x + u.cards.w - 12, u.cards.y, 18, u.cards.h, D.color('#070c17', 0), D.color('#070c17', 0.95), 6);

    D.text('拖动卡牌到战场放置 · 左右滑动丢弃', u.w / 2, t.y + t.h - 16, 18,
      D.color('#546b96'), 1);
  }

  function drawInspect() {
    if (!S.inspect || !S.inspectT || S.inspectT <= 0) return;
    var u = L.ui;
    var def = S.inspect;
    var a = Math.min(1, S.inspectT / 0.45);
    var w = u.w - u.pad * 3;
    var h = 112;
    var x = (u.w - w) / 2;
    var y = u.tray.y - h - 12;
    D.roundRect(x, y, w, h, 14, D.color('#0c1630', 0.96 * a));
    D.strokeRect(x, y, w, h, 1, D.color('#2c4270', a));
    icon(def.icon, x + 44, y + h / 2, 62, a);
    D.text(def.name, x + 82, y + 12, 28, D.color('#ffffff', a), 0);
    D.text(def.clsName + ' · 费用 ' + def.cost, x + 82, y + 44, 18,
      D.color(CLS_COLOR[def.cls], a), 0);
    D.text(def.desc, x + 82, y + 66, 18, D.color('#a8b8d8', a), 0);
    D.text('生命 ' + def.hp + '  攻击 ' + def.atk + '  射程 ' + def.range,
      x + 82, y + 88, 18, D.color('#7f92b6', a), 0);
  }

  function drawToast() {
    if (!S.toast) return;
    var u = L.ui;
    var a = Math.min(1, S.toast.life / 0.3);
    var w = 224;
    var y = u.field.y + u.field.h * 0.34;
    D.roundRect(u.w / 2 - w / 2, y, w, 42, 21, D.color('#08111f', 0.9 * a));
    D.strokeRect(u.w / 2 - w / 2, y, w, 42, 1, D.color('#2b4470', a));
    D.text(S.toast.text, u.w / 2, y + 10, 18, D.color('#d7e8ff', a), 1);
  }

  function drawButton(label, y, primary) {
    var u = L.ui;
    var w = u.btnW;
    var h = u.btnH;
    var x = u.w / 2 - w / 2;
    D.roundRect(x, y, w, h, h / 2,
      primary ? D.color('#2f7fe0') : D.color('#1f2d4a'));
    if (primary) {
      D.roundRect(x + 2, y + 2, w - 4, h * 0.45, h / 2, D.color('#6cb6ff', 0.35));
    }
    D.text(label, u.w / 2, y + (h - 22) / 2, 28, COL.textMain, 1);
  }

  function drawMenu() {
    var u = L.ui;
    D.roundRect(0, 0, u.w, u.h, 0, D.color('#050a14', 0.9));
    icon('enemy-boss', u.w / 2, u.h * 0.19, 104);
    D.text('塔防小游戏', u.w / 2, u.h * 0.27, 48, COL.textMain, 1);
    D.text('拖动卡牌 · 守护基地', u.w / 2, u.h * 0.27 + 62, 28, COL.textDim, 1);

    var lines = [
      '下方能量条会持续积攒能量',
      '卡牌左上角数字是所需能量',
      '按住卡牌拖到战场即可布阵',
      '向左右滑动卡牌可立即丢弃',
      '坦克·战士·射手·法师 各有定位',
      '共 ' + C.WAVES.length + ' 波，末波首领登场',
    ];
    var y = u.h * 0.42;
    for (var i = 0; i < lines.length; i++) {
      D.text(lines[i], u.w / 2, y + i * 28, 18, D.color('#93a7cc'), 1);
    }
    drawButton('开始游戏', u.btnY.menu, true);
    D.text('点击开始 · 局内右上角可暂停', u.w / 2, u.btnY.menu + 66, 18, D.color('#546b96'), 1);
  }

  function drawPaused() {
    var u = L.ui;
    D.roundRect(0, 0, u.w, u.h, 0, D.color('#04080f', 0.72));
    D.text('已暂停', u.w / 2, u.h * 0.32, 48, COL.textMain, 1);
    D.text('点击右上角按钮继续游戏', u.w / 2, u.h * 0.32 + 66, 18, COL.textDim, 1);
    drawButton('重新开始', u.btnY.paused, false);
  }

  function drawResult(win) {
    var u = L.ui;
    D.roundRect(0, 0, u.w, u.h, 0, D.color('#04080f', 0.82));
    D.text(win ? '胜利' : '失败', u.w / 2, u.h * 0.23, 48,
      win ? COL.gold : COL.hpRed, 1);
    D.text(win ? '你守住了基地！' : '基地被攻破了', u.w / 2, u.h * 0.23 + 62, 28,
      COL.textDim, 1);
    var cleared = win ? C.WAVES.length : S.waveIndex;
    var stats = [
      '抵达波次  ' + Math.max(1, Math.min(cleared, C.WAVES.length)) + '/' + C.WAVES.length,
      '击杀数量  ' + S.kills,
      '上场单位  ' + S.cardsPlaced,
      '剩余基地  ' + Math.max(0, Math.ceil(S.baseHp)) + '/' + C.BASE_HP,
    ];
    for (var i = 0; i < stats.length; i++) {
      D.text(stats[i], u.w / 2, u.h * 0.24 + 118 + i * 32, 28, COL.textMain, 1);
    }
    drawButton('再玩一次', u.btnY.result, true);
  }

  function drawLoading() {
    var u = L.ui && L.ui.ready ? L.ui : { w: C.designW, h: C.designH };
    var w = u.w || C.designW;
    var h = u.h || C.designH;
    D.text('塔防小游戏', w / 2, h * 0.38, 48, COL.textMain, 1);
    D.text(S.phase === 'error' ? '资源加载失败' : '加载中', w / 2, h * 0.38 + 70, 18, COL.textDim, 1);
  }

  A.Hud = {
    CLS_COLOR: CLS_COLOR,
    drawHud: drawHud,
    drawTray: drawTray,
    drawInspect: drawInspect,
    drawToast: drawToast,
    drawMenu: drawMenu,
    drawPaused: drawPaused,
    drawResult: drawResult,
    drawLoading: drawLoading,
    drawDragGhost: Scene.drawDragGhost,
  };
})();
