/* gameplay/input.js — 触摸 / 鼠标：商店买英雄、拖到战场、长按看详情、按钮点击 */
(function () {
  var A = window.AIGCUtils;
  var C = A.Config;
  var S = A.State;
  var L = A.Layout;

  var canvas = null;
  var down = false;
  var drag = null;
  var shopPressStarted = false;
  var MOVE_TOL = 6;
  var LONG_PRESS = 0.45;

  function toLocal(clientX, clientY) {
    var r = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
    var w = r && r.width ? r.width : L.w;
    var h = r && r.height ? r.height : L.h;
    var left = r ? r.left : 0;
    var top = r ? r.top : 0;
    return {
      x: (clientX - left) * (L.w / w),
      y: (clientY - top) * (L.h / h),
    };
  }

  function pointIn(rect, x, y, pad) {
    pad = pad || 0;
    return rect && x >= rect.x - pad && x <= rect.x + rect.w + pad &&
      y >= rect.y - pad && y <= rect.y + rect.h + pad;
  }

  function inInteractiveArea(x, y) {
    return pointIn(L.ui.interactiveRect, x, y, 0);
  }

  function hitControl(rect, x, y, pad) {
    return inInteractiveArea(x, y) && pointIn(rect, x, y, pad);
  }

  function allowed(action, unit) {
    return !A.Tutorial || A.Tutorial.allow(action, unit);
  }

  function menuHitKey(x, y) {
    var m = L.ui.menu;
    if (!m || !inInteractiveArea(x, y) || S.menuSlide) return null;
    if (S.selectedLevel > 1 && hitControl(m.levelPrev, x, y, 0)) return 'levelPrev';
    if (S.selectedLevel < C.LEVELS.length && hitControl(m.levelNext, x, y, 0)) return 'levelNext';
    if (A.Profile.isLevelUnlocked(S.selectedLevel) && hitControl(m.start, x, y, 12)) return 'start';
    if (hitControl(m.collection, x, y, 0)) return 'collection';
    if (hitControl(m.settings, x, y, 6)) return 'settings';
    if (hitControl(m.avatar, x, y, 6)) return 'avatar';
    return null;
  }

  // 命中商店卡：返回卡片索引与矩形
  function shopAt(x, y) {
    var u = L.ui;
    if (!inInteractiveArea(x, y)) return null;
    for (var i = 0; i < C.cardCount; i++) {
      var rect = L.shopRect(i);
      var slot = S.shop[i];
      if (!slot || slot.sold) continue;
      if (pointIn(rect, x, y, 2)) return { index: i, rect: rect, slot: slot };
    }
    return null;
  }

  function showCardDetails(d) {
    S.inspect = d.def;
    S.inspectT = 1;
    S.inspectX = d.rect.x;
    S.inspectY = d.rect.y - 180;
  }

  function onCardPortrait(d, x, y) {
    return pointIn(L.shopCardParts(d.index).portrait, x, y);
  }

  function onDown(px, py) {
    shopPressStarted = false;
    down = inInteractiveArea(px, py);
    if (!down) return;
    // 弹窗 / 全屏页优先：打开时不再把触摸传给战场或商店
    if (A.ProfileUI && A.ProfileUI.isOpen()) return;
    if (S.phase === 'menu' && !S.menuSlide) {
      S.menuPressed = menuHitKey(px, py);
      if (pointIn(L.ui.menu.card, px, py, 0)) {
        S.menuSwipe = { startX: px, startY: py, x: px, y: py };
      }
    }
    if (S.phase !== 'playing' && S.phase !== 'paused') return;

    if (hitControl(L.ui.speedBtn, px, py, 0) || hitControl(L.ui.pauseBtn, px, py, 0)) return;

    if (S.phase === 'paused') {
      var pauseKeys = ['resume', 'settings', 'restart', 'home'];
      for (var pk = 0; pk < pauseKeys.length; pk++) {
        if (hitControl(L.ui.pausePanel.btn(pauseKeys[pk]), px, py, 8)) return;
      }
    }

    var u = L.ui;
    if (S.phase === 'playing' && S.gold >= S.refreshCost && hitControl(u.refreshBtn, px, py, 0)) {
      S.shopPressed = 'refresh';
      shopPressStarted = true;
      return;
    }
    if (S.phase === 'playing' && S.heroCap < C.UNIT_CAP_MAX && S.gold >= S.capCost &&
        hitControl(u.capBtn, px, py, 0)) {
      S.shopPressed = 'cap';
      shopPressStarted = true;
      return;
    }

    var hit = S.phase === 'playing' ? shopAt(px, py) : null;
    if (!hit) {
      for (var i = S.units.length - 1; i >= 0; i--) {
        var unit = S.units[i];
        if (unit.dead || unit.hp <= 0) continue;
        if (!allowed('inspect', unit) && !allowed('sell', unit)) continue;
        var hitRadius = Math.max(unit.def.radius, 26);
        if (S.dist2(px, py, unit.x, unit.y) > hitRadius * hitRadius) continue;
        drag = { kind: 'unit', unit: unit, def: unit.def, x: px, y: py,
          startX: px, startY: py, active: false, holdT: 0 };
        S.dragging = drag;
        return;
      }
      return;
    }
    var def = S.heroAtStar(hit.slot.cardId, hit.slot.star || 1);
    if (!def) return;
    if (hitControl(L.shopLockRect(hit.index), px, py, 0)) {
      drag = { kind: 'lock', index: hit.index, slot: hit.slot, startX: px, startY: py, x: px, y: py };
      return;
    }
    if (!allowed('deploy', { def: def, star: hit.slot.star || 1 }) &&
      !allowed('merge', { def: def, star: hit.slot.star || 1 })) return;
    drag = {
      index: hit.index,
      slot: hit.slot,
      def: def,
      x: px, y: py,
      startX: px, startY: py,
      active: false,
      holdT: 0,
      startedAt: A._now ? A._now() : Date.now(),
      rect: hit.rect,
    };
    S.dragging = drag;
  }

  function onMove(px, py) {
    if (down && S.menuSwipe) {
      S.menuSwipe.x = px;
      S.menuSwipe.y = py;
      if (Math.abs(px - S.menuSwipe.startX) > MOVE_TOL) S.menuPressed = null;
    }
    if (S.phase === 'menu' && S.menuPressed && menuHitKey(px, py) !== S.menuPressed) {
      S.menuPressed = null;
    }
    if (S.shopPressed) {
      var r = S.shopPressed === 'refresh' ? L.ui.refreshBtn : L.ui.capBtn;
      if (!hitControl(r, px, py, 0)) S.shopPressed = null;
    }
    if (!down || !drag) return;
    drag.x = px;
    drag.y = py;
    var dx = px - drag.startX;
    var dy = py - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > MOVE_TOL) drag.moved = true;
    if (!drag.active && drag.moved) {
      if (drag.kind !== 'unit' || (S.phase === 'playing' && drag.unit.def.moveSpeed === 0 && allowed('sell', drag.unit))) drag.active = true;
    }
    if (drag.kind === 'lock') return;
    if (drag.active && drag.kind !== 'unit') {
      var target = shopAt(px, py);
      drag.mergeTarget = target ? target.index : null;
      drag.mergeValid = !!(target && target.index !== drag.index &&
        target.slot.cardId === drag.slot.cardId && (target.slot.star || 1) === (drag.slot.star || 1) &&
        (drag.slot.star || 1) < 3 && allowed('merge', { def: drag.def, star: drag.slot.star || 1 }));
    }
    if (drag.active) S.dragging = drag;
  }

  function onUp(px, py) {
    var wasDown = down;
    var swipe = S.menuSwipe;
    S.menuSwipe = null;
    if (S.phase === 'menu') S.menuPressed = null;

    if (!wasDown && !drag) return;
    if (swipe && S.phase === 'menu') {
      var dx = px - swipe.startX;
      var dy = py - swipe.startY;
      if (Math.abs(dx) > MOVE_TOL) {
        down = false;
        var horizontal = Math.abs(dx) > Math.abs(dy) * 1.3;
        var cardW = L.ui.menu.card.w;
        var edge = dx < 0 ? S.selectedLevel === C.LEVELS.length : S.selectedLevel === 1;
        var offset = horizontal ? Math.max(-cardW * 0.85, Math.min(cardW * 0.85, dx)) : 0;
        if (edge) offset *= 0.25;
        if (horizontal && Math.abs(dx) >= 36 && !edge) {
          A.Game.selectLevel(dx < 0 ? 1 : -1, offset);
        } else if (Math.abs(offset) > 0) {
          A.Game.selectLevel(0, offset);
        }
        return;
      }
    }

    var validShopRelease = false;
    if (S.shopPressed) {
      var pressedRect = S.shopPressed === 'refresh' ? L.ui.refreshBtn : L.ui.capBtn;
      if (hitControl(pressedRect, px, py, 0)) {
        S.shopFeedback = { key: S.shopPressed, life: 0.18 };
        validShopRelease = true;
      }
      S.shopPressed = null;
    }
    if (shopPressStarted) {
      shopPressStarted = false;
      down = false;
      if (validShopRelease) tap(px, py);
      return;
    }

    // 忽略没有对应按下动作的抬手事件；触屏浏览器可能补发鼠标事件。
    if (!down && !drag) return;

    down = false;
    if (drag && drag.kind === 'unit' && S.phase === 'paused') {
      finishDrag(px, py); drag = null; S.dragging = null; return;
    }
    if (S.phase !== 'playing') {
      drag = null;
      S.dragging = null;
      tap(px, py);
      return;
    }
    if (drag) {
      finishDrag(px, py);
      drag = null;
      S.dragging = null;
      return;
    }
    tap(px, py);
  }

  // 单击仍然自动部署；已有射手占中心时寻找空落点，避免教学第二次购买卡住。
  function buyAtFreePoint(d) {
    var u = L.ui, radius = d.def.radius || 22;
    var points = [{ x: u.field.x + u.field.w * 0.5, y: u.placeBottom - 10 }];
    for (var row = 0; row < 5; row++) {
      for (var col = 0; col < 5; col++) points.push({
        x: u.placeLeft + (u.placeRight - u.placeLeft) * col / 4,
        y: u.placeBottom - 10 - (u.placeBottom - u.placeTop - 10) * row / 4
      });
    }
    var actors = S.units.concat(S.enemies);
    for (var i = 0; i < points.length; i++) {
      var p = points[i], clear = true;
      for (var j = 0; j < actors.length; j++) {
        var actor = actors[j];
        if (actor.dead || actor.hp <= 0) continue;
        var min = Math.max(32, radius + actor.def.radius + 2);
        if (S.dist2(p.x, p.y, actor.x, actor.y) < min * min) { clear = false; break; }
      }
      if (clear) return A.Battle.buyCard(d.index, p.x, p.y);
    }
    return A.Battle.buyCardAtCenter(d.index);
  }

  function finishDrag(px, py) {
    var u = L.ui;
    var d = drag;
    if (d.kind === 'lock') {
      if (!d.moved && S.phase === 'playing' && S.shop[d.index] === d.slot &&
        hitControl(L.shopLockRect(d.index), px, py, 0) && allowed('lock', d.slot)) {
        if (S.toggleShopLock(d.index)) A.GameAudio && A.GameAudio.play('click');
      }
      return;
    }
    if (!d.def) return;
    if (d.kind === 'unit') {
      if (d.active && S.phase === 'playing' && !d.unit.dead && d.unit.hp > 0 &&
        S.units.indexOf(d.unit) >= 0 && d.unit.def.moveSpeed === 0 && allowed('sell', d.unit) && hitControl(u.sellZone, px, py, 0)) {
        A.Battle.sellUnit(d.unit);
      } else if (!d.active && !d.moved && hitControl(u.interactiveRect, px, py, 0) &&
        !d.unit.dead && allowed('inspect', d.unit)) {
        S.inspect = d.unit.def; S.inspectStar = d.unit.star || d.unit.level || 1;
        S.inspectT = 2.4; S.inspectX = px - 124; S.inspectY = py - 150;
      }
      return;
    }

    // 松手在商店卡上优先走合成，不购买、不自动扣费；包括无效与自合。
    if (d.active && inInteractiveArea(px, py)) {
      var target = shopAt(px, py);
      if (target) {
        if (target.index !== d.index && allowed('merge', { def: d.def, star: d.slot.star || 1 })) {
          if (S.mergeShopCards(d.index, target.index)) A.GameAudio && A.GameAudio.play('click');
        }
        return;
      }
    }
    // 拖到战场：直接部署
    if (d.active && py < u.tray.y - 4) {
      if (!allowed('deploy', { def: d.def, star: d.slot.star || 1 })) return;
      var reason = A.Battle.deployBlockReason(d.def, px, py);
      if (reason === 'outside') {
        S.toastMsg('请拖到高亮战场区域', 1.2);
        return;
      }
      if (A.Battle.buyCard(d.index, px, py)) {
        A.GameAudio && A.GameAudio.play('place');
      }
      return;
    }
    // 拖回商店区域松手：什么都不做
    if (d.active) return;

    // 头像是明确的详情入口；按住卡牌也能查看，不会误购。
    if (onCardPortrait(d, px, py) ||
        ((A._now ? A._now() : Date.now()) - d.startedAt) >= LONG_PRESS * 1000) {
      showCardDetails(d);
      return;
    }
    // 点卡牌文字区：默认放到战场中下方。
    if (A.Battle.buyCardAtCenter(d.index)) {
      S.inspect = null;
      S.inspectT = 0;
      A.GameAudio && A.GameAudio.play('place');
    } else {
      showCardDetails(d);
    }
  }

  function tap(px, py) {
    var u = L.ui;
    // 弹窗 / 全屏页打开时吞掉所有点击，避免误触后面的战场
    if (A.ProfileUI && A.ProfileUI.isOpen()) {
      A.ProfileUI.handleTap(px, py);
      return;
    }
    if (!inInteractiveArea(px, py)) return;

    if (S.phase === 'menu') {
      if (S.menuStartDelay > 0) return;
      var key = menuHitKey(px, py);
      if (key) S.menuFeedback = { key: key, life: 0.18 };
      if (key === 'settings' || key === 'avatar') {
        A.GameAudio && A.GameAudio.play('click');
      }
      if (key === 'levelPrev') { A.Game.selectLevel(-1); return; }
      if (key === 'levelNext') { A.Game.selectLevel(1); return; }
      if (key === 'start') {
        if (!A.Profile.isLevelUnlocked(S.selectedLevel)) {
          S.toastMsg('请先通过第 ' + (S.selectedLevel - 1) + ' 关', 1.4);
          return;
        }
        S.menuStartDelay = 0.18;
        return;
      }
      if (key === 'collection') { A.GameAudio && A.GameAudio.play('click'); A.ProfileUI.open('collection'); return; }
      if (key === 'settings') { A.ProfileUI.open('settings'); return; }
      if (key === 'avatar') { A.ProfileUI.open('profile'); return; }
      return;
    }
    if (S.phase === 'win' || S.phase === 'lose') {
      if (S.phase === 'win' && S.currentLevel < C.LEVELS.length && hitControl(u.resultNext, px, py, 0)) {
        A.Game.nextLevel();
        return;
      }
      if (hitControl(u.resultHome, px, py, 0)) { A.Game.goMenu(); return; }
      if (hitControl(u.btnRect('result'), px, py, 8)) A.Game.restart();
      return;
    }
    if (S.phase === 'paused') {
      var pp = u.pausePanel;
      if (hitControl(pp.btn('resume'), px, py, 8)) { A.Game.togglePause(); return; }
      if (hitControl(pp.btn('settings'), px, py, 8)) {
        A.GameAudio && A.GameAudio.play('click');
        A.Game.openSettings();
        return;
      }
      if (hitControl(pp.btn('restart'), px, py, 8)) { A.Game.restart(); return; }
      if (hitControl(pp.btn('home'), px, py, 8)) { A.Game.goMenu(); return; }
      if (hitControl(u.pauseBtn, px, py, 10)) A.Game.togglePause();
      return;
    }
    if (S.phase === 'playing') {
      if (hitControl(u.speedBtn, px, py, 0)) { if (allowed('speed')) A.Game.toggleSpeed(); return; }
      if (hitControl(u.pauseBtn, px, py, 10)) { if (allowed('pause')) A.Game.togglePause(); return; }
      if (A.Tutorial && A.Tutorial.isActive() && hitControl(u.tutorial.start, px, py, 0) && allowed('start')) {
        A.Tutorial.startBattle(); return;
      }
      if (hitControl(u.refreshBtn, px, py, 4)) {
        if (!allowed('refresh')) return;
        A.GameAudio && A.GameAudio.play('click');
        S.refreshShop();
        return;
      }
      if (hitControl(u.capBtn, px, py, 4)) {
        if (!allowed('cap')) return;
        A.GameAudio && A.GameAudio.play('click');
        S.buyCap();
        return;
      }
      // 点战场空白处：收起详情
      S.inspect = null;
      S.inspectT = 0;
    }
  }

  function cancel() {
    down = false;
    drag = null;
    S.dragging = null;

    S.shopPressed = null;
    shopPressStarted = false;

    S.menuSwipe = null;
    S.menuPressed = null;

  }

  function bind(cv) {
    canvas = cv;
    var opts = { passive: false };

    function touchPos(e) {
      var t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
      if (!t) return null;
      return toLocal(t.clientX, t.clientY);
    }

    canvas.addEventListener('touchstart', function (e) {
      if (e.preventDefault) e.preventDefault();
      var p = touchPos(e);
      if (p) onDown(p.x, p.y);
    }, opts);

    canvas.addEventListener('touchmove', function (e) {
      if (e.preventDefault) e.preventDefault();
      var p = touchPos(e);
      if (p) onMove(p.x, p.y);
    }, opts);

    canvas.addEventListener('touchend', function (e) {
      if (e.preventDefault) e.preventDefault();
      var p = touchPos(e);
      if (p) onUp(p.x, p.y); else cancel();
    }, opts);

    canvas.addEventListener('touchcancel', function () { cancel(); }, opts);

    canvas.addEventListener('mousedown', function (e) {
      var p = toLocal(e.clientX, e.clientY);
      onDown(p.x, p.y);
    });
    canvas.addEventListener('mousemove', function (e) {
      var p = toLocal(e.clientX, e.clientY);
      onMove(p.x, p.y);
    });
    canvas.addEventListener('mouseup', function (e) {
      var p = toLocal(e.clientX, e.clientY);
      onUp(p.x, p.y);
    });
    canvas.addEventListener('mouseleave', function () { cancel(); });
  }

  A.Input = {
    cancel: cancel,
    bind: bind,
    getDrag: function () { return drag; },
  };
})();
