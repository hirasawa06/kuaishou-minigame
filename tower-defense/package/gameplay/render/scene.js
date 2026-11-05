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

  function heroArt(def, cx, cy, size, alpha) {
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
    var atlas = Assets.entry('enemy-furniture-atlas');
    var cell = null;
    if (e.def.id === 'small') cell = [0, 0];
    else if (e.def.id === 'normal') cell = [1, 0];
    else if (e.def.id === 'elite') cell = [0, 1];
    else if (e.def.id === 'boss') cell = [1, 1];
    if (!atlas || !cell) D.circle(e.x, e.y + rr * 0.85, rr * 0.8, D.color('#000000', 0.28));
    if (e.slowT > 0) {
      D.circle(e.x, e.y, rr + 7, D.color('#5ab6e8', 0.18));
      D.ring(e.x, e.y, rr + 5, 1.4, D.color('#8fe0ff', 0.55));
    }
    if (atlas && cell) {
      var cw = atlas.w / 2, ch = atlas.h / 2;
      // 图集每格保留透明边距；只放大美术，不改变单位半径与碰撞规则。
      var size = rr * (e.def.id === 'small' ? 5.0 : e.def.id === 'normal' ? 4.6 : 4.2);
      D.texture(atlas.tex, atlas.w, atlas.h, cell[0] * cw, cell[1] * ch, cw, ch,
        e.x - size / 2, e.y + wind - size / 2, size, size,
        { r: 1, g: 1, b: 1, a: spawn });
    } else {
      icon(e.def.icon, e.x, e.y + wind, rr * 2.5, spawn);
    }
    if (e.hitFlash > 0) {
      D.circle(e.x, e.y, rr, D.color('#ffffff', e.hitFlash * 3.2));
    }
    var w = Math.max(24, rr * 2.1);
    var ratio = Math.max(0, e.hp / e.maxHp);
    hpBar(e.x - w / 2, e.y - rr - 12, w, ratio,
      e.def.id === 'boss' ? D.color('#ff6b9d') : COL.hpRed);
    if (e.def.id === 'boss') {
      D.ring(e.x, e.y, rr + 6 + Math.sin(S.time * 3) * 2, 1.6, D.color('#ffd166', 0.6));
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

  function drawUnit(un) {
    var d = un.def;
    var r = d.radius;
    var spawn = un.spawnT > 0 ? 1 - un.spawnT / 0.3 : 1;
    var rig = A.Rigs && A.Rigs[d.id];
    D.circle(un.x, un.y + r * 0.9, r * 0.85, D.color('#000000', 0.16));

    // 盾位：嘲讽范围常驻淡蓝光晕，脉动一下表示嘲讽在生效
    if (d.cls === 'tank' && d.taunt) {
      var pulse = un.tauntPulse > 0 ? un.tauntPulse / 0.45 : 0;
      A.Render.setAdditive(true);
      additiveGlow(un.x, un.y, d.taunt * 1.9, '#4f7fd0', 0.10 + pulse * 0.16, 0);
      A.Render.setAdditive(false);
      D.ring(un.x, un.y, d.taunt * (0.55 + 0.45 * (1 - pulse)), 2.2,
        D.color('#8fc0ff', 0.22 + pulse * 0.5));
    }

    if (rig) {
      D.circle(un.x, un.y, r + 3, D.color(d.color, 0.20));
      D.ring(un.x, un.y, r + 2, 1.3, D.color(d.color, 0.6));
      if (d.id === 'tank') {
        var a = un.anim === 'atk' ? 0.5 : 0.22;
        A.Render.setAdditive(true);
        additiveGlow(un.x, un.y + r * 0.2, r * 3.2, '#7fb2ff', a, 0);
        A.Render.setAdditive(false);
      }
      var size = r * 3.05 * (0.86 + 0.14 * spawn);
      A.Anim.draw(rig, un, un.x, un.y - r * 0.15, size, {
        alpha: 0.3 + 0.7 * spawn,
      });
      if (un.hitFlash > 0) {
        A.Render.setAdditive(true);
        additiveGlow(un.x, un.y, r * 2.4, '#ffffff', un.hitFlash * 2.2, 0);
        A.Render.setAdditive(false);
      }
    } else {
      D.circle(un.x, un.y, r + 3, D.color(d.color, 0.18));
      D.ring(un.x, un.y, r + 2, 1.2, D.color(d.color, 0.55));
      var alpha = 0.25 + 0.75 * spawn;
      heroArt(d, un.x, un.y - r * 0.12, r * 3.4 * (0.8 + 0.2 * spawn), alpha);
      if (un.hitFlash > 0) D.circle(un.x, un.y, r, D.color('#ffffff', un.hitFlash * 3));
    }

    // 战士出击时脚下留一条回到驻点的虚线，便于读出动线
    if (d.cls === 'warrior' && d.moveSpeed > 0) {
      var dx = un.x - un.homeX, dy = un.y - un.homeY;
      if (dx * dx + dy * dy > 900) {
        D.ring(un.homeX, un.homeY, 8, 1.2, D.color(d.color, 0.35));
        D.rect(un.homeX - 1, un.homeY - 1, 2, 2, D.color(d.color, 0.45));
      }
    }

    var w = Math.max(22, r * 2.1);
    var ratio = Math.max(0, un.hp / un.maxHp);
    var col = ratio > 0.5 ? COL.hpGreen : ratio > 0.25 ? COL.hpOrange : COL.hpRed;
    hpBar(un.x - w / 2, un.y - r - 10, w, ratio, col);
  }

  function drawProjectiles() {
    for (var i = 0; i < S.projectiles.length; i++) {
      var p = S.projectiles[i];
      if (p.kind === 'arrow') {
        var dx = p.tx - p.x, dy = p.ty - p.y;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var nx = dx / len, ny = dy / len;
        if (!fxArt(0, 0, p.x, p.y, 28, 20, 1, Math.atan2(ny, nx))) {
          D.circle(p.x, p.y, 2.6, D.color('#eaffd8'));
          D.rect(p.x - nx * 6 - 1, p.y - ny * 6 - 1, 3, 3, D.color('#c8ffb0', 0.7));
        }
      } else if (p.kind === 'fire') {
        if (!fxArt(1, 0, p.x, p.y, 24, 24, 1, 0)) {
          D.circle(p.x, p.y, 6, D.color(p.color, 0.55));
          D.circle(p.x, p.y, 3.4, D.color('#ffd9a0'));
        }
      } else {
        D.circle(p.x, p.y, 5.6, D.color(p.color, 0.6));
        D.circle(p.x, p.y, 3, D.color('#e6fbff'));
      }
    }
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
      } else if (e.type === 'smoke') {
        var sc = (e.r || 10) * (1 + t * 1.1);
        if (!fxArt(1, 1, e.x, e.y, sc * 2, sc * 2, (1 - t) * 0.42, 0)) {
          var sp = Assets.sprite('fx-smoke');
          if (sp) {
          D.sprite(sp.tex, sp.texW, sp.texH, sp.x, sp.y, sp.w, sp.h,
            e.x, e.y, sc * 2, { alpha: (1 - t) * 0.26, tint: D.color(e.color, 1) });
          }
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
    var def = drag.def;
    if (!def) return;
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
    heroArt(def, x, y, def.radius * 3.4, 0.94);
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
    drawProjectiles: drawProjectiles,
    drawEffects: drawEffects,
    drawFloats: drawFloats,
    drawSpawnHint: drawSpawnHint,
    drawFieldGuides: drawFieldGuides,
    drawDragGhost: drawDragGhost,
  };
})();
