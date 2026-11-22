/* 现状：动画状态与命中特效；保持原战斗规则。 */
(function () {
  var A = window.AIGCUtils;
  var S = A.State;

  // ---- 动画状态与命中特效 ----
  function entityRig(entity) {
    return A.Rigs && A.Rigs[entity.rigId || entity.def.id];
  }

  function activeRig(unit) {
    return entityRig(unit);
  }

  function stateDuration(entity, stateName, fallback) {
    var rig = entityRig(entity);
    var state = rig && rig.states && rig.states[stateName];
    return state && state.dur ? state.dur : fallback;
  }

  function enterAnimation(entity, stateName) {
    if (entity.anim === stateName) return;
    // ── 战士待机继承上一动作朝向，避免攻击结束后强制回头 ──
    if (stateName === 'idle' && entity.def.directionRig && entity.def.cls !== 'warrior') {
      entity.rigId = entity.def.directionRig.back;
    }
    entity.anim = stateName;
    entity.animT = 0;
  }

  function finishTransientAnimation(entity, fallback) {
    if (entity.anim === 'idle' || entity.anim === 'move' || entity.anim === 'die') return;
    if (entity.animT >= stateDuration(entity, entity.anim, fallback)) {
      enterAnimation(entity, 'idle');
    }
  }

  function selectAttackRig(unit, target) {
    var rigs = unit.def.attackRig;
    if (rigs) {
      unit.rigId = target.x < unit.x ? rigs.left : rigs.right;
      return;
    }
    selectVerticalRig(unit, target.y);
  }

  function selectVerticalRig(unit, targetY) {
    var rigs = unit.def.directionRig;
    if (rigs) unit.rigId = targetY < unit.y ? rigs.back : rigs.front;
  }

  function attackHitTime(unit, fallback, stateName) {
    var rig = entityRig(unit);
    var state = rig && rig.states && rig.states[stateName || 'atk'];
    return state && state.hit !== undefined ? state.hit : fallback;
  }

  function deathDuration(unit) {
    return stateDuration(unit, 'die', unit.def.deathDuration || 0.28);
  }

  function deathSmoke(unit) {
    S.addEffect({
      type: 'smoke', x: unit.x, y: unit.y, r: unit.def.visualRadius || unit.def.radius,
      life: 0.25, max: 0.25, color: '#ffffff',
    });
  }

  function enemyImpactEffect(enemy, target) {
    A.GameAudio && A.GameAudio.play('enemyHit');
    var color = enemy.def.impactColor || '#ff9a9a';
    if (enemy.def.attackEffect === 'bump') {
      S.addEffect({
        type: 'pop', x: target.x, y: target.y - 2, r: 8,
        life: 0.14, max: 0.14, color: color,
      });
      return;
    }
    S.addEffect({
      type: 'glow', x: target.x, y: target.y - 2, r: 7,
      life: 0.14, max: 0.14, color: color,
    });
  }

  A.BattleAnimation = {
    entityRig: entityRig,
    activeRig: activeRig,
    stateDuration: stateDuration,
    enterAnimation: enterAnimation,
    finishTransientAnimation: finishTransientAnimation,
    selectAttackRig: selectAttackRig,
    selectVerticalRig: selectVerticalRig,
    attackHitTime: attackHitTime,
    deathDuration: deathDuration,
    deathSmoke: deathSmoke,
    enemyImpactEffect: enemyImpactEffect,
  };
})();
