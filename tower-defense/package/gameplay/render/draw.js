/* gameplay/render/draw.js — 绘图原语（矩形 / 圆角 / 圆 / 圆环 / 纹理 / 文字） */
(function () {
  var A = window.AIGCUtils;
  var GL = A.Render;
  var draw = {};

  var WHITE = { r: 1, g: 1, b: 1, a: 1 };
  draw.white = WHITE;
  draw.color = function (hex, a) { return GL.color(hex, a); };

  draw.rect = function (x, y, w, h, col) {
    if (w <= 0 || h <= 0) return;
    GL.push(x, y, w, h, col, { mode: 0, hw: w / 2, hh: h / 2, r: 0 });
  };

  draw.roundRect = function (x, y, w, h, r, col) {
    if (w <= 0 || h <= 0) return;
    r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    GL.push(x, y, w, h, col, { mode: 0, hw: w / 2, hh: h / 2, r: r });
  };

  draw.circle = function (cx, cy, radius, col) {
    if (radius <= 0) return;
    GL.push(cx - radius, cy - radius, radius * 2, radius * 2, col,
      { mode: 0, hw: radius, hh: radius, r: radius });
  };

  // 圆环：r 为环中线半径，t 为环宽
  draw.ring = function (cx, cy, r, t, col) {
    if (r <= 0) return;
    var R = r + t * 0.5;
    GL.push(cx - R, cy - R, R * 2, R * 2, col,
      { mode: 2, hw: r, hh: r, r: Math.max(0.8, t) });
  };

  draw.strokeRect = function (x, y, w, h, t, col) {
    draw.rect(x, y, w, t, col);
    draw.rect(x, y + h - t, w, t, col);
    draw.rect(x, y + t, t, h - t * 2, col);
    draw.rect(x + w - t, y + t, t, h - t * 2, col);
  };

  draw.vGradient = function (x, y, w, h, top, bottom, bands) {
    bands = bands || 16;
    var bh = h / bands;
    for (var i = 0; i < bands; i++) {
      draw.rect(x, y + i * bh, w, bh + 0.6, GL.mix(top, bottom, i / (bands - 1)));
    }
  };

  draw.hGradient = function (x, y, w, h, left, right, bands) {
    bands = bands || 12;
    var bw = w / bands;
    for (var i = 0; i < bands; i++) {
      draw.rect(x + i * bw, y, bw + 0.6, h, GL.mix(left, right, i / (bands - 1)));
    }
  };

  // 从图集绘制（sx/sy/sw/sh 为纹理像素）
  // tw/th 为纹理像素尺寸：WebGLTexture 对象本身不带宽高，必须显式传入。
  // sy 以「图片左上角」为原点（与 PNG / 图集元数据一致），这里换算成 GL 的左下原点。
  draw.texture = function (tex, tw, th, sx, sy, sw, sh, dx, dy, dw, dh, tint, opts) {
    if (!tex || !tw || !th || dw <= 0 || dh <= 0) return;
    GL.setTexture(tex);
    // 顶点着色器已保持 v 与图集同向（y 向下），这里直接用源图坐标
    var v0 = sy / th;
    var v1 = (sy + sh) / th;
    var o = {
      mode: opts && opts.alphaCutout ? 3 : 1,
      u0: sx / tw, v0: v0, u1: (sx + sw) / tw, v1: v1,
    };
    if (opts) {
      if (opts.rot) o.rot = opts.rot;
      if (opts.flipX) o.flipX = true;
      if (opts.cx !== undefined) o.cx = opts.cx;
      if (opts.cy !== undefined) o.cy = opts.cy;
    }
    GL.push(dx, dy, dw, dh, tint || WHITE, o);
  };

  // 以 (cx,cy) 为中心绘制图集帧，支持旋转（弧度）、翻转、缩放
  // opts: { rot, rotate(度), flipX, scale, alpha, tint, additive }
  draw.sprite = function (tex, tw, th, sx, sy, sw, sh, cx, cy, size, opts) {
    if (!tex) return;
    var o = opts || {};
    var k = o.scale === undefined ? 1 : o.scale;
    var dw = o.w !== undefined ? o.w : size * k;
    var dh = o.h !== undefined ? o.h : size * k;
    var rot = o.rot || 0;
    if (o.rotate) rot = o.rotate * Math.PI / 180;
    var tint = o.tint || WHITE;
    var a = o.alpha === undefined ? 1 : o.alpha;
    if (a !== 1 || o.rgbScale !== undefined) {
      tint = { r: tint.r, g: tint.g, b: tint.b, a: tint.a * a };
    }
    draw.texture(tex, tw, th, sx, sy, sw, sh, cx - dw / 2, cy - dh / 2, dw, dh,
      tint, { rot: rot, flipX: !!o.flipX, cx: cx, cy: cy });
  };

  // ── 文字（位图字形图集，2x 烘焙）──────────────────────────────
  // atlas 中 ox/oy/adv 已是逻辑像素，w/h 是纹理像素，需乘 TEXT_SCALE
  var TEXT_SCALE = 0.5;

  draw.textWidth = function (str, atlas) {
    if (!atlas) return 0;
    var g = atlas.glyphs;
    var w = 0;
    for (var i = 0; i < str.length; i++) {
      var gl = g[str.charAt(i)] || g[' '];
      if (gl) w += gl.adv;
    }
    return w;
  };

  // align: 0 左对齐 / 1 居中 / 2 右对齐
  draw.text = function (str, x, y, size, col, align, scale) {
    var atlas = A.FontAtlas[String(size)];
    if (!atlas) return 0;
    var tex = A.Assets ? A.Assets.tex('font-' + size) : null;
    if (!tex) return 0;
    scale = scale === undefined ? 1 : scale;
    var total = draw.textWidth(str, atlas) * scale;
    var penX = x;
    if (align === 1) penX = x - total / 2;
    else if (align === 2) penX = x - total;
    var g = atlas.glyphs;
    GL.setTexture(tex);
    for (var i = 0; i < str.length; i++) {
      var gl = g[str.charAt(i)] || g[' '];
      if (!gl) continue;
      if (!gl.blank && gl.w > 0) {
        GL.push(penX + gl.ox * scale, y + gl.oy * scale,
          gl.w * TEXT_SCALE * scale, gl.h * TEXT_SCALE * scale, col, {
            mode: 1,
            u0: gl.x / atlas.texW, v0: gl.y / atlas.texH,
            u1: (gl.x + gl.w) / atlas.texW, v1: (gl.y + gl.h) / atlas.texH,
          });
      }
      penX += gl.adv * scale;
    }
    return total;
  };

  draw.textLineH = function (size) {
    var atlas = A.FontAtlas[String(size)];
    return atlas ? atlas.lineH : size;
  };

  A.Render.draw = draw;
})();
