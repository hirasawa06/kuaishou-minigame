/* gameplay/render/gl.js — 极简 WebGL 1.0 精灵批渲染器 */
// 只用 gl.* API：单纹理 + 顶点色 + 四边形批处理。
// mode 0 = 实心圆角矩形/圆，1 = 纹理，2 = 圆环，3 = 遮罩，5/6 = 彩色/灰度圆角纹理
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
    'varying float vScreenY;',
    'varying float vScreenX;',
    'varying vec4 vColor;',
    'varying vec3 vShape;',
    'varying float vMode;',
    'void main() {',
    '  vec2 p = aPos / uRes * 2.0 - 1.0;',
    '  gl_Position = vec4(p.x, -p.y, 0.0, 1.0);',
    '  vUV = aUV;',
    '  vScreenY = aPos.y;',
    '  vScreenX = aPos.x;',
    '  vColor = aColor;',
    '  vShape = aShape;',
    '  vMode = aMode;',
    '}',
  ].join('\n');

  var FRAG = [
    'precision mediump float;',
    'varying vec2 vUV;',
    'varying float vScreenY;',
    'varying float vScreenX;',
    'varying vec4 vColor;',
    'varying vec3 vShape;',
    'varying float vMode;',
    'uniform sampler2D uTex;',
    'uniform sampler2D uMaskTex;',
    'uniform float uAdd;',
    'uniform vec4 uClipRect;',
    'uniform float uClipRadius;',
    'uniform vec4 uTutorialHole;',
    'uniform float uTutorialRadius;',
    'uniform vec4 uSceneLight;', // 调色强度、身体中心Y、画布高、顶部光强度
    // ── 密集高斯核：81次采样连续羽化，边缘权重渐减并归一 ──
    'vec4 blurredCover(vec2 uv, vec2 d) {',
    '  vec4 t = vec4(0.0);',
    '  float total = 0.0;',
    '  for (int y = -4; y <= 4; y++) {',
    '    for (int x = -4; x <= 4; x++) {',
    '      vec2 offset = vec2(float(x), float(y));',
    '      float weight = exp(-dot(offset, offset) / 11.52);',
    '      t += texture2D(uTex, clamp(uv + offset * d, 0.0, 1.0)) * weight;',
    '      total += weight;',
    '    }',
    '  }',
    '  return t / total;',
    '}',
    'void main() {',
    '  vec4 c = vColor;',
    // ── 按屏幕坐标裁切容器，纹理UV保持完整，不依赖源图取景 ──
    '  if (uClipRect.z > 0.0) {',
    '    vec2 halfClip = uClipRect.zw * 0.5;',
    '    vec2 local = vec2(vScreenX, vScreenY) - uClipRect.xy - halfClip;',
    '    vec2 qClip = abs(local) - (halfClip - uClipRadius);',
    '    float clipDist = length(max(qClip, 0.0)) + min(max(qClip.x, qClip.y), 0.0) - uClipRadius;',
    '    float clipAlpha = 1.0 - smoothstep(-0.7, 0.7, clipDist);',
    '    if (clipAlpha < 0.004) discard;',
    '    c.a *= clipAlpha;',
    '  }',
    '  vec2 h = vShape.xy;',
    // 宽中心柔边椭圆：地面阴影不依赖图集光斑。
    // ┌─ Figma 收藏卡：代码绘制下半部波浪面板，并沿圆角卡片裁切 ─┐
    // ┌─ Figma 263:161：最外层 1.16px #874600 描边必须在所有内容之上 ─┐
    // ── 星级底板：仅左上、右下圆角，另外两角保持直角 ──
    // ── 主按钮：纯色填充，浅黄色柔光只沿顶部内缘分布 ──
    // ── 模式12：抗锯齿继续三角，直接绘制无需图集 ──
    // ── 模式13：圆润四角星的距离场，圆头和抗锯齿无需图片 ──
    '  if (vMode > 13.5) {',
    '    vec2 p = (vUV - 0.5) * 2.0 * h;',
    '    float r = vShape.z;',
    '    vec2 q = abs(p) - (h - r);',
    '    float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;',
    '    if (uTutorialHole.z > 0.0) {',
    '      vec2 halfHole = uTutorialHole.zw * 0.5;',
    '      vec2 holeQ = abs(vec2(vScreenX, vScreenY) - uTutorialHole.xy - halfHole) - (halfHole - uTutorialRadius);',
    '      float holeDist = length(max(holeQ, 0.0)) + min(max(holeQ.x, holeQ.y), 0.0) - uTutorialRadius;',
    '      dist = min(dist, holeDist);',
    '    }',
    '    float alpha = smoothstep(-0.7, 0.7, dist);',
    '    if (alpha < 0.004) discard;',
    '    c.a *= alpha;',
    '  } else if (vMode > 12.5) {',
    '    vec2 p = abs((vUV - 0.5) * 2.0);',
    '    p = vec2(min(p.x, p.y), max(p.x, p.y));',
    '    vec2 edge = vec2(0.30, -0.56);',
    '    vec2 delta = p - vec2(0.0, 0.86);',
    '    float t = clamp(dot(delta, edge) / dot(edge, edge), 0.0, 1.0);',
    '    float side = sign(edge.x * delta.y - edge.y * delta.x);',
    '    float dist = (length(delta - edge * t) * side - 0.12) * min(h.x, h.y);',
    '    float alpha = 1.0 - smoothstep(-0.5, 0.5, dist);',
    '    if (alpha < 0.004) discard;',
    '    c.a *= alpha;',
    '  } else if (vMode > 11.5) {',
    '    vec2 p = (vUV - 0.5) * 2.0 * h;',
    '    float slope = 2.0 * h.x / h.y;',
    '    float side = (p.x + slope * abs(p.y) - h.x) / sqrt(1.0 + slope * slope);',
    '    float dist = max(-p.x - h.x, side);',
    '    float a = 1.0 - smoothstep(-0.6, 0.6, dist);',
    '    if (a < 0.004) discard;',
    '    c.a *= a;',
    '  } else if (vMode > 9.5) {',
    '    vec2 p = (vUV - 0.5) * 2.0 * h;',
    '    float r = vShape.z;',
    '    vec2 q = abs(p) - (h - r);',
    '    float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;',
    '    float a = 1.0 - smoothstep(-0.7, 0.7, dist);',
    '    float top = 1.0 - smoothstep(-h.y * 0.5, 0.0, p.y);',
    '    float light = 0.90 * top * exp(-0.5 * pow((dist + 1.8) / 2.5, 2.0));',
    '    float bottom = smoothstep(0.0, h.y * 0.5, p.y);',
    '    float shade = 0.45 * bottom * exp(-0.5 * pow((dist + 1.5) / 2.0, 2.0));',
    // ── 模式11复用内光轮廓，波次牌使用奶油白高光与暖棕内阴影 ──
    '    float cream = step(10.5, vMode);',
    '    vec3 lower = mix(vec3(0.91, 0.45, 0.0), vec3(0.79, 0.59, 0.40), cream);',
    '    vec3 upper = mix(vec3(1.0, 0.902, 0.639), vec3(1.0, 0.976, 0.91), cream);',
    '    c.rgb = mix(c.rgb, lower, shade);',
    '    c.rgb = mix(c.rgb, upper, light);',
    '    if (a < 0.004) discard;',
    '    c.a *= a;',
    '  } else if (vMode > 8.5) {',
    '    vec2 p = (vUV - 0.5) * 2.0 * h;',
    '    float r = vShape.z;',
    '    vec2 local = p + h;',
    '    vec2 remaining = h - p;',
    '    float dist = max(abs(p.x) - h.x, abs(p.y) - h.y);',
    '    if (local.x < r && local.y < r) dist = length(local - vec2(r)) - r;',
    '    if (remaining.x < r && remaining.y < r) dist = length(remaining - vec2(r)) - r;',
    '    float a = 1.0 - smoothstep(-0.7, 0.7, dist);',
    '    if (a < 0.004) discard;',
    '    c.a *= a;',
    '  } else if (vMode > 7.5) {',
    '    float t = h.x * 2.0 * (1.16 / 329.521);',
    '    vec2 p = (vUV - 0.5) * 2.0 * h;',
    '    float r = vShape.z;',
    '    vec2 q = abs(p) - (h - r);',
    '    float outer = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;',
    '    vec2 ih = h - vec2(t);',
    '    float ir = max(0.0, r - t);',
    '    vec2 iq = abs(p) - (ih - ir);',
    '    float inner = length(max(iq, 0.0)) + min(max(iq.x, iq.y), 0.0) - ir;',
    '    float a = (1.0 - smoothstep(-0.7, 0.7, outer)) * smoothstep(-0.7, 0.7, inner);',
    '    if (a < 0.004) discard;',
    '    c.a *= a;',
    '  } else if (vMode > 6.5) {',
    '    vec2 p = (vUV - 0.5) * 2.0 * h;',
    '    float r = vShape.z;',
    '    vec2 q = abs(p) - (h - r);',
    '    float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;',
    '    float wave = 0.735 + 0.045 * pow(sin(vUV.x * 6.2831853), 2.0);',
    '    if (dist > 0.0 || vUV.y < wave) discard;',
    // Figma Union 内阴影：dy 2.32057、blur 1.91447、白色 70%。
    '    float depth = vUV.y - wave;',
    '    float dy = 2.32057 / 502.404;',
    '    float blur = 1.91447 / 502.404;',
    '    float innerLight = 0.70 * exp(-0.5 * pow((depth - dy) / blur, 2.0));',
    '    c.rgb = mix(c.rgb, vec3(1.0), innerLight);',
    '  } else if (vMode > 4.5) {',
    '    vec2 p = (vUV - 0.5) * 2.0 * h;',
    '    float r = vShape.z;',
    '    vec2 q = abs(p) - (h - r);',
    '    float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;',
    '    float a = 1.0 - smoothstep(-0.9, 0.9, dist);',
    '    vec4 t = texture2D(uTex, vUV);',
    // ── 模式6：未解锁关卡封面去色，保留透明度与圆角 ──
    // ── 模式6.25：远期关卡先模糊，再去色；不影响模式7/8 ──
    '    if (vMode > 6.1) t = blurredCover(vUV, vec2(3.0) / (2.0 * h));',
    '    t.rgb = mix(t.rgb, vec3(dot(t.rgb, vec3(0.299, 0.587, 0.114))), step(5.5, vMode));',
    '    if (a < 0.004 || t.a < 0.004) discard;',
    '    c = vec4(c.rgb * t.rgb, c.a * t.a * a);',
    '  } else if (vMode > 3.5) {',
    '    float radius = length((vUV - 0.5) * 2.0);',
    '    float a = 1.0 - smoothstep(0.30, 1.0, radius);',
    '    if (a < 0.004) discard;',
    '    c.a *= a;',
    '  } else if (vMode > 2.5) {',
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
    // 只处理实体贴图：阴影、几何UI、遮罩与加法光效不调色。
    '  if (uSceneLight.x > 0.0 && uAdd < 0.5 && vMode > 0.5 && vMode < 1.5) {',
    '    float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));',
    '    vec3 tone = mix(vec3(luma), c.rgb, 0.94);',
    '    tone = (tone - 0.5) * 1.065 + 0.5;',
    '    tone = tone * vec3(1.025, 0.995, 0.955);',
    '    tone += vec3(0.024, 0.009, 0.004) * (1.0 - luma);',
    '    float height = clamp((vScreenY - uSceneLight.y) / max(1.0, uSceneLight.z) + 0.5, 0.0, 1.0);',
    '    float overhead = mix(0.35, -0.85, smoothstep(0.18, 0.90, height));',
    '    tone *= 1.0 + overhead * uSceneLight.w;',
    '    c.rgb = mix(c.rgb, clamp(tone, 0.0, 1.0), uSceneLight.x);',
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
    loc.uClipRect = gl.getUniformLocation(prog, 'uClipRect');
    loc.uClipRadius = gl.getUniformLocation(prog, 'uClipRadius');
    loc.uTutorialHole = gl.getUniformLocation(prog, 'uTutorialHole');
    loc.uTutorialRadius = gl.getUniformLocation(prog, 'uTutorialRadius');
    loc.uSceneLight = gl.getUniformLocation(prog, 'uSceneLight');

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

  // ── 切换容器前提交批次，避免裁切状态影响后续文字与按钮 ──
  function setTutorialHole(rect, radius) {
    if (!gl) return;
    flush();
    gl.uniform4f(loc.uTutorialHole, rect ? rect.x : 0, rect ? rect.y : 0,
      rect ? rect.w : 0, rect ? rect.h : 0);
    gl.uniform1f(loc.uTutorialRadius, rect ? Math.min(radius || 0, rect.w / 2, rect.h / 2) : 0);
  }
  function setClipRect(rect, radius) {
    if (!gl) return;
    flush();
    gl.uniform4f(loc.uClipRect, rect ? rect.x : 0, rect ? rect.y : 0,
      rect ? rect.w : 0, rect ? rect.h : 0);
    gl.uniform1f(loc.uClipRadius, rect ? Math.min(radius || 0, rect.w / 2, rect.h / 2) : 0);
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
    var x1 = x + w, y1 = y + h;

    function v(sx, sy, uu, vv) {
      // --- 圆角渐变：沿局部纵轴插值，复用几何裁切 ---
      var tint = o0.bottomColor ? mix(color, o0.bottomColor, vv) : color;
      b[o] = sx; b[o + 1] = sy; b[o + 2] = uu; b[o + 3] = vv;
      b[o + 4] = tint.r; b[o + 5] = tint.g; b[o + 6] = tint.b; b[o + 7] = tint.a;
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
    if (loc.uAdd != null) gl.uniform1f(loc.uAdd, blendAdditive ? 1 : 0);
  }

  function isAdditive() { return blendAdditive; }

  // ── 场景光影：共用配置，切换先提交旧批次 ────────────────
  var sceneLight = [0, 0, 1, 0];
  var sceneLighting = { enabled: true, environment: 0.50, character: 1, overhead: 0.10 };
  function setSceneLight(kind, cy, height) {
    flush();
    var strength = sceneLighting.enabled ? (sceneLighting[kind] || 0) : 0;
    sceneLight = [strength, cy || 0, height || 1,
      kind === 'character' ? sceneLighting.overhead : 0];
  }

  function flush() {
    if (!gl || quadCount === 0) return;
    gl.useProgram(prog);
    // 手机宿主可能共用上下文；每批显式恢复自己的混合状态。
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(blendAdditive ? gl.ONE : gl.SRC_ALPHA,
      blendAdditive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2f(loc.uRes, resW, resH);
    if (loc.uSceneLight != null) gl.uniform4f(loc.uSceneLight, sceneLight[0], sceneLight[1], sceneLight[2], sceneLight[3]);
    if (loc.uAdd != null) gl.uniform1f(loc.uAdd, blendAdditive ? 1 : 0);
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
    sceneLight = [0, 0, 1, 0];
    stats.flushes = 0;
    blendAdditive = false;
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
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
  A.Render.setClipRect = setClipRect;
  A.Render.setTutorialHole = setTutorialHole;
  A.Render.invalidateTexture = invalidateTexture;
  A.Render.flush = flush;
  A.Render.beginFrame = beginFrame;
  A.Render.endFrame = flush;
  A.Render.push = push;
  A.Render.setAdditive = setAdditive;
  A.Render.setSceneLight = setSceneLight;
  A.Render.sceneLighting = sceneLighting;
  A.Render.isAdditive = isAdditive;
  A.Render.color = color;
  A.Render.mix = mix;
  A.Render.stats = stats;
  A.Render.whiteTex = function () { return whiteTex; };
})();
