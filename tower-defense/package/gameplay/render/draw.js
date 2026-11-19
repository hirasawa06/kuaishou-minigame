/* gameplay/render/draw.js — 绘图原语（矩形 / 圆角 / 圆 / 圆环 / 纹理 / 文字） */
(function () {
  var A = window.AIGCUtils;
  var GL = A.Render;
  var draw = {};

  var WHITE = { r: 1, g: 1, b: 1, a: 1 };
  draw.white = WHITE;
  draw.color = function (hex, a) { return GL.color(hex, a); };

  // ── 圆润四角星：统一代码轮廓，不依赖切图 ──
  draw.star = function (x, y, size, col) {
    if (size <= 0) return;
    GL.push(x, y, size, size, col, { mode: 13, hw: size / 2, hh: size / 2, r: 0 });
  };

  // ── 正上方光源的地面软影 ────────────────────────────────
  draw.softEllipse = function (cx, cy, w, h, col) {
    if (w <= 0 || h <= 0) return;
    GL.push(cx - w / 2, cy - h / 2, w, h, col,
      { mode: 4, hw: w / 2, hh: h / 2, r: 0 });
  };

  draw.rect = function (x, y, w, h, col) {
    if (w <= 0 || h <= 0) return;
    GL.push(x, y, w, h, col, { mode: 0, hw: w / 2, hh: h / 2, r: 0 });
  };

  draw.roundRect = function (x, y, w, h, r, col, bottomColor) {
    if (w <= 0 || h <= 0) return;
    r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    GL.push(x, y, w, h, col, { mode: 0, hw: w / 2, hh: h / 2, r: r, bottomColor: bottomColor });
  };

  // ┌─ 收藏卡的下半部波浪：曲线、圆角裁切与渐变全由着色器完成 ─┐
  draw.wavePanel = function (x, y, w, h, r, top, bottom) {
    if (w <= 0 || h <= 0) return;
    GL.push(x, y, w, h, top, {
      mode: 7, hw: w / 2, hh: h / 2, r: Math.min(r, w / 2, h / 2), bottomColor: bottom,
    });
  };

  // ┌─ 263:161 的 1.16px 描边单独后绘；解锁卡默认棕金，锁定卡可传浅灰 ─┐
  draw.figmaCardBorder = function (x, y, w, h, r, borderColor) {
    if (w <= 0 || h <= 0) return;
    GL.push(x, y, w, h, borderColor || draw.color('#874600'), {
      mode: 8, hw: w / 2, hh: h / 2, r: Math.min(r, w / 2, h / 2),
    });
  };

  // 商店卡片与教学提示共用的暖色圆角底板；所有层均限制在传入矩形内。
  draw.creamPanel = function (rect, alpha, radius) {
    if (!rect || rect.w <= 8 || rect.h <= 8) return;
    var a = alpha === undefined ? 1 : alpha;
    var r = Math.min(radius || 13, rect.h * 0.2);
    draw.roundRect(rect.x, rect.y, rect.w, rect.h, r, draw.color('#9b542c', a));
    draw.roundRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4,
      Math.max(1, r - 2), draw.color('#e8ac69', a));
    draw.roundRect(rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 8,
      Math.max(1, r - 4), draw.color('#fff0da', a));
    if (rect.w > 38 && rect.h > 25) {
      draw.roundRect(rect.x + r, rect.y + 4, rect.w - r * 2, 2, 1,
        draw.color('#ffffff', 0.55 * a));
    }
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

  // --- 完整图片放进圆角容器，圆角不写入素材 ---
  draw.roundTexture = function (tex, x, y, w, h, radius, grayscale, blur) {
    if (!tex || w <= 0 || h <= 0) return;
    GL.setTexture(tex);
    GL.push(x, y, w, h, WHITE, {
      mode: grayscale ? 6 + (blur ? 0.25 : 0) : 5, hw: w / 2, hh: h / 2,
      r: Math.min(radius, w / 2, h / 2),
    });
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

  // ── 全局七档字号：辅助、说明、正文、控件、数字、标题、主标题 ──
  var FONT_SIZES = [12, 14, 16, 20, 24, 32, 40];
  draw.fontSizes = FONT_SIZES.slice();
  draw.fontSize = function (requested) {
    return FONT_SIZES.reduce(function (best, candidate) {
      return Math.abs(candidate - requested) < Math.abs(best - requested) ? candidate : best;
    }, FONT_SIZES[0]);
  };

  // ── 对外只接受最终字号，内部匹配现有字形素材 ──────────
  function fontForSize(size) {
    var sizes = Object.keys(A.FontAtlas).map(Number);
    var nearest = sizes.reduce(function (best, candidate) {
      return Math.abs(candidate - size) < Math.abs(best - size) ? candidate : best;
    }, sizes[0]);
    return A.FontAtlas[String(nearest)];
  }

  draw.fitTextSize = function (str, size, maxWidth) {
    var preferred = draw.fontSize(size);
    var candidates = FONT_SIZES.filter(function (value) { return value <= preferred; });
    for (var i = candidates.length - 1; i >= 0; i--) {
      if (draw.textWidth(str, candidates[i]) <= maxWidth) return candidates[i];
    }
    return FONT_SIZES[0];
  };

  draw.fitTextContent = function (str, size, maxWidth) {
    if (draw.textWidth(str, size) <= maxWidth) return str;
    var suffix = '...';
    if (draw.textWidth(suffix, size) > maxWidth) return '';
    var end = str.length;
    while (end > 0 && draw.textWidth(str.slice(0, end) + suffix, size) > maxWidth) end--;
    return str.slice(0, end) + suffix;
  };

  draw.fittedText = function (str, x, y, size, maxWidth, col, align) {
    var fontSize = draw.fitTextSize(str, size, maxWidth);
    return draw.text(draw.fitTextContent(str, fontSize, maxWidth), x, y, fontSize, col, align);
  };

  draw.textWidth = function (str, size) {
    size = draw.fontSize(size);
    var atlas = fontForSize(size);
    if (!atlas) return 0;
    var g = atlas.glyphs;
    var w = 0;
    for (var i = 0; i < str.length; i++) {
      var gl = g[str.charAt(i)] || g[' '];
      if (gl) w += gl.adv;
    }
    return w * size / atlas.size;
  };

  // align: 0 左对齐 / 1 居中 / 2 右对齐
  draw.text = function (str, x, y, size, col, align) {
    size = draw.fontSize(size);
    var atlas = fontForSize(size);
    if (!atlas) return 0;
    var tex = A.Assets ? A.Assets.tex('font-' + atlas.size) : null;
    if (!tex) return 0;
    var fontRatio = size / atlas.size;
    var total = draw.textWidth(str, size);
    var penX = x;
    if (align === 1) penX = x - total / 2;
    else if (align === 2) penX = x - total;
    var g = atlas.glyphs;
    for (var i = 0; i < str.length; i++) {
      var gl = g[str.charAt(i)] || g[' '];
      if (!gl) continue;
      if (!gl.blank && gl.w > 0) {
        var page = gl.page || 0;
        var pageAtlas = atlas.pages ? atlas.pages[page] : atlas;
        var pageTex = page === 0 ? tex : A.Assets.tex('font-' + atlas.size + '-' + page);
        if (pageAtlas && pageTex) {
          GL.setTexture(pageTex);
          GL.push(penX + gl.ox * fontRatio, y + gl.oy * fontRatio,
            gl.w * TEXT_SCALE * fontRatio, gl.h * TEXT_SCALE * fontRatio, col, {
              mode: 1,
              u0: gl.x / pageAtlas.texW, v0: gl.y / pageAtlas.texH,
              u1: (gl.x + gl.w) / pageAtlas.texW, v1: (gl.y + gl.h) / pageAtlas.texH,
            });
        }
      }
      penX += gl.adv * fontRatio;
    }
    return total;
  };

  // ── 按可见字形边界居中，消除字体留白造成的偏移 ────────
  draw.centeredText = function (str, cx, cy, size, col) {
    size = draw.fontSize(size);
    var atlas = fontForSize(size);
    if (!atlas) return 0;
    var left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    var pen = 0;
    for (var i = 0; i < str.length; i++) {
      var glyph = atlas.glyphs[str.charAt(i)] || atlas.glyphs[' '];
      if (!glyph) continue;
      if (!glyph.blank && glyph.w > 0) {
        left = Math.min(left, pen + glyph.ox);
        right = Math.max(right, pen + glyph.ox + glyph.w * TEXT_SCALE);
        top = Math.min(top, glyph.oy);
        bottom = Math.max(bottom, glyph.oy + glyph.h * TEXT_SCALE);
      }
      pen += glyph.adv;
    }
    if (left === Infinity) return 0;
    var fontRatio = size / atlas.size;
    return draw.text(str, cx - (left + right) * fontRatio / 2, cy - (top + bottom) * fontRatio / 2,
      size, col, 0);
  };

  draw.textLineH = function (size) {
    size = draw.fontSize(size);
    var atlas = fontForSize(size);
    return atlas ? atlas.lineH * size / atlas.size : size;
  };

  A.Render.draw = draw;
})();
