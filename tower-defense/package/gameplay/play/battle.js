/* gameplay/play/battle.js — 核心玩法：能量、卡槽、单位、敌人、投射物、波次 */
(function () {
  var A = window.AIGCUtils;
  var C = A.Config;
  var S = A.State;
  var L = A.Layout;

  var REFILL_DELAY = 0.45;

  // ── 波次 ───────────────────────────────────────────────────
  function buildWave(index) {
    var wave = C.WAVES[index];
    var queue = [];
    var hpScale = Math.pow(C.waveHpScale, index);
    var atkScale = Math.pow(C.waveAtkScale, index);
    for (var gi = 0; gi < wave.groups.length; gi++) {
      var g = wave.groups[gi];
      for (var n = 0; n < g[1]; n++) {
        // 同一组内轻微错开 hp，避免完全一致
        var jitter = 0.94 + Math.random() * 0.12;
        queue.push({ id: g[0], hp: hpScale * jitter, atk: atkScale });
      }
    }
    S.spawnQueue = interleave(queue);
    S.spawnTimer = 0;
    S.waveState = 'spawning';
    S.toastMsg('第 ' + (index + 1) + ' 波来袭', 1.6);
    A.GameAudio && A.GameAudio.play('wave');
  }

  // 组内保序、组间轮转，避免同种怪堆在一起
  function interleave(queue) {
    var buckets = [];
    var last = null;
    for (var i = 0; i < queue.length; i++) {
      if (!last || last.id !== queue[i].id) {
        buckets.push([]);
        last = queue[i];
      }
      buckets[buckets.length - 1].push(queue[i]);
    }
    var out = [];
    var maxLen = 0;
    for (var b = 0; b < buckets.length; b++) maxLen = Math.max(maxLen, buckets[b].length);
    for (var k = 0; k < maxLen; k++) {
      for (var b2 = 0; b2 < buckets.length; b2++) {
        if (k < buckets[b2].length) out.push(buckets[b2][k]);
      }
    }
    return out;
  }

  function spawnEnemy(spec) {
    var def = C.ENEMIES[spec.id];
    var u = L.ui;
    var lane = S.randInt(u.lanes.length);
    var laneSpread = u.field.w * 0.62 / 3;
    var laneX = u.lanes[lane] + (Math.random() - 0.5) * laneSpread;
    var e = {
      uid: S.uid++,
      def: def,
      x: S.clamp(laneX, u.field.x + 26, u.field.x + u.field.w - 26),
      y: u.spawnY - S.rand(24),
      lane: lane,
      hp: Math.round(def.hp * spec.hp),
      maxHp: Math.round(def.hp * spec.hp),
      atk: def.atk * spec.atk,
      speed: def.speed,
      slowT: 0,
      slowFactor: 1,
      atkTimer: 0.3,
      hitFlash: 0,
      spawnT: 0.35,
      dead: false,
      anim: 'idle',
      animT: 0,
      pendingHit: -1,
      pendingTarget: 0,
    };
    S.enemies.push(e);
  }

  // ── 单位 ───────────────────────────────────────────────────
  function placeUnit(card, x, y) {
    var u = L.ui;
    x = S.clamp(x, u.field.x + card.radius + 4, u.field.x + u.field.w - card.radius - 4);
    y = S.clamp(y, u.placeTop, u.placeBottom);
    // 与已有单位保持最小间距；同点重叠时随机给一个方向，避免来回推成 NaN
    var minGap = C.UNIT_MIN_GAP;
    for (var pi = 0; pi < S.units.length; pi++) {
      var other = S.units[pi];
      if (other.dead) continue;
      var d = Math.sqrt(S.dist2(x, y, other.x, other.y));
      if (d >= minGap) continue;
      var nx = x - other.x, ny = y - other.y;
      var len = Math.sqrt(nx * nx + ny * ny);
      if (len < 0.001) {
        var ang = Math.random() * Math.PI * 2;
        nx = Math.cos(ang);
        ny = Math.sin(ang);
        len = 1;
      }
      x = S.clamp(other.x + nx / len * minGap,
        u.field.x + card.radius + 4, u.field.x + u.field.w - card.radius - 4);
      y = S.clamp(other.y + ny / len * minGap, u.placeTop, u.placeBottom);
    }
    var unit = {
      uid: S.uid++,
      def: card,
      x: x,
      y: y,
      hp: card.hp,
      maxHp: card.hp,
      atkTimer: 0.3,
      hitFlash: 0,
      slowT: 0,
      spawnT: 0.3,
      dead: false,
      anim: 'idle',
      animT: 0,
      pendingHit: -1,     // 攻击动作到达出手帧的剩余时间；<0 表示无待结算
      pendingTarget: 0,
    };
    S.units.push(unit);
    return unit;
  }

  function canAfford(card) { return S.energy >= card.cost; }

  function tryDeploy(card, x, y) {
    var u = L.ui;
    if (x < u.field.x || x > u.field.x + u.field.w) return false;
    if (y < u.field.y - 24 || y > u.base.y + 10) return false;
    if (!canAfford(card)) {
      S.toastMsg('能量不足', 0.9);
      return false;
    }
    // 死亡动画中的单位不算占位，否则尸体卡住上场名额
    var liveCount = 0;
    for (var ci = 0; ci < S.units.length; ci++) if (!S.units[ci].dead) liveCount++;
    if (liveCount >= C.UNIT_CAP) {
      S.toastMsg('上场单位已满', 1.0);
      return false;
    }
    S.energy -= card.cost;
    S.cardsPlaced++;
    placeUnit(card, x, y);
    S.addEffect({ type: 'ring', x: x, y: y, r: card.radius + 4, r2: card.radius + 26, life: 0.36, max: 0.36, color: card.color });
    S.addFloat(x, y - card.radius - 14, '-' + card.cost, '#7fe3ff');
    return true;
  }

  // ── 伤害 ───────────────────────────────────────────────────
  function damageEnemy(e, dmg, isSplash) {
    if (e.dead) return;
    e.hp -= dmg;
    e.hitFlash = 0.12;
    if (!isSplash) {
      S.addFloat(e.x + (Math.random() - 0.5) * 10, e.y - e.def.radius - 8,
        String(Math.round(dmg)), '#ffe9a8');
    }
    if (e.hp <= 0) {
      e.dead = true;
      S.kills++;
      S.energy = Math.min(C.ENERGY_MAX, S.energy + C.KILL_ENERGY);
      S.addEffect({ type: 'pop', x: e.x, y: e.y, r: e.def.radius, life: 0.42, max: 0.42, color: e.def.color });
      if (e.def.id === 'boss') onBossDeath(e);
    }
  }

  function onBossDeath(e) {
    S.shake = 0.5;
    S.addEffect({ type: 'ring', x: e.x, y: e.y, r: 24, r2: 132, life: 0.9, max: 0.9, color: '#ffd166' });
    for (var i = 0; i < 16; i++) {
      var a = Math.PI * 2 * i / 16;
      S.addEffect({
        type: 'spark', x: e.x, y: e.y,
        vx: Math.cos(a) * (120 + Math.random() * 140),
        vy: Math.sin(a) * (120 + Math.random() * 140),
        life: 0.6 + Math.random() * 0.4, max: 1,
        color: i % 2 ? '#ffd166' : '#ff7aa2',
      });
    }
    A.GameAudio && A.GameAudio.play('boss');
  }

  function damageUnit(u, dmg) {
    if (u.dead) return;
    u.hp -= dmg;
    u.hitFlash = 0.14;
    if (u.anim !== 'die' && u.anim !== 'atk') {
      u.anim = 'hurt';
      u.animT = 0;
    }
    if (u.hp <= 0) {
      u.dead = true;
      u.anim = 'die';
      u.animT = 0;
      u.dieT = 0.4;
      S.addEffect({ type: 'smoke', x: u.x, y: u.y, r: u.def.radius, life: 0.55, max: 0.55, color: '#b9c2d8' });
      S.addEffect({ type: 'pop', x: u.x, y: u.y, r: u.def.radius, life: 0.4, max: 0.4, color: '#8e97b8' });
    }
  }

  // ── 投射物 ─────────────────────────────────────────────────
  function fireProjectile(unit, target) {
    var def = unit.def;
    S.projectiles.push({
      x: unit.x, y: unit.y - 6,
      tx: target.x, ty: target.y,
      targetUid: target.uid,
      speed: def.cls === 'archer' ? 640 : 400,
      kind: def.cls === 'archer' ? 'arrow' : (def.id === 'mage-b' ? 'ice' : 'fire'),
      dmg: def.atk,
      splash: def.splash || 0,
      slow: def.slow || null,
      color: def.color,
      life: 1.6,
    });
  }

  function applySplash(p, cx, cy) {
    var r2 = p.splash * p.splash;
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.dead) continue;
      if (S.dist2(e.x, e.y, cx, cy) > r2) continue;
      if (p.slow) {
        e.slowT = Math.max(e.slowT, p.slow.duration);
        e.slowFactor = Math.min(e.slowFactor, p.slow.factor);
      }
      damageEnemy(e, p.dmg * 0.6, true);
    }
    S.addEffect({
      type: 'ring', x: cx, y: cy, r: p.splash * 0.35, r2: p.splash,
      life: 0.34, max: 0.34, color: p.color,
    });
  }

  // ── 卡牌传送带 ─────────────────────────────────────────────
  // 每张卡有 x（当前屏幕位置）与 target（目标位置）：
  //   · target 持续以固定速度左移 → 整条带稳定滚动
  //   · 用掉/丢弃一张卡后，它右侧的卡 target 左移一格 → 立即补位，不留空洞
  //   · 拖动卡牌时整条带暂停，松手继续
  function updateSlots(dt) {
    var u = L.ui;
    var step = u.cardW + u.cardGap;
    var speed = C.CARD_SCROLL_SPEED;
    var dragging = S.dragging && S.dragging.active;

    if (!dragging) {
      for (var i = 0; i < S.slots.length; i++) {
        if (S.slots[i] === (S.dragging && S.dragging.slot)) continue;
        S.slots[i].target -= speed * dt;
      }

      // 右侧补牌：保证整条带始终铺满可视宽度
      var guard = 0;
      while (guard++ < 8) {
        var last = S.slots[S.slots.length - 1];
        var nextTarget = last ? last.target + step : 0;
        if (nextTarget + u.cardW < u.cards.w + step * 0.35) {
          S.slots.push({
            uid: ++S.slotSeq,
            cardId: S.drawCardId(),
            x: nextTarget + step * 0.5,
            target: nextTarget,
          });
        } else break;
      }
    }

    // 平滑靠拢 target，并淘汰彻底滑出左侧的卡
    var keep = [];
    for (var k = 0; k < S.slots.length; k++) {
      var slot = S.slots[k];
      var k2 = 1 - Math.pow(0.0002, dt);
      slot.x += (slot.target - slot.x) * k2;
      if (Math.abs(slot.target - slot.x) < 0.2) slot.x = slot.target;
      var isHeld = S.dragging && S.dragging.slot === slot;
      if (slot.x + u.cardW < -10 && !isHeld) continue;
      keep.push(slot);
    }
    S.slots = keep;
  }

  // 用掉/丢弃一张卡：移除它，并把右侧的牌整体左移一格补位
  function removeSlot(slot) {
    var u = L.ui;
    var step = u.cardW + u.cardGap;
    var idx = -1;
    for (var i = 0; i < S.slots.length; i++) {
      if (S.slots[i] === slot) { idx = i; break; }
    }
    if (idx < 0) return;
    S.slots.splice(idx, 1);
    for (var j = idx; j < S.slots.length; j++) {
      S.slots[j].target -= step;
    }
  }

  // ── 帧更新 ─────────────────────────────────────────────────
  function update(dt) {
    if (S.phase === 'paused') {
      updateEffects(dt);
      return;
    }
    if (S.phase !== 'playing') {
      updateEffects(dt);
      return;
    }
    S.time += dt;
    S.energy = Math.min(C.ENERGY_MAX, S.energy + C.ENERGY_REGEN * dt);
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt);
    if (S.hitstop > 0) S.hitstop = Math.max(0, S.hitstop - dt);
    // 命中停顿：只压缩战斗推进，不影响特效衰减，否则闪点会一起卡住
    var battleDt = S.hitstop > 0 ? dt * 0.18 : dt;
    if (S.toast) {
      S.toast.life -= dt;
      if (S.toast.life <= 0) S.toast = null;
    }

    updateSlots(dt);
    updateWaves(dt);
    updateUnits(battleDt);
    updateEnemies(battleDt);
    updateProjectiles(battleDt);
    updateEffects(dt);

    if (S.baseHp <= 0 && S.phase === 'playing') {
      S.baseHp = 0;
      S.phase = 'lose';
      S.shake = 0.6;
      A.GameAudio && A.GameAudio.play('lose');
    }
  }

  function updateWaves(dt) {
    if (S.waveState === 'prep') {
      S.waveTimer -= dt;
      if (S.waveTimer <= 0) buildWave(S.waveIndex);
      return;
    }
    if (S.waveState === 'spawning') {
      S.spawnTimer -= dt;
      if (S.spawnTimer <= 0 && S.spawnQueue.length > 0) {
        spawnEnemy(S.spawnQueue.shift());
        S.spawnTimer = C.spawnGap;
      }
      if (S.spawnQueue.length === 0) S.waveState = 'fighting';
      return;
    }
    if (S.waveState === 'fighting' && S.enemies.length === 0) {
      S.waveIndex++;
      if (S.waveIndex >= C.WAVES.length) {
        S.phase = 'win';
        A.GameAudio && A.GameAudio.play('win');
        return;
      }
      S.waveState = 'prep';
      S.waveTimer = C.waveGap;
      S.energy = Math.min(C.ENERGY_MAX, S.energy + 1.5);
      S.toastMsg('波次清除  +1.5 能量', 1.5);
    }
  }

  function updateUnits(dt) {
    var alive = [];
    for (var i = 0; i < S.units.length; i++) {
      var un = S.units[i];

      // 死亡动画播完再移除，避免单位凭空消失
      if (un.dead) {
        un.animT += dt;
        un.dieT -= dt;
        if (un.dieT > 0) alive.push(un);
        continue;
      }
      if (un.spawnT > 0) un.spawnT -= dt;
      if (un.hitFlash > 0) un.hitFlash -= dt;

      var def = un.def;
      un.animT += dt;
      if ((un.anim === 'hurt' || un.anim === 'atk') && un.animT > 0.6) {
        un.anim = 'idle';
        un.animT = 0;
      }

      // 攻击动作到达出手帧，才真正结算伤害（前摇/出手/后摇）
      if (un.pendingHit >= 0) {
        un.pendingHit -= dt;
        if (un.pendingHit < 0) {
          var tgt = null;
          for (var ti = 0; ti < S.enemies.length; ti++) {
            if (S.enemies[ti].uid === un.pendingTarget && !S.enemies[ti].dead) {
              tgt = S.enemies[ti];
              break;
            }
          }
          if (!tgt) tgt = findTarget(un);
          if (tgt) {
            var reach = def.range + tgt.def.radius;
            if (S.dist2(un.x, un.y, tgt.x, tgt.y) <= reach * reach) {
              resolveAttack(un, tgt);
            }
          }
        }
      }

      un.atkTimer -= dt;
      if (un.atkTimer <= 0) {
        var best = findTarget(un);
        if (best) {
          un.atkTimer = def.interval;
          un.anim = 'atk';
          un.animT = 0;
          // 出手帧：柴犬的盾击中点在 0.17s，其余单位手感偏快
          un.pendingHit = def.id === 'tank-a' ? 0.17 : 0.07;
          un.pendingTarget = best.uid;
        }
      }
      alive.push(un);
    }
    if (alive.length !== S.units.length) S.units = alive;
  }

  function findTarget(un) {
    var def = un.def;
    var best = null;
    var bestY = -Infinity;
    var bestD = Infinity;
    for (var j = 0; j < S.enemies.length; j++) {
      var e = S.enemies[j];
      if (e.dead) continue;
      var d2 = S.dist2(un.x, un.y, e.x, e.y);
      var reach = def.range + e.def.radius;
      if (d2 > reach * reach) continue;
      if (e.y > bestY || (e.y === bestY && d2 < bestD)) {
        bestY = e.y;
        bestD = d2;
        best = e;
      }
    }
    return best;
  }

  function resolveAttack(un, best) {
    var def = un.def;
    if (def.cls === 'tank' || def.cls === 'warrior') {
      damageEnemy(best, def.atk, false);
      var mx = (un.x + best.x) / 2, my = (un.y + best.y) / 2;
      S.addEffect({
        type: 'slash', x: un.x, y: un.y, tx: best.x, ty: best.y,
        life: 0.18, max: 0.18, color: def.color,
      });
      // 命中闪点：贴在受击点，加法混合下会明显发亮
      S.addEffect({
        type: 'glow', x: mx, y: my, r: 7, life: 0.15, max: 0.15,
        color: def.id === 'tank-a' ? '#ffe3b8' : def.color,
      });
      if (def.cls === 'tank') {
        for (var k = 0; k < S.enemies.length; k++) {
          var e2 = S.enemies[k];
          if (e2 === best || e2.dead) continue;
          var reach2 = def.range + e2.def.radius;
          if (S.dist2(un.x, un.y, e2.x, e2.y) <= reach2 * reach2) {
            damageEnemy(e2, def.atk * 0.32, true);
          }
        }
      }
      S.hitstop = Math.max(S.hitstop, def.cls === 'tank' ? 0.055 : 0.04);
    } else {
      fireProjectile(un, best);
      S.addEffect({
        type: 'glow', x: un.x, y: un.y - 6, r: def.cls === 'archer' ? 5 : 8,
        life: 0.12, max: 0.12, color: def.color,
      });
    }
    A.GameAudio && A.GameAudio.play(def.cls === 'archer' ? 'arrow' : def.cls === 'mage' ? 'magic' : 'hit');
  }

  function updateEnemies(dt) {
    var u = L.ui;
    var alive = [];
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.dead) continue;
      if (e.spawnT > 0) e.spawnT -= dt;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      e.animT += dt;
      if (e.anim === 'atk' && e.animT > 0.5) { e.anim = 'idle'; e.animT = 0; }
      if (e.slowT > 0) {
        e.slowT -= dt;
        if (e.slowT <= 0) e.slowFactor = 1;
      }
      if (e.atkTimer > 0) e.atkTimer -= dt;

      // 抬手结束：落刀结算
      if (e.pendingHit >= 0) {
        e.pendingHit -= dt;
        if (e.pendingHit < 0) {
          var hitUnit = null;
          for (var hu = 0; hu < S.units.length; hu++) {
            if (S.units[hu].uid === e.pendingTarget && !S.units[hu].dead) {
              hitUnit = S.units[hu];
              break;
            }
          }
          if (hitUnit) {
            damageUnit(hitUnit, e.atk);
            S.addEffect({
              type: 'slash', x: e.x, y: e.y + e.def.radius * 0.5,
              tx: hitUnit.x, ty: hitUnit.y, life: 0.16, max: 0.16, color: '#ff9a9a',
            });
            S.addEffect({
              type: 'glow', x: hitUnit.x, y: hitUnit.y - 2, r: 7,
              life: 0.14, max: 0.14, color: '#ffb0a8',
            });
            S.hitstop = Math.max(S.hitstop, 0.035);
          }
        }
      }

      // 找正下方最近的阻挡单位
      var blocker = null;
      var bestDy = Infinity;
      for (var j = 0; j < S.units.length; j++) {
        var un = S.units[j];
        if (un.dead) continue;
        var dy = un.y - e.y;
        if (dy <= 0) continue;
        if (Math.abs(un.x - e.x) > un.def.radius + e.def.radius + 16) continue;
        if (dy > e.def.radius + un.def.radius + 26) continue;
        if (dy < bestDy) { bestDy = dy; blocker = un; }
      }

      var atBase = e.y >= u.baseStopY;
      if (atBase && e.def.id === 'boss') {
        // 首领压基地时对周围单位造成范围伤害，迫使玩家把火力集中在它身上
        if (e.atkTimer <= 0) {
          e.atkTimer = e.def.interval;
          S.baseHp -= e.def.baseDamage;
          S.shake = Math.max(S.shake, 0.35);
          S.addFloat(e.x, e.y - 40, '-' + e.def.baseDamage, '#ff7a8a');
          for (var bi = 0; bi < S.units.length; bi++) {
            var bu = S.units[bi];
            if (bu.dead) continue;
            if (S.dist2(bu.x, bu.y, e.x, e.y) <= 95 * 95) damageUnit(bu, 22);
          }
          A.GameAudio && A.GameAudio.play('base');
        }
      } else if (atBase) {
        e.y = u.baseStopY;
        if (e.atkTimer <= 0) {
          e.atkTimer = e.def.interval;
          S.baseHp -= e.def.baseDamage;
          S.shake = Math.max(S.shake, 0.2);
          S.addFloat(u.base.x + u.base.w * 0.5 + (Math.random() - 0.5) * 100,
            u.base.y + 4, '-' + e.def.baseDamage, '#ff7a8a');
          A.GameAudio && A.GameAudio.play('base');
        }
      } else if (blocker) {
        if (e.atkTimer <= 0) {
          e.atkTimer = e.def.interval;
          // 先抬手 0.18s 再落刀：给玩家看见危险、读到节奏的机会
          e.anim = 'atk';
          e.animT = 0;
          e.pendingHit = 0.18;
          e.pendingTarget = blocker.uid;
        }
      } else {
        var sp = e.speed * (e.slowT > 0 ? e.slowFactor : 1);
        e.y += sp * dt;
        if (e.y > u.baseStopY) e.y = u.baseStopY;
      }
      alive.push(e);
    }
    if (alive.length !== S.enemies.length) S.enemies = alive;
  }

  function updateProjectiles(dt) {
    var alive = [];
    for (var i = 0; i < S.projectiles.length; i++) {
      var p = S.projectiles[i];
      p.life -= dt;
      var target = null;
      for (var j = 0; j < S.enemies.length; j++) {
        if (S.enemies[j].uid === p.targetUid && !S.enemies[j].dead) {
          target = S.enemies[j];
          break;
        }
      }
      if (target) { p.tx = target.x; p.ty = target.y; }
      var dx = p.tx - p.x, dy = p.ty - p.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      var step = p.speed * dt;
      var hit = d <= step || d < 6;
      if (hit) {
        p.x = p.tx;
        p.y = p.ty;
        if (target) damageEnemy(target, p.dmg, false);
        if (p.splash) applySplash(p, p.x, p.y);
        else if (p.slow && target) {
          target.slowT = Math.max(target.slowT, p.slow.duration);
          target.slowFactor = p.slow.factor;
          S.addEffect({ type: 'ring', x: p.x, y: p.y, r: 6, r2: 26, life: 0.24, max: 0.24, color: p.color });
        }
        if (p.kind === 'arrow') {
          S.addEffect({
            type: 'spark', x: p.x, y: p.y,
            vx: -dx / d * 70, vy: -dy / d * 70, life: 0.16, max: 0.16, color: '#d9ffcf',
          });
        }
      } else if (p.life > 0) {
        p.x += dx / d * step;
        p.y += dy / d * step;
        alive.push(p);
      }
    }
    S.projectiles = alive;
  }

  function updateEffects(dt) {
    var alive = [];
    for (var i = 0; i < S.effects.length; i++) {
      var e = S.effects[i];
      e.life -= dt;
      if (e.type === 'spark') {
        e.x += (e.vx || 0) * dt;
        e.y += (e.vy || 0) * dt;
        e.vx *= 0.93;
        e.vy *= 0.93;
      } else if (e.type === 'smoke') {
        e.y -= 14 * dt;
        e.r = (e.r || 10) * (1 + dt * 0.9);
      }
      if (e.life > 0) alive.push(e);
    }
    S.effects = alive;

    var fl = [];
    for (var k = 0; k < S.floats.length; k++) {
      var f = S.floats[k];
      f.life -= dt;
      f.y -= 34 * dt;
      if (f.life > 0) fl.push(f);
    }
    S.floats = fl;
  }

  A.Battle = {
    update: update,
    tryDeploy: tryDeploy,
    canAfford: canAfford,
    damageEnemy: damageEnemy,
    refillDelay: REFILL_DELAY,
    removeSlot: removeSlot,
    remainingEnemies: function () { return S.enemies.length + S.spawnQueue.length; },
  };
})();
