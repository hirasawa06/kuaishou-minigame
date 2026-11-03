/* gameplay/render/safe-area-debug.js — H5 五区安全区域可视化 */
(function () {
  var A = window.AIGCUtils;

  function band(draw, label, x, y, w, h, fill, edge, labelX) {
    if (h <= 0 || w <= 0) return;
    // 仅显示边界和标签，不遮盖全屏美术。
    draw.rect(x, y + h - 2, w, 2, edge);
    var pillY = y + Math.max(4, Math.min(10, (h - 26) / 2));
    var pillX = labelX == null ? x + 8 : labelX;
    draw.roundRect(pillX, pillY, 28, 24, 12, draw.color('#07101d', 0.78));
    draw.text(label, pillX + 14, pillY + 3, 18, draw.color('#ffffff'), 1);
  }

  function fullScreenProof(D, w, h) {
    // 诊断用棋盘格按画布坐标铺满，跨过全部安全区边界。
    var size = 72;
    for (var y = 0; y < h; y += size) {
      for (var x = 0; x < w; x += size) {
        var even = ((x / size + y / size) % 2) === 0;
        D.rect(x, y, Math.min(size, w - x), Math.min(size, h - y),
          D.color(even ? '#ffcc54' : '#42e6d5', 0.19));
      }
    }
    var corners = [[0, 0], [w - 28, 0], [0, h - 28], [w - 28, h - 28]];
    for (var i = 0; i < corners.length; i++) {
      D.rect(corners[i][0], corners[i][1], 28, 28, D.color('#ff4b60', 0.88));
    }
  }

  function draw() {
    if (!window.__safeAreaDebug) return;
    var D = A.Render.draw;
    var u = A.Layout.ui;
    if (!D || !u || !u.ready) return;

    fullScreenProof(D, u.w, u.h);

    band(D, 'A', 0, 0, u.w, u.systemTop,
      D.color('#f2c46d', 0.30), D.color('#f2c46d', 0.9), (u.w - 28) / 2);
    band(D, 'B', 0, u.systemTop, u.w, u.platformBand.y - u.systemTop,
      D.color('#cdb9e8', 0.30), D.color('#cdb9e8', 0.9));
    band(D, 'C', u.platformBand.x, u.platformBand.y, u.platformBand.w, u.platformBand.h,
      D.color('#acd8f2', 0.28), D.color('#acd8f2', 0.9));
    // D 是交互边界的参考线；背景和非交互美术仍应完整铺到画布边缘。
    band(D, 'D', u.safeLeft, u.contentTop, u.safeRight - u.safeLeft, u.contentH,
      D.color('#b7dfc4', 0), D.color('#78c58f', 0.8));
    band(D, 'E', 0, u.contentBottom, u.w, u.h - u.contentBottom,
      D.color('#90a8c8', 0.30), D.color('#90a8c8', 0.9));
  }

  A.SafeAreaDebug = { draw: draw };
})();
