/* 现状：攻击范围与目标优先级；保持原战斗规则。 */
(function () {
  var A = window.AIGCUtils;
  var C = A.Config;
  var S = A.State;
  var L = A.Layout;

  // ---- 攻击范围与目标优先级 ----
  function warriorTarget(un) {
    var range = un.def.aggro || 240;
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.uid !== un.pendingTarget || e.dead) continue;
      if (un.anim === 'atk' || un.pendingHit >= 0) return e;
    }
    return homePriorityEnemy(un) || homePriorityEnemy(un, range);
  }

  function homePriorityEnemy(un, maxRange) {
    var best = null;
    var bestHome = Infinity, bestD = Infinity;
    var bar = L.ui.guardianBar;
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.dead) continue;
      var d2 = S.dist2(un.x, un.y, e.x, e.y);
      var eligible = maxRange === undefined ? attackInRange(un, e, e.uid === un.pendingTarget)
        : d2 <= maxRange * maxRange;
      if (!eligible) continue;
      var home = S.dist2(e.x, e.y, S.clamp(e.x, bar.x, bar.x + bar.w), L.ui.baseStopY);
      if (home > bestHome || (home === bestHome && d2 > bestD)) continue;
      if (best && home === bestHome && d2 === bestD && e.uid >= best.uid) continue;
      best = e; bestHome = home; bestD = d2;
    }
    return best;
  }

  function attackReach(unit, target) {
    return unit.def.range + target.def.radius;
  }

  function attackInFront(unit, target) {
    if (!unit || (unit.def.cls !== 'archer' && unit.def.cls !== 'mage')) return true;
    return target.y <= unit.y;
  }

  function attackInRange(unit, target, retained) {
    if (!target || target.dead) return false;
    if (!attackInFront(unit, target)) return false;
    var reach = attackReach(unit, target) + C.ATTACK_DISTANCE_EPSILON +
      (retained ? C.ATTACK_RELEASE_MARGIN : 0);
    return S.dist2(unit.x, unit.y, target.x, target.y) <= reach * reach;
  }

  function findTarget(un) {
    // 可攻击目标第一优先，其内部按离家距离、自身距离依次排序。
    return homePriorityEnemy(un);
  }

  A.BattleTargeting = {
    warriorTarget: warriorTarget,
    homePriorityEnemy: homePriorityEnemy,
    attackReach: attackReach,
    attackInFront: attackInFront,
    attackInRange: attackInRange,
    findTarget: findTarget,
  };
})();
