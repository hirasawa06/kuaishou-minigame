/* gameplay/render/safe-area-debug.js — H5 五区安全区域可视化 */
(function () {
  var A = window.AIGCUtils;

  function band(draw, label, x, y, w, h, fill, edge, labelX) {
    if (h <= 0 || w <= 0) return;
    draw.rect(x, y, w, h, fill);
    draw.rect(x, y + h - 2, w, 2, edge);
    var pillY = y + Math.max(4, Math.min(10, (h - 26) / 2));
    var pillX = labelX == null ? x + 8 : labelX;
    draw.roundRect(pillX, pillY, 28, 24, 12, draw.color('#07101d', 0.78));
    draw.text(label, pillX + 14, pillY + 3, 18, draw.color('#ffffff'), 1);
  }

  function draw() {
    if (!window.__safeAreaDebug) return;
    var D = A.Render.draw;
    var u = A.Layout.ui;
    if (!D || !u || !u.ready) return;

    band(D, 'A', 0, 0, u.w, u.systemTop,
      D.color('#f2c46d', 0.30), D.color('#f2c46d', 0.9), (u.w - 28) / 2);
    band(D, 'B', 0, u.systemTop, u.w, u.platformBand.y - u.systemTop,
      D.color('#cdb9e8', 0.30), D.color('#cdb9e8', 0.9));
    band(D, 'C', u.platformBand.x, u.platformBand.y, u.platformBand.w, u.platformBand.h,
      D.color('#acd8f2', 0.28), D.color('#acd8f2', 0.9));
    band(D, 'D', u.safeLeft, u.contentTop, u.safeRight - u.safeLeft, u.contentH,
      D.color('#b7dfc4', 0.055), D.color('#78c58f', 0.8));
    band(D, 'E', 0, u.contentBottom, u.w, u.h - u.contentBottom,
      D.color('#90a8c8', 0.30), D.color('#90a8c8', 0.9));
  }

  A.SafeAreaDebug = { draw: draw };
})();
