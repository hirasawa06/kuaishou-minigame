/* gameplay/tutorial.js — 首关五波：真实买卡、合成、锁卡与拖卖教学，真机待验证。 */
(function () {
  var A = window.AIGCUtils, S = A.State, C = A.Config, L = A.Layout;
  var T = { active: false, stage: 'deploy', unit: null, strong: null, time: 0, lockedIndex: -1 };
  var COPY = {
    deploy: ['', '拖动卡池中的镭射喵上阵'],
    firstFight: ['', '家具怪来了，看看镭射喵的攻击'],
    secondFight: ['', '看看二星镭射喵的攻击'],
    cap: ['扩建上场人口', '点击下方扩建按钮，增加席位'],
    refresh: ['刷新卡池', '点击刷新，准备两张镭射喵卡片'],
    merge: ['合成二星镭射喵', '拖一张一星镭射喵到另一张一星镭射喵上'],
    lock: ['二星已上锁', '二星镭射喵已上锁，不会被刷新'],
    deploy2: ['上阵二星镭射喵', '拖动锁定的二星镭射喵上阵'],
    sell: ['学会出售镭射喵', '拖动原来的一星镭射喵到底部出售区并松手'],
    redeploy: ['重新布阵', '拖动一星镭射喵再次上阵'],
    start: ['', '家具怪入侵，准备迎接吧']
  };
  function idOf(unit) { var def = unit && (unit.baseDef || unit.def); return def && def.id; }
  function starOf(unit) { return unit && (unit.star || unit.level || 1); }
  function live(unit) { return !!(unit && !unit.dead && unit.hp > 0 && S.units.indexOf(unit) >= 0); }
  function archerSlots(star, locked) {
    var out = [];
    for (var i = 0; i < S.shop.length; i++) {
      var slot = S.shop[i];
      if (slot && !slot.sold && slot.cardId === 'arch' && (slot.star || 1) === star &&
        (locked === undefined || !!slot.locked === locked)) out.push(i);
    }
    return out;
  }
  // 仅准备教学卡，不替玩家购买/合成/锁定；已锁定的卡绝不覆盖。
  function guaranteeArchers(count) {
    var found = archerSlots(1).length;
    for (var i = 0; i < C.cardCount && found < count; i++) {
      var slot = S.shop[i];
      if (slot && !slot.sold && (slot.locked || (slot.cardId === 'arch' && (slot.star || 1) === 1))) continue;
      S.shop[i] = { cardId: 'arch', star: 1, locked: false, sold: false, born: S.time };
      found++;
    }
  }
  function begin() {
    T.active = false; T.stage = 'deploy'; T.unit = null; T.strong = null;
    T.time = 0; T.lockedIndex = -1;
    if (!A.Profile || S.currentLevel !== 1 || A.Profile.data.tutorialStarComplete === true) return false;
    if (typeof A.Profile.data.tutorialStarComplete !== 'boolean') A.Profile.data.tutorialStarComplete = false;
    T.active = true; // 教学使用首关初始预算，不额外赠送饼干。
    guaranteeArchers(1);
    return true;
  }
  function allow(action, detail) {
    if (!T.active) return true;
    if (T.stage === 'firstFight' || T.stage === 'secondFight') return false;
    if (action === 'deploy') {
      if (T.stage !== 'deploy' && T.stage !== 'redeploy' && T.stage !== 'deploy2') return false;
      return !detail || (idOf(detail) === 'arch' && starOf(detail) === (T.stage === 'deploy2' ? 2 : 1));
    }
    if (action === 'merge') return T.stage === 'merge' && (!detail ||
      ((idOf(detail) === 'arch' || detail.cardId === 'arch') && starOf(detail) === 1));
    if (action === 'lock') return false;
    if (action === 'sell') return T.stage === 'sell' && (!detail ||
      (detail === T.unit && idOf(detail) === 'arch' && detail.def.moveSpeed === 0));
    if (action === 'refresh') return T.stage === 'refresh';
    return action === T.stage;
  }
  function onAction(action, detail) {
    if (!T.active) return;
    var unit = detail && detail.unit ? detail.unit : detail;
    if (action === 'deploy') {
      if (!allow(action, unit) || !live(unit)) return;
      if (T.stage === 'deploy2') {
        T.strong = unit; T.stage = 'secondFight';
        T.secondEnemies = A.Battle.startTutorialPair(unit);
      }
      else {
        T.unit = unit;
        if (T.stage === 'deploy') {
          T.stage = 'firstFight';
          T.firstEnemy = A.Battle.startTutorialEncounter(unit);
        } else { T.stage = 'start'; T.startNoticeTime = 0; }
      }
    } else if (action === 'cap' && T.stage === 'cap') {
      T.stage = 'refresh';
    } else if (action === 'refresh' && T.stage === 'refresh') {
      guaranteeArchers(2); T.stage = 'merge';
    } else if (action === 'merge' && T.stage === 'merge') {
      if (!detail || detail.cardId !== 'arch' || detail.fromStar !== 1 || detail.star !== 2 || !archerSlots(2).length) return;
      var locked = archerSlots(2, true);
      if (!locked.length) return;
      T.lockedIndex = locked[0]; T.stage = 'lock'; T.lockNoticeTime = 0;
    } else if (action === 'sell' && T.stage === 'sell') {
      if (unit !== T.unit || S.units.indexOf(unit) >= 0) return;
      guaranteeArchers(1); T.stage = 'redeploy';
    }
  }
  function startBattle() {
    if (!T.active || T.stage !== 'start' || S.phase !== 'playing' || !live(T.unit) || !live(T.strong)) return false;
    T.active = false; A.Profile.data.tutorialStarComplete = true; A.Profile.save();
    S.waveTimer = C.firstWaveDelay;
    A.GameAudio && A.GameAudio.play('click');
    return true;
  }
  function update(dt) {
    if (!T.active) return;
    T.time += dt;
    if (T.stage === 'secondFight') {
      A.Battle.update(dt, dt, true);
      if (T.secondEnemies.every(function (enemy) { return enemy.dead; }) &&
          S.enemies.length === 0 && live(T.strong)) {
        S.waveState = 'prep'; S.waveTimer = C.waveGap;
        T.stage = 'sell';
      }
      return;
    }
    if (T.stage === 'firstFight') {
      A.Battle.update(dt, dt, true);
      if (T.firstEnemy && T.firstEnemy.dead && S.enemies.length === 0 && live(T.unit)) {
        S.waveIndex = 1;
        S.waveState = 'prep';
        S.waveTimer = C.waveGap;
        S.gold += C.WAVE_GOLD_BONUS;
        S.goldEarned += C.WAVE_GOLD_BONUS;
        T.stage = 'cap';
      }
      return;
    }
    if (T.stage === 'start') {
      T.startNoticeTime = (T.startNoticeTime || 0) + dt;
      if (T.startNoticeTime >= 1) { startBattle(); return; }
    }
    if (T.stage === 'lock') {
      T.lockNoticeTime = (T.lockNoticeTime || 0) + dt;
      // ── 提示满2秒直接允许拖动，不经过点击或再次刷新 ──
      if (T.lockNoticeTime + 1e-9 >= 2) T.stage = 'deploy2';
    }
    if (S.toast) { S.toast.life -= dt; if (S.toast.life <= 0) S.toast = null; }
    for (var i = S.floats.length - 1; i >= 0; i--) {
      S.floats[i].life -= dt; if (S.floats[i].life <= 0) S.floats.splice(i, 1);
    }
  }
  function highlight(rect) {
    // 目标通过全屏圆角镂空显示，不再叠加描边。
  }
  function wrapped(text, maxWidth) {
    var D = A.Render.draw, out = [], line = '';
    for (var i = 0; i < text.length; i++) {
      var next = line + text.charAt(i);
      if (line && D.textWidth(next, 18) > maxWidth) { out.push(line); line = text.charAt(i); }
      else line = next;
    }
    if (line) out.push(line);
    return out;
  }
  function targetRects() {
    var u = L.ui, rects = [];
    if (T.stage === 'cap') rects.push(u.capBtn);
    else if (T.stage === 'refresh') rects.push(u.refreshBtn);
    else if (T.stage === 'lock') {
      if (T.lockedIndex >= 0) rects.push(L.shopRect(T.lockedIndex));
    }
    else if (T.stage === 'sell') {
      if (live(T.unit)) rects.push({ x: T.unit.x - 30, y: T.unit.y - 48, w: 60, h: 80 });
      rects.push(u.sellZone);
    } else {
      var slots = archerSlots(T.stage === 'deploy2' || T.stage === 'lock' ? 2 : 1);
      slots = slots.slice(0, T.stage === 'merge' ? 2 : 1);
      for (var i = 0; i < slots.length; i++) {
        rects.push(L.shopRect(slots[i]));
      }
    }
    return rects;
  }
  // 拖卡尚未进入战场时提示目标方向；进入战场后交给落点预览显示有效范围。
  function drawBattleDropGuide() {
    var D = A.Render.draw, u = L.ui;
    var x = u.placeLeft, y = u.placeTop;
    var w = u.placeRight - x, h = u.placeBottom - y;
    if (w <= 0 || h <= 0) return;
    var cx = x + w / 2;
    var cy = y + h * 0.58;
    var pulse = 0.74 + Math.sin(T.time * 5) * 0.12;
    D.roundRect(x, y, w, h, 10, D.color('#73e5a0', 0.10));
    D.roundRect(cx - 76, cy - 15, 152, 30, 15,
      D.color('#fff0d9', 0.96));
    D.text('拖到战场上阵', cx, cy - 9, 18, D.color('#704026'), 1);
  }
  // 单层全屏圆角镂空，合成及出售最多保留两个必要目标。
  function spotlight(rects) {
    var D = A.Render.draw, u = L.ui;
    if (rects.length) {
      var card = rects[0], shadeColor = D.color('#000000', 0.76);
      A.Render.setTutorialHole(rects[1] || null, 20 * u.battleScale);
      // 单个全幅四边形镂空，避免分块遮罩边缘抗锯齿产生横竖接缝。
      A.Render.push(0, 0, u.w, u.h, shadeColor,
        { mode: 14, hw: card.w / 2, hh: card.h / 2,
          u0: -card.x / card.w, u1: (u.w - card.x) / card.w,
          v0: -card.y / card.h, v1: (u.h - card.y) / card.h,
          r: Math.min(20 * u.battleScale, card.h / 2) });
      A.Render.setTutorialHole(null);
      return;
    }
    D.rect(0, 0, u.w, u.h, D.color('#000000', 0.76));
  }
  function draw() {
    if (!T.active || S.phase !== 'playing') return;
    var drag = S.dragging, dragging = !!(drag && drag.active);
    // 拖动期间不盖暗幕也不追着手指开亮孔，避免遮住浮起卡和战场。
    if (!dragging && T.stage !== 'firstFight' && T.stage !== 'secondFight') spotlight(targetRects());
    if (dragging && (T.stage === 'deploy' || T.stage === 'redeploy' || T.stage === 'deploy2') &&
      drag.kind !== 'unit' && drag.y >= L.ui.tray.y) drawBattleDropGuide();
    var D = A.Render.draw, u = L.ui, source = u.tutorial.caption, copy = COPY[T.stage];
    var innerW = source.w - 32;
    var deploying = T.stage === 'deploy' || T.stage === 'redeploy' || T.stage === 'deploy2';
    var singleLine = true;
    var bodyText = singleLine ? copy[1] : dragging && deploying ? '拖到战场，松手上阵' : copy[1];
    var title = singleLine ? [] : wrapped(copy[0], innerW), body = wrapped(bodyText, innerW);
    var footer = T.stage === 'merge' ? wrapped('合成后的角色会更强大哦', innerW)
      : singleLine ? [] : wrapped('完成操作才继续', innerW);
    var rect = { x: source.x, y: source.y, w: source.w,
      h: 26 + (title.length + body.length + footer.length) * 20 + (footer.length ? 6 : 0) };
    // 字幕固定在战场上部；出售目标靠近时移到战场底部，商店不被遮挡。
    D.creamPanel(rect, 0.98, 16);
    var titleBandH = title.length * 20 + 7;
    if (!singleLine) D.roundRect(rect.x + 7, rect.y + 7, rect.w - 14, titleBandH, 10,
      D.color('#f5cd94', 0.96));
    var textY = rect.y + 9;
    function drawLines(items, color) {
      for (var li = 0; li < items.length; li++) {
        D.text(items[li], rect.x + rect.w / 2, textY, 18, D.color(color), 1); textY += 20;
      }
    }
    drawLines(title, '#704026');
    textY += singleLine ? 4 : 6;
    drawLines(body, '#683c29');
    textY += 3;
    if (!singleLine) D.roundRect(rect.x + 18, textY - 2, rect.w - 36, 1.5, 0.75,
      D.color('#d7a675', 0.75));
    textY += 3;
    drawLines(footer, '#8a6248');
    if (T.stage === 'cap') { if (!dragging) highlight(u.capBtn); }
    else if (T.stage === 'refresh') {
      if (!dragging) highlight(u.refreshBtn);
    } else if (T.stage === 'deploy' || T.stage === 'redeploy' || T.stage === 'merge' || T.stage === 'deploy2' || T.stage === 'lock') {
      if (dragging && T.stage !== 'merge') {
        return;
      }
      var slots = archerSlots(T.stage === 'deploy2' || T.stage === 'lock' ? 2 : 1);
      for (var i = 0; i < slots.length; i++) {
        if (dragging && slots[i] === drag.index) continue;
        if (T.stage !== 'deploy') highlight(L.shopRect(slots[i]));
      }
    } else if (T.stage === 'sell') {
      if (!dragging && T.unit) highlight({ x: T.unit.x - 28, y: T.unit.y - 48, w: 56, h: 76 });
      A.BattleShopUI.drawSellZone(T.unit);
      if (!dragging) highlight(u.sellZone);
    }
  }
  A.Tutorial = { begin: begin, update: update, draw: draw, onAction: onAction, allow: allow,
    startBattle: startBattle, isActive: function () { return T.active; },
    stop: function () { T.active = false; T.unit = null; T.strong = null; }, getStage: function () { return T.stage; } };
})();
