/* gameplay/render/battle-shop.js — Figma 275:246 战斗底部操作台 */
(function () {
  var A = window.AIGCUtils;
  var C = A.Config;
  var S = A.State;
  var L = A.Layout;
  var D = A.Render.draw;

  function art(key) {
    return A.Assets && A.Assets.entry ? A.Assets.entry(key) : null;
  }

  function image(key, rect, alpha, tint) {
    var source = art(key);
    if (!source) return false;
    D.texture(source.tex, source.w, source.h, 0, 0, source.w, source.h,
      rect.x, rect.y, rect.w, rect.h, D.color(tint || '#ffffff', alpha === undefined ? 1 : alpha));
    return true;
  }

  function scaled(rect, scale) {
    var w = rect.w * scale;
    var h = rect.h * scale;
    return { x: rect.x + (rect.w - w) / 2, y: rect.y + (rect.h - h) / 2, w: w, h: h };
  }

  function drawTray() {
    var u = L.ui;
    var source = art('battle-tray');
    // ── 背景底部延伸20px；排除原图右侧透明留白，保持顶部与操作区域 ──
    var tray = { x: 0, y: u.tray.y, w: u.w, h: u.h - u.tray.y + 20 };
    if (source) {
      D.nineSlice(source, tray, { left: 32, right: 32, top: 32, bottom: 16, width: 414 }, 1);
    } else {
      D.vGradient(tray.x, tray.y, tray.w, tray.h,
        D.color('#fff0d9'), D.color('#f2c981'), 14);
    }
  }

  function drawGold() {
    var bar = L.ui.goldBar;
    var s = L.ui.battleScale;
    var y = bar.y - 6 * s;
    var token = { x: bar.x, y: y, w: 38 * s, h: 38 * s };
    if (!image('battle-paw-token', token)) D.circle(bar.x + 19 * s, y + 19 * s, 16 * s, D.color('#f7a93b'));
    D.text(String(Math.floor(S.gold)), bar.x + 40 * s, y + 7 * s,
      24 * s, D.color('#80501f'), 0);
    // ── 成员占用共用战斗实时数量，字号与刷新、扩建文字一致 ──
    D.text('成员 ' + S.liveUnits() + '/' + S.heroCap, bar.x + 4 * s,
      y + 38 * s, 16 * s, D.color('#80501f'), 0);
  }

  function pressScale(key, enabled) {
    if (!enabled) return 1;
    if (S.shopPressed === key) return 0.94;
    var feedback = S.shopFeedback;
    if (!feedback || feedback.key !== key || feedback.life <= 0) return 1;
    var progress = 1 - feedback.life / 0.18;
    return 1 + 0.035 * Math.sin(Math.PI * progress) * (1 - progress);
  }

  function drawAction(key, rect, label, cost, enabled) {
    var s = L.ui.battleScale;
    var box = scaled(rect, pressScale(key, enabled));
    var source = key === 'refresh' ? 'battle-expand' : 'battle-refresh';
    if (!image(source, box, enabled ? 1 : 0.55)) {
      D.roundRect(box.x, box.y, box.w, box.h, 18 * s, D.color('#e89b37', enabled ? 1 : 0.55));
    }
    var col = D.color('#ffffff', enabled ? 1 : 0.7);
    // ── 内容整体对齐按钮主体中心，排除底部阴影；横向间距保持 ──
    var centerY = box.y + box.h / 2 - 3 * s;
    var costX = box.x + 59 * s, costW = D.textWidth(String(cost), 20 * s);
    D.centeredText(label, box.x + 36 * s, centerY, 16 * s, col);
    D.centeredText(String(cost), costX + costW / 2, centerY, 20 * s, col);
    var paw = { x: costX + costW + 2,
      y: centerY - 10 * s, w: 20 * s, h: 20 * s };
    if (!image('battle-white-bone', paw, enabled ? 1 : 0.6)) {
      D.circle(paw.x + paw.w / 2, paw.y + paw.h / 2, paw.w * 0.42, D.color('#f5a531'));
    }
  }

  function drawStars(rect, star, alpha) {
    var s = L.ui.battleScale;
    var count = Math.max(1, Math.min(3, star || 1));
    if (count === 1) return;
    // ── 底板覆盖到外框同一轮廓，消除内沿两次抗锯齿叠加形成的浅色缝 ──
    var x = rect.x, y = rect.y;
    var w = (count * 12 + 22) * s, h = 26 * s;
    A.Render.push(x, y, w, h, D.color('#BA6F19', alpha),
      { mode: 9, hw: w / 2, hh: h / 2, r: 20 * s });
    for (var i = 0; i < count; i++) {
      D.star(x + (12 + i * 12) * s, y + 9 * s, 10 * s, D.color('#fff8ce', alpha));
    }
  }

  function drawShell(rect, alpha) {
    var s = L.ui.battleScale;
    D.roundRect(rect.x, rect.y, rect.w, rect.h, 20 * s, D.color('#BA6F19', alpha));
    D.roundRect(rect.x + 2 * s, rect.y + 2 * s, rect.w - 4 * s, rect.h - 4 * s,
      18 * s, D.color('#fff7ec', alpha));
  }

  function drawLocked(parts, locked, alpha) {
    var s = L.ui.battleScale;
    var circle = parts.lockBackground;
    D.circle(circle.x + circle.w / 2, circle.y + circle.h / 2, circle.w / 2,
      D.color('#f5dfba', alpha));
    image(locked ? 'battle-lock-closed' : 'battle-lock-open', parts.lock, alpha,
      locked ? '#ffffff' : '#a07850');
  }

  function drawCard(def, rect, alpha, index, dragging) {
    var s = L.ui.battleScale;
    var slot = S.shop[index] || {};
    var cost = S.shopCost ? S.shopCost(slot) : def.cost;
    var usable = S.gold >= cost && S.liveUnits() < S.heroCap;
    var parts = L.shopCardParts(index, rect);
    drawShell(rect, alpha);
    var portrait = art('battle-shop-' + def.id);
    if (portrait) {
      // ── Figma：完整102×102立绘向左和底部延伸，由卡片圆角容器裁切 ──
      var size = 102 * s;
      var fit = size / Math.max(portrait.w, portrait.h);
      var portraitW = portrait.w * fit, portraitH = portrait.h * fit;
      A.Render.setClipRect({ x: rect.x + 2 * s, y: rect.y + 2 * s,
        w: rect.w - 4 * s, h: rect.h - 4 * s }, 18 * s);
      D.texture(portrait.tex, portrait.w, portrait.h,
        0, 0, portrait.w, portrait.h,
        rect.x - 14 * s + (size - portraitW) / 2,
        rect.y + (size - portraitH) / 2, portraitW, portraitH,
        D.color('#ffffff', alpha));
      A.Render.setClipRect(null);
    }
    drawStars(rect, slot.star || 1, alpha);
    D.fittedText(def.name, parts.textX, rect.y + 10 * s, 16 * s,
      93 * s, D.color('#80501f', alpha), 0);
    D.text(String(cost), parts.cost.x, parts.cost.y, 20 * s,
      D.color(usable ? '#80501f' : '#9a8877', alpha), 0);
    image('battle-paw-token', { x: parts.cost.x + D.textWidth(String(cost), 20 * s) + 2,
      y: rect.y + 34 * s,
      w: 19 * s, h: 19 * s }, alpha);
    // 锁按钮最后绘制，不受资源不足置灰层覆盖。
    if (!usable) D.roundRect(rect.x + 2 * s, rect.y + 2 * s, rect.w - 4 * s,
      rect.h - 4 * s, 18 * s, D.color('#d2c8bd', 0.22 * alpha));
    drawLocked(parts, !!slot.locked, alpha);
    var drag = S.dragging;
    if (!dragging && drag && drag.active && drag.kind !== 'unit' && drag.mergeTarget === index) {
      D.roundRect(rect.x, rect.y, rect.w, rect.h, 20 * s,
        D.color(drag.mergeValid ? '#276953' : '#833b43', 0.82 * alpha));
      D.text(drag.mergeValid ? '松手合成' : '无法合成', rect.x + rect.w / 2,
        rect.y + 26 * s, 16 * s, D.color('#ffffff', alpha), 1);
    }
  }

  function drawEmpty(rect, label) {
    drawShell(rect, 0.62);
    if (label) D.text(label, rect.x + rect.w / 2, rect.y + rect.h / 2 - 9,
      16 * L.ui.battleScale, D.color('#9a8877'), 1);
  }

  function drawShop() {
    var u = L.ui;
    drawTray();
    drawGold();
    drawAction('refresh', u.refreshBtn, '刷新', S.refreshCost, S.gold >= S.refreshCost);
    var capFull = S.heroCap >= C.UNIT_CAP_MAX;
    drawAction('cap', u.capBtn, '扩建', capFull ? '满' : S.capCost, !capFull && S.gold >= S.capCost);
    for (var i = 0; i < C.cardCount; i++) {
      var rect = L.shopRect(i);
      var slot = S.shop[i];
      if (!slot) { drawEmpty(rect); continue; }
      if (slot.sold) { drawEmpty(rect, '已上阵'); continue; }
      var def = S.heroAtStar(slot.cardId, slot.star || 1);
      if (!def) { drawEmpty(rect); continue; }
      var lifted = S.dragging && S.dragging.active && S.dragging.kind !== 'unit' && S.dragging.index === i;
      drawCard(def, rect, lifted ? 0.4 : 1, i, false);
    }
    drawSellZone();
  }

  function drawSellZone(unit) {
    var drag = S.dragging;
    if (!unit && (!drag || drag.kind !== 'unit' || !drag.active)) return;
    unit = unit || drag.unit;
    var sell = L.ui.sellZone;
    // ── 底色延展至画布底部；热区与文案仍使用原出售区 ──
    var bottom = sell.y + sell.h;
    D.roundRect(sell.x, bottom - 1, sell.w, L.ui.h - bottom + 2, 0, D.color('#874732'));
    // ── 圆弧顶部：同心圆裁切形成3px描边，底部平直铺满出售区 ──
    var rise = sell.h * 0.4, radius = sell.w * sell.w / (8 * rise) + rise / 2;
    var cx = sell.x + sell.w / 2, cy = sell.y + radius;
    A.Render.setClipRect(sell);
    D.circle(cx, cy, radius, D.color('#FDD199'));
    D.circle(cx, cy, radius - 3, D.color('#874732'));
    A.Render.setClipRect(null);
    var inside = drag && drag.active && drag.kind === 'unit' &&
      drag.x >= sell.x && drag.x <= sell.x + sell.w &&
      drag.y >= sell.y && drag.y <= sell.y + sell.h;
    var price = A.Battle.sellPrice(unit), font = 24, zoom = inside ? 1.05 : 1;
    var label = '出售 +' + price, iconW = 24;
    var textW = D.textWidth(label, font) * zoom, x = cx - (textW + iconW + 4) / 2;
    var y = sell.y + sell.h * 0.56;
    D.centeredText(label, x + textW / 2, y, font, D.color('#ffffff'), zoom);
    var ix = x + textW + 4, white = D.color('#ffffff');
    // ── 保留24×18图标轮廓；外围1px留白容纳抗锯齿 ──
    A.Render.push(ix - 1, y - 10, 26, 20, white, { mode: 16, hw: 13, hh: 10 });
  }

  function drawDragCard(def, rect, index) {
    drawCard(def, rect, 0.98, index, true);
  }

  A.BattleShopUI = { draw: drawShop, drawDragCard: drawDragCard, drawSellZone: drawSellZone };
})();
