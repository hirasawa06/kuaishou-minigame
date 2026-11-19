/* gameplay/render/scene.js — 战场绘制（背景、合照守护物、单位、敌人、投射物、特效） */
(function () {
  var A = window.AIGCUtils;
  var C = A.Config;
  var S = A.State;
  var L = A.Layout;
  var D = A.Render.draw;
  var Assets = A.Assets;
  var SMOKE_FRAMES = ['fx-smoke', 'fx-smoke-2', 'fx-smoke-3'];
  // 正视立绘的可见边界（纹理像素）；统一卡牌、详情与拖拽中的角色视觉大小。
  var CARD_ART = {
    tank: { key: 'shield-dog-front', crop: [69, 62, 332, 380] },
    war: { key: 'melee-cat-front', crop: [37, 28, 407, 434] },
    arch: { key: 'archer-cat-front', crop: [82, 73, 308, 365] },
    mage: { key: 'mage-dog-front', crop: [52, 20, 371, 460] },
  };

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
    var card = CARD_ART[def.id];
    var artKey = view === 'battle'
      ? (def.id === 'war' ? 'melee-cat-back' : def.id === 'mage' ? 'mage-dog-back' : null)
      : (card && card.key);
    var art = artKey && Assets.entry(artKey);
    if (art) {
      var crop = view === 'battle' ? [0, 0, art.w, art.h] : card.crop;
      var w = size * crop[2] / crop[3];
      D.texture(art.tex, art.w, art.h, crop[0], crop[1], crop[2], crop[3],
        cx - w / 2, cy - size / 2, w, size,
        { r: 1, g: 1, b: 1, a: alpha === undefined ? 1 : alpha },
        { flipX: facing < 0 });
      return;
    }
    icon(def.icon, cx, cy, size, alpha);
  }

  // 背视姿势图只用于战场；卡牌继续使用角色正面图。
  function battlePose(un, cx, cy, size, alpha) {
    var id = un.def.id;
    var state = un.anim === 'hurt' ? 1 : un.anim === 'die' ? 2 : 0;
    var key = id === 'war' ? 'melee-cat-poses' : id === 'mage' ? 'mage-dog-poses' : null;
    var art = key && Assets.entry(key);
    if (art) {
      var cell = art.w / 3;
      D.texture(art.tex, art.w, art.h, cell * state, 0, cell, art.h,
        cx - size / 2, cy - size / 2, size, size,
        { r: 1, g: 1, b: 1, a: alpha }, { flipX: un.facing < 0 });
      return true;
    }
    if (id === 'arch' && state === 1) {
      art = Assets.entry('archer-cat-hurt');
      if (art) {
        var w = size * art.w / art.h;
        D.texture(art.tex, art.w, art.h, 0, 0, art.w, art.h,
          cx - w / 2, cy - size / 2, w, size,
          { r: 1, g: 1, b: 1, a: alpha }, { flipX: un.facing < 0 });
        return true;
      }
    }
    return false;
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
    var level = C.LEVELS[S.currentLevel - 1] || C.LEVELS[0];
    var bg = Assets.entry('battle-map-' + level.map) || Assets.entry('in-game-background');
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
      A.Render.setSceneLight('environment');
      D.texture(bg.tex, bg.w, bg.h, sx, sy, sw, sh, 0, 0, u.w, u.h);
      A.Render.setSceneLight('off');
    } else {
      D.vGradient(0, 0, u.w, u.h, COL.bgTop, COL.bgBottom, 26);
    }
  }

  // 动作场复用正式图集和 Rig，只替换战斗背景与实体来源，便于比对实际播放结果。
  function drawBossLab() {
    var lab = L.ui.bossLab;
    var preview = S.bossLab;
    if (!lab || !preview || !preview.entity) return;
    drawBackground();
    var stage = lab.stage;
    D.vGradient(stage.x, stage.y, stage.w, stage.h,
      D.color('#4c265d', 0.92), D.color('#1a254f', 0.95), 18);
    D.roundRect(stage.x, stage.y, stage.w, stage.h, 20, D.color('#ffd9ee', 0.82));
    D.roundRect(stage.x + 3, stage.y + 3, stage.w - 6, stage.h - 6, 17,
      D.color('#291d4c', 0.92));
    var cx = stage.x + stage.w * 0.5;
    var shadowY = stage.y + stage.h * 0.78;
    var size = Math.min(stage.w * 0.74, stage.h * 0.76);
    D.ring(cx, shadowY, size * 0.33, 2, D.color('#c578ff', 0.48));
    drawGroundShadow(cx, shadowY, size * 0.35, 0.52);
    var rig = A.Rigs && A.Rigs.boss;
    if (preview.impactT >= 0) drawBossImpact(cx, shadowY, preview.impactT,
      Math.min(C.BOSS_IMPACT.drawSize, stage.w * 0.9));
    A.Render.setSceneLight('character', shadowY - size * 0.40, size);
    if (rig) A.Anim.draw(rig, preview.entity, cx, shadowY - size * 0.40, size);
    else icon('enemy-boss', cx, shadowY - size * 0.40, size);
    A.Render.setSceneLight('off');
  }

  function drawBase(dt) {
    var u = L.ui;
    var ratio = Math.max(0, S.baseHp) / C.BASE_HP;
    // 守卫物只展示状态；受击闪色限制在血条内部。
    var level = C.LEVELS[S.currentLevel - 1] || C.LEVELS[0];
    var photo = Assets.entry('battle-guardian-' + level.guardian);
    var fw = u.guardian.w, fh = u.guardian.h;
    var fx = u.guardian.x, fy = u.guardian.y;
    if (photo) {
      A.Render.setSceneLight('character', fy + fh / 2, fh);
      D.texture(photo.tex, photo.w, photo.h, 0, 0, photo.w, photo.h,
        fx, fy, fw, fh);
      A.Render.setSceneLight('off');
    }
    var bar = u.guardianBar, s = u.battleScale;
    var bx = bar.x, bw = bar.w, barY = bar.y;
    D.roundRect(bx, barY, bw, bar.h, bar.h / 2, D.color('#fff4df'));
    D.roundRect(bx + 3*s, barY + 3*s, bw - 6*s, bar.h - 6*s, 4*s, COL.hpBack);
    var hpCol = ratio > 0.5 ? COL.hpGreen : ratio > 0.25 ? COL.hpOrange : COL.hpRed;
    D.roundRect(bx + 3*s, barY + 3*s, Math.max(0, (bw - 6*s) * ratio), bar.h - 6*s, 4*s, hpCol);
    if (S.goalHitT > 0) {
      D.roundRect(bx + 3*s, barY + 3*s, bw - 6*s, bar.h - 6*s, 4*s,
        D.color('#ff5a6e', Math.min(0.85, S.goalHitT * 2.5)));
    }
    D.text(level.guardianName, u.guardianLabel.x, u.guardianLabel.y, 16, D.color('#ffffff'), 0);
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
    A.Render.setSceneLight('character', e.y - r * 0.15, r * 3.05 * (rig ? rig.scale || 1 : 1) * scale);
    if (rig) {
      A.Anim.draw(rig, e, e.x, e.y - r * 0.15, r * 3.05 * (rig.scale || 1) * scale, {
        alpha: 0.3 + 0.7 * spawn,
      });
    } else {
      icon(e.def.icon, e.x, e.y + wind, rr * 2.5, spawn);
    }
    A.Render.setSceneLight('off');
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
    return actorGround(actor, isEnemy).y;
  }

  // ── 待机双脚接触点：120px 格，排除尾巴和武器 ────────────
  var groundFeet = {
    arch: [[40, 99], [78, 99]], tank: [[40, 116], [87, 116]],
    war: [[34, 106], [80, 103]], mage: [[38, 107], [73, 110]],
    healer: [[48, 90], [76, 90]], small: [[39, 115], [81, 115]],
    normal: [[38, 115], [82, 115]], elite: [[33, 106], [85, 106]],
    boss: [[38, 109], [87, 109]],
  };

  function actorGround(actor, isEnemy) {
    var r = actor.def.radius;
    var duration = isEnemy ? 0.35 : 0.3;
    var spawn = actor.spawnT > 0 ? Math.max(0, 1 - actor.spawnT / duration) : 1;
    var rig = A.Rigs && A.Rigs[actor.rigId || actor.def.id];
    var scale = isEnemy ? 0.7 + 0.3 * spawn : 0.86 + 0.14 * spawn;
    var size = rig ? r * 3.05 * (rig.scale || 1) * scale : r * 2.35 * (0.8 + 0.2 * spawn);
    var feet = groundFeet[actor.def.id] || [[60, 106], [60, 106]];
    var point = [(feet[0][0] + feet[1][0]) / 240, (feet[0][1] + feet[1][1]) / 240];
    var back = A.HeroForms && A.Assets.entry && A.Assets.entry('hero-levels-back');
    if (actor.def.id === 'healer' && back && back.w === 1000 && back.h === 600) {
      point = [0.5 + 0.68 * (91.5 / 200 - 0.5), 0.6 + 0.68 * (161.5 / 200 - 0.5)];
    }
    var spriteY = rig ? actor.y - r * 0.15 : actor.y;
    return { x: actor.x + size * (point[0] - 0.5),
      y: spriteY + size * (point[1] - 0.5), size: size, spawn: spawn };
  }

  function drawActorShadows() {
    var groups = [S.units, S.enemies];
    for (var g = 0; g < groups.length; g++) {
      for (var i = 0; i < groups[g].length; i++) {
        var actor = groups[g][i];
        if (actor.dead) continue;
        var ground = actorGround(actor, g === 1);
        drawGroundShadow(ground.x, ground.y, ground.size * 0.40, ground.spawn);
      }
    }
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

  // 地面阴影独立绘制柔边椭圆，正常混合下使用深红棕色。
  // 两层同心，外围由着色器径向渐隐，不依赖光斑纹理。
  function drawGroundShadow(cx, cy, radius, alpha) {
    // 圆心保持在双脚中点；扩大外围，避免整个深色区被身体遮住。
    var layers = [[2.5, 1.5, 0.38], [1.4, 0.7, 0.46]];
    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];
      D.softEllipse(cx, cy, radius * layer[0], radius * layer[1],
        { r: 0.18, g: 0.055, b: 0.045, a: alpha * layer[2] });
    }
  }

  // GIF 已离线拆为透明 PNG 帧表。按固定节奏取格，飞行距离变化不会拉伸动画速度。
  function mageFlightVfx(p, rot, scale, alpha) {
    var spec = A.MageFlight;
    var tex = Assets.entry('mage-flight');
    if (!spec || !tex) return;
    var index = Math.floor((p.animT || 0) * 1000 / spec.frameMs) % spec.frames;
    var cell = spec.cell;
    var size = 76 * scale;
    D.sprite(tex.tex, tex.w, tex.h, (index % spec.cols) * cell,
      Math.floor(index / spec.cols) * cell, cell, cell, p.x, p.y, size, {
        rot: rot, w: size, h: size, tint: { r: 1, g: 1, b: 1, a: alpha },
      });
  }

  // 固定落地点锚定帧表；最后一格从出现起渐隐，避免残烟突然消失。
  function mageImpactVfx(e, t, scale, alpha) {
    var spec = A.MageImpact;
    var tex = Assets.entry('mage-impact');
    if (!spec || !tex) return;
    var timeline = spec.timeline || [];
    var index = 0;
    for (var step = 1; step < timeline.length; step++) if (t >= timeline[step]) index = step;
    var cell = spec.cell;
    var size = (spec.drawSize || 108) * scale;
    var anchor = spec.anchor || [cell * 0.5, cell * 0.5];
    var cy = e.y - (anchor[1] - cell * 0.5) * size / cell;
    var finalStart = timeline[timeline.length - 1] || 0;
    var finalDuration = Math.max(0.001, (spec.duration || e.max) - finalStart);
    var fade = index === timeline.length - 1 ? Math.max(0, 1 - (t - finalStart) / finalDuration) : 1;
    D.sprite(tex.tex, tex.w, tex.h, (index % spec.cols) * cell,
      Math.floor(index / spec.cols) * cell, cell, cell, e.x, cy, size, {
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
      ? { alpha: 0.92, scale: 0.6, layers: 2, particles: 18 }
      : { alpha: 0.88, scale: 1, layers: 2, particles: 4 };
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
    drawActorShadows();
    for (var i = 0; i < S.effects.length; i++) {
      var e = S.effects[i];
      if (e.type !== 'boss-ground-impact') continue;
      var ground = actorGround({ x: e.x, y: e.y, def: C.ENEMIES.boss, spawnT: 0 }, true);
      drawBossImpact(ground.x, ground.y, e.max - e.life, C.BOSS_IMPACT.drawSize);
    }
    drawHealEffects(false);
  }

  // ── 冰裂砸地：地面层正常混合，原图紫烟和食物保持原色 ────
  function drawBossImpact(cx, cy, time, width) {
    var spec = C.BOSS_IMPACT;
    var image = Assets.entry('boss-impact');
    if (!image || time < 0 || time >= spec.duration) return;
    var index = time < spec.timeline[1] ? 0 : time < spec.timeline[2] ? 1 : 2;
    var fade = index === 2 ? 1 - (time - spec.timeline[2]) / (spec.duration - spec.timeline[2]) : 1;
    var cell = spec.cell;
    D.texture(image.tex, image.w, image.h, index * cell, 0, cell, cell,
      cx - width / 2, cy - width / 2 + width * (spec.offsetYRatio || 0), width, width,
      { r: 1, g: 1, b: 1, a: fade });
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

    // ── 战斗角色统一走动作Rig；星级展示图不能覆盖治疗、受伤等动态状态 ──
    A.Render.setSceneLight('character', spriteY, size);
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

      var poseSize = r * 3.4 * (0.8 + 0.2 * spawn);
      if (d.cls === 'healer') drawHealerPlaceholder(un.x, un.y, size, alpha);
      else if (!battlePose(un, un.x, un.y - r * 0.12, poseSize, alpha)) {
        heroArt(d, un.x, un.y - r * 0.12, poseSize, alpha, 'battle', un.facing);
      }

      if (un.hitFlash > 0) D.circle(un.x, un.y, r, D.color('#ffffff', un.hitFlash * 3));
    }

    A.Render.setSceneLight('off');
    if (!un.dead) drawUnitStatus(un, spriteY, size);
  }

  function drawUnitStatus(un, spriteY, size) {
    var ratio = Math.max(0, Math.min(1, un.hp / un.maxHp));
    var col = ratio > 0.5 ? COL.hpGreen : ratio > 0.25 ? COL.hpOrange : COL.hpRed;
    var w = 6, h = size * 0.46;
    var x = un.x + size * 0.40 + 3, y = spriteY - h / 2;
    D.roundRect(x, y, w, h, w / 2, D.color('#fff4df'));
    D.roundRect(x + 1, y + 1, w - 2, h - 2, 2, COL.hpBack);
    var fill = (h - 2) * ratio;
    if (fill > 0) D.roundRect(x + 1, y + h - 1 - fill, w - 2, fill, 2, col);
    var count = un.star || 1, starSize = 8, gap = 3;
    var left = un.x - (count * starSize + (count - 1) * gap) / 2;
    if (count === 1) return;
    for (var i = 0; i < count; i++) {
      D.star(left + i * (starSize + gap), spriteY - size * 0.46 - 12,
        starSize, D.color('#fff8ce'));
    }
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
      if (e.type === 'boss-ground-impact') continue; // 已在角色下方绘制。
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
        continue; // 治疗光环与十字由各自层级统一绘制。
      } else if (e.type === 'mage-biscuit-impact') {
        var impactConfig = vfxTune('mage');
        mageImpactVfx(e, t, impactConfig.scale, impactConfig.alpha);
      } else if (e.type === 'smoke') {
        var smokeIndex = smokeFrame(t);
        var sp = Assets.sprite(smokeFrames[smokeIndex]);
        if (sp) {
          var size = (e.r || 10) * 4.2 * smokeScales[smokeIndex];
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
      if (f.kind !== 'kill-reward') continue;
      var a = Math.min(1, f.life / f.max * 2);
      var icon = Assets.entry('battle-paw-token');
      var textWidth = D.textWidth(f.text, 18);
      var iconH = 18;
      var iconW = icon && icon.tex ? iconH * icon.w / icon.h : 0;
      var left = f.x - (iconW + textWidth) / 2;
      var cy = f.y - 10;
      if (iconW) D.texture(icon.tex, icon.w, icon.h, 0, 0, icon.w, icon.h,
        left, cy - iconH / 2, iconW, iconH, D.color('#ffffff', a));
      D.centeredText(f.text, left + iconW + textWidth / 2, cy, 18, D.color(f.color, a));
    }
  }

  function drawSpawnHint() {
    var u = L.ui;
    if (S.phase !== 'playing') return;
    if (S.waveState === 'prep') {
      var t = Math.max(0, S.waveTimer);
      var label = S.waveIndex < S.getWaves().length
        ? '第 ' + (S.waveIndex + 1) + ' 波准备 ' + Math.ceil(t)
        : '';
      if (label) {
        D.roundRect(u.field.x + u.field.w / 2 - 80, u.field.y + 10, 160, 32, 16,
          D.color('#000000', 0.25));
        D.centeredText(label, u.field.x + u.field.w / 2, u.field.y + 26, 18,
          D.color('#ffffff'));
      }
    }
  }

  function drawFieldGuides() {
    if (S.phase !== 'playing') return;
    var u = L.ui;
    var field = u.field;
    var drag = S.dragging || (A.Input && A.Input.getDrag && A.Input.getDrag());
    if (!drag || !drag.active || !drag.def || drag.y >= u.tray.y) return;
    var top = Math.max(field.y - 24, u.interactiveRect.y);
    var bottom = Math.min(u.base.y + 10, u.tray.y - 4,
      u.interactiveRect.y + u.interactiveRect.h);
    var h = bottom - top;
    if (h <= 0) return;
    // 部署是连续坐标，不绘制虚假的格子。
    D.roundRect(field.x, top, field.w, h, 8, D.color('#73e5a0', 0.13));
    D.strokeRect(field.x, top, field.w, h, 2, D.color('#eaffbd', 0.8));
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
      D.text('+' + A.Battle.sellPrice(unit) + ' 饼干', drag.x, drag.y + def.radius + 12,
        18, COL.gold, 1);
      return;
    }
    var overField = drag.y < u.tray.y;
    var x = drag.x, y = drag.y;
    // 卡池内的浮起卡由 Hud 复用商店卡片绘制；这里只负责战场落点预览。
    if (!overField) return;
    var reason = A.Battle.deployBlockReason(def, x, y);
    var ok = !reason && y < u.tray.y - 4;
    var col = ok ? '#6ff0a8' : '#ff6b7f';
    var point = ok && A.Battle.findDeployPoint(def, x, y);
    if (point) { x = point.x; y = point.y; }

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
    // 落点预览复用正式角色待机美术，避免再次露出旧图集的职业符号。
    var rig = A.Rigs && A.Rigs[def.id];
    var previewSize = rig ? def.radius * 3.05 * (rig.scale || 1) : def.radius * 2.35;
    var spriteY = rig ? y - def.radius * 0.15 : y;
    var shadowY = spriteY + previewSize * 0.42;
    var previewAlpha = ok ? 0.88 : 0.56;
    drawGroundShadow(x, shadowY, def.radius * 0.70, ok ? 0.32 : 0.20);
    D.roundRect(x - 18, shadowY + 3, 36, 4, 2, D.color(col, 0.88));
    if (rig && Assets.tex('game')) {
      A.Anim.draw(rig, { anim: 'idle', animT: S.time, hitFlash: 0 },
        x, spriteY, previewSize, { alpha: previewAlpha });
    } else if (def.cls === 'healer') {
      if (!A.HeroForms || !A.HeroForms.drawBattleIdle(def.id, 2,
        x, spriteY + previewSize * 0.10, previewSize * 0.68, previewAlpha)) {
        drawHealerPlaceholder(x, spriteY, previewSize, previewAlpha);
      }
    } else {
      var still = { def: def, anim: 'idle', facing: 1 };
      if (!battlePose(still, x, spriteY, previewSize, previewAlpha)) {
        heroArt(def, x, spriteY, previewSize, previewAlpha);
      }
    }

    if (!ok) {
      D.text(reason === 'cap' ? '席位已满' : reason === 'gold' ? '饼干不足' :
        reason === 'occupied' ? '附近位置已占用' : '请拖到战场', x, y + def.radius + 12, 18,
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
    drawBossLab: drawBossLab,
    drawBase: drawBase,
    drawEnemy: drawEnemy,
    drawUnit: drawUnit,
    actorDepthY: actorDepthY,
    drawProjectiles: drawProjectiles,
    drawEffects: drawEffects,
    drawGroundEffects: drawGroundEffects,
    drawFloats: drawFloats,
    drawSpawnHint: drawSpawnHint,
    drawFieldGuides: drawFieldGuides,
    drawDragGhost: drawDragGhost,
  };
})();
