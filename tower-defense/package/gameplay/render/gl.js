/* gameplay/render/gl.js — 极简 WebGL 1.0 精灵批渲染器 */
// 只用 gl.* API：单纹理 + 顶点色 + 四边形批处理。
// mode 0 = 实心圆角矩形/圆，mode 1 = 纹理，mode 2 = 圆环，mode 3 = 高 alpha 纹理遮罩
(function () {
  var A = window.AIGCUtils;

  var VERT = [
    'attribute vec2 aPos;',
    'attribute vec2 aUV;',
    'attribute vec4 aColor;',
    'attribute vec3 aShape;', // x: 半宽 y: 半高 z: 圆角半径/环宽
    'attribute float aMode;',
    'uniform vec2 uRes;',
    'varying vec2 vUV;',
    'varying vec4 vColor;',
    'varying vec3 vShape;',
    'varying float vMode;',
    'void main() {',
    '  vec2 p = aPos / uRes * 2.0 - 1.0;',
    '  gl_Position = vec4(p.x, -p.y, 0.0, 1.0);',
    '  vUV = aUV;',
    '  vColor = aColor;',
    '  vShape = aShape;',
    '  vMode = aMode;',
    '}',
  ].join('\n');

  var FRAG = [
    'precision mediump float;',
    'varying vec2 vUV;',
    'varying vec4 vColor;',
    'varying vec3 vShape;',
    'varying float vMode;',
    'uniform sampler2D uTex;',
    'uniform sampler2D uMaskTex;',
    'uniform float uAdd;',
    'void main() {',
    '  vec4 c = vColor;',
    '  vec2 h = vShape.xy;',
    '  if (vMode > 2.5) {',
    '    vec4 t = texture2D(uTex, vUV);',
    '    vec4 m = texture2D(uMaskTex, vUV);',
    '    if (t.a < 0.004 || m.a < 0.5) discard;',
    '    c = vec4(c.rgb * t.rgb, c.a * t.a);',
    '  } else if (vMode > 0.5 && vMode < 1.5) {',
    '    vec4 t = texture2D(uTex, vUV);',
    '    if (t.a < 0.004) discard;',
    // 顶点色作为 tint 与贴图颜色相乘：tint 为白色时保留原图配色
    // 加法混合下 alpha 不参与衰减，必须让 RGB 乘上贴图 alpha，
    // 否则 PNG 透明区的白色 RGB 会把整个四边形加亮成方块
    '    c = vec4(c.rgb * t.rgb * mix(1.0, t.a, uAdd), c.a * t.a);',
    '  } else if (vMode > 1.5) {',
    '    vec2 p = (vUV - 0.5) * 2.0 * h;',
    '    float dist = abs(length(p) - h.x) - vShape.z * 0.5;',
    '    float a = 1.0 - smoothstep(-0.9, 0.9, dist);',
    '    if (a < 0.02) discard;',
    '    c = vec4(c.rgb * mix(1.0, a, uAdd), c.a * a);',
    '  } else if (vMode > -0.5) {',
    '    vec2 p = (vUV - 0.5) * 2.0 * h;',
    '    float r = vShape.z;',
    '    vec2 q = abs(p) - (h - r);',
    '    float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;',
    '    float a = 1.0 - smoothstep(-0.9, 0.9, dist);',
    '    if (a < 0.02) discard;',
    '    c = vec4(c.rgb * mix(1.0, a, uAdd), c.a * a);',
    '  }',
    '  gl_FragColor = c;',
    '}',
  ].join('\n');

  var FLOATS_PER_VERT = 12;
  var QUADS_PER_FLUSH = 2048;
  var MAX_QUADS = 8192;

  var gl = null;
  var prog = null;
  var loc = {};
  var vbo = null;
  var ibo = null;
  var whiteTex = null;
  var currentTex = null;
  var currentMaskTex = null;
  var buffer = new Float32Array(MAX_QUADS * 4 * FLOATS_PER_VERT);
  var quadCount = 0;
  var resW = 1;
  var resH = 1;
  var stats = { quads: 0, flushes: 0 };

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Render.Shader', String(gl.getShaderInfoLog(s)));
      return null;
    }
    return s;
  }

  function makeWhiteTexture() {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return t;
  }

  function textureFromSource(source) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }

  function init(canvas) {
    if (gl) return true;
    var ctx = null;
    try { ctx = canvas.getContext('webgl'); } catch (e) { ctx = null; }
    if (!ctx) {
      console.error('Render.Init', 'WebGL 上下文创建失败');
      return false;
    }
    gl = ctx;
    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Render.Link', String(gl.getProgramInfoLog(prog)));
      return false;
    }
    gl.useProgram(prog);
    loc.aPos = gl.getAttribLocation(prog, 'aPos');
    loc.aUV = gl.getAttribLocation(prog, 'aUV');
    loc.aColor = gl.getAttribLocation(prog, 'aColor');
    loc.aShape = gl.getAttribLocation(prog, 'aShape');
    loc.aMode = gl.getAttribLocation(prog, 'aMode');
    loc.uRes = gl.getUniformLocation(prog, 'uRes');
    loc.uTex = gl.getUniformLocation(prog, 'uTex');
    loc.uMaskTex = gl.getUniformLocation(prog, 'uMaskTex');
    loc.uAdd = gl.getUniformLocation(prog, 'uAdd');

    vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, buffer.byteLength, gl.DYNAMIC_DRAW);

    var idx = new Uint16Array(QUADS_PER_FLUSH * 6);
    for (var i = 0; i < QUADS_PER_FLUSH; i++) {
      var o = i * 4;
      idx[i * 6] = o;
      idx[i * 6 + 1] = o + 1;
      idx[i * 6 + 2] = o + 2;
      idx[i * 6 + 3] = o;
      idx[i * 6 + 4] = o + 2;
      idx[i * 6 + 5] = o + 3;
    }
    ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

    whiteTex = makeWhiteTexture();
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.uniform1i(loc.uTex, 0);
    gl.uniform1i(loc.uMaskTex, 1);
    gl.uniform1f(loc.uAdd, 0);
    currentTex = null;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, whiteTex);
    currentTex = whiteTex;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, whiteTex);
    currentMaskTex = whiteTex;
    gl.activeTexture(gl.TEXTURE0);

    A.Render.gl = gl;
    A.Render.textureFromSource = textureFromSource;
    return true;
  }

  function setRes(w, h) {
    resW = w || 1;
    resH = h || 1;
    if (gl) gl.uniform2f(loc.uRes, resW, resH);
  }

  // 外部（纹理上传等）改动了 TEXTURE_2D 绑定后，必须调用此函数让缓存失效，
  // 否则批渲染器会跳过 bindTexture，导致采样到错误的纹理（表现为图标/文字消失）。
  function invalidateTexture() {
    currentTex = null;
    if (gl) gl.bindTexture(gl.TEXTURE_2D, null);
  }

  function setTexture(t) {
    if (!gl) return;
    t = t || whiteTex;
    if (currentTex === t) return;
    flush();
    currentTex = t;
    gl.bindTexture(gl.TEXTURE_2D, t);
  }

  function setMaskTexture(t) {
    if (!gl) return;
    t = t || whiteTex;
    if (currentMaskTex === t) return;
    flush();
    currentMaskTex = t;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.activeTexture(gl.TEXTURE0);
  }

  // opts: { mode, u0,v0,u1,v1, hw, hh, r }
  function push(x, y, w, h, color, opts) {
    if (!gl || w <= 0 || h <= 0) return;
    if (quadCount >= QUADS_PER_FLUSH) flush();
    var o = quadCount * 4 * FLOATS_PER_VERT;
    var b = buffer;
    var o0 = opts || {};
    var u0 = o0.u0 === undefined ? 0 : o0.u0;
    var v0 = o0.v0 === undefined ? 0 : o0.v0;
    var u1 = o0.u1 === undefined ? 1 : o0.u1;
    var v1 = o0.v1 === undefined ? 1 : o0.v1;
    var hw = o0.hw === undefined ? w / 2 : o0.hw;
    var hh = o0.hh === undefined ? h / 2 : o0.hh;
    var r = o0.r || 0;
    var mode = o0.mode || 0;
    if (!color) color = { r: 1, g: 1, b: 1, a: 1 };
    var cr = color.r, cg = color.g, cb = color.b, ca = color.a;
    var x1 = x + w, y1 = y + h;

    function v(sx, sy, uu, vv) {
      b[o] = sx; b[o + 1] = sy; b[o + 2] = uu; b[o + 3] = vv;
      b[o + 4] = cr; b[o + 5] = cg; b[o + 6] = cb; b[o + 7] = ca;
      b[o + 8] = hw; b[o + 9] = hh; b[o + 10] = r; b[o + 11] = mode;
      o += FLOATS_PER_VERT;
    }

    var rot = o0.rot || 0;
    if (!rot && !o0.flipX) {
      v(x, y, u0, v0);
      v(x1, y, u1, v0);
      v(x1, y1, u1, v1);
      v(x, y1, u0, v1);
      quadCount++;
      return;
    }

    // 旋转 / 水平翻转：在 CPU 端变换四角，不改 shader、不扩顶点格式
    var cx = o0.cx === undefined ? x + w / 2 : o0.cx;
    var cy = o0.cy === undefined ? y + h / 2 : o0.cy;
    var cos = Math.cos(rot), sin = Math.sin(rot);
    var dx0 = x - cx, dx1 = x1 - cx;
    var dy0 = y - cy, dy1 = y1 - cy;
    var LU = o0.flipX ? u1 : u0;
    var RU = o0.flipX ? u0 : u1;
    v(dx0 * cos - dy0 * sin + cx, dx0 * sin + dy0 * cos + cy, LU, v0);
    v(dx1 * cos - dy0 * sin + cx, dx1 * sin + dy0 * cos + cy, RU, v0);
    v(dx1 * cos - dy1 * sin + cx, dx1 * sin + dy1 * cos + cy, RU, v1);
    v(dx0 * cos - dy1 * sin + cx, dx0 * sin + dy1 * cos + cy, LU, v1);
    quadCount++;
  }

  // 加法混合：发光特效段开关。进出都要 flush，否则已入批的图元会沿用旧混合。
  var blendAdditive = false;
  function setAdditive(on) {
    if (!gl || blendAdditive === !!on) return;
    flush();
    blendAdditive = !!on;
    if (blendAdditive) gl.blendFunc(gl.ONE, gl.ONE);
    else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    // 着色器里按贴图 alpha 预乘，透明区不加亮
    if (loc.uAdd) gl.uniform1f(loc.uAdd, blendAdditive ? 1 : 0);
  }

  function isAdditive() { return blendAdditive; }

  function flush() {
    if (!gl || quadCount === 0) return;
    gl.useProgram(prog);
    gl.uniform2f(loc.uRes, resW, resH);
    if (loc.uAdd) gl.uniform1f(loc.uAdd, blendAdditive ? 1 : 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, buffer.subarray(0, quadCount * 4 * FLOATS_PER_VERT));
    var stride = FLOATS_PER_VERT * 4;
    gl.enableVertexAttribArray(loc.aPos);
    gl.vertexAttribPointer(loc.aPos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(loc.aUV);
    gl.vertexAttribPointer(loc.aUV, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(loc.aColor);
    gl.vertexAttribPointer(loc.aColor, 4, gl.FLOAT, false, stride, 16);
    gl.enableVertexAttribArray(loc.aShape);
    gl.vertexAttribPointer(loc.aShape, 3, gl.FLOAT, false, stride, 32);
    gl.enableVertexAttribArray(loc.aMode);
    gl.vertexAttribPointer(loc.aMode, 1, gl.FLOAT, false, stride, 44);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.drawElements(gl.TRIANGLES, quadCount * 6, gl.UNSIGNED_SHORT, 0);
    stats.quads += quadCount;
    stats.flushes++;
    quadCount = 0;
  }

  function beginFrame(rgb) {
    if (!gl) return;
    quadCount = 0;
    stats.quads = 0;
    stats.flushes = 0;
    if (blendAdditive) {
      blendAdditive = false;
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    gl.clearColor(rgb[0], rgb[1], rgb[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    gl.uniform2f(loc.uRes, resW, resH);
    gl.activeTexture(gl.TEXTURE0);
    currentTex = null;
    setTexture(whiteTex);
  }

  function color(hex, alpha) {
    var h = hex.charAt(0) === '#' ? hex.slice(1) : hex;
    var n = parseInt(h, 16);
    if (h.length === 8) {
      return {
        r: ((n >> 24) & 255) / 255, g: ((n >> 16) & 255) / 255,
        b: ((n >> 8) & 255) / 255, a: alpha === undefined ? (n & 255) / 255 : alpha,
      };
    }
    return {
      r: ((n >> 16) & 255) / 255,
      g: ((n >> 8) & 255) / 255,
      b: (n & 255) / 255,
      a: alpha === undefined ? 1 : alpha,
    };
  }

  function mix(c1, c2, t) {
    return {
      r: c1.r + (c2.r - c1.r) * t,
      g: c1.g + (c2.g - c1.g) * t,
      b: c1.b + (c2.b - c1.b) * t,
      a: c1.a + (c2.a - c1.a) * t,
    };
  }

  A.Render = A.Render || {};
  A.Render.init = init;
  A.Render.setRes = setRes;
  A.Render.setTexture = setTexture;
  A.Render.setMaskTexture = setMaskTexture;
  A.Render.invalidateTexture = invalidateTexture;
  A.Render.flush = flush;
  A.Render.beginFrame = beginFrame;
  A.Render.endFrame = flush;
  A.Render.push = push;
  A.Render.setAdditive = setAdditive;
  A.Render.isAdditive = isAdditive;
  A.Render.color = color;
  A.Render.mix = mix;
  A.Render.stats = stats;
  A.Render.whiteTex = function () { return whiteTex; };
})();
