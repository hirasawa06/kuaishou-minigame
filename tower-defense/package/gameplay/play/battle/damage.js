/* 现状：受伤、死亡与击败奖励；保持原战斗规则。 */
(function () {
  var A = window.AIGCUtils;
  var S = A.State;
  var enterAnimation = A.BattleAnimation.enterAnimation;
  var deathDuration = A.BattleAnimation.deathDuration;

  // ---- 受伤、死亡与击败奖励 ----
  function damageEnemy(e, dmg, isSplash) {
    if (e.dead) return;
    e.hp -= dmg;
    var reactsToHit = e.def.hitReaction !== 'none';
    e.hitFlash = reactsToHit ? 0.12 : 0;
    if (reactsToHit && e.anim !== 'die' && e.anim !== 'atk') enterAnimation(e, 'hurt');
    if (!isSplash) {
      S.addFloat(e.x + (Math.random() - 0.5) * 10, e.y - e.def.radius - 8,
        String(Math.round(dmg)), '#ffe9a8');
    }
    if (e.hp <= 0) {
      e.dead = true;
      enterAnimation(e, 'die');
      e.dieT = deathDuration(e);
      S.kills++;
      var g = e.def.gold || 2;
      // ── 配置了奖励上限时，每次击败等概率抽取区间内整数 ──
      if (e.def.goldMax !== undefined) {
        g += Math.floor(Math.random() * (e.def.goldMax - g + 1));
      }
      S.gold += g;
      S.goldEarned += g;
      S.addFloat(e.x, e.y - e.def.radius - 20, String(g), '#ffd166', 'kill-reward');
      if (e.def.tier === 'boss') onBossDeath(e);
      else A.GameAudio && A.GameAudio.play('enemyDeath');
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
    u.hp -= dmg * (1 - (u.def.damageReduction || 0));
    u.hitFlash = 0.14;
    if (u.anim !== 'die' && u.anim !== 'atk') {
      u.anim = 'hurt';
      u.animT = 0;
    }
    if (u.hp <= 0) {
      u.dead = true;
      enterAnimation(u, 'die');
      u.dieT = deathDuration(u);
    }
  }

  A.BattleDamage = {
    damageEnemy: damageEnemy,
    onBossDeath: onBossDeath,
    damageUnit: damageUnit,
  };
})();
