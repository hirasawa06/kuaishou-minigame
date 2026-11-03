/* gameplay/input.js — 触摸 / 鼠标：拖拽放卡、左右滑动弃卡、按钮点击 */
(function () {
  var A = window.AIGCUtils;
  var C = A.Config;
  var S = A.State;
  var L = A.Layout;

  var canvas = null;
  var down = false;
  var drag = null;
  var MOVE_TOL = 6;
  var SWIPE_X = 46;

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
    return x >= rect.x - pad && x <= rect.x + rect.w + pad &&
      y >= rect.y - pad && y <= rect.y + rect.h + pad;
  }

  function inInteractiveArea(x, y) {
    return pointIn(L.ui.interactiveRect, x, y, 0);
  }

  function hitControl(rect, x, y, pad) {
    return inInteractiveArea(x, y) && pointIn(rect, x, y, pad);
  }

  // 命中检测：传送带卡牌按屏幕位置判定，返回卡牌对象本身
  function slotAt(x, y) {
    var u = L.ui;
    if (!inInteractiveArea(x, y) || !pointIn(u.cards, x, y, 0)) return null;
    for (var i = 0; i < S.slots.length; i++) {
      var slot = S.slots[i];
      if (slot.delay > 0 || !slot.cardId) continue;
      var left = u.cards.x + slot.x;
      if (left < u.cards.x - 2) continue;          // 已被左侧裁掉的部分不响应
      var rect = { x: left, y: u.cards.y, w: u.cardW, h: u.cardH };
      if (hitControl(rect, x, y, 2)) return { slot: slot, rect: rect };
    }
    return null;
  }

  function onDown(px, py) {
    down = inInteractiveArea(px, py);
    if (!down) return;
    if (S.phase !== 'playing') return;
    var hit = slotAt(px, py);
    if (!hit) return;
    var def = S.cardById(hit.slot.cardId);
    if (!def) return;
    drag = {
      slot: hit.slot,
      def: def,
      x: px, y: py,
      startX: px, startY: py,
      active: false,
      swiped: false,
      dir: 0,
    };
    S.dragging = drag;
  }

  function onMove(px, py) {
    if (!down || !drag) return;
    drag.x = px;
    drag.y = py;
    var dx = px - drag.startX;
    var dy = py - drag.startY;
    if (!drag.active && Math.abs(dx) + Math.abs(dy) > MOVE_TOL) drag.active = true;
    if (drag.active) {
      S.dragging = drag;
      if (Math.abs(dx) > SWIPE_X && Math.abs(dy) < Math.abs(dx) * 0.8) {
        drag.swiped = true;
        drag.dir = dx > 0 ? 1 : -1;
      } else {
        drag.swiped = false;
      }
    }
  }

  function onUp(px, py) {
    if (!down && !drag) { tap(px, py); return; }
    down = false;
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

  function finishDrag(px, py) {
    var u = L.ui;
    var d = drag;
    if (!d.def) return;
    if (!inInteractiveArea(px, py)) return;
    if (d.active && d.swiped) {
      discard(d.slot);
      return;
    }
    if (d.active && py < u.tray.y + 2) {
      if (!A.Battle.canAfford(d.def)) {
        S.toastMsg('能量不足', 0.9);
        return;
      }
      if (A.Battle.tryDeploy(d.def, px, py)) {
        consume(d.slot);
        A.GameAudio && A.GameAudio.play('place');
      }
      return;
    }
    if (!d.active) {
      S.inspect = d.def;
      S.inspectT = 2.2;
    }
  }

  // 用掉的卡直接从传送带移除，后面的牌继续左移
  function consume(slot) {
    if (!slot) return;
    A.Battle.removeSlot(slot);
  }

  function discard(slot) {
    if (!slot) return;
    A.Battle.removeSlot(slot);
    S.toastMsg('已丢弃', 0.7);
    A.GameAudio && A.GameAudio.play('discard');
  }

  function tap(px, py) {
    var u = L.ui;
    if (!inInteractiveArea(px, py)) return;
    if (S.phase === 'menu' || S.phase === 'win' || S.phase === 'lose') {
      var kind = S.phase === 'menu' ? 'menu' : 'result';
      if (hitControl(u.btnRect(kind), px, py, 12)) A.Game.start();
      return;
    }
    if (S.phase === 'paused') {
      if (hitControl(u.btnRect('paused'), px, py, 12)) {
        A.Game.start();
        return;
      }
      if (hitControl(u.pauseBtn, px, py, 10)) A.Game.togglePause();
      return;
    }
    if (S.phase === 'playing') {
      if (hitControl(u.pauseBtn, px, py, 10)) A.Game.togglePause();
    }
  }

  function cancel() {
    down = false;
    drag = null;
    S.dragging = null;
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
    bind: bind,
    getDrag: function () { return drag; },
  };
})();
