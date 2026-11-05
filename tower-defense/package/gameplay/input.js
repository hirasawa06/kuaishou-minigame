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
  var LONG_PRESS = 0.22;   // 按住不动超过这个时间显示详情

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

  function menuHitKey(x, y) {
    var m = L.ui.menu;
    if (!m || !inInteractiveArea(x, y)) return null;
    if (hitControl(m.start, x, y, 12)) return 'start';
    if (hitControl(m.settings, x, y, 6)) return 'settings';
    if (hitControl(m.rank, x, y, 6)) return 'rank';
    if (hitControl(m.avatar, x, y, 6)) return 'avatar';
    if (hitControl(m.stamina, x, y, 6)) return 'stamina';
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

  function onDown(px, py) {
    shopPressStarted = false;
    down = inInteractiveArea(px, py);
    if (!down) return;
    // 弹窗 / 全屏页优先：打开时不再把触摸传给战场或商店
    if (A.ProfileUI && A.ProfileUI.isOpen()) return;
    if (S.phase === 'menu' && !S.menuPanel) S.menuPressed = menuHitKey(px, py);
    if (S.phase !== 'playing') return;
    var u = L.ui;
    if (S.gold >= S.refreshCost && hitControl(u.refreshBtn, px, py, 0)) {
      S.shopPressed = 'refresh';
      shopPressStarted = true;
      return;
    }
    if (S.heroCap < C.UNIT_CAP_MAX && S.gold >= S.capCost &&
        hitControl(u.capBtn, px, py, 0)) {
      S.shopPressed = 'cap';
      shopPressStarted = true;
      return;
    }
    var hit = shopAt(px, py);
    if (!hit) return;
    var def = S.heroById(hit.slot.cardId);
    if (!def) return;
    drag = {
      index: hit.index,
      slot: hit.slot,
      def: def,
      x: px, y: py,
      startX: px, startY: py,
      active: false,
      holdT: 0,
      rect: hit.rect,
    };
    S.dragging = drag;
  }

  function onMove(px, py) {
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
    if (!drag.active && Math.abs(dx) + Math.abs(dy) > MOVE_TOL) drag.active = true;
    if (drag.active) S.dragging = drag;
  }

  function onUp(px, py) {
    if (S.phase === 'menu') S.menuPressed = null;
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

    // 拖到战场：直接部署
    if (d.active && py < u.tray.y - 4 && inInteractiveArea(px, py)) {
      if (A.Battle.buyCard(d.index, px, py)) {
        A.GameAudio && A.GameAudio.play('place');
      }
      return;
    }
    // 拖回商店区域松手：什么都不做
    if (d.active) return;

    // 点一下：默认放到战场中下方（省一次拖拽）
    if (A.Battle.buyCardAtCenter(d.index)) {
      A.GameAudio && A.GameAudio.play('place');
    } else {
      S.inspect = d.def;
      S.inspectT = 2.4;
      S.inspectX = d.rect.x;
      S.inspectY = d.rect.y - 140;
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
      if (S.menuPanel) {
        S.menuPanel = null;
        return;
      }
      var key = menuHitKey(px, py);
      if (key) S.menuFeedback = { key: key, life: 0.18 };
      if (key === 'start') { S.menuStartDelay = 0.18; return; }
      if (key === 'settings') { A.ProfileUI.open('settings'); return; }
      if (key === 'rank') { A.ProfileUI.open('rank'); return; }
      if (key === 'avatar') { A.ProfileUI.open('profile'); return; }
      if (key === 'stamina') { S.menuPanel = 'stamina'; return; }
      return;
    }
    if (S.phase === 'win' || S.phase === 'lose') {
      if (hitControl(u.btnRect('result'), px, py, 12)) A.Game.start();
      return;
    }
    if (S.phase === 'paused') {
      var pp = u.pausePanel;
      if (hitControl(pp.btn('resume'), px, py, 8)) { A.Game.togglePause(); return; }
      if (hitControl(pp.btn('settings'), px, py, 8)) { A.Game.openSettings(); return; }
      if (hitControl(pp.btn('restart'), px, py, 8)) { A.Game.restart(); return; }
      if (hitControl(pp.btn('home'), px, py, 8)) { A.Game.goMenu(); return; }
      if (hitControl(u.pauseBtn, px, py, 10)) A.Game.togglePause();
      return;
    }
    if (S.phase === 'playing') {
      if (hitControl(u.pauseBtn, px, py, 10)) { A.Game.togglePause(); return; }
      if (hitControl(u.refreshBtn, px, py, 4)) {
        S.refreshShop();
        A.GameAudio && A.GameAudio.play('discard');
        return;
      }
      if (hitControl(u.capBtn, px, py, 4)) {
        S.buyCap();
        A.GameAudio && A.GameAudio.play('start');
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
