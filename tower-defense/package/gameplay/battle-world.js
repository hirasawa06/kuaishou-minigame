/* battle-world.js — 固定战场坐标；屏幕只负责展示和触摸转换。 */
(function () {
  var A = window.AIGCUtils, L = A.Layout;
  var depth = 0;
  var transform = { x: 0, y: 0, scale: 1 };
  var world;
  function rectToScreen(rect) {
    var p = toScreen(rect.x, rect.y);
    return { x: p.x, y: p.y, w: rect.w * transform.scale, h: rect.h * transform.scale };
  }
  function toScreen(x, y) {
    return { x: x * transform.scale + transform.x, y: y * transform.scale + transform.y };
  }
  function toWorld(x, y) {
    return { x: (x - transform.x) / transform.scale, y: (y - transform.y) / transform.scale };
  }
  // ── 414×896 基准的500高战场；额外屏幕空间不参与战斗 ──
  function configure(u) {
    var available = u.field;
    var scale = Math.min(available.w / 396, available.h / 500);
    transform = { scale: scale, x: available.x + (available.w - 396 * scale) / 2 - 9 * scale,
      y: u.tray.y - 636 * scale };
    world = Object.assign({}, u, {
      field: { x: 9, y: 136, w: 396, h: 500 },
      base: { x: 9, y: 586, w: 396, h: 50 }, baseStopY: 594,
      lanes: [88.2, 207, 325.8], spawnY: 106,
      placeTop: 161, placeBottom: 561, placeLeft: 35, placeRight: 379,
      guardianBar: { x: 122, y: 608, w: 292, h: 14 },
      tray: { x: 0, y: 636, w: 414, h: 260 },
      interactiveRect: { x: 0, y: 96, w: 414, h: 800 }
    });
    ['field', 'base'].forEach(function (key) { u[key] = rectToScreen(world[key]); });
    ['spawnY', 'baseStopY', 'placeTop', 'placeBottom'].forEach(function (key) {
      u[key] = toScreen(0, world[key]).y;
    });
    u.lanes = world.lanes.map(function (x) { return toScreen(x, 0).x; });
    u.placeLeft = toScreen(world.placeLeft, 0).x;
    u.placeRight = toScreen(world.placeRight, 0).x;
    u.worldScale = scale;
    // ── 道具保持战场比例，状态信息独立锚定图片与操作台 ──
    u.guardian = rectToScreen({ x: 8, y: 558, w: 88, h: 88 });
    L.alignGuardianInfo(u, scale);
  }
  function run(callback) {
    if (!world || depth) return callback();
    var screen = L.ui;
    depth++;
    L.ui = world;
    try { return callback(); }
    finally { L.ui = screen; depth--; }
  }
  // ── 光照、半圆裁切和拖影也跟随战场，保持几何一致 ──
  function draw(callback) {
    var R = A.Render, S = A.State, drag = S.dragging;
    var clip = R.setClipRect, light = R.setSceneLight;
    if (drag) S.dragging = Object.assign({}, drag, toWorld(drag.x, drag.y));
    R.setClipRect = function (rect, radius) { return clip(rect && rectToScreen(rect), radius && radius * transform.scale); };
    R.setSceneLight = function (kind, cy, height) {
      return light(kind, cy === undefined ? cy : toScreen(0, cy).y, height === undefined ? height : height * transform.scale);
    };
    try { return run(function () { return R.draw.withTransform(transform, callback); }); }
    finally { S.dragging = drag; R.setClipRect = clip; R.setSceneLight = light; }
  }
  function wrapBattle(fn, coordinateIndex, returnsPoint) {
    return function () {
      var args = Array.prototype.slice.call(arguments), screenCall = !depth;
      if (screenCall && coordinateIndex !== undefined) {
        var p = toWorld(args[coordinateIndex], args[coordinateIndex + 1]);
        args[coordinateIndex] = p.x; args[coordinateIndex + 1] = p.y;
      }
      var result = run(function () { return fn.apply(null, args); });
      return screenCall && returnsPoint && result ? toScreen(result.x, result.y) : result;
    };
  }
  A.BattleWorld = { configure: configure, run: run, draw: draw, toWorld: toWorld,
    toScreen: toScreen, rectToScreen: rectToScreen, wrapBattle: wrapBattle };
})();
