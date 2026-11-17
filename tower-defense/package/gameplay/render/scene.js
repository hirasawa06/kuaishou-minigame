/* gameplay/render/scene.js — 战场绘制（背景、基地、单位、敌人、投射物、特效） */
(function () {
  var A = window.AIGCUtils;
  var C = A.Config;
  var S = A.State;
  var L = A.Layout;
  var D = A.Render.draw;
  var Assets = A.Assets;

  var COL = {
    bgTop: D.color('#101a33'),
    bgBottom: D.color('#070b17'),
    fieldLine: D.color('#243656', 0.7),
    laneLine: D.color('#1b2942'),
    baseTop: D.color('#2c3d63'),
    baseBottom: D.color('#1a2440'),
    hpBack: D.color('#0a0f1c', 0.75),
    hpGreen: D.color('#5be08a'),
    hpRed: D.color('#ff6b7f'),
    hpOrange: D.color('#ffb23f'),
    textMain: D.color('#f2f6ff'),
    textDim: D.color('#8fa2c6'),
    energy: D.color('#4de1ff'),
    cardBg: D.color('#18233d'),
    cardBgDim: D.color('#131c31'),
    gold: D.color('#ffd166'),
  };

  function icon(name, cx, cy, size, alpha) {
    var sp = Assets.sprite(name);
    if (!sp) return;
    D.texture(sp.tex, sp.texW, sp.texH, sp.x, sp.y, sp.w, sp.h,
      cx - size / 2, cy - size / 2, size, size,
      { r: 1, g: 1, b: 1, a: alpha === undefined ? 1 : alpha });
  }

  function drawBackground() {
    var u = L.ui;
    // 客厅背景铺满全屏（与首页同一张），避免换场景时跳色
    var bg = Assets.entry('menu-bg');
    if (bg) {
      D.texture(bg.tex, bg.w, bg.h, 0, 0, bg.w, bg.h, 0, 0, u.w, u.h);
    } else {
      D.vGradient(0, 0, u.w, u.h, COL.bgTop, COL.bgBottom, 26);
    }
    // 战场压暗，让敌人和英雄从客厅背景里浮出来
    var f = u.field;
    D.vGradient(0, 0, u.w, u.h, D.color('#141018', 0.58), D.color('#0d0b10', 0.72), 18);
    // 三条通道
    for (var i = 0; i < u.lanes.length; i++) {
      D.rect(u.lanes[i] - f.w * 0.15, f.y, f.w * 0.30, f.h, D.color('#3a2c22', 0.16));
    }
    for (var k = 1; k < u.lanes.length; k++) {
      var x = (u.lanes[k - 1] + u.lanes[k]) / 2;
      D.rect(x - 0.5, f.y, 1, f.h, D.color('#6b5442', 0.28));
    }
    D.strokeRect(f.x, f.y, f.w, f.h, 1, D.color('#a8845e', 0.35));
    // 顶部生成区指示
    D.hGradient(f.x + 1, f.y + 1, f.w - 2, 34, D.color('#5a2b44', 0.55), D.color('#0d1526', 0), 8);
  }

  function drawBase(dt) {
    var u = L.ui;
    var b = u.base;
    D.roundRect(b.x + 1, b.y, b.w - 2, b.h, 12, COL.baseTop);
    D.roundRect(b.x + 1, b.y + 4, b.w - 2, b.h - 4, 12, D.color('#223054'));
    // 城墙垛口
    var n = 14;
    var cw = (b.w - 10) / n;
    for (var i = 0; i < n; i++) {
      D.rect(b.x + 5 + i * cw + cw * 0.15, b.y - 6, cw * 0.7, 10, D.color('#35496f'));
    }
    var ratio = Math.max(0, S.baseHp) / C.BASE_HP;
    var bx = b.x + 14, bw = b.w - 28;
    D.roundRect(bx, b.y + b.h * 0.42, bw, 10, 5, COL.hpBack);
    var hpCol = ratio > 0.5 ? COL.hpGreen : ratio > 0.25 ? COL.hpOrange : COL.hpRed;
    D.roundRect(bx + 1, b.y + b.h * 0.42 + 1, Math.max(0, (bw - 2) * ratio), 8, 4, hpCol);
    D.text(String(Math.ceil(Math.max(0, S.baseHp))), bx + bw - 4, b.y + b.h * 0.42 - 17, 18, COL.textMain, 2);
    D.text('基地', bx + 2, b.y + b.h * 0.42 - 17, 18, COL.textDim, 0);
    // 基地范围提示
    if (S.shake > 0.05) {
      var a = S.shake * 1.6;
      D.roundRect(b.x, b.y, b.w, b.h, 12, D.color('#ff5a6e', Math.min(0.35, a)));
    }
  }

  function hpBar(x, y, w, ratio, col) {
    D.roundRect(x, y, w, 4, 2, COL.hpBack);
    if (ratio > 0) D.roundRect(x, y, Math.max(1.5, w * ratio), 4, 2, col);
  }

  function drawEnemy(e) {
    var r = e.def.radius;
    var spawn = e.spawnT > 0 ? 1 - e.spawnT / 0.35 : 1;
    var scale = 0.7 + 0.3 * spawn;
    var rr = r * scale;
    var rig = A.Rigs && A.Rigs[e.rigId || e.def.id];
    // 抬手动画：0.18s 内微微上抬后压，给攻击一个可读的节奏
    var wind = 0;
    var tilt = 0;
    if (e.anim === 'atk') {
      var at = Math.max(0, Math.min(0.5, e.animT));
      if (at < 0.18) {
        wind = -at / 0.18 * 2.4;
        tilt = at / 0.18 * 6;
      } else {
        var k = Math.min(1, (at - 0.18) / 0.26);
        wind = 3.4 * (1 - k);
        tilt = 6 * (1 - k) - 4 * k * (1 - k);
      }
    }
    drawGroundShadow(e.x, e.y + rr * 0.84, rr * 0.70, 0.48 * spawn);
    if (rig) {
      A.Anim.draw(rig, e, e.x, e.y - r * 0.15, r * 3.05 * (rig.scale || 1) * scale, {
        alpha: 0.3 + 0.7 * spawn,
      });
    } else {
      icon(e.def.icon, e.x, e.y + wind, rr * 2.5, spawn);
    }
    if (e.hitFlash > 0) {
      D.circle(e.x, e.y, rr, D.color('#ffffff', e.hitFlash * 3.2));
    }
    var w = Math.max(24, rr * 2.1);
    var ratio = Math.max(0, e.hp / e.maxHp);
    if (!e.dead) hpBar(e.x - w / 2, e.y - rr - 12, w, ratio,
      e.def.id === 'boss' ? D.color('#ff6b9d') : COL.hpRed);
  }

  // 用角色真正落在地面的绘制点决定前后层级，而不是按“宠物 / 怪物”分组。
  // 数值和各自阴影中心一致：北侧（较小 y）先画，南侧（较大 y）后画。
  function actorDepthY(actor, isEnemy) {
    var r = actor.def.radius;
    if (isEnemy) {
      var spawn = actor.spawnT > 0 ? 1 - actor.spawnT / 0.35 : 1;
      var scale = 0.7 + 0.3 * spawn;
      return actor.y + r * scale * 0.84;
    }
    var unitSpawn = actor.spawnT > 0 ? 1 - actor.spawnT / 0.3 : 1;
    var rig = A.Rigs && A.Rigs[actor.rigId || actor.def.id];
    var size = rig
      ? r * 3.05 * (rig.scale || 1) * (0.86 + 0.14 * unitSpawn)
      : r * 2.35 * (0.8 + 0.2 * unitSpawn);
    var spriteY = rig ? actor.y - r * 0.15 : actor.y;
    return spriteY + size * 0.42;
  }

  // 图集帧绘制：优先用 frame 名字直接查 A.SpriteAtlas
  function frame(name, cx, cy, size, opts) {
    var sp = Assets.sprite(name);
    if (!sp) return;
    opts = opts || {};
    opts.tint = opts.tint || { r: 1, g: 1, b: 1, a: opts.alpha === undefined ? 1 : opts.alpha };
    opts.w = opts.w || size;
    opts.h = opts.h || size;
    D.sprite(sp.tex, sp.texW, sp.texH, sp.x, sp.y, sp.w, sp.h, cx, cy, size, opts);
  }

  function glowTex() {
    var sp = Assets.sprite('fx-glow');
    return sp;
  }

  // 地面阴影复用柔边光斑纹理，正常混合下染成近黑色并压成椭圆。
  // 它不是角色光环，边缘会随贴图 alpha 自然羽化。
  function drawGroundShadow(cx, cy, radius, alpha) {
    var sp = glowTex();
    if (!sp) return;
    var width = radius * 2;
    D.sprite(sp.tex, sp.texW, sp.texH, sp.x, sp.y, sp.w, sp.h, cx, cy, width, {
      w: width,
      h: radius * 0.56,
      tint: { r: 0.02, g: 0.02, b: 0.03, a: alpha },
    });
  }

  // GIF 已离线拆为透明 PNG 帧表。按固定节奏取格，飞行距离变化也不会拉伸动画速度。
  function mageFlightVfx(p, rot, scale, alpha) {
    var spec = A.MageFlight;
    var tex = Assets.entry('mage-flight');
    if (!spec || !tex) return;
    var index = Math.floor((p.animT || 0) * 1000 / spec.frameMs) % spec.frames;
    var col = index % spec.cols;
    var row = Math.floor(index / spec.cols);
    var cell = spec.cell;
    var size = 76 * scale;
    D.sprite(tex.tex, tex.w, tex.h, col * cell, row * cell, cell, cell, p.x, p.y, size, {
      rot: rot, w: size, h: size, tint: { r: 1, g: 1, b: 1, a: alpha },
    });
  }

  // 命中帧表用固定“落地点”锚定。爆发可以向上扩散，但每一帧都从同一个地面原点生长。
  function mageImpactVfx(e, t, scale, alpha) {
    var spec = A.MageImpact;
    var tex = Assets.entry('mage-impact');
    if (!spec || !tex) return;
    var index = 0;
    var timeline = spec.timeline || [];
    for (var step = 1; step < timeline.length; step++) {
      if (t >= timeline[step]) index = step;
    }
    var col = index % spec.cols;
    var row = Math.floor(index / spec.cols);
    var cell = spec.cell;
    var size = (spec.drawSize || 108) * scale;
    var anchor = spec.anchor || [cell * 0.5, cell * 0.5];
    var cy = e.y - (anchor[1] - cell * 0.5) * size / cell;
    var lastFrame = timeline.length - 1;
    var fade = 1;
    if (index === lastFrame) {
      var finalStart = timeline[lastFrame];
      var finalDuration = Math.max(0.001, (spec.duration || e.max) - finalStart);
      fade = Math.max(0, 1 - (t - finalStart) / finalDuration);
    }
    D.sprite(tex.tex, tex.w, tex.h, col * cell, row * cell, cell, cell, e.x, cy, size, {
      w: size, h: size, tint: { r: 1, g: 1, b: 1, a: alpha * fade },
    });
  }

  // 加法混合光斑：rgb 预先乘 alpha，这样加法混合下淡出才不会“越淡越亮”
  function additiveGlow(cx, cy, size, hex, alpha, rot) {
    var sp = glowTex();
    if (!sp) return;
    var c = D.color(hex, 1);
    D.sprite(sp.tex, sp.texW, sp.texH, sp.x, sp.y, sp.w, sp.h, cx, cy, size, {
      rot: rot || 0,
      tint: { r: c.r * alpha, g: c.g * alpha, b: c.b * alpha, a: 1 },
    });
  }

  // 60°正北俯视：地面上的圆形能量在屏幕中应是横向椭圆。
  function additiveGroundGlow(cx, cy, width, height, hex, alpha) {
    var sp = glowTex();
    if (!sp) return;
    var c = D.color(hex, 1);
    D.sprite(sp.tex, sp.texW, sp.texH, sp.x, sp.y, sp.w, sp.h, cx, cy, width, {
      w: width, h: height, tint: { r: c.r * alpha, g: c.g * alpha, b: c.b * alpha, a: 1 },
    });
  }

  function clamp01(value) { return Math.max(0, Math.min(1, value)); }

  function vfxTune(kind) {
    return kind === 'mage'
      ? { hue: 266, saturation: 0.76, brightness: 1, alpha: 0.92, blendMode: 1, layers: 2, particles: 18, particleStyle: 0, lightStyle: 0, pulseSpeed: 1, glowScale: 1, scale: 0.6, particleSize: 1, particleSpeed: 1, spread: 1, shape: 0, travel: 1, rotation: 0, drift: 0 }
      : { hue: 96, saturation: 0.76, brightness: 1, alpha: 0.88, blendMode: 1, layers: 2, particles: 4, particleStyle: 1, lightStyle: 0, pulseSpeed: 1, glowScale: 1, scale: 1, particleSize: 1, particleSpeed: 1, spread: 1, shape: 0, travel: 1, rotation: 0, drift: 0 };
  }

  function vfxColor(kind, offset, light, fallback) {
    return fallback;
  }

  // 统一处理软光、脉冲与光环：层数由外向内叠加，避免为每种效果复制混合逻辑。
  function tunedLight(x, y, size, color, alpha, config, time, ground) {
    var pulse = config.lightStyle === 1 ? 0.84 + Math.sin(time * Math.PI * 4 * config.pulseSpeed) * 0.16 : 1;
    for (var i = 0; i < config.layers; i++) {
      var layer = 1 - i * 0.19;
      var layerSize = size * pulse * (1 - i * 0.14) * config.glowScale;
      if (ground) additiveGroundGlow(x, y, layerSize, layerSize * 0.42, color, alpha * layer * config.alpha);
      else additiveGlow(x, y, layerSize, color, alpha * layer * config.alpha, 0);
    }
    if (config.lightStyle === 2) D.ring(x, y, size * 0.30 * config.glowScale, 1.2, D.color(color, alpha * config.alpha));
  }

  // ── 治疗地面层：0.5 秒淡入淡出，所有角色之前绘制 ──────────
  function healTexture(key, x, y, width, alpha, anchor) {
    var image = Assets.entry(key);
    if (!image) return;
    var height = width * image.h / image.w;
    var origin = anchor || [0.5, 0.5];
    D.texture(image.tex, image.w, image.h, 0, 0, image.w, image.h,
      x - width * origin[0], y - height * origin[1], width, height,
      { r: 1, g: 1, b: 1, a: alpha });
  }

  function drawHealLayer(e, target, foreground) {
    var t = clamp01(1 - e.life / e.max);
    var alpha = Math.sin(Math.PI * t);
    if (t === 0 || t === 1) alpha = 0;
    var r = target.def.radius;
    var rig = A.Rigs && A.Rigs[target.rigId || target.def.id];
    var spawn = target.spawnT > 0 ? 1 - target.spawnT / 0.3 : 1;
    var size = rig ? r * 3.05 * (rig.scale || 1) * (0.86 + 0.14 * spawn)
      : r * 2.35 * (0.8 + 0.2 * spawn);
    var pivot = rig && rig.parts[0].pivot || [0.5, 0.92];
    var footX = target.x + (pivot[0] - 0.5) * size;
    var footY = target.y - (rig ? r * 0.15 : 0) + (pivot[1] - 0.5) * size;
    var width = r * 3.2;
    // 光环在角色下方，十字在角色上方；共用位置和透明度时间线。
    if (!foreground) {
      // 光环可见圆心并非图片中心；直接将素材圆心锚到角色脚底支点。
      healTexture('heal-aura', footX, footY, width, alpha, [0.525, 0.68]);
      return;
    }
    // 参考图：左下大十字、右上小十字，沿身体两侧轻微上浮。
    healTexture('heal-cross', target.x - size * 0.38,
      footY - size * 0.40 - t * 4, size * 0.24, alpha);
    healTexture('heal-cross', target.x + size * 0.43,
      footY - size * 0.66 - t * 4, size * 0.14, alpha);
  }

  function drawGroundEffects() {
    drawHealEffects(false);
  }

  function drawHealEffects(foreground) {
    for (var i = 0; i < S.effects.length; i++) {
      var e = S.effects[i];
      if (e.type !== 'heal') continue;
      for (var j = 0; j < S.units.length; j++) {
        var target = S.units[j];
        if (target.uid === e.targetUid && !target.dead && target.hp > 0) {
          drawHealLayer(e, target, foreground);
          break;
        }
      }
    }
  }

  function drawUnit(un) {
    var d = un.def;
    var r = d.radius;
    var spawn = un.spawnT > 0 ? 1 - un.spawnT / 0.3 : 1;
    var rig = A.Rigs && A.Rigs[un.rigId || d.id];
    var size = rig
      ? r * 3.05 * (rig.scale || 1) * (0.86 + 0.14 * spawn)
      : r * 2.35 * (0.8 + 0.2 * spawn);
    // 阴影只跟随贴图尺寸：固定贴在贴图下部，不再用逻辑半径推算位置。
    var spriteY = rig ? un.y - r * 0.15 : un.y;
    var shadowY = spriteY + size * 0.42;

    drawGroundShadow(un.x, shadowY, r * 0.70, 0.40 * (0.4 + 0.6 * spawn));
    if (rig) {
      A.Anim.draw(rig, un, un.x, spriteY, size, {
        alpha: 0.3 + 0.7 * spawn,
      });
      if (un.hitFlash > 0) {
        A.Render.setAdditive(true);
        additiveGlow(un.x, un.y, r * 2.4, '#ffffff', un.hitFlash * 2.2, 0);
        A.Render.setAdditive(false);
      }
    } else {
      var alpha = 0.25 + 0.75 * spawn;
      icon(d.icon, un.x, un.y, size, alpha);
      if (un.hitFlash > 0) D.circle(un.x, un.y, r, D.color('#ffffff', un.hitFlash * 3));
    }

    var w = Math.max(22, r * 2.1);
    var ratio = Math.max(0, un.hp / un.maxHp);
    var col = ratio > 0.5 ? COL.hpGreen : ratio > 0.25 ? COL.hpOrange : COL.hpRed;
    hpBar(un.x - w / 2, un.y - r - 10, w, ratio, col);
  }

  function drawProjectiles() {
    for (var i = 0; i < S.projectiles.length; i++) {
      var p = S.projectiles[i];
      if (p.kind === 'light') {
        var dx = p.tx - p.x, dy = p.ty - p.y;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var nx = dx / len, ny = dy / len;
        // 单发光弹：短尾迹跟随目标方向，亮核只画一次投射物本体。
        A.Render.setAdditive(true);
        additiveGlow(p.x - nx * 3.5, p.y - ny * 3.5, 15, '#ffd38a', 0.72,
          Math.atan2(dy, dx));
        additiveGlow(p.x, p.y, 9, '#fff5d1', 0.92, 0);
        A.Render.setAdditive(false);
        D.circle(p.x, p.y, 2.2, D.color('#fff7d8', 0.96));
      } else if (p.kind === 'fire') {
        D.circle(p.x, p.y, 6, D.color(p.color, 0.55));
        D.circle(p.x, p.y, 3.4, D.color('#ffd9a0'));
      } else if (p.kind === 'magic') {
        var magicConfig = vfxTune('mage');
        var mdx = p.tx - p.x, mdy = p.ty - p.y;
        // 源图的北向是画面上方；从这个基准绕中心转向实际目标方向。
        var magicRot = Math.atan2(mdy, mdx) + Math.PI / 2;
        mageFlightVfx(p, magicRot, magicConfig.scale, magicConfig.alpha);
      } else {
        D.circle(p.x, p.y, 5.6, D.color(p.color, 0.6));
        D.circle(p.x, p.y, 3, D.color('#e6fbff'));
      }
    }
  }

  // ═══ 倒地烟雾 ═══
  // 只保留中烟团与残烟两帧，删除用户否决的大烟团起始帧。
  var smokeFrames = ['fx-smoke', 'fx-smoke-2'];
  var smokeScales = [0.55, 0.9];

  function smokeFrame(t) {
    return Math.min(smokeFrames.length - 1, Math.floor(t * smokeFrames.length));
  }

  function drawEffects() {
    drawHealEffects(true);
    var i, e, t;
    for (i = 0; i < S.effects.length; i++) {
      e = S.effects[i];
      t = 1 - e.life / e.max;
      if (e.type === 'ring') {
        var rr = (e.r || 8) + ((e.r2 || e.r * 1.8) - (e.r || 8)) * t;
        D.ring(e.x, e.y, rr, 2.2 * (1 - t) + 0.6, D.color(e.color, (1 - t) * 0.8));
      } else if (e.type === 'pop') {
        D.circle(e.x, e.y, e.r * (1 + t * 0.8), D.color(e.color, (1 - t) * 0.55));
        D.ring(e.x, e.y, e.r * (1 + t * 1.6), 2, D.color(e.color, (1 - t) * 0.7));
      } else if (e.type === 'slash') {
        drawSlashTrail(e, t);
      } else if (e.type === 'spark') {
        // 火星改走加法混合，比纯色小圆更有“打中”的感觉
        A.Render.setAdditive(true);
        additiveGlow(e.x, e.y, 12 * (1 - t) + 4, e.color, (1 - t) * 0.9, 0);
        A.Render.setAdditive(false);
      } else if (e.type === 'glow') {
        A.Render.setAdditive(true);
        var g = 1 - t;
        additiveGlow(e.x, e.y, (e.r || 10) * (1.3 + t * 1.3), e.color, g * 0.62, 0);
        A.Render.setAdditive(false);
      } else if (e.type === 'heal') {
        continue; // 治疗光环与十字由各自层级统一绘制。
      } else if (e.type === 'mage-biscuit-impact') {
        var mageConfig = vfxTune('mage');
        mageImpactVfx(e, t, mageConfig.scale, mageConfig.alpha);
      } else if (e.type === 'smoke') {
        var smokeIndex = smokeFrame(t);
        var sp = Assets.sprite(smokeFrames[smokeIndex]);
        if (sp) {
          var size = (e.r || 10) * 6 * smokeScales[smokeIndex];
          D.sprite(sp.tex, sp.texW, sp.texH, sp.x, sp.y, sp.w, sp.h,
            e.x, e.y - size / 2, size, { alpha: 0.9, tint: D.color(e.color, 1) });
        }
      }
    }
  }

  // 刀光：一条贴着攻击方向的月牙，从出手点扫向受击点。
  // 贴图弧朝上，旋转到与攻击方向垂直后，弧背正好朝目标方向推进。
  function drawSlashTrail(e, t) {
    var sp = Assets.sprite('fx-slash');
    if (!sp) return;
    var dx = e.tx - e.x;
    var dy = e.ty - e.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return;
    // 沿攻击方向推进：0.5 → 0.85，弧线扫过去
    var k = 0.5 + t * 0.5;
    var px = e.x + dx * k;
    var py = e.y + dy * k;
    var rot = Math.atan2(dy, dx) + Math.PI / 2;
    var a = (1 - t) * 0.95;
    var c = D.color(e.color, 1);
    var size = 40 - t * 10;
    A.Render.setAdditive(true);
    D.sprite(sp.tex, sp.texW, sp.texH, sp.x, sp.y, sp.w, sp.h, px, py, size, {
      rot: rot,
      w: size,
      h: size * 0.62,
      tint: { r: c.r, g: c.g, b: c.b, a: a },
    });
    A.Render.setAdditive(false);
  }

  function drawFloats() {
    for (var i = 0; i < S.floats.length; i++) {
      var f = S.floats[i];
      var a = Math.min(1, f.life / f.max * 2);
      D.text(f.text, f.x, f.y - 10, 18, D.color(f.color, a), 1);
    }
  }

  function drawSpawnHint() {
    var u = L.ui;
    if (S.phase !== 'playing') return;
    if (S.waveState === 'prep') {
      var t = Math.max(0, S.waveTimer);
      var label = S.waveIndex < C.WAVES.length
        ? '第 ' + (S.waveIndex + 1) + ' 波 ' + t.toFixed(1) + 's'
        : '';
      if (label) {
        D.roundRect(u.field.x + u.field.w / 2 - 78, u.field.y + 10, 156, 32, 16, D.color('#0b1324', 0.85));
        D.text(label, u.field.x + u.field.w / 2, u.field.y + 17, 18, COL.gold, 1);
      }
    } else if (S.waveState === 'spawning') {
      var a = 0.35 + Math.sin(S.time * 6) * 0.15;
      D.rect(u.field.x + 2, u.field.y + 1, u.field.w - 4, 3, D.color('#ff5a6e', a));
    }
  }

  function drawDragGhost() {
    var drag = S.dragging || (A.Input && A.Input.getDrag && A.Input.getDrag());
    if (!drag || !drag.active) return;
    var u = L.ui;
    var def = drag.kind === 'unit' && drag.unit ? drag.unit.def : drag.def;
    if (!def) return;
    if (drag.kind === 'unit') {
      var unit = drag.unit;
      if (!unit || unit.dead || unit.hp <= 0 || def.moveSpeed !== 0 || S.units.indexOf(unit) < 0) return;
      // 只绘制一个角色副本与售价，不移动原单位，不进入买卡/部署预览分支。
      var ghostRig = A.Rigs && A.Rigs[unit.rigId || def.id];
      var ghostSize = ghostRig ? def.radius * 3.05 * (ghostRig.scale || 1) : def.radius * 2.35;
      var ghostY = ghostRig ? drag.y - def.radius * 0.15 : drag.y;
      if (ghostRig) {
        A.Anim.draw(ghostRig, unit, drag.x, ghostY, ghostSize, { alpha: 0.7 });
      } else {
        icon(def.icon, drag.x, ghostY, ghostSize, 0.7);
      }
      D.text('+' + A.Battle.sellPrice(unit) + ' 金币', drag.x, drag.y + def.radius + 12,
        18, COL.gold, 1);
      return;
    }
    var overField = drag.y < u.tray.y;
    var x = drag.x, y = drag.y;
    if (!overField) {
      // 手指还在商店里：卡片跟手，不显示落地预览
      D.roundRect(x - 52, y - 34, 104, 68, 12, D.color('#0d1220', 0.55));
      icon(def.icon, x - 20, y, 40, 0.96);
      D.text(def.name, x + 4, y - 20, 18, D.color('#ffffff', 0.95), 0);
      D.text(def.cost + ' 金币', x + 4, y + 2, 18, D.color('#ffd166', 0.95), 0);
      return;
    }
    var live = S.liveUnits();
    var ok = A.Battle.canAfford(def) && live < S.heroCap &&
      y > u.field.y - 30 && y < u.base.y;
    var col = ok ? '#6ff0a8' : '#ff6b7f';

    // 攻击半径（盾位无攻击，改画嘲讽半径）
    if (def.cls === 'tank' && def.taunt) {
      D.circle(x, y, def.taunt, D.color('#5b8bd0', 0.10));
      D.ring(x, y, def.taunt, 1.6, D.color('#7fb2ff', 0.55));
      D.text('嘲讽', x, y - def.taunt - 16, 18, D.color('#9ec6ff', 0.85), 1);
    } else if (def.range) {
      D.circle(x, y, def.range, D.color(col, 0.09));
      D.ring(x, y, def.range, 1.4, D.color(col, 0.5));
    }
    // 群攻范围
    if (def.splash) {
      D.circle(x, y, def.splash, D.color('#a583f0', 0.08));
      D.ring(x, y, def.splash, 1.2, D.color('#b79cff', 0.45));
    }
    D.circle(x, y, def.radius + 4, D.color(col, 0.22));
    D.ring(x, y, def.radius + 3, 1.6, D.color(col, 0.85));
    var previewRig = A.Rigs && A.Rigs[def.id];
    if (previewRig) {
      var previewSize = def.radius * 3.05 * (previewRig.scale || 1);
      A.Anim.draw(previewRig, { anim: 'idle', animT: 0, hitFlash: 0 },
        x, y - def.radius * 0.15, previewSize, { alpha: 0.94 });
    } else {
      icon(def.icon, x, y, def.radius * 2.2, 0.94);
    }
    if (!ok) {
      D.text(live >= S.heroCap ? '席位已满' : '金币不足', x, y + def.radius + 12, 18,
        D.color('#ff9aa8', 0.95), 1);
    }
  }

  function spriteIcon(name, cx, cy, size) { icon(name, cx, cy, size); }

  A.Scene = {
    COL: COL,
    icon: icon,
    ic: spriteIcon,
    frame: frame,
    additiveGlow: additiveGlow,
    drawBackground: drawBackground,
    drawBase: drawBase,
    drawEnemy: drawEnemy,
    drawUnit: drawUnit,
    actorDepthY: actorDepthY,
    drawProjectiles: drawProjectiles,
    drawEffects: drawEffects,
    drawGroundEffects: drawGroundEffects,
    drawFloats: drawFloats,
    drawSpawnHint: drawSpawnHint,
    drawDragGhost: drawDragGhost,
  };
})();
