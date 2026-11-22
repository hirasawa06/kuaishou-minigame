/* 现状：攻击结算与投射物；保持原战斗规则。 */
(function () {
  var A = window.AIGCUtils;
  var S = A.State;
  var damageEnemy = A.BattleDamage.damageEnemy;
  var activeRig = A.BattleAnimation.activeRig;
  var attackInFront = A.BattleTargeting.attackInFront;
  var attackInRange = A.BattleTargeting.attackInRange;

  // ---- 攻击结算与投射物 ----
  function projectileOrigin(unit) {
    var rig = activeRig(unit);
    var muzzle = rig && rig.muzzle;
    return {
      x: unit.x + (muzzle ? muzzle[0] : 0),
      y: unit.y + (muzzle ? muzzle[1] : -6),
    };
  }

  function fireProjectile(unit, target, damageRatio, delay) {
    var def = unit.def;
    var origin = projectileOrigin(unit);
    var projectile = {
      x: origin.x, y: origin.y,
      tx: target.x, ty: target.y,
      targetUid: target.uid,
      sourceUnit: unit,
      speed: def.cls === 'archer' ? 680 : 420,
      kind: def.cls === 'archer' ? 'light' : def.cls === 'mage' ? 'magic' : 'fire',
      dmg: def.atk * (damageRatio === undefined ? 1 : damageRatio),
      delay: delay || 0,
      echoRatio: def.echoRatio || 0,
      splash: def.splash || 0,
      slow: def.slow || null,
      color: def.color,
      life: 1.6,
    };
    S.projectiles.push(projectile);
    return projectile;
  }

  function applySplash(p, cx, cy, primary) {
    var r2 = p.splash * p.splash;
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.dead) continue;
      if (e !== primary && !attackInFront(p.sourceUnit, e)) continue;
      if (S.dist2(e.x, e.y, cx, cy) > r2) continue;
      if (p.slow) {
        e.slowT = Math.max(e.slowT, p.slow.duration);
        e.slowFactor = Math.min(e.slowFactor, p.slow.factor);
      }
      damageEnemy(e, p.dmg, true);
    }
    // 法师有自己的贴地饼干扩散，不再叠一层通用正面圆环。
    if (p.kind !== 'magic') {
      S.addEffect({
        type: 'ring', x: cx, y: cy, r: p.splash * 0.35, r2: p.splash,
        life: 0.34, max: 0.34, color: p.color,
      });
    }
  }

  function resolveAttack(un, best) {
    var def = un.def;
    if (def.cls === 'healer' || def.cls === 'tank') return;
    if (def.cls === 'warrior') {
      damageEnemy(best, def.atk, false);
      if (def.cleaveRatio) applyMeleeCleave(un, best);
      var mx = (un.x + best.x) / 2, my = (un.y + best.y) / 2;
      S.addEffect({
        type: 'slash', x: un.x, y: un.y, tx: best.x, ty: best.y,
        life: 0.18, max: 0.18, color: def.color,
      });
      S.addEffect({
        type: 'glow', x: mx, y: my, r: 7, life: 0.15, max: 0.15, color: def.color,
      });
      S.hitstop = Math.max(S.hitstop, 0.04);
    } else {
      var projectile = fireProjectile(un, best);
      if (def.extraShotRatio) fireProjectile(un, best, def.extraShotRatio, 0.12);
      S.addEffect({
        type: 'glow', x: projectile.x, y: projectile.y, r: def.cls === 'archer' ? 7 : 8,
        life: 0.12, max: 0.12, color: def.color,
      });
    }
    A.GameAudio && A.GameAudio.play(def.cls === 'archer' ? 'arrow' : def.cls === 'mage' ? 'magic' : 'hit');
  }

  function applyMeleeCleave(unit, primary) {
    var def = unit.def;
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e === primary || e.dead || !attackInRange(unit, e, false)) continue;
      if (S.dist2(e.x, e.y, primary.x, primary.y) > def.cleaveRange * def.cleaveRange) continue;
      damageEnemy(e, def.atk * def.cleaveRatio, true);
      S.addEffect({ type: 'slash', x: primary.x, y: primary.y, tx: e.x, ty: e.y,
        life: 0.18, max: 0.18, color: def.color });
    }
  }

  function updateProjectiles(dt) {
    var alive = [];
    for (var i = 0; i < S.projectiles.length; i++) {
      var p = S.projectiles[i];
      if (p.delay > 0) {
        p.delay -= dt;
        if (p.delay > 0) { alive.push(p); continue; }
      }
      if (p.echo) {
        applySplash(p, p.x, p.y);
        S.addEffect({ type: 'mage-biscuit-impact', x: p.x, y: p.y, r: 34,
          life: 0.6, max: 0.6, color: p.color });
        continue;
      }
      p.life -= dt;
      var target = null;
      for (var j = 0; j < S.enemies.length; j++) {
        if (S.enemies[j].uid === p.targetUid && !S.enemies[j].dead) {
          target = S.enemies[j];
          break;
        }
      }
      // 发射后锁定存活目标，不再因目标离开角色范围或绕后取消命中。
      if (target) { p.tx = target.x; p.ty = target.y; }
      var dx = p.tx - p.x, dy = p.ty - p.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      var step = p.speed * dt;
      var hit = d <= step || d < 6;
      if (hit) {
        p.x = p.tx;
        p.y = p.ty;
        // ── 范围弹只通过爆炸结算，主目标不再重复吃直接伤害 ──
        if (p.splash) applySplash(p, p.x, p.y, target);
        else if (target) damageEnemy(target, p.dmg, false);
        if (p.echoRatio) alive.push({ x: p.x, y: p.y, splash: p.splash,
          dmg: p.dmg * p.echoRatio, sourceUnit: p.sourceUnit, color: p.color,
          kind: 'magic', echo: true, delay: 0.2 });
        if (p.kind === 'magic') {
          S.addEffect({
            type: 'mage-biscuit-impact', x: p.x, y: p.y, r: 34,
            life: 0.6, max: 0.6, color: p.color,
          });
        }
        else if (p.slow && target) {
          target.slowT = Math.max(target.slowT, p.slow.duration);
          target.slowFactor = p.slow.factor;
          S.addEffect({ type: 'ring', x: p.x, y: p.y, r: 6, r2: 26, life: 0.24, max: 0.24, color: p.color });
        }
        if (p.kind === 'light') {
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

  A.BattleCombat = {
    projectileOrigin: projectileOrigin,
    fireProjectile: fireProjectile,
    applySplash: applySplash,
    resolveAttack: resolveAttack,
    applyMeleeCleave: applyMeleeCleave,
    updateProjectiles: updateProjectiles,
  };
})();
