/* gameplay/anim/rig.js — 分件关键帧动画（瘦身版骨骼，无运行时依赖）
 *
 * 数据模型：
 *   rig.parts[]  每个分件引用图集里的一帧，anchor 为图集单元格内的像素锚点
 *   rig.states   每个状态一个关键帧表，keys[].mods[i] 作用于 parts[i]
 *   mod: { dx, dy, rot(度), sx, sy, alpha, flash }
 *
 * 采样得到 { t01, mods: [...] }，由 rig.draw() 负责套用。
 */
(function () {
  var A = window.AIGCUtils;

  // ── 缓动 ─────────────────────────────────────────────────
  var E = {
    linear: function (t) { return t; },
    outQuad: function (t) { return 1 - (1 - t) * (1 - t); },
    inQuad: function (t) { return t * t; },
    inOutSine: function (t) { return 0.5 - 0.5 * Math.cos(Math.PI * t); },
    outBack: function (t) {
      var c = 1.9;
      return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    },
    outElastic: function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      var p = 0.32;
      return Math.pow(2, -9 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
    },
  };

  // ── 关键帧采样 ───────────────────────────────────────────
  function lerp(a, b, t) { return a + (b - a) * t; }

  function sample(state, t) {
    var keys = state.keys;
    if (!keys || keys.length === 0) return [];
    var n = keys[0].mods.length;
    var out = [];
    var i;
    for (i = 0; i < n; i++) {
      out.push({ dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, alpha: 1, flash: 0, icon: null });
    }
    if (keys.length === 1) {
      for (i = 0; i < n; i++) Object.assign(out[i], keys[0].mods[i] || {});
      return out;
    }
    var k1 = keys[keys.length - 1];
    for (i = 0; i < keys.length - 1; i++) {
      if (t <= keys[i + 1].t) { k1 = keys[i + 1]; break; }
    }
    var k0 = keys[0];
    for (i = keys.length - 1; i >= 0; i--) {
      if (keys[i].t <= t) { k0 = keys[i]; break; }
    }
    var span = Math.max(1e-5, k1.t - k0.t);
    var raw = Math.min(1, Math.max(0, (t - k0.t) / span));
    var ease = E[state.ease || 'inOutSine'] || E.inOutSine;
    var u = ease(raw);
    for (i = 0; i < n; i++) {
      var a = k0.mods[i] || {};
      var b = k1.mods[i] || {};
      var o = out[i];
      o.dx = lerp(a.dx || 0, b.dx || 0, u);
      o.dy = lerp(a.dy || 0, b.dy || 0, u);
      o.rot = lerp(a.rot || 0, b.rot || 0, u);
      o.sx = lerp(a.sx === undefined ? 1 : a.sx, b.sx === undefined ? 1 : b.sx, u);
      o.sy = lerp(a.sy === undefined ? 1 : a.sy, b.sy === undefined ? 1 : b.sy, u);
      o.alpha = lerp(a.alpha === undefined ? 1 : a.alpha, b.alpha === undefined ? 1 : b.alpha, u);
      o.flash = lerp(a.flash || 0, b.flash || 0, u);
      // 图标帧不插值：保持当前关键帧，直到抵达下一帧。
      o.icon = a.icon || null;
    }
    return out;
  }

  // ── 绘制 ─────────────────────────────────────────────────
  // ent: 单位/敌人实体，需有 anim(状态名)、animT(状态内秒数)、hitFlash
  // extra: { tint, alpha }
  function draw(rig, ent, cx, cy, size, extra) {
    var state = rig.states[ent.anim || 'idle'] || rig.states.idle;
    if (!state) return;
    var t = ent.animT || 0;
    if (state.loop && state.dur > 0) t = t % state.dur;
    var mods = sample(state, Math.min(t, state.dur));
    var D = A.Render.draw;
    var atlas = A.GameAtlas || A.SpriteAtlas;
    var tex = A.Assets.tex('game') || A.Assets.tex('sprites');
    if (!tex) return;
    var tint = (extra && extra.tint) || { r: 1, g: 1, b: 1, a: 1 };
    var baseA = extra && extra.alpha !== undefined ? extra.alpha : 1;
    var flash = ent.hitFlash > 0 ? Math.min(1, ent.hitFlash * 5) : 0;

    for (var i = 0; i < rig.parts.length; i++) {
      var part = rig.parts[i];
      var m = mods[i] || {};
      var icon = atlas.icons[m.icon || part.icon];
      if (!icon) continue;
      var dw = size * (m.sx || 1);
      var dh = size * (m.sy || 1);
      var rot = (m.rot || 0) * Math.PI / 180;
      // 支点：分件锚点相对单元格中心的位置，旋转时保持不动
      var offX = (part.pivot ? part.pivot[0] * size : size / 2) - size / 2;
      var offY = (part.pivot ? part.pivot[1] * size : size / 2) - size / 2;
      var cos = Math.cos(rot), sin = Math.sin(rot);
      var shiftX = offX * cos - offY * sin - offX;
      var shiftY = offX * sin + offY * cos - offY;
      var col = {
        r: tint.r + (1 - tint.r) * flash,
        g: tint.g + (1 - tint.g) * flash,
        b: tint.b + (1 - tint.b) * flash,
        a: baseA * (m.alpha === undefined ? 1 : m.alpha),
      };
      D.sprite(tex, atlas.texW, atlas.texH,
        icon[0], icon[1], icon[2], icon[3],
        cx + (m.dx || 0) + shiftX, cy + (m.dy || 0) + shiftY,
        size, { w: dw, h: dh, rot: rot, tint: col });
    }
  }

  A.Anim = {
    E: E,
    sample: sample,
    draw: draw,
  };
})();
