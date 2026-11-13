/* gameplay/tutorial.js — 首关五波：真实买卡、合成、锁卡与拖卖教学，真机待验证。 */
(function () {
  var A = window.AIGCUtils, S = A.State, C = A.Config, L = A.Layout;
  var T = { active: false, stage: 'deploy', unit: null, strong: null, time: 0, gift: 0, lockedIndex: -1 };
  var COPY = {
    deploy: ['先买一只射手', '点击卡池中的镭射喵上阵'],
    cap: ['扩建上场人口', '点击下方扩建按钮，增加席位'],
    refresh: ['刷新卡池', '点击刷新，准备两张相同射手卡'],
    merge: ['合成二星射手', '拖一张一星射手到另一张一星射手上'],
    lock: ['保留二星卡', '点击二星射手右上角的锁按钮'],
    refreshLocked: ['验证锁卡保留', '再次点击刷新，锁定的二星射手不会消失'],
    deploy2: ['买下二星射手', '点击锁定的二星射手上阵'],
    sell: ['学会出售驻守角色', '拖动原来的一星射手到底部出售区并松手'],
    redeploy: ['重新布阵', '点击一星射手再次上阵'],
    start: ['布阵完成！首关共五波', '点击开始战斗，守住客厅']
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
    T.time = 0; T.gift = 0; T.lockedIndex = -1;
    if (!A.Profile || S.currentLevel !== 1 || A.Profile.data.tutorialStarComplete === true) return false;
    if (typeof A.Profile.data.tutorialStarComplete !== 'boolean') A.Profile.data.tutorialStarComplete = false;
    T.active = true; T.gift = 100;
    S.gold += T.gift; S.goldEarned += T.gift;
    guaranteeArchers(1);
    return true;
  }
  function allow(action, detail) {
    if (!T.active) return true;
    if (action === 'deploy') {
      if (T.stage !== 'deploy' && T.stage !== 'redeploy' && T.stage !== 'deploy2') return false;
      return !detail || (idOf(detail) === 'arch' && starOf(detail) === (T.stage === 'deploy2' ? 2 : 1));
    }
    if (action === 'merge') return T.stage === 'merge' && (!detail ||
      ((idOf(detail) === 'arch' || detail.cardId === 'arch') && starOf(detail) === 1));
    if (action === 'lock') return T.stage === 'lock' && (!detail ||
      (detail.cardId === 'arch' && (detail.star || 1) === 2 && !detail.locked));
    if (action === 'sell') return T.stage === 'sell' && (!detail ||
      (detail === T.unit && idOf(detail) === 'arch' && detail.def.moveSpeed === 0));
    if (action === 'refresh') return T.stage === 'refresh' || T.stage === 'refreshLocked';
    return action === T.stage;
  }
  function onAction(action, detail) {
    if (!T.active) return;
    var unit = detail && detail.unit ? detail.unit : detail;
    if (action === 'deploy') {
      if (!allow(action, unit) || !live(unit)) return;
      if (T.stage === 'deploy2') { T.strong = unit; T.stage = 'sell'; }
      else { T.unit = unit; T.stage = T.stage === 'redeploy' ? 'start' : 'cap'; }
    } else if (action === 'cap' && T.stage === 'cap') {
      T.stage = 'refresh';
    } else if (action === 'refresh' && T.stage === 'refresh') {
      guaranteeArchers(2); T.stage = 'merge';
    } else if (action === 'merge' && T.stage === 'merge') {
      if (!detail || detail.cardId !== 'arch' || detail.fromStar !== 1 || detail.star !== 2 || !archerSlots(2).length) return;
      T.stage = 'lock';
    } else if (action === 'lock' && T.stage === 'lock') {
      if (!detail || detail.cardId !== 'arch' || detail.star !== 2 || detail.locked !== true) return;
      var locked = archerSlots(2, true);
      if (!locked.length) return;
      T.lockedIndex = locked[0]; T.stage = 'refreshLocked';
    } else if (action === 'refresh' && T.stage === 'refreshLocked') {
      var slot = S.shop[T.lockedIndex];
      if (!slot || slot.sold || slot.cardId !== 'arch' || (slot.star || 1) !== 2 || !slot.locked) return;
      T.stage = 'deploy2';
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
    if (S.toast) { S.toast.life -= dt; if (S.toast.life <= 0) S.toast = null; }
    for (var i = S.floats.length - 1; i >= 0; i--) {
      S.floats[i].life -= dt; if (S.floats[i].life <= 0) S.floats.splice(i, 1);
    }
  }
  function highlight(rect) {
    if (!rect) return;
    var D = A.Render.draw;
    D.strokeRect(rect.x, rect.y, rect.w, rect.h, 3, D.color('#ffe17c', 0.7 + Math.sin(T.time * 5) * 0.2));
  }
  function wrapped(text, maxWidth) {
    var D = A.Render.draw, out = [], line = '';
    for (var i = 0; i < text.length; i++) {
      var next = line + text.charAt(i);
      if (line && D.textWidth(next, A.FontAtlas['18']) > maxWidth) { out.push(line); line = text.charAt(i); }
      else line = next;
    }
    if (line) out.push(line);
    return out;
  }
  function targetRects() {
    var u = L.ui, rects = [];
    if (T.stage === 'cap') rects.push(u.capBtn);
    else if (T.stage === 'refresh' || T.stage === 'refreshLocked') rects.push(u.refreshBtn);
    else if (T.stage === 'start') rects.push(u.tutorial.start);
    else if (T.stage === 'sell') {
      if (live(T.unit)) rects.push({ x: T.unit.x - 30, y: T.unit.y - 48, w: 60, h: 80 });
      rects.push(u.sellZone);
    } else {
      var slots = archerSlots(T.stage === 'deploy2' || T.stage === 'lock' ? 2 : 1);
      for (var i = 0; i < slots.length; i++) {
        rects.push(T.stage === 'lock' ? L.shopLockRect(slots[i]) : L.shopRect(slots[i]));
      }
    }
    var drag = S.dragging;
    if (drag && drag.active) rects.push({ x: drag.x - 56, y: drag.y - 60, w: 112, h: 112 });
    return rects;
  }
  // 多目标镂空：按水平条带合并亮区，不叠加暗层，不依赖DOM或Canvas2D。
  function spotlight(rects) {
    var D = A.Render.draw, u = L.ui, holes = [], ys = [u.contentTop, u.contentBottom];
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      var x = Math.max(u.safeLeft, r.x - 3), y = Math.max(u.contentTop, r.y - 3);
      var right = Math.min(u.safeRight, r.x + r.w + 3), bottom = Math.min(u.contentBottom, r.y + r.h + 3);
      if (right <= x || bottom <= y) continue;
      holes.push({ x: x, y: y, right: right, bottom: bottom });
      ys.push(y, bottom);
    }
    ys.sort(function (a, b) { return a - b; });
    var shade = D.color('#000000', 0.76);
    for (var band = 0; band < ys.length - 1; band++) {
      var top = ys[band], end = ys[band + 1];
      if (end <= top) continue;
      var spans = [];
      for (var hi = 0; hi < holes.length; hi++) {
        if (holes[hi].y < end && holes[hi].bottom > top) spans.push(holes[hi]);
      }
      spans.sort(function (a, b) { return a.x - b.x; });
      var cursor = u.safeLeft;
      for (var si = 0; si < spans.length; si++) {
        if (spans[si].x > cursor) D.rect(cursor, top, spans[si].x - cursor, end - top, shade);
        cursor = Math.max(cursor, spans[si].right);
      }
      if (cursor < u.safeRight) D.rect(cursor, top, u.safeRight - cursor, end - top, shade);
    }
  }
  function draw() {
    if (!T.active || S.phase !== 'playing') return;
    spotlight(targetRects());
    var D = A.Render.draw, u = L.ui, source = u.tutorial.caption, copy = COPY[T.stage];
    var title = wrapped(copy[0], source.w - 24), body = wrapped(copy[1], source.w - 24);
    var footer = wrapped('引导赠币 +' + T.gift + ' · 完成操作才继续', source.w - 24);
    var rect = { x: source.x, y: source.y, w: source.w, h: 16 + (title.length + body.length + footer.length) * 20 };
    // 字幕固定在战场上部；出售目标靠近时移到战场底部，商店不被遮挡。
    if (T.stage === 'sell' && live(T.unit) && T.unit.y - 56 < rect.y + rect.h && T.unit.y + 30 > rect.y) {
      rect.y = Math.max(u.contentTop + 4, u.tray.y - rect.h - 6);
    }
    D.roundRect(rect.x, rect.y, rect.w, rect.h, 16, D.color('#14253b', 0.97));
    var textY = rect.y + 8;
    function drawLines(items, color) {
      for (var li = 0; li < items.length; li++) {
        D.text(items[li], rect.x + rect.w / 2, textY, 18, D.color(color), 1); textY += 20;
      }
    }
    drawLines(title, '#ffe17c'); drawLines(body, '#ffffff'); drawLines(footer, '#aac6dd');
    if (T.stage === 'cap') highlight(u.capBtn);
    else if (T.stage === 'refresh' || T.stage === 'refreshLocked') highlight(u.refreshBtn);
    else if (T.stage === 'deploy' || T.stage === 'redeploy' || T.stage === 'merge' || T.stage === 'deploy2' || T.stage === 'lock') {
      var slots = archerSlots(T.stage === 'deploy2' || T.stage === 'lock' ? 2 : 1);
      for (var i = 0; i < slots.length; i++) highlight(T.stage === 'lock' ? L.shopLockRect(slots[i]) : L.shopRect(slots[i]));
    } else if (T.stage === 'sell') {
      if (T.unit) highlight({ x: T.unit.x - 28, y: T.unit.y - 48, w: 56, h: 76 });
      D.roundRect(u.sellZone.x, u.sellZone.y, u.sellZone.w, u.sellZone.h, 12, D.color('#765024', 0.97));
      D.text('拖到这里松手出售', u.sellZone.x + u.sellZone.w / 2, u.sellZone.y + 12, 18, D.color('#ffe17c'), 1);
      highlight(u.sellZone);
    } else if (T.stage === 'start') {
      var b = u.tutorial.start;
      D.roundRect(b.x, b.y, b.w, b.h, 24, D.color('#f0a02a'));
      D.text('开始战斗', b.x + b.w / 2, b.y + 10, 28, D.color('#5a3208'), 1);
      highlight(b);
    }
  }
  A.Tutorial = { begin: begin, update: update, draw: draw, onAction: onAction, allow: allow,
    startBattle: startBattle, isActive: function () { return T.active; },
    stop: function () { T.active = false; T.unit = null; T.strong = null; }, getStage: function () { return T.stage; } };
})();
