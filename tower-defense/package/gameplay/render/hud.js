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
    collection: [125, 439, 400, 370],
    bolt: [182, 873, 287, 354],
  };

  function fmt(n) {
    return String(Math.floor(n));
  }


  // ── 顶部 HUD：波次 / 剩余敌人 / 暂停；合照状态显示在相框旁 ──────

  function drawHud() {
    var u = L.ui;
    var plate = u.wavePlate;
    var pb = u.pauseBtn;
    var s = u.battleScale;
    var brown = D.color('#80501f');
    var totalWaves = S.getWaves().length;
    var waveNo = Math.min(S.waveIndex + 1, totalWaves);
    D.roundRect(plate.x, plate.y, plate.w, plate.h, 20 * s, D.color('#fff9ef', 0.96));
    D.ring(plate.x + plate.w / 2, plate.y + plate.h / 2, plate.h / 2 - s,
      s, D.color('#f3c88f', 0.75));
    D.fittedText('第' + waveNo + '/' + totalWaves + '波 ×' + S.battleSpeed,
      plate.x + plate.w / 2, plate.y + 11 * s, 16 * s, plate.w - 12 * s, brown, 1);

    // 暂停按钮与热区共用 Layout.ui.pauseBtn，保留 Figma 的轻色圆牌。
    D.roundRect(pb.x, pb.y, pb.w, pb.h, 20 * s, D.color('#fff9ef', 0.96));
    D.ring(pb.x + pb.w / 2, pb.y + pb.h / 2, pb.h / 2 - s, s, D.color('#f3c88f', 0.75));
    if (S.phase === 'paused') {
      icon('ui-play', pb.x + pb.w / 2, pb.y + pb.h / 2, 16 * s);
    } else {
      D.roundRect(pb.x + 13 * s, pb.y + 11 * s, 5 * s, 18 * s, 2 * s, brown);
      D.roundRect(pb.x + 22 * s, pb.y + 11 * s, 5 * s, 18 * s, 2 * s, brown);
    }
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
    D.fittedText(value, x, y, 16, maxW, col, align);
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
    var line1 = def.cls === 'tank'
      ? def.clsName + '·生命' + Math.round(def.hp)
      : def.cls === 'healer' ? def.clsName + '·回血' + Math.round(def.heal)
        : def.clsName + '·攻击' + Math.round(def.atk);
    var statRight = parts.lock.x - 3;
    var statW = Math.max(1, statRight - tx);
    // 两行使用相同字号与缩放，分隔点两侧不再占用空格。
    var fontSize = Math.min(D.fitTextSize(def.name, 18, nameW),
      D.fitTextSize(line1, 18, statW));
    D.fittedText(def.name, tx, nameY, fontSize, nameW, D.color('#663c2b', a), 0);
    D.fittedText(line1, tx, nameY + 20, fontSize, statW, clsCol, 0);

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
    A.BattleShopUI.drawDragCard(drag.def, rect, drag.index);
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
      if (!line2 && D.textWidth(next, 18) <= maxLineW) line = next;
      else line2 += def.desc.charAt(i);
    }
    D.text(line, x + 14, y + 70, 18, D.color('#76513c', a), 0);
    if (line2) D.text(line2, x + 14, y + 91, 18, D.color('#76513c', a), 0);
    D.text('生命 ' + Math.round(def.hp) + ' · 攻击 ' + Math.round(def.atk),
      x + 14, y + 119, 18, D.color('#8b634a', a), 0);
    D.text('射程 ' + Math.round(def.range || 0) + ' · 间隔 ' + Math.round(def.interval * 1000) + '毫秒',
      x + 14, y + 143, 18, D.color('#8b634a', a), 0);

  }

  function drawToast() {
    var u = L.ui;
    // Figma 战场默认保持干净；只在产生真实操作反馈时显示轻提示。
    if (!S.toast) return;
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

  // ── 首页（客厅 + 头像 + 体力入口 + 设置 / 收藏 + 章节卡 + 开始） ──
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
  function menuText(str, cx, cy, col, size) {
    D.centeredText(str, cx, cy, size || 20, col);
  }

  // ── 代码绘制：深橙厚边、纯色面板和顶部柔和内高光 ──
  function drawStartSurface(x, y, w, h) {
    var inset = 1.5, depth = 4;
    D.roundRect(x, y, w, h, h / 2, D.color('#D87A09'));
    var faceW = w - inset * 2, faceH = h - depth - inset;
    A.Render.push(x + inset, y + inset, faceW, faceH, D.color('#FFA400'),
      { mode: 10, hw: faceW / 2, hh: faceH / 2, r: faceH / 2 });
  }

  // ── 首页主按钮：参考图金橙色材质，白字独立居中 ──
  function drawMenuStartButton(target, scale, disabled, label) {
    var w = target.w * scale, h = target.h * scale;
    var x = target.x + (target.w - w) / 2, y = target.y + (target.h - h) / 2;
    if (disabled) D.roundRect(x, y, w, h, h / 2, D.color('#ded6cc'));
    else drawStartSurface(x, y, w, h);
    menuText(label, x + w / 2, y + h / 2,
      D.color(disabled ? '#756a63' : '#ffffff'), disabled ? 24 : 32);
  }

  function menuPlate(r, pill) {
    var x = r.x, y = r.y, w = r.w, h = r.h;
    var unit = pill ? h / 44 : w / 78;
    var radius = pill ? h / 2 : 18 * unit;
    var border = 2 * unit, inset = 4 * unit;
    D.roundRect(x, y, w, h, radius, D.color('#a3663d'));
    D.roundRect(x + border, y + border, w - border * 2, h - border * 2,
      Math.max(1, radius - border), D.color('#f3cf9e'));
    D.roundRect(x + inset, y + inset, w - inset * 2, h - inset * 2,
      Math.max(1, radius - inset), D.color('#ffecd2'));
    D.roundRect(x + 10 * unit, y + 7 * unit, 14 * unit, 2 * unit, unit,
      D.color('#ffffff', 0.36));
  }

  function drawMenuControl(key, target, scale) {
    var w = target.w * scale, h = target.h * scale;
    var r = { x: target.x + (target.w - w) / 2,
      y: target.y + (target.h - h) / 2, w: w, h: h };
    if (key === 'stamina') {
      var barUnit = h / 44;
      var boltW = 19 * barUnit, boltH = 25 * barUnit;
      var gap = 5 * barUnit;
      // 快照负责按时间恢复；这里只展示，不改变体力计算。
      var stamina = A.Profile.getStaminaSnapshot();
      var value = stamina.value + '/' + stamina.max;
      var valueFontSize = 16;
      var seconds = Math.ceil(stamina.nextRecoveryMs / 1000);
      var timer = stamina.value >= stamina.max ? '' :
        Math.floor(seconds / 60) + ':' + ('0' + (seconds % 60)).slice(-2) + ' +1';
      var timerFontSize = 12;
      var timerGap = timer ? 7 * barUnit : 0;
      var valueW = D.textWidth(value, valueFontSize);
      var timerWidth = D.textWidth(timer, timerFontSize);
      var rowW = boltW + gap + valueW + timerGap + timerWidth;
      // --- 左侧锚点固定，按内容宽度加左右12设计像素，同步点击区域 ---
      var padding = 12 * barUnit;
      r.x = target.x;
      r.w = rowW + padding * 2;
      target.w = r.w / scale;
      menuPlate(r, true);
      var rowX = r.x + padding;
      menuIconInBox('bolt', { x: rowX, y: r.y + (h - boltH) / 2, w: boltW, h: boltH });
      var valueX = rowX + boltW + gap;
      menuText(value, valueX + valueW / 2,
        r.y + h / 2, D.color('#704026'), valueFontSize);
      menuText(timer, valueX + valueW + timerGap + timerWidth / 2,
        r.y + h / 2, D.color('#916b50'), timerFontSize);
      return;
    }
    var unit = w / 78;
    if (key === 'avatar') {
      // --- 首页头像：奶油色厚框保留，无紫色夹层，四边等距 ---
      menuPlate(r, false);
      var avatarSize = Math.min(w, h) - 12 * unit;
      A.ProfileUI.avatar(A.Profile.data.avatarIndex,
        r.x + w / 2, r.y + h / 2, avatarSize, true);
      return;
    }
    menuPlate(r, false);
    var label = key === 'settings' ? '设置' : '收藏';
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

    var keys = ['avatar', 'stamina', 'settings', 'collection', 'start'];
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
      drawMenuStartButton(target, scale, false, '开始保卫');
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
      // ── 裁剪区包含封面顶部信息条，滑动时不截掉圆章 ──────
      var scissorTop = Math.min(clipY, m.levelStatus.y - 2);
      gl.scissor(Math.round(card.x * sx), Math.round((u.h - clipY - clipH) * sy),
        Math.round(card.w * sx), Math.round((clipY + clipH - scissorTop) * sy));
    }
    function drawLevelCard(levelNo, shift) {
      if (levelNo < 1 || levelNo > C.LEVELS.length) return;
      // 先绘封面，再叠加顶部关卡信息条。
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
      var unlocked = A.Profile.isLevelUnlocked(levelNo);
      var blur = levelNo >= A.Profile.data.completedLevel + 3;
      if (cover) D.roundTexture(cover.tex, container.x, container.y,
        container.w, container.h, container.radius, !unlocked, blur);
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
      }
      var status = m.levelStatus;
      D.texture(nameplateArt.tex, nameplateArt.w, nameplateArt.h, 0, 0, nameplateArt.w, nameplateArt.h,
        status.x + shift, status.y, status.w, status.h);
      // ── 单行名称与纯数字，锚点来自新素材中心 ────────────
      var medallionX = status.x + shift + status.w * 192 / 1296;
      var nameX = status.x + shift + status.w * 0.625;
      var textCenterY = status.y + status.h * 0.55;
      D.centeredText(String(levelNo), medallionX, status.y + status.h * 220 / 404,
        24, D.color('#784323'));
      D.text(C.LEVELS[levelNo - 1].name,
        nameX, textCenterY - 10, 20, D.color('#784323'), 1);
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
    if (S.toast) {
      D.text(S.toast.text, m.card.x + m.card.w / 2, m.card.y + 12, 18, D.color('#fff0d4'), 1);
    }
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

  function drawMenuFallback() {
    var u = L.ui;
    D.roundRect(0, 0, u.w, u.h, 0, D.color('#f6ead8', 1));
    D.text('塔防小游戏', u.w / 2, u.contentTop + u.contentH * 0.3, 48, D.color('#5b4126'), 1);
    drawButton('开始保卫', u.btnY.menu, true);
  }

  function drawStartButton(r) {
    D.roundRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, r.h / 2, D.color('#c47a22', 0.35));
    D.roundRect(r.x, r.y, r.w, r.h, r.h / 2, D.color('#f5a623'));
    D.roundRect(r.x + 4, r.y + 4, r.w - 8, r.h * 0.44, r.h / 2, D.color('#ffd07a', 0.9));
    D.strokeRect(r.x, r.y, r.w, r.h, 2, D.color('#c07a18'));
    icon('ui-coin', r.x + 26, r.y + r.h / 2, 26, 0.0);
    D.text('开始保卫', r.x + r.w / 2, r.y + (r.h - 32) / 2, 48, D.color('#5a3208'), 1);
  }

  function drawPaused() {
    var u = L.ui, pause = u.pausePanel, panel = pause.panel;
    D.rect(0, 0, u.w, u.h, D.color('#3e2419', 0.44));
    A.ProfileUI.dialogPaper(panel, pause.headerH, '已暂停');
    // --- 复用局外弹窗的字体、渐变与阴影，四个按钮共用命中布局 ---
    A.ProfileUI.dialogButton(pause.btn('resume'), '继续游戏');
    A.ProfileUI.dialogButton(pause.btn('settings'), '设置');
    A.ProfileUI.dialogButton(pause.btn('restart'), '重新开始');
    A.ProfileUI.dialogButton(pause.btn('home'), '返回主页');
  }

  function resultText(value, x, y, maxW, size, color, align) {
    D.fittedText(value, x, y, size, maxW, D.color(color), align);
  }

  function drawResult(win) {
    var u = L.ui, result = u.result, panel = result.panel;
    var cx = panel.x + panel.w / 2;
    D.rect(0, 0, u.w, u.h, D.color('#3e2419', 0.44));
    A.ProfileUI.dialogPaper(panel, result.headerH, win ? '胜利' : '合照被毁了');
    var nextUnlocked = win && S.currentLevel < C.LEVELS.length;
    var hasNotice = win && S.unlockNotice && S.unlockNotice.length;
    // ── 提示区单独占一段，删除失败时的关卡与重复说明，避免上下留白失衡 ──
    if (win && !hasNotice) {
      var chapter = '第 ' + S.currentLevel + ' 关' + (nextUnlocked ? ' · 下一关已解锁' : '');
      resultText(chapter, cx, result.notice.y + (result.notice.h - 42) / 2,
        panel.w - 44, 18, '#73482a', 1);
      resultText('合照守住了！', cx, result.notice.y + (result.notice.h - 42) / 2 + 24,
        panel.w - 44, 18, '#73482a', 1);
    }

    if (!win) {
      var reviveNotice = result.notice;
      resultText(S.toast ? S.toast.text : '复活恢复合照50并击退敌人 · 每局1次',
        cx, reviveNotice.y + (reviveNotice.h - 18) / 2,
        reviveNotice.w - 16, 18, '#8a6248', 1);
    }
    if (hasNotice) {
      var notice = result.notice;
      resultText('新伙伴已解锁', notice.x + notice.w / 2, notice.y + 5,
        notice.w - 20, 18, '#a86a24', 1);
      var itemW = notice.w / S.unlockNotice.length;
      var iconSize = result.compact ? 22 : 28;
      var itemY = notice.y + notice.h - iconSize / 2 - 5;
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

    // ── 结算按钮共用头像选择弹窗样式，命中与复活状态仍由原逻辑管理 ──
    if (nextUnlocked) A.ProfileUI.dialogButton(u.resultNext, '下一关');
    else if (!win) {
      var busy = S.adBusy || (A.Rewards && A.Rewards.isBusy());
      var used = S.revivesUsed > 0;
      A.ProfileUI.dialogButton(u.resultRevive,
        used ? '本局复活次数已用' : busy ? '广告加载中' : '看广告复活');
      if (used || busy) D.roundRect(u.resultRevive.x + 3, u.resultRevive.y + 3,
        u.resultRevive.w - 6, u.resultRevive.h - 6, u.resultRevive.h / 2 - 3,
        D.color('#b5a18a', 0.22));
    } else resultText('全部关卡已通关',
      cx, u.resultNext.y + (u.resultNext.h - 18) / 2,
      panel.w - 36, 18, '#8a6248', 1);
    A.ProfileUI.dialogButton(u.resultReplay, '再玩一次');
    A.ProfileUI.dialogButton(u.resultHome, '返回主页');
  }

  // 字体纹理尚未就绪时，用七段几何显示真实整数百分比；不依赖图片。
  function loadingPercent(value, cx, y) {
    var label = String(value) + '%';
    if (A.Assets && A.Assets.tex('font-28')) {
      resultText(label, cx, y, 160, 28, '#704026', 1);
      return;
    }
    var digits = String(value), step = 18, start = cx - (digits.length * step + 20) / 2;
    var segments = ['1111110', '0110000', '1101101', '1111001', '0110011',
      '1011011', '1011111', '1110000', '1111111', '1111011'];
    var boxes = [[3, 0, 10, 2], [13, 2, 2, 10], [13, 14, 2, 10],
      [3, 24, 10, 2], [1, 14, 2, 10], [1, 2, 2, 10], [3, 12, 10, 2]];
    for (var i = 0; i < digits.length; i++) {
      var active = segments[Number(digits.charAt(i))];
      for (var j = 0; j < boxes.length; j++) if (active.charAt(j) === '1') {
        var b = boxes[j];
        D.rect(start + i * step + b[0], y + b[1], b[2], b[3], D.color('#704026'));
      }
    }
    var px = start + digits.length * step + 4;
    D.ring(px + 2, y + 5, 3, 1.5, D.color('#704026'));
    D.ring(px + 12, y + 21, 3, 1.5, D.color('#704026'));
    for (var k = 0; k < 7; k++) D.rect(px + 12 - k * 2, y + 5 + k * 2, 2, 3, D.color('#704026'));
  }

  function drawLoading() {
    if (S.phase !== 'loading' && S.phase !== 'error') return;
    var u = L.calc();
    var progress = A.Assets && A.Assets.progress ? A.Assets.progress() :
      { loaded: 0, total: 0, ratio: 0, failed: 0 };
    var ratio = typeof progress.ratio === 'number' && isFinite(progress.ratio) ?
      Math.max(0, Math.min(1, progress.ratio)) : 0;
    var loaded = Math.max(0, Math.floor(progress.loaded || 0));
    var total = Math.max(0, Math.floor(progress.total || 0));
    var failed = Math.max(0, Math.floor(progress.failed || 0));
    var panelW = Math.min(340, u.interactiveRect.w - u.pad * 2);
    var panelH = Math.min(S.phase === 'error' ? 480 : 310, u.contentH - 16);
    var panel = { x: u.safeLeft + (u.interactiveRect.w - panelW) / 2,
      y: u.contentTop + (u.contentH - panelH) / 2, w: panelW, h: panelH };
    var cx = panel.x + panel.w / 2;
    D.vGradient(0, 0, u.w, u.h, D.color('#fff0d9'), D.color('#e7c69b'), 18);
    D.creamPanel(panel, 1, 22);
    D.roundRect(panel.x + 7, panel.y + 7, panel.w - 14, 58, 17, D.color('#f5d29f'));
    resultText('猫狗大战家具', cx, panel.y + 22, panel.w - 36, 28, '#704026', 1);
    // 暖色代码爪印是初始加载兜底，即便没有一张图片也可绘制。
    var pawY = panel.y + panelH * 0.35;
    D.roundRect(cx - 20, pawY + 3, 40, 27, 14, D.color('#d6a060'));
    var toes = [[-25, -8], [-9, -20], [9, -20], [25, -8]];
    for (var pi = 0; pi < toes.length; pi++) {
      D.circle(cx + toes[pi][0], pawY + toes[pi][1], 8, D.color('#d6a060'));
    }
    loadingPercent(Math.floor(ratio * 100), cx, panel.y + panelH * 0.53);
    var bar = { x: panel.x + 24, y: panel.y + panelH * 0.67, w: panel.w - 48, h: 18 };
    D.roundRect(bar.x, bar.y, bar.w, bar.h, 9, D.color('#b88350'));
    D.roundRect(bar.x + 2, bar.y + 2, bar.w - 4, bar.h - 4, 7, D.color('#ecd9bc'));
    var fillW = (bar.w - 4) * ratio;
    if (fillW > 0) D.roundRect(bar.x + 2, bar.y + 2, fillW, bar.h - 4,
      Math.min(7, fillW / 2), D.color('#f2a12b'));
    resultText('已加载 ' + loaded + '/' + total, cx, bar.y + 26,
      panel.w - 32, 18, '#8a6248', 1);
    if (S.phase === 'error') {
      var failures = A.Assets.failures();
      var detailY = bar.y + 52;
      var rowH = 22;
      var count = Math.min(failures.length, Math.max(1, Math.floor((panel.y + panelH - 38 - detailY) / rowH)));
      for (var fi = 0; fi < count; fi++) {
        var failure = failures[fi];
        var file = String(failure.src || failure.key).split('/').pop().toUpperCase();
        var reason = failure.reason === 'texture-upload' ? 'UPLOAD' : 'LOAD';
        resultText((fi + 1) + '. ' + file + ' ' + reason, cx, detailY + fi * rowH,
          panel.w - 24, 18, '#b04f4c', 1);
      }
    }
    resultText(S.phase === 'error' || failed > 0 ? '资源加载失败' + (failed ? ' ' + failed : '') : '正在准备小家',
      cx, panel.y + panelH - 29, panel.w - 32, 18,
      S.phase === 'error' || failed > 0 ? '#b04f4c' : '#8a6248', 1);
  }

  A.Hud = {
    CLS_COLOR: CLS_COLOR,
    drawHud: drawHud,
    drawTray: function () { A.BattleShopUI.draw(); },
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
