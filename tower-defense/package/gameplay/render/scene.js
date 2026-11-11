/* gameplay/render/scene.js — 战场绘制（背景、基地、单位、敌人、投射物、特效） */
(function () {
  var A = window.AIGCUtils;
  var C = A.Config;
  var S = A.State;
  var L = A.Layout;
  var D = A.Render.draw;
  var Assets = A.Assets;
  var SMOKE_FRAMES = ['fx-smoke', 'fx-smoke-2', 'fx-smoke-3'];

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


  function heroArt(def, cx, cy, size, alpha, view, facing) {
    var artKey = null;
    if (def.id === 'war') artKey = view === 'battle' ? 'melee-cat-back' : 'melee-cat-front';
    else if (def.id === 'mage') artKey = view === 'battle' ? 'mage-dog-back' : 'mage-dog-front';
    var art = artKey && Assets.entry(artKey);
    if (art) {
      var w = size * art.w / art.h;
      D.texture(art.tex, art.w, art.h, 0, 0, art.w, art.h,
        cx - w / 2, cy - size / 2, w, size,
        { r: 1, g: 1, b: 1, a: alpha === undefined ? 1 : alpha },
        { flipX: facing < 0 });
      return;
    }
    var atlas = Assets.entry('hero-pets-atlas');
    var cell = null;
    if (def.id === 'tank') cell = [0, 0];
    else if (def.id === 'war') cell = [1, 0];
    else if (def.id === 'arch') cell = [0, 1];
    else if (def.id === 'mage') cell = [1, 1];
    if (!atlas || !cell) {
      icon(def.icon, cx, cy, size, alpha);
      return;
    }
    var cw = atlas.w / 2, ch = atlas.h / 2;
    D.texture(atlas.tex, atlas.w, atlas.h, cell[0] * cw, cell[1] * ch, cw, ch,
      cx - size / 2, cy - size / 2, size, size,
      { r: 1, g: 1, b: 1, a: alpha === undefined ? 1 : alpha });
  }

  // 治疗角色暂无参考图与专属 Rig：复用心形占位，叠绿色医疗十字便于识别。
  function drawHealerPlaceholder(cx, cy, size, alpha) {
    icon('ui-heart', cx, cy, size, alpha);
    var mark = size * 0.30;
    var mx = cx + size * 0.24, my = cy + size * 0.20;
    D.roundRect(mx - mark / 2, my - mark / 2, mark, mark, 3, D.color('#153c2c', alpha));
    D.rect(mx - mark * 0.12, my - mark * 0.34, mark * 0.24, mark * 0.68, D.color('#6ff0a8', alpha));
    D.rect(mx - mark * 0.34, my - mark * 0.12, mark * 0.68, mark * 0.24, D.color('#6ff0a8', alpha));
  }

  function drawBackground() {
    var u = L.ui;
    // 环境层覆盖整个画布，按中心裁切保持原图比例；不受交互安全区约束。
    var bg = Assets.entry('in-game-background');
    if (bg) {
      var targetRatio = u.w / u.h;
      var sourceRatio = bg.w / bg.h;
      var sx = 0, sy = 0, sw = bg.w, sh = bg.h;
      if (sourceRatio > targetRatio) {
        sw = bg.h * targetRatio;
        sx = (bg.w - sw) / 2;
      } else {
        sh = bg.w / targetRatio;
        sy = (bg.h - sh) / 2;
      }
      D.texture(bg.tex, bg.w, bg.h, sx, sy, sw, sh, 0, 0, u.w, u.h);
    } else {
      D.vGradient(0, 0, u.w, u.h, COL.bgTop, COL.bgBottom, 26);
    }
  }

  function drawBase(dt) {
    var u = L.ui;
    var b = u.base;
    var sofa = Assets.entry('guardian-sofa');
    if (sofa) {
      var sofaW = Math.min(b.w * 0.66, b.h * 5);
      var sofaH = sofaW * sofa.h / sofa.w;
      // 沙发是独立游戏对象，靠近战场底边；生命条仍实时绘制在它前方。
      D.texture(sofa.tex, sofa.w, sofa.h, 0, 0, sofa.w, sofa.h,
        b.x + (b.w - sofaW) / 2, b.y - sofaH * 0.56, sofaW, sofaH);
    }
    var ratio = Math.max(0, S.baseHp) / C.BASE_HP;
    var bx = b.x + b.w * 0.16, bw = b.w * 0.68;
    var barY = b.y + b.h * 0.69;
    D.roundRect(bx - 4, barY - 4, bw + 8, 18, 9, D.color('#784436', 0.95));
    D.roundRect(bx, barY, bw, 10, 5, COL.hpBack);
    var hpCol = ratio > 0.5 ? COL.hpGreen : ratio > 0.25 ? COL.hpOrange : COL.hpRed;
    D.roundRect(bx + 1, barY + 1, Math.max(0, (bw - 2) * ratio), 8, 4, hpCol);
    D.text(String(Math.ceil(Math.max(0, S.baseHp))), bx + bw - 2, barY - 21, 18, COL.textMain, 2);
    // 基地范围提示
    if (S.shake > 0.05) {
      var a = S.shake * 1.6;
      D.roundRect(b.x, b.y, b.w, b.h, 12, D.color('#ff5a6e', Math.min(0.35, a)));
    }
  }

  function hpBar(x, y, w, ratio, col) {
    D.roundRect(x - 1, y - 1, w + 2, 6, 3, D.color('#5d382d', 0.88));
    D.roundRect(x, y, w, 4, 2, COL.hpBack);
    if (ratio > 0) D.roundRect(x, y, Math.max(1.5, w * ratio), 4, 2, col);
  }

  // 2×2 透明特效图集：箭矢、魔法弹、爪印命中、烟雾。
  function fxArt(cellX, cellY, cx, cy, w, h, alpha, rot) {
    var atlas = Assets.entry('battle-fx-atlas');
    if (!atlas) return false;
    var cw = atlas.w / 2, ch = atlas.h / 2;
    D.sprite(atlas.tex, atlas.w, atlas.h, cellX * cw, cellY * ch, cw, ch,
      cx, cy, Math.max(w, h), { w: w, h: h, rot: rot || 0, alpha: alpha });
    return true;
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

  function mageVfx(name, cx, cy, w, h, rot, alpha, tint) {
    var fx = A.MageVfx && A.MageVfx.effects[name];
    var tex = Assets.entry('mage-vfx');
    if (!fx || !tex) return;
    tint = tint || { r: 1, g: 1, b: 1 };
    D.sprite(tex.tex, tex.w, tex.h, fx[0], fx[1], fx[2], fx[3], cx, cy, w,
      { rot: rot || 0, w: w, h: h, tint: { r: tint.r, g: tint.g, b: tint.b, a: alpha } });
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

  // 70°正北俯视：地面上的圆形能量在屏幕中应是横向椭圆。
  function additiveGroundGlow(cx, cy, width, height, hex, alpha) {
    var sp = glowTex();
    if (!sp) return;
    var c = D.color(hex, 1);
    D.sprite(sp.tex, sp.texW, sp.texH, sp.x, sp.y, sp.w, sp.h, cx, cy, width, {
      w: width, h: height, tint: { r: c.r * alpha, g: c.g * alpha, b: c.b * alpha, a: 1 },
    });
  }

  function drawMageImpactParticles(e, t) {
    var fade = 1 - t;
    var burst = Math.min(1, t * 2.4);
    A.Render.setAdditive(true);
    additiveGroundGlow(e.x, e.y + 4, 42 + burst * 108, 20 + burst * 52, '#7130ff', fade * 0.92);
    additiveGroundGlow(e.x, e.y + 4, 20 + burst * 58, 9 + burst * 28, '#d8baff', fade * 0.56);
    for (var i = 0; i < 18; i++) {
      var angle = i * Math.PI * 2 / 18 + 0.38;
      var distance = 8 + burst * (44 + (i % 4) * 9);
      var px = e.x + Math.cos(angle) * distance;
      var py = e.y + 4 + Math.sin(angle) * distance * 0.52;
      var color = i % 4 === 0 ? '#f2dcff' : '#b368ff';
      additiveGlow(px, py, 7 + (i % 3) * 2, color, fade * (0.72 - (i % 3) * 0.08), 0);
    }
    A.Render.setAdditive(false);
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
      if (d.cls === 'healer') drawHealerPlaceholder(un.x, un.y, size, alpha);
      else icon(d.icon, un.x, un.y, size, alpha);
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
        var mdx = p.tx - p.x, mdy = p.ty - p.y;
        // 源图的北向是画面上方；从这个基准绕中心转向实际目标方向。
        var magicRot = Math.atan2(mdy, mdx) + Math.PI / 2;
        mageVfx('flight', p.x, p.y, 58, 88, magicRot, 1);
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
    var i, e, t;
    for (i = 0; i < S.effects.length; i++) {
      e = S.effects[i];
      t = 1 - e.life / e.max;
      if (e.type === 'ring') {
        var rr = (e.r || 8) + ((e.r2 || e.r * 1.8) - (e.r || 8)) * t;
        D.ring(e.x, e.y, rr, 2.2 * (1 - t) + 0.6, D.color(e.color, (1 - t) * 0.8));
      } else if (e.type === 'pop') {
        var popSize = e.r * (2.6 + t * 1.4);
        if (!fxArt(0, 1, e.x, e.y, popSize, popSize, 1 - t, 0)) {
          D.circle(e.x, e.y, e.r * (1 + t * 0.8), D.color(e.color, (1 - t) * 0.55));
          D.ring(e.x, e.y, e.r * (1 + t * 1.6), 2, D.color(e.color, (1 - t) * 0.7));
        }
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
        var source = null, target = null;
        for (var hi = 0; hi < S.units.length; hi++) {
          var hu = S.units[hi];
          if (hu.dead || hu.hp <= 0) continue;
          if (hu.uid === e.sourceUid) source = hu;
          if (hu.uid === e.targetUid) target = hu;
        }
        if (!source || !target) continue;
        var tx = target.x, ty = target.y - target.def.radius * 0.3;
        var sx = source.x, sy = source.y - source.def.radius * 0.3;
        var dx = tx - sx, dy = ty - sy;
        var length = Math.sqrt(dx * dx + dy * dy);
        if (length > 0) {
          A.Render.push((sx + tx) / 2 - length / 2, (sy + ty) / 2 - 2,
            length, 4, D.color('#6ff0a8', (1 - t) * 0.9),
            { mode: 0, hw: length / 2, hh: 2, r: 2, rot: Math.atan2(dy, dx), cx: (sx + tx) / 2, cy: (sy + ty) / 2 });
        }
        var healAlpha = 1 - t;
        var healSize = 10 + t * 5;
        var healY = ty - t * 18;
        A.Render.setAdditive(true);
        additiveGlow(tx, ty, (e.r || 20) * (1.2 + t), e.color, healAlpha * 0.4, 0);
        A.Render.setAdditive(false);
        D.rect(tx - healSize * 0.12, healY - healSize * 0.5,
          healSize * 0.24, healSize, D.color(e.color, healAlpha));
        D.rect(tx - healSize * 0.5, healY - healSize * 0.12,
          healSize, healSize * 0.24, D.color(e.color, healAlpha));
      } else if (e.type === 'mage-biscuit-impact') {
        // 贴图只含饼干和实体碎块；紫色地面能量全部由运行时粒子负责。
        var biscuitSize = (e.r || 34) * (1.85 + t * 0.28);
        drawMageImpactParticles(e, t);
        // 饼干是命中残留物：保持完整 0.2 秒，到时由效果生命周期直接移除。
        mageVfx('impact', e.x, e.y + 3, biscuitSize, biscuitSize * 0.92, 0, 1);
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
        ? '第 ' + (S.waveIndex + 1) + ' 波准备 ' + t.toFixed(1)
        : '';
      if (label) {
        D.roundRect(u.field.x + u.field.w / 2 - 80, u.field.y + 10, 160, 32, 16,
          D.color('#a96638', 0.94));
        D.roundRect(u.field.x + u.field.w / 2 - 78, u.field.y + 12, 156, 28, 14,
          D.color('#ffe7c2', 0.97));
        D.text(label, u.field.x + u.field.w / 2, u.field.y + 17, 18,
          D.color('#704026'), 1);
      }
    } else if (S.waveState === 'spawning') {
      var a = 0.35 + Math.sin(S.time * 6) * 0.15;
      D.rect(u.field.x + 2, u.field.y + 1, u.field.w - 4, 3, D.color('#ff5a6e', a));
    }
  }

  function drawFieldGuides() {
    if (S.phase !== 'playing') return;
    var u = L.ui;
    var field = u.field;
    var drag = S.dragging || (A.Input && A.Input.getDrag && A.Input.getDrag());
    if (S.waveState === 'prep' || S.waveState === 'spawning') {
      var pulse = 0.52 + 0.18 * Math.sin(S.time * 5);
      for (var i = 0; i < u.lanes.length; i++) {
        var x = u.lanes[i], y = field.y + 55;
        D.circle(x, y, 13, D.color('#fff0cf', 0.62 * pulse));
        D.ring(x, y, 13, 2, D.color('#ab6438', pulse));
        // 三路入口的向下箭头；仅提示敌人方向，不改变生成点。
        D.roundRect(x - 2, y - 7, 4, 10, 2, D.color('#a95136', pulse));
        D.roundRect(x - 7, y + 2, 14, 3, 1.5, D.color('#a95136', pulse));
        D.roundRect(x - 4, y + 5, 8, 3, 1.5, D.color('#a95136', pulse));
      }
    }
    if (!drag || !drag.active || !drag.def || drag.y >= u.tray.y) return;
    var top = Math.max(field.y - 24, u.interactiveRect.y);
    var bottom = Math.min(u.base.y + 10, u.tray.y - 4,
      u.interactiveRect.y + u.interactiveRect.h);
    var h = bottom - top;
    if (h <= 0) return;
    // 部署是连续坐标，不绘制虚假的格子。
    D.roundRect(field.x, top, field.w, h, 8, D.color('#73e5a0', 0.055));
    D.roundRect(field.x, top, field.w, 2, 1, D.color('#eaffbd', 0.56));
    D.roundRect(field.x, bottom - 2, field.w, 2, 1, D.color('#eaffbd', 0.56));
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
      } else if (def.cls === 'healer') {
        drawHealerPlaceholder(drag.x, ghostY, ghostSize, 0.7);
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
      D.roundRect(x - 52, y - 34, 104, 68, 12, D.color('#a96638', 0.9));
      D.roundRect(x - 49, y - 31, 98, 62, 10, D.color('#fff0d9', 0.96));
      heroArt(def, x - 20, y, 40, 0.96);
      D.text(def.name, x + 4, y - 20, 18, D.color('#704026', 0.95), 0);
      D.text(def.cost + ' 金币', x + 4, y + 2, 18, D.color('#9b5b30', 0.95), 0);
      return;
    }
    var reason = A.Battle.deployBlockReason(def, x, y);
    var ok = !reason && y < u.tray.y - 4;
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

    if (def.cls === 'healer') drawHealerPlaceholder(x, y, def.radius * 2.2, 0.94);
    else icon(def.icon, x, y, def.radius * 2.2, 0.94);

    if (!ok) {
      D.text(reason === 'cap' ? '席位已满' : reason === 'gold' ? '金币不足' : '请拖到战场', x, y + def.radius + 12, 18,
        D.color('#ff9aa8', 0.95), 1);
    }
  }

  function spriteIcon(name, cx, cy, size) { icon(name, cx, cy, size); }

  A.Scene = {
    COL: COL,
    icon: icon,
    heroArt: heroArt,
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
    drawFloats: drawFloats,
    drawSpawnHint: drawSpawnHint,
    drawFieldGuides: drawFieldGuides,
    drawDragGhost: drawDragGhost,
  };
})();
