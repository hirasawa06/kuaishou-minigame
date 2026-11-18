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
  var CARD_TEXT_COLOR = {
    tank: '#456d9a', warrior: '#9b5a28', archer: '#397b4d', mage: '#76539a',
  };
  // 遮罩几何按卡片局部坐标定义；卡片在不同安全区缩放时保持同一圆角轮廓。
  var LEVEL_CARD_MASK = { insetX: 0.024, insetY: 0.025, radius: 0.09 };
  // 导航图标与按钮底板分离：底板/文字按布局实时绘制，图集只保留透明图标。
  var MENU_ICON_CROPS = {
    settings: [160, 48, 315, 332],
    rank: [700, 48, 475, 335],
    collection: [125, 439, 400, 370],
    avatar: [727, 420, 435, 400],
    stamina: [182, 873, 287, 354],
  };
  var menuTextMetrics = {};

  function fmt(n) {
    return String(Math.floor(n));
  }


  // ── 顶部 HUD：波次 / 剩余敌人 / 暂停；合照状态显示在相框旁 ──────

  function drawHud() {
    var u = L.ui;
    var h = u.hud;
    var pb = u.pauseBtn;
    var panelX = u.safeLeft + u.pad;
    var panelY = h.y;
    var panelW = Math.max(1, pb.x - panelX - 5);
    var panel = A.Assets.entry('hud-panel');
    if (panel) {
      D.texture(panel.tex, panel.w, panel.h, 0, 0, panel.w, panel.h,
        panelX, panelY, panelW, h.h);
    } else {
      D.roundRect(panelX, panelY, panelW, h.h, 24, D.color('#ffe4bd'));
    }
    var brown = D.color('#78432b');
    // 避开面板两侧爪印；局内 HUD 不重复相框完好度与上场数量。
    var compact = panelW < 280;
    var left = panelX + (compact ? 37 : 48);
    var right = panelX + panelW - (compact ? 25 : 39);
    var row = panelY + Math.max(10, (h.h - 18) / 2);
    var totalWaves = S.getWaves().length;
    var waveNo = Math.min(S.waveIndex + 1, totalWaves);
    D.text(compact ? '第' + waveNo + '/' + totalWaves + '波'
      : '第 ' + waveNo + '/' + totalWaves + ' 波', left, row, 18, brown, 0);
    var remain = A.Battle.remainingEnemies();
    D.text(compact ? '剩余' + remain : '剩余敌人 ' + remain,
      right, row, 18, brown, 2);

    // 暂停按钮的绘制与命中区同用 Layout.ui.pauseBtn。
    D.roundRect(pb.x, pb.y, pb.w, pb.h, pb.h / 2, D.color('#ad6732'));
    D.roundRect(pb.x + 3, pb.y + 3, pb.w - 6, pb.h - 6, (pb.h - 6) / 2,
      D.color('#ffdeb0'));
    if (S.phase === 'paused') {
      D.roundRect(pb.x + 14, pb.y + 11, 18, 22, 6, brown);
      icon('ui-play', pb.x + pb.w / 2, pb.y + pb.h / 2, 16);
    } else {
      D.roundRect(pb.x + 15, pb.y + 13, 5, 18, 2, brown);
      D.roundRect(pb.x + 25, pb.y + 13, 5, 18, 2, brown);
    }
    var speed = u.speedBtn;
    D.roundRect(speed.x, speed.y, speed.w, speed.h, 12,
      D.color(S.battleSpeed === 2 ? '#b57925' : '#283b53', 0.95));
    D.text(S.battleSpeed + 'x', speed.x + speed.w / 2, speed.y + 13, 18, D.color('#ffe5ac'), 1);

  }

  // ── 金币条 ────────────────────────────────────────────────
  function drawGoldBar() {
    var u = L.ui;
    var gb = u.goldBar;
    if (!gb) return;
    var statusW = u.safeRight - u.pad - gb.x;
    D.roundRect(gb.x, gb.y, statusW, gb.h, gb.h / 2, D.color('#a46537'));
    D.roundRect(gb.x + 2, gb.y + 2, statusW - 4, gb.h - 4,
      (gb.h - 4) / 2, D.color('#ffe8c7'));
    icon('ui-coin', gb.x + gb.h * 0.55, gb.y + gb.h / 2, gb.h * 0.74);
    D.text('金币 ' + fmt(S.gold), gb.x + gb.h * 1.08, gb.y + (gb.h - 18) / 2,
      18, D.color('#78432b'), 0);
  }

  // ── 商店按钮 ──────────────────────────────────────────────
  function drawShopButton(rect, label, sub, enabled, accent, key) {
    var pressed = enabled && S.shopPressed === key;
    var feedback = enabled && S.shopFeedback && S.shopFeedback.key === key && S.shopFeedback.life > 0;
    var progress = feedback ? 1 - S.shopFeedback.life / 0.18 : 1;
    var scale = pressed ? 0.94 : feedback ? 1 + 0.045 * Math.sin(Math.PI * progress) * (1 - progress) : 1;
    var w = rect.w * scale, h = rect.h * scale;
    var x = rect.x + (rect.w - w) / 2, y = rect.y + (rect.h - h) / 2;
    var art = A.Assets.entry('shop-button');
    if (art) {
      D.texture(art.tex, art.w, art.h, 0, 0, art.w, art.h, x, y, w, h,
        enabled ? D.color('#ffffff') : D.color('#9a968e', 0.88));
    } else {
      D.roundRect(x, y, w, h, h / 2,
        enabled ? D.color(accent) : D.color('#a69b8b'));
    }
    var col = enabled ? D.color('#704026') : D.color('#5f5750');
    if (sub) {
      D.text(label, x + 12, y + (h - 18) / 2, 18, col, 0);
      D.text(sub, x + w - 10, y + (h - 18) / 2, 18, col, 2);
    } else {
      D.text(label, x + w / 2, y + (h - 18) / 2, 18, col, 1);
    }
  }

  function drawShop() {
    var u = L.ui;
    var t = u.tray;
    var trayArt = A.Assets.entry('shop-tray');
    if (trayArt) {
      // 木质底板属于展示层，可延伸至屏幕底部；按钮和卡牌仍受安全区布局约束。
      D.texture(trayArt.tex, trayArt.w, trayArt.h, 0, 0, trayArt.w, trayArt.h,
        0, t.y, u.w, u.h - t.y);
    } else {
      D.vGradient(0, t.y, u.w, u.h - t.y, D.color('#c5874b'), D.color('#925832'), 10);
    }
    drawGoldBar();

    // 刷新 / 扩建
    drawShopButton(u.refreshBtn,
      '刷新 ' + S.refreshCost,
      null,
      S.gold >= S.refreshCost, '#ffd166', 'refresh');
    var capFull = S.heroCap >= C.UNIT_CAP_MAX;
    drawShopButton(u.capBtn,
      capFull ? '席位已满' : '扩建 +' + C.UNIT_CAP_STEP + '  ' + S.capCost,
      null,
      !capFull && S.gold >= S.capCost, '#ffd166', 'cap');

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
      var def = S.heroAtStar(slot.cardId, slot.star || 1);
      if (!def) { drawEmptyCell(rect); continue; }
      var lifted = S.dragging && S.dragging.active &&
        S.dragging.kind !== 'unit' && S.dragging.index === i;
      drawHeroCell(def, rect, lifted ? 0.45 : 1, i);
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
      D.text('点卡上阵 · 同星同卡互拖合成',
        u.w / 2, u.contentBottom - 18, 18, D.color('#8a8172'), 1);
    }

  }

  function drawEmptyCell(rect) {
    drawCardShell(rect, 0.72);
  }

  function drawSoldCell(rect) {
    drawEmptyCell(rect);
    drawCardText('已上阵', rect.x + rect.w / 2,
      rect.y + (rect.h - 18) / 2, rect.w - 20,
      D.color('#815d48'), 1);
  }

  // 卡片底板与信息徽章按同一卡片矩形绘制，立绘仍取独立透明美术素材。
  function drawCardShell(rect, alpha) {
    D.creamPanel(rect, alpha, 13);
  }

  function drawCardText(value, x, y, maxW, col, align) {
    if (maxW <= 0) return;
    var atlas = A.FontAtlas['18'];
    var width = D.textWidth(value, atlas);
    D.text(value, x, y, 18, col, align,
      width > maxW ? maxW / width : 1);
  }

  // 费用在右上、锁定按钮在右下；文字仅占头像与角标之间的可用宽度。
  function drawHeroCell(def, rect, alpha, index, isDragPreview) {
    var slot = S.shop[index], star = slot ? slot.star || 1 : 1;
    var cost = slot ? S.shopCost(slot) : def.cost;
    var afford = S.gold >= cost, usable = afford && S.liveUnits() < S.heroCap;
    var a = alpha === undefined ? 1 : alpha;
    var clsCol = D.color(CARD_TEXT_COLOR[def.cls] || '#397b4d', a);
    var drag = S.dragging;
    if (drag && drag.index === index && !drag.active) {
      rect = { x: rect.x + 2, y: rect.y + 1, w: rect.w - 4, h: rect.h - 2 };
    }
    var parts = L.shopCardParts(index, rect);
    var portrait = parts.portrait;
    drawCardShell(rect, a);
    D.roundRect(portrait.x, portrait.y, portrait.w, portrait.h, 8,
      D.color('#e9c9a6', a));
    D.roundRect(portrait.x + 2, portrait.y + 2, portrait.w - 4, portrait.h - 4, 6,
      D.color('#f8e6d2', a));
    var iconSize = Math.max(1, Math.min(portrait.w - 6, portrait.h - 6));
    Scene.heroArt(def, portrait.x + portrait.w / 2,
      portrait.y + portrait.h / 2, iconSize, a);
    // 头像区域可点开详情，提示图标与命中区共用 portrait 几何。
    var infoR = Math.min(7, portrait.w * 0.16);
    D.circle(portrait.x + infoR + 2, portrait.y + infoR + 2, infoR,
      D.color('#fff0d9', a));
    drawCardText('i', portrait.x + infoR + 2, portrait.y + 1,
      infoR * 2 - 2, D.color('#704026', a), 1);
    if (star > 1) {
      var badgeW = Math.min(portrait.w - 4, 28);
      var badgeX = portrait.x + (portrait.w - badgeW) / 2;
      var badgeY = portrait.y + portrait.h - 17;
      D.roundRect(badgeX, badgeY, badgeW, 15, 7,
        D.color(star === 3 ? '#e5b350' : '#a9c9d9', a));
      drawCardText(star + '星', badgeX + badgeW / 2, badgeY - 1,
        badgeW - 3, D.color('#704026', a), 1);
    }

    var tx = parts.textX;
    var nameY = rect.y + (rect.h - 38) / 2;
    var nameW = Math.max(1, parts.cost.x - parts.cost.r - 4 - tx);
    drawCardText(def.name, tx, nameY, nameW, D.color('#663c2b', a), 0);
    var line1 = def.cls === 'tank'
      ? def.clsName + ' · 生命 ' + def.hp
      : def.cls === 'healer' ? def.clsName + ' · 回血 ' + def.heal
        : def.clsName + ' · 攻 ' + def.atk;
    var statRight = parts.lock.x - 3;
    drawCardText(line1, tx, nameY + 20, Math.max(1, statRight - tx), clsCol, 0);

    var cc = parts.cost;
    D.circle(cc.x, cc.y, cc.r,
      afford ? D.color('#ffcb68', a) : D.color('#b9a99a', a));
    D.ring(cc.x, cc.y, cc.r - 0.8, 1.2, D.color('#a66b3b', a));
    drawCardText(String(cost), cc.x, cc.y - 9, cc.r * 2 - 5,
      afford ? D.color('#6f3a20', a) : D.color('#695b52', a), 1);

    if (!usable) D.roundRect(rect.x + 3, rect.y + 3, rect.w - 6,
      rect.h - 6, Math.min(10, rect.h * 0.18), D.color('#f0e0cf', 0.24 * a));
    if (slot) {
      var lock = parts.lock;
      D.roundRect(lock.x, lock.y, lock.w, lock.h, Math.min(8, lock.h / 2),
        D.color(slot.locked ? '#d0e8f2' : '#f6dcc1', a));
      drawCardText(slot.locked ? '已锁' : '锁', lock.x + lock.w / 2,
        lock.y + (lock.h - 18) / 2, lock.w - 3, D.color('#704026', a), 1);
    }
    if (!isDragPreview && drag && drag.active && drag.kind !== 'unit' && drag.mergeTarget === index) {
      D.roundRect(rect.x, rect.y, rect.w, rect.h, 10,
        D.color(drag.mergeValid ? '#276953' : '#833b43', 0.86 * a));
      D.text(drag.mergeValid ? '松手合成 ' + (star + 1) + '星' : '无法合成',
        rect.x + rect.w / 2, rect.y + rect.h / 2 - 9, 18, D.color('#ffffff', a), 1);
    }
  }

  function drawDragGhost() {
    var drag = S.dragging;
    if (!drag || !drag.active || drag.kind === 'unit' || drag.y < L.ui.tray.y) {
      Scene.drawDragGhost();
      return;
    }
    if (!drag.def || !drag.slot || drag.index === undefined) return;
    var rect = L.shopDragRect(drag.index, drag.x, drag.y, drag.startX, drag.startY);
    // 阴影只从底边露出 5px，布局已给安全边界预留对应空间。
    D.roundRect(rect.x + 2, rect.y + 5, rect.w - 4, rect.h, 12,
      D.color('#5e3524', 0.38));
    drawHeroCell(drag.def, rect, 0.98, drag.index, true);
  }

  function drawInspect() {
    if (!S.inspect) return;
    var def = S.inspect;
    var a = 1;
    var w = Math.min(300, L.ui.interactiveRect.w - 16);
    var h = 172;
    var x = S.inspectX === undefined ? L.ui.safeLeft + 8 : S.inspectX;
    var y = S.inspectY === undefined ? L.ui.contentTop + 90 : S.inspectY;
    x = Math.max(L.ui.safeLeft + 8, Math.min(L.ui.safeRight - w - 8, x));
    y = Math.max(L.ui.contentTop + 6, Math.min(L.ui.tray.y - h - 6, y));

    D.roundRect(x, y, w, h, 14, D.color('#a7663d', 0.96 * a));
    D.roundRect(x + 3, y + 3, w - 6, h - 6, 12, D.color('#fff0d9', 0.98 * a));
    Scene.heroArt(def, x + 38, y + 35, 56, a);
    D.text(def.name, x + 72, y + 10, 28, D.color('#704026', a), 0);
    D.text((S.inspectStar || 1) + '星 · ' + def.cost + ' 金币', x + 72, y + 43, 18,
      D.color(CARD_TEXT_COLOR[def.cls], a), 0);
    var maxLineW = w - 28;
    var line = '', line2 = '';
    for (var i = 0; i < def.desc.length; i++) {
      var next = line + def.desc.charAt(i);
      if (!line2 && D.textWidth(next, A.FontAtlas['18']) <= maxLineW) line = next;
      else line2 += def.desc.charAt(i);
    }
    D.text(line, x + 14, y + 70, 18, D.color('#76513c', a), 0);
    if (line2) D.text(line2, x + 14, y + 91, 18, D.color('#76513c', a), 0);
    D.text('生命 ' + def.hp + ' · 攻击 ' + def.atk,
      x + 14, y + 119, 18, D.color('#8b634a', a), 0);
    D.text('射程 ' + (def.range || 0) + ' · 攻速 ' + def.interval,
      x + 14, y + 143, 18, D.color('#8b634a', a), 0);

  }

  function drawToast() {
    var u = L.ui;
    if (!S.toast) {
      if (S.phase === 'playing' && S.cardsPlaced === 0) {
        var hintY = u.field.y + u.field.h * 0.42;
        D.roundRect(u.w / 2 - 127, hintY, 254, 58, 20,
          D.color('#fff0d9', 0.9));
        D.strokeRect(u.w / 2 - 127, hintY, 254, 58, 2,
          D.color('#ae7548', 0.85));
        D.text('点头像看详情 · 点卡牌上场', u.w / 2, hintY + 7, 18,
          D.color('#704026'), 1);
        D.text('自动落在下方 · 拖动可选位置', u.w / 2, hintY + 31, 18,
          D.color('#704026'), 1);
      }
      return;
    }
    var a = Math.min(1, S.toast.life / 0.3);
    var w = 244;
    var y = u.field.y + u.field.h * 0.3;
    D.roundRect(u.w / 2 - w / 2, y, w, 42, 21, D.color('#a96638', 0.94 * a));
    D.roundRect(u.w / 2 - w / 2 + 2, y + 2, w - 4, 38, 19,
      D.color('#ffe7c2', 0.98 * a));
    D.text(S.toast.text, u.w / 2, y + 10, 18, D.color('#704026', a), 1);
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
    var art = primary ? A.Assets.entry('shop-button') : null;
    if (art) {
      D.texture(art.tex, art.w, art.h, 0, 0, art.w, art.h,
        r.x, r.y, r.w, r.h);
    } else {
      D.roundRect(r.x, r.y, r.w, r.h, r.h / 2,
        primary ? D.color('#f0a02a') : D.color('#ffe4bd'));
    }
    if (primary) {
      if (!art) D.strokeRect(r.x, r.y, r.w, r.h, 2, D.color('#a86a14'));
    } else {
      D.strokeRect(r.x, r.y, r.w, r.h, 2,
        D.color(subtle ? '#9a7152' : '#bb8555'));
    }
    D.text(label, r.x + r.w / 2, r.y + (r.h - size) / 2,
      size, D.color('#633b25'), 1);
  }

  // ── 首页（参考图：客厅 + 头像 + 体力 + 设置 / 排行榜 + 章节卡 + 开始） ──
  function menuIcon(key, x, y, w, h) {
    var art = A.Assets.entry('home-menu-icons');
    var crop = MENU_ICON_CROPS[key];
    if (!art || !crop) return;
    D.texture(art.tex, art.w, art.h, crop[0], crop[1], crop[2], crop[3], x, y, w, h);
  }

  function menuIconInBox(key, box) {
    var crop = MENU_ICON_CROPS[key];
    if (!crop) return;
    var fit = Math.min(box.w / crop[2], box.h / crop[3]);
    var w = crop[2] * fit, h = crop[3] * fit;
    menuIcon(key, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
  }

  // 按位图字形的可见范围居中，避免“文字 y 值居中”却压到底边。
  function menuText(str, cx, cy, col, size, scale) {
    size = size || 18;
    scale = scale === undefined ? 1 : scale;
    var cacheKey = size + ':' + str;
    var bounds = menuTextMetrics[cacheKey];
    if (!bounds) {
      var atlas = A.FontAtlas && A.FontAtlas[String(size)];
      if (!atlas) return;
      var glyphs = atlas.glyphs, pen = 0;
      var left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      for (var i = 0; i < str.length; i++) {
        var glyph = glyphs[str.charAt(i)] || glyphs[' '];
        if (!glyph) continue;
        if (!glyph.blank && glyph.w > 0) {
          left = Math.min(left, pen + glyph.ox);
          right = Math.max(right, pen + glyph.ox + glyph.w * 0.5);
          top = Math.min(top, glyph.oy);
          bottom = Math.max(bottom, glyph.oy + glyph.h * 0.5);
        }
        pen += glyph.adv;
      }
      bounds = menuTextMetrics[cacheKey] = { left: left, right: right, top: top, bottom: bottom };
    }
    if (!isFinite(bounds.left)) return;
    D.text(str, cx - (bounds.left + bounds.right) * scale / 2,
      cy - (bounds.top + bounds.bottom) * scale / 2, size, col, 0, scale);
  }

  function menuPaw(cx, cy, unit) {
    var art = A.Assets.entry('home-start-paw');
    if (!art) return;
    var size = 20 * unit;
    D.texture(art.tex, art.w, art.h, 321, 256, 667, 672,
      cx - size / 2, cy - size / 2, size, size);
  }

  function drawMenuStartButton(target, scale, disabled, label) {
    var w = target.w * scale, h = target.h * scale;
    var x = target.x + (target.w - w) / 2;
    var y = target.y + (target.h - h) / 2;
    var unit = Math.min(w / 260.92, h / 85.6);
    var rim = disabled ? '#8c786d' : '#a95617';
    var edge = disabled ? '#b5aba5' : '#dc7817';
    var face = disabled ? '#d3cbc4' : '#ffac2c';
    var light = disabled ? '#e5ddd4' : '#ffd771';
    var ink = disabled ? '#756a63' : '#fff3dc';
    var textScale = disabled ? Math.min(1, 1.17 * unit) : unit;
    var labelSize = disabled ? 28 : 48;
    var centerY = y + h * 0.49;
    var radius = h * 0.48;

    D.roundRect(x, y + 5 * unit, w, h - 2 * unit, radius,
      D.color('#6e391c', disabled ? 0.22 : 0.30));
    D.roundRect(x, y, w, h - 5 * unit, radius, D.color(rim));
    D.roundRect(x + 2 * unit, y + 2 * unit, w - 4 * unit, h - 10 * unit,
      radius - 2 * unit, D.color(edge));
    D.roundRect(x + 5 * unit, y + 5 * unit, w - 10 * unit, h - 16 * unit,
      radius - 5 * unit, D.color(face));
    // 高光只落在胶囊顶部直边内，不越过圆角肩部。
    var shineX = x + radius + 5 * unit;
    var shineW = w - 2 * (radius + 5 * unit);
    D.roundRect(shineX, y + 7 * unit, shineW, 5 * unit,
      2.5 * unit, D.color(light, disabled ? 0.35 : 0.63));
    D.roundRect(shineX + 9 * unit, y + 8 * unit, 32 * unit, 1.5 * unit,
      0.75 * unit, D.color('#fff6db', disabled ? 0.20 : 0.76));

    if (!disabled) {
      var textWidth = D.textWidth(label, A.FontAtlas['48']) * textScale;
      var pawGap = 13 * unit, pawW = 20 * unit;
      var groupW = textWidth + 2 * (pawGap + pawW);
      var groupX = x + (w - groupW) / 2;
      menuPaw(groupX + pawW / 2, centerY, unit);
      menuText(label, x + w / 2, centerY, D.color('#77401e'), labelSize,
        textScale);
      menuText(label, x + w / 2, centerY - 2 * unit, D.color(ink), labelSize,
        textScale);
      menuPaw(groupX + groupW - pawW / 2, centerY, unit);
    } else {
      menuText(label, x + w / 2, centerY, D.color(ink), labelSize, textScale);
    }
  }

  function drawBossLabEntry(target) {
    var active = S.menuPressed === 'bossLab';
    var feedback = S.menuFeedback && S.menuFeedback.key === 'bossLab' && S.menuFeedback.life > 0;
    var scale = active ? 0.95 : feedback ? 1.03 : 1;
    var w = target.w * scale, h = target.h * scale;
    var x = target.x + (target.w - w) / 2, y = target.y + (target.h - h) / 2;
    D.roundRect(x, y + 2, w, h - 2, h / 2, D.color('#754334', 0.95));
    D.roundRect(x + 2, y + 2, w - 4, h * 0.48, Math.max(4, h * 0.38), D.color('#ffe6b8'));
    D.text('查看 Boss 动作', x + w / 2, y + (h - 18) / 2, 18, D.color('#704026'), 1);
  }

  function menuPlate(r, pill) {
    var x = r.x, y = r.y, w = r.w, h = r.h;
    var unit = pill ? h / 44 : w / 78;
    var radius = pill ? h / 2 : 18 * unit;
    var border = 2 * unit, inset = 4 * unit, shadow = 3 * unit;
    D.roundRect(x, y + shadow, w, h - shadow, radius, D.color('#5f3722', 0.25));
    D.roundRect(x, y, w, h - shadow, radius, D.color('#a3663d'));
    D.roundRect(x + border, y + border, w - border * 2, h - shadow - border * 2,
      Math.max(1, radius - border), D.color('#f3cf9e'));
    D.roundRect(x + inset, y + inset, w - inset * 2, h - shadow - inset * 2,
      Math.max(1, radius - inset), D.color('#ffecd2'));
    D.roundRect(x + 10 * unit, y + 7 * unit, 14 * unit, 2 * unit, unit,
      D.color('#ffffff', 0.36));
  }

  function drawMenuControl(key, target, scale) {
    var w = target.w * scale, h = target.h * scale;
    var r = { x: target.x + (target.w - w) / 2,
      y: target.y + (target.h - h) / 2, w: w, h: h };
    if (key === 'stamina') {
      menuPlate(r, true);
      var barUnit = h / 44;
      var boltW = 19 * barUnit, boltH = 25 * barUnit;
      var gap = 5 * barUnit, labelW = 48 * barUnit;
      var valueW = D.textWidth('30/30', A.FontAtlas['18']);
      var compact = target.w < 89 * (target.h / 44) + valueW;
      var groupW = boltW + gap + valueW + (compact ? 0 : labelW + gap);
      var groupX = r.x + (w - groupW) / 2;
      var boltBox = { x: groupX, y: r.y + (h - boltH) / 2,
        w: boltW, h: boltH };
      menuIconInBox('stamina', boltBox);
      if (!compact) {
        var labelX = groupX + boltW + gap;
        D.roundRect(labelX, r.y + (h - 28 * barUnit) / 2,
          labelW, 28 * barUnit, 14 * barUnit, D.color('#794322'));
        menuText('体力', labelX + labelW / 2, r.y + h / 2, D.color('#fff1d9'));
      }
      menuText('30/30', groupX + groupW - valueW / 2,
        r.y + h / 2, D.color('#704026'));
      return;
    }
    menuPlate(r, false);
    var unit = w / 78;
    if (key === 'avatar') {
      D.roundRect(r.x + 5 * unit, r.y + 5 * unit, w - 10 * unit, h - 13 * unit,
        14 * unit,
        D.color('#dcc1d1'));
      A.ProfileUI.avatar(A.Profile.data.avatarIndex,
        r.x + w / 2, r.y + (h - 3 * unit) / 2,
        Math.min(w - 14 * unit, h - 15 * unit));
      return;
    }
    var label = key === 'settings' ? '设置' : key === 'rank' ? '排行榜' : '收藏';
    var showLabel = w >= 64;
    var labelCenterY = r.y + h - 22;
    var iconY = r.y + (showLabel ? 9 * unit : 8 * unit);
    menuIconInBox(key, { x: r.x + 10 * unit, y: iconY,
      w: w - 20 * unit,
      h: showLabel ? Math.min(32 * unit, labelCenterY - 8.5 - iconY - 6 * unit)
        : h - 16 * unit });
    if (showLabel) menuText(label, r.x + w / 2, labelCenterY, D.color('#704026'));
  }

  function drawMenu() {
    var u = L.ui;
    var m = u.menu;
    if (!m) { drawMenuFallback(); return; }
    var art = A.Assets.entry('home-background-clean');
    var cardArt = A.Assets.entry('home-level-card-no-banner');
    var frameOverlayArt = A.Assets.entry('home-level-frame-overlay');
    var arrowArt = A.Assets.entry('home-level-arrows');
    var disabledArrowArt = A.Assets.entry('home-level-arrows-disabled');
    var nameplateArt = A.Assets.entry('home-level-nameplate');
    var lockArt = A.Assets.entry('home-level-lock');
    var frame = u.menuArtwork;
    if (!art || !cardArt || !frameOverlayArt || !arrowArt || !disabledArrowArt || !nameplateArt ||
        !lockArt || !frame) { drawMenuFallback(); return; }

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

    var keys = ['avatar', 'stamina', 'settings', 'rank', 'collection', 'start'];
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var target = m[key];
      if (!target) continue;
      if (key === 'start' && !A.Profile.isLevelUnlocked(S.selectedLevel)) continue;
      var active = S.menuPressed === key;
      var feedback = S.menuFeedback && S.menuFeedback.key === key && S.menuFeedback.life > 0;
      var progress = feedback ? 1 - S.menuFeedback.life / 0.18 : 1;
      var scale = key === 'start'
        ? (active ? 1.045 : feedback ?
          1 + 0.045 * (1 - progress) + 0.03 * Math.sin(progress * Math.PI * 2) * (1 - progress) : 1)
        : (active ? 0.94 : feedback ? 1 - 0.06 * Math.pow(1 - progress, 3) : 1);
      if (key !== 'start') {
        drawMenuControl(key, target, scale);
        continue;
      }
      drawMenuStartButton(target, scale, false, '开始游戏');
    }
    // 背景和卡片是两张独立纹理；选关只移动透明卡片与其动态文案。
    var card = m.card;
    var swipe = S.menuSwipe;
    var slide = S.menuSlide;
    var offset = 0;
    if (slide) {
      var t = Math.min(1, slide.elapsed / slide.duration);
      t = 1 - Math.pow(1 - t, 3);
      offset = slide.offset + (slide.end - slide.offset) * t;
    } else if (swipe) {
      var dx = swipe.x - swipe.startX;
      var dy = swipe.y - swipe.startY;
      if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        offset = Math.max(-card.w * 0.85, Math.min(card.w * 0.85, dx));
        if ((dx > 0 && S.selectedLevel === 1) ||
            (dx < 0 && S.selectedLevel === C.LEVELS.length)) offset *= 0.25;
      }
    }
    var moving = Math.abs(offset) > 0.5;
    var clipY = card.y;
    var clipH = card.h;
    if (moving) {
      // 批次须先提交，再以 WebGL scissor 裁剪两张相邻卡；不改变主包图片。
      A.Render.flush();
      var gl = A.Render.gl;
      var canvas = window.canvas;
      var sx = canvas.width / u.w, sy = canvas.height / u.h;
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(Math.round(card.x * sx), Math.round((u.h - clipY - clipH) * sy),
        Math.round(card.w * sx), Math.round(clipH * sy));
    }
    function drawLevelCard(levelNo, shift) {
      if (levelNo < 1 || levelNo > C.LEVELS.length) return;
      // 只绘透明插画卡片；章节信息统一落入卡片底部信息区。
      var cover = A.Assets.entry('level-cover-' + levelNo);
      if (cover) A.Render.setMaskTexture(frameOverlayArt.tex);
      D.texture(cardArt.tex, cardArt.w, cardArt.h, 46, 266, 1107, 928,
        card.x + shift, clipY, card.w, clipH, undefined, cover ? { alphaCutout: true } : undefined);
      if (cover) A.Render.setMaskTexture(null);
      var container = {
        x: card.x + shift + card.w * 43 / 1107, y: clipY + clipH * 34 / 928,
        w: card.w * 1021 / 1107, h: clipH * 856 / 928,
        radius: card.w * 85 / 1107 + 10,
      };
      if (cover) D.roundTexture(cover.tex, container.x, container.y,
        container.w, container.h, container.radius);
      var unlocked = A.Profile.isLevelUnlocked(levelNo);
      if (!unlocked) {
        // 锁定遮罩由 WebGL 圆角几何绘制；略伸入框内，再以原卡图像素重绘画框。
        // 这样场景四角被遮住，外部背景不会出现随卡片移动的黑色矩形。
        var maskX = cover ? container.x : card.x + shift + card.w * LEVEL_CARD_MASK.insetX;
        var maskY = cover ? container.y : clipY + clipH * LEVEL_CARD_MASK.insetY;
        var maskW = cover ? container.w : card.w * (1 - 2 * LEVEL_CARD_MASK.insetX);
        var maskH = cover ? container.h : clipH * (1 - 2 * LEVEL_CARD_MASK.insetY);
        D.roundRect(maskX, maskY, maskW, maskH, cover ? container.radius : card.w * LEVEL_CARD_MASK.radius,
          D.color('#000000', 0.45));
        // 仅用提取层的 alpha 标识画框；重绘原卡图像素，内外边界不会放大。
        if (!cover) {
          A.Render.setMaskTexture(frameOverlayArt.tex);
          D.texture(cardArt.tex, cardArt.w, cardArt.h, 46, 266, 1107, 928,
            card.x + shift, clipY, card.w, clipH, undefined, { alphaCutout: true });
          A.Render.setMaskTexture(null);
        }
        var scene = { x: card.x + shift + 13, y: card.y + 13,
          w: card.w - 26, h: card.h - 26 };
        var lockW = Math.min(76, scene.w * 0.24);
        var lockH = lockW * 1.25;
        D.texture(lockArt.tex, lockArt.w, lockArt.h, 48, 26, 160, 200,
          scene.x + (scene.w - lockW) / 2, scene.y + (scene.h - lockH) / 2,
          lockW, lockH);
        var hintW = Math.min(186, scene.w - 28);
        D.roundRect(scene.x + (scene.w - hintW) / 2, scene.y + 12,
          hintW, 29, 14, D.color('#3c2a25', 0.78));
        D.text('先通关第 ' + (levelNo - 1) + ' 关',
          scene.x + scene.w / 2, scene.y + 17, 18, D.color('#fff1d9'), 1);
      }
      var status = m.levelStatus;
      D.texture(nameplateArt.tex, nameplateArt.w, nameplateArt.h, 27, 32, 970, 270,
        status.x + shift, status.y, status.w, status.h);
      var medallionX = status.x + shift + status.w * 0.125;
      var nameX = status.x + shift + status.w * 0.61;
      D.text(String(levelNo), medallionX, status.y + 12, 28, D.color('#784323'), 1);
      D.text('关', medallionX, status.y + 46, 18, D.color('#784323'), 1);
      D.text(C.LEVELS[levelNo - 1].name,
        nameX, status.y + 12, 18, D.color('#784323'), 1);
      D.text(levelNo + '/' + C.LEVELS.length + ' · ' + (unlocked ?
        (levelNo <= A.Profile.data.completedLevel ? '已通关' : '可挑战') : '未解锁'),
        nameX, status.y + 45, 18, D.color(unlocked ? '#784323' : '#8f8276'), 1);
    }
    drawLevelCard(S.selectedLevel, offset);
    if (moving) {
      var neighbor = offset < 0 ? S.selectedLevel + 1 : S.selectedLevel - 1;
      drawLevelCard(neighbor, offset + (offset < 0 ? card.w : -card.w));
      A.Render.flush();
      gl.disable(gl.SCISSOR_TEST);
    }
    var unlocked = A.Profile.isLevelUnlocked(S.selectedLevel);
    var nav = [m.levelPrev, m.levelNext];
    for (var ni = 0; ni < nav.length; ni++) {
      var nr = nav[ni];
      var enabled = !slide && (ni === 0 ? S.selectedLevel > 1 : S.selectedLevel < C.LEVELS.length);
      var pressed = S.menuPressed === (ni === 0 ? 'levelPrev' : 'levelNext');
      var size = nr.w * (pressed ? 1.08 : 1);
      var arrowSprite = enabled ? arrowArt : disabledArrowArt;
      D.texture(arrowSprite.tex, arrowSprite.w, arrowSprite.h,
        ni === 0 ? 60 : 305, 12, 145, 155,
        nr.x + (nr.w - size) / 2, nr.y + (nr.h - size) / 2, size, size);
    }
    if (!unlocked) {
      drawMenuStartButton(m.start, 1, true, '尚未解锁');
    }
    drawBossLabEntry(m.bossLab);
    if (S.toast) {
      D.text(S.toast.text, m.card.x + m.card.w / 2, m.card.y + 12, 18, D.color('#fff0d4'), 1);
    }
    if (S.menuPanel) drawMenuPanel(m);
  }

  function drawBossLab() {
    var lab = L.ui.bossLab;
    var preview = S.bossLab;
    if (!lab || !preview) return;
    D.creamPanel(lab.header, 1, 16);
    D.text('双开门冰箱怪 · 动作场', lab.header.x + 16,
      lab.header.y + (lab.header.h - 18) / 2, 18, D.color('#704026'), 0);
    D.circle(lab.close.x + lab.close.w / 2, lab.close.y + lab.close.h / 2,
      lab.close.h * 0.32, D.color('#9b542c'));
    icon('ui-close', lab.close.x + lab.close.w / 2, lab.close.y + lab.close.h / 2,
      lab.close.h * 0.42);
    var labels = { idle: '待机', move: '移动', atk: '单体攻击',
      aoe: '范围攻击', hurt: '受击', die: '倒地' };
    for (var key in lab.buttons) {
      var r = lab.buttons[key];
      var active = preview.action === key;
      D.roundRect(r.x, r.y, r.w, r.h, r.h * 0.42,
        D.color(active ? '#b75d2c' : '#754334'));
      D.roundRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, Math.max(4, r.h * 0.37),
        D.color(active ? '#ffd16f' : '#ffe3bd'));
      D.text(labels[key], r.x + r.w / 2, r.y + (r.h - 18) / 2, 18,
        D.color(active ? '#693510' : '#704026'), 1);
    }
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
    var u = L.ui, pause = u.pausePanel, panel = pause.panel;
    D.rect(0, 0, u.w, u.h, D.color('#3e2419', 0.44));
    D.creamPanel(panel, 1, 22);
    D.roundRect(panel.x + 7, panel.y + 7, panel.w - 14,
      pause.headerH - 11, 17, D.color('#f5d29f'));
    resultText('已暂停', panel.x + panel.w / 2,
      panel.y + (pause.compact ? 24 : 31), panel.w - 40,
      pause.compact ? 28 : 48, '#704026', 1);
    // 四枚按钮与触摸共用 pausePanel.btn；短屏收紧字号与间距。
    var buttonFont = pause.compact ? 18 : 28;
    drawResultButton('继续游戏', pause.btn('resume'), true, buttonFont);
    drawResultButton('设置', pause.btn('settings'), false, buttonFont);
    drawResultButton('重新开始', pause.btn('restart'), false, buttonFont);
    drawResultButton('返回主页', pause.btn('home'), false, buttonFont);
  }

  function resultText(value, x, y, maxW, size, color, align) {
    var width = D.textWidth(value, A.FontAtlas[String(size)]);
    D.text(value, x, y, size, D.color(color), align,
      width > maxW ? maxW / width : 1);
  }

  function drawResultButton(label, rect, primary, fontSize) {
    var r = rect.h / 2;
    D.roundRect(rect.x, rect.y + 2, rect.w, rect.h - 2, r,
      D.color(primary ? '#a95316' : '#a96e44'));
    D.roundRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 6, r - 2,
      D.color(primary ? '#ef8d18' : '#e4b987'));
    D.roundRect(rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 10, r - 4,
      D.color(primary ? '#ffb234' : '#fff0d9'));
    D.roundRect(rect.x + r, rect.y + 5, rect.w - 2 * r, 2, 1,
      D.color('#ffffff', primary ? 0.65 : 0.4));
    var size = fontSize || (primary && rect.h >= 44 ? 28 : 18);
    resultText(label, rect.x + rect.w / 2, rect.y + (rect.h - size) / 2 - 1,
      rect.w - 20, size, '#704026', 1);
  }

  function drawResult(win) {
    var u = L.ui, result = u.result, panel = result.panel;
    var cx = panel.x + panel.w / 2;
    D.rect(0, 0, u.w, u.h, D.color('#3e2419', 0.5));
    D.creamPanel(panel, 1, 22);
    D.roundRect(panel.x + 7, panel.y + 7, panel.w - 14,
      result.headerH - 11, 17, D.color('#f5d29f'));
    var nextUnlocked = win && S.currentLevel < C.LEVELS.length;
    var chapter = '第 ' + S.currentLevel + ' 关' + (nextUnlocked ? ' · 下一关已解锁' : '');
    resultText(chapter, cx, panel.y + 10, panel.w - 32, 18, '#8a6248', 1);
    var titleSize = result.compact ? 28 : 48;
    resultText(win ? '胜利' : '失败', cx, panel.y + (result.compact ? 29 : 31),
      panel.w - 32, titleSize, win ? '#aa671f' : '#b04f4c', 1);
    resultText(win ? '合照守住了！' : '合照被毁了', cx,
      panel.y + (result.compact ? 58 : 83), panel.w - 32,
      result.compact ? 18 : 28, '#704026', 1);

    var hasNotice = win && S.unlockNotice && S.unlockNotice.length;
    if (hasNotice) {
      var notice = result.notice;
      D.roundRect(notice.x, notice.y, notice.w, notice.h, 12, D.color('#dba36b'));
      D.roundRect(notice.x + 2, notice.y + 2, notice.w - 4, notice.h - 4,
        10, D.color('#fff2df'));
      resultText('新伙伴已解锁', notice.x + notice.w / 2, notice.y + 5,
        notice.w - 20, 18, '#a86a24', 1);
      var itemW = notice.w / S.unlockNotice.length;
      var iconSize = result.compact ? 22 : 28;
      var itemY = notice.y + (result.compact ? 39 : 51);
      for (var ni = 0; ni < S.unlockNotice.length; ni++) {
        var hero = S.heroById(S.unlockNotice[ni]);
        if (!hero) continue;
        var itemX = notice.x + itemW * ni + 9;
        var artX = itemX + iconSize / 2;
        if (A.HeroForms) A.HeroForms.draw(hero.id, 2, artX, itemY, iconSize);
        else icon(hero.icon, artX, itemY, iconSize);
        resultText(hero.name, itemX + iconSize + 5, itemY - 9,
          itemW - iconSize - 20, 18, '#704026', 0);
      }
    }

    var totalWaves = S.getWaves().length;
    var cleared = win ? totalWaves : S.waveIndex;
    var stats = [
      ['抵达波次', Math.max(1, Math.min(cleared, totalWaves)) + '/' + totalWaves],
      ['击杀数量', String(S.kills)],
      ['累计金币', String(S.goldEarned)],
      ['上阵英雄', String(S.cardsPlaced)],
      ['合照完好', Math.max(0, Math.ceil(S.baseHp)) + '/' + C.BASE_HP],
    ];
    var statsY = hasNotice ? result.statsY :
      result.infoTop + Math.max(0, (result.infoH - stats.length * result.statsGap) / 2);
    var left = panel.x + 27, right = panel.x + panel.w - 27;
    for (var i = 0; i < stats.length; i++) {
      var rowY = statsY + i * result.statsGap;
      resultText(stats[i][0], left, rowY, panel.w * 0.48, 18, '#76513c', 0);
      resultText(stats[i][1], right, rowY, panel.w * 0.36, 18, '#704026', 2);
    }

    if (nextUnlocked) drawResultButton('下一关', u.resultNext, true);
    else resultText(win ? '全部关卡已通关' : '调整阵容，再试一次',
      cx, u.resultNext.y + (u.resultNext.h - 18) / 2,
      panel.w - 36, 18, '#8a6248', 1);
    drawResultButton('再玩一次', u.resultReplay, !win);
    drawResultButton('返回选关', u.resultHome, false);
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
    drawBossLab: drawBossLab,
    drawPaused: drawPaused,
    drawResult: drawResult,
    drawLoading: drawLoading,
    drawDragGhost: drawDragGhost,
  };
})();
