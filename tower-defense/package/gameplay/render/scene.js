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
    // 首页渲染图（主包 res/home-asset，首帧即可用）铺满全屏，避免首帧纯色
    var bg = Assets.entry('home-bg');
    if (bg) {
      D.texture(bg.tex, bg.w, bg.h, 0, 0, bg.w, bg.h, 0, 0, u.w, u.h);
    } else {
      D.vGradient(0, 0, u.w, u.h, COL.bgTop, COL.bgBottom, 26);
    }
    // 战场边框
    var f = u.field;
    D.roundRect(f.x, f.y, f.w, f.h, 16, D.color('#0d1526', 1));
    for (var i = 1; i < u.lanes.length; i++) {
      var x = (u.lanes[i - 1] + u.lanes[i]) / 2;
      D.rect(x - 0.5, f.y + 8, 1, f.h - 16, COL.laneLine);
    }
    D.strokeRect(f.x, f.y, f.w, f.h, 1, COL.fieldLine);
    // 顶部生成区指示
    D.hGradient(f.x + 1, f.y + 1, f.w - 2, 34, D.color('#2a1140', 0.6), D.color('#0d1526', 0), 8);
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
    // 影子
    D.circle(e.x, e.y + rr * 0.85, rr * 0.8, D.color('#000000', 0.28));
    if (e.slowT > 0) {
      D.circle(e.x, e.y, rr + 7, D.color('#5ab6e8', 0.18));
      D.ring(e.x, e.y, rr + 5, 1.4, D.color('#8fe0ff', 0.55));
    }
    icon(e.def.icon, e.x, e.y + wind, rr * 2.5, spawn);
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
    if (rig) {
      // 分件动画：底盘保留队伍色，方便在密集阵型里分出单位类型
      D.circle(un.x, un.y, r + 3, D.color(d.color, 0.20));
      D.ring(un.x, un.y, r + 2, 1.3, D.color(d.color, 0.6));
      if (un.def.id === 'tank-a') {
        // 呼吸光晕：待机时贴地一圈淡蓝，攻击时更亮
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
      icon(d.icon, un.x, un.y, r * 2.35 * (0.8 + 0.2 * spawn), alpha);
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
      if (p.kind === 'arrow') {
        var dx = p.tx - p.x, dy = p.ty - p.y;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var nx = dx / len, ny = dy / len;
        D.circle(p.x, p.y, 2.6, D.color('#eaffd8'));
        D.rect(p.x - nx * 6 - 1, p.y - ny * 6 - 1, 3, 3, D.color('#c8ffb0', 0.7));
      } else if (p.kind === 'fire') {
        D.circle(p.x, p.y, 6, D.color(p.color, 0.55));
        D.circle(p.x, p.y, 3.4, D.color('#ffd9a0'));
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
      } else if (e.type === 'smoke') {
        var sp = Assets.sprite('fx-smoke');
        if (sp) {
          var sc = (e.r || 10) * (1 + t * 1.1);
          D.sprite(sp.tex, sp.texW, sp.texH, sp.x, sp.y, sp.w, sp.h,
            e.x, e.y, sc * 2, { alpha: (1 - t) * 0.26, tint: D.color(e.color, 1) });
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
    if (drag.swiped) {
      // 滑动丢弃：卡片跟随手指并变红，松手即丢
      icon(drag.def.icon, drag.x, drag.y, 72, 0.85);
      D.roundRect(drag.x - 40, drag.y - 46, 80, 92, 12, D.color('#ff4d6a', 0.22));
      D.ring(drag.x, drag.y, 42, 2, D.color('#ff6b7f', 0.8));
      return;
    }
    var u = L.ui;
    var def = drag.def;
    if (!def) return;
    var overField = drag.y < u.tray.y;
    var x = drag.x, y = drag.y;
    // 放置范围圆
    if (overField) {
      var ok = A.Battle.canAfford(def) && y > u.field.y - 30 && y < u.base.y;
      var col = ok ? '#6ff0a8' : '#ff6b7f';
      D.circle(x, y, def.range, D.color(col, 0.10));
      D.ring(x, y, def.range, 1.4, D.color(col, 0.5));
      D.circle(x, y, def.radius + 4, D.color(col, 0.22));
      D.ring(x, y, def.radius + 3, 1.6, D.color(col, 0.85));
      icon(def.icon, x, y, def.radius * 2.2, 0.9);
    } else {
      icon(def.icon, x, y - 46, 60, 0.95);
    }
  }

  A.Scene = {
    COL: COL,
    icon: icon,
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
    drawDragGhost: drawDragGhost,
  };
})();
