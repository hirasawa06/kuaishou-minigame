/* gameplay/play/battle.js — 核心玩法：饼干、卡池、英雄、敌人、投射物、波次 */
(function () {
  var A = window.AIGCUtils;
  var C = A.Config;
  var S = A.State;
  var L = A.Layout;

  // ---- 模块装配：按依赖顺序加载，保留战斗公共接口 ----
  var enterAnimation = A.BattleAnimation.enterAnimation;
  var finishTransientAnimation = A.BattleAnimation.finishTransientAnimation;
  var selectAttackRig = A.BattleAnimation.selectAttackRig;
  var selectVerticalRig = A.BattleAnimation.selectVerticalRig;
  var attackHitTime = A.BattleAnimation.attackHitTime;
  var deathSmoke = A.BattleAnimation.deathSmoke;
  var enemyImpactEffect = A.BattleAnimation.enemyImpactEffect;
  var warriorTarget = A.BattleTargeting.warriorTarget;
  var attackInRange = A.BattleTargeting.attackInRange;
  var findTarget = A.BattleTargeting.findTarget;
  var resolveBodyCollisions = A.BattleSpatial.resolveBodyCollisions;
  var returnRoute = A.BattleSpatial.returnRoute;
  var damageUnit = A.BattleDamage.damageUnit;
  var resolveAttack = A.BattleCombat.resolveAttack;
  var updateProjectiles = A.BattleCombat.updateProjectiles;
  var placeHero = A.BattleDeployment.placeHero;
  var canAfford = A.BattleDeployment.canAfford;
  var getUpgradePreview = A.BattleDeployment.getUpgradePreview;
  var upgradeUnit = A.BattleDeployment.upgradeUnit;
  var sellPrice = A.BattleDeployment.sellPrice;
  var sellUnit = A.BattleDeployment.sellUnit;
  var findDeployPoint = A.BattleDeployment.findDeployPoint;
  var deployBlockReason = A.BattleDeployment.deployBlockReason;
  var tryDeploy = A.BattleDeployment.tryDeploy;
  var buyCard = A.BattleDeployment.buyCard;
  var buyCardAtCenter = A.BattleDeployment.buyCardAtCenter;

  // ── 波次 ───────────────────────────────────────────────────
  function buildWave(index) {
    var wave = S.getWaves()[index];
    if (!wave) return false;
    var queue = [];
    // ── 每两波提升一档：1/2波基础，3/4波一档，依次递增 ──
    var growthTier = Math.floor(index / 2);
    var hpScale = Math.pow(C.waveHpScale, growthTier);
    var atkScale = Math.pow(C.waveAtkScale, growthTier);
    for (var gi = 0; gi < wave.groups.length; gi++) {
      var g = wave.groups[gi];
      for (var n = 0; n < g[1]; n++) {
        var jitter = 0.94 + Math.random() * 0.12;
        queue.push({ id: g[0], hp: hpScale * jitter, atk: atkScale });
      }
    }
    S.spawnQueue = interleave(queue);
    S.spawnTimer = 0;
    S.waveState = 'spawning';
    var strengthens = index > 0 && index % 2 === 0;
    S.toastMsg(strengthens ? '家具们变强了' : '第 ' + (index + 1) + ' 波来袭',
      strengthens ? 2 : 1.6);
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
    if (A.Profile && A.Profile.recordEnemyEncounter) A.Profile.recordEnemyEncounter(spec.id);
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
      pendingKind: '',
      taunted: 0,
    };
    S.enemies.push(e);
    return e;
  }

  function startTutorialEncounter(unit) {
    S.waveIndex = 0;
    S.waveState = 'fighting';
    S.spawnQueue = [];
    var enemy = spawnEnemy({ id: 'small', hp: 1, atk: 1 });
    enemy.x = unit.x;
    S.toastMsg('第 1 波来袭', 1.6);
    A.GameAudio && A.GameAudio.play('wave');
    return enemy;
  }

  // ── 英雄 ───────────────────────────────────────────────────
  // ── 二星上阵演示：两只小怪，不消耗正式波次队列 ──
  function startTutorialPair(unit) {
    S.waveState = 'fighting';
    S.spawnQueue = [];
    return [-24, 24].map(function (offset) {
      var enemy = spawnEnemy({ id: 'small', hp: 1, atk: 1 });
      enemy.x = S.clamp(unit.x + offset, L.ui.field.x + enemy.def.radius,
        L.ui.field.x + L.ui.field.w - enemy.def.radius);
      return enemy;
    });
  }

  // 各实例保留独立的 1 星配置母版，实际属性由统一星级接口派生。

  // 旧 UI 兼容出口：直接饼干升级已移除，不提供可用升级预览。

  // 接受仍在场上的所有存活角色；不读取会随平衡调整改变的 def.cost。

  // 只检测脚底圆形占地，不把高大贴图的遮挡区域作为碰撞范围。

  // 从卡池买下第 i 张：成功返回 true，卡位留空等刷新

  // 点卡（不拖拽）时直接以卡为中心落地放

  // ── 伤害 ───────────────────────────────────────────────────

  // ── 投射物 ─────────────────────────────────────────────────

  // ── 卡池（固定 4 格，不再滚动）──────────────────────────────
  function updateShop(dt) {
    // 占位：卡池静止，刷新由玩家触发；此处只推进新抽卡的出现动画
    for (var i = 0; i < S.shop.length; i++) {
      var sl = S.shop[i];
      if (sl.born !== undefined) sl.age = S.time - sl.born;
    }
  }

  // ── 帧更新 ─────────────────────────────────────────────────
  function update(dt, elapsedDt, tutorialEncounter) {
    if (S.adBusy) return;
    if (S.phase === 'paused') {
      updateEffects(dt);
      return;
    }
    if (S.phase !== 'playing') {
      updateEffects(dt);
      return;
    }
    S.time += dt;
    updateBiscuits(elapsedDt === undefined ? dt : elapsedDt);
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt);
    if (S.goalHitT > 0) S.goalHitT = Math.max(0, S.goalHitT - dt);
    if (S.hitstop > 0) S.hitstop = Math.max(0, S.hitstop - dt);
    var battleDt = S.hitstop > 0 ? dt * 0.18 : dt;
    if (S.toast) {
      S.toast.life -= dt;
      if (S.toast.life <= 0) S.toast = null;
    }

    updateShop(dt);
    if (!tutorialEncounter) updateWaves(dt);
    updateUnits(battleDt);
    updateEnemies(battleDt);
    resolveBodyCollisions();
    updateProjectiles(battleDt);
    updateEffects(dt);

    if (S.baseHp <= 0 && S.phase === 'playing') {
      S.baseHp = 0;
      S.phase = 'lose';
      S.shake = 0.6;
      recordRun(false);
      A.GameAudio && A.GameAudio.play('lose');
    }
  }

  // ── 角色体积 ──────────────────────────────────────────────
  function updateBiscuits(dt) {
    S.biscuitTimer += dt;
    var count = Math.floor((S.biscuitTimer + 1e-9) / C.BISCUIT_INTERVAL);
    S.biscuitTimer = Math.max(0, S.biscuitTimer - count * C.BISCUIT_INTERVAL);
    S.gold += count;
    S.goldEarned += count;
  }

  // 现有 radius 是“脚底占地”的逻辑半径。这里把它落实为圆形体积：
  // 固定部署的宠物不被挤走；移动中的怪物、主动出击的战士负责退让。
  // 这不会影响攻击距离、嘲讽距离或贴图尺寸。

  // 本局结果写入本地存档，排行榜与名片共用同一份最高关卡
  function recordRun(won) {
    if (S.runRecorded) return;
    S.runRecorded = true;
    var cleared = won ? S.getWaves().length : Math.max(0, S.waveIndex);
    if (A.Profile && A.Profile.recordRun) A.Profile.recordRun(cleared, won, S.runFinalization);
    S.ranking = null;
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
        var batchSize = C.spawnBatchMin + Math.floor(Math.random()
          * (C.spawnBatchMax - C.spawnBatchMin + 1));
        batchSize = Math.min(batchSize, S.spawnQueue.length);
        for (var bi = 0; bi < batchSize; bi++) spawnEnemy(S.spawnQueue.shift());
        S.spawnTimer = C.spawnBatchGapMin + Math.random()
          * (C.spawnBatchGapMax - C.spawnBatchGapMin);
      }
      if (S.spawnQueue.length === 0) S.waveState = 'fighting';
      return;
    }
    if (S.waveState === 'fighting' && S.enemies.length === 0) {
      S.waveIndex++;
      if (S.waveIndex >= S.getWaves().length) {
        S.phase = 'win';
        recordRun(true);
        A.GameAudio && A.GameAudio.play('win');
        return;
      }
      S.waveState = 'prep';
      S.waveTimer = C.waveGap;
      S.gold += C.WAVE_GOLD_BONUS;
      S.goldEarned += C.WAVE_GOLD_BONUS;
      S.toastMsg('波次清除', 1.5);
    }
  }

  // ── 嘲讽 ───────────────────────────────────────────────────
  function tauntCandidates() {
    return S.units.filter(function (un) {
      return !un.dead && !(un.hp <= 0) && un.def.cls === 'tank' && un.def.taunt;
    });
  }

  function tauntTarget(e, tanks) {
    var best = null, bestD = Infinity;
    for (var j = 0; j < tanks.length; j++) {
      var un = tanks[j];
      if (un.dead || un.hp <= 0 || un.def.cls !== 'tank' || !un.def.taunt || e.y > un.y) continue;
      var d2 = S.dist2(un.x, un.y, e.x, e.y);
      if (d2 <= un.def.taunt * un.def.taunt && d2 < bestD) { bestD = d2; best = un; }
    }
    return best;
  }

  function enemyCanReach(e, unit) {
    var dy = unit.y - e.y;
    return dy >= 0 && dy <= e.def.radius + unit.def.radius + 26 &&
      Math.abs(unit.x - e.x) <= e.def.radius + unit.def.radius + 16;
  }

  // ── 移动和攻击共用嘲讽目标，避免前排近战角色抢走攻击 ──
  function updateTaunt(dt) {
    var tanks = tauntCandidates();
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.dead) continue;
      var best = tauntTarget(e, tanks);
      if (best) {
        e.taunted = Math.max(e.taunted, 0.4);
        if (e.tauntRoute && e.tauntRoute.length > 1) continue;
        // 向盾位方向横向吸附，纵向仍朝基地推进，避免被卡死在原地
        var dx = best.x - e.x;
        var dy = best.y - e.y;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var pull = Math.min(1, 90 * dt / Math.max(1, len));
        e.x += dx * pull * 0.9;
        e.y += dy * pull * 0.25;
      } else if (e.taunted > 0) {
        e.taunted -= dt;
      }
    }
  }

  // 返位路径按宠物碰撞圆绕行，保留原来的home坐标而不是穿过队友。

  function updateUnits(dt) {
    updateTaunt(dt);
    var alive = [];
    for (var i = 0; i < S.units.length; i++) {
      var un = S.units[i];

      if (un.dead) {
        un.animT += dt;
        un.dieT -= dt;
        if (un.dieT > 0) alive.push(un);
        else deathSmoke(un);
        continue;
      }
      if (un.spawnT > 0) un.spawnT -= dt;
      if (un.hitFlash > 0) un.hitFlash -= dt;
      var def = un.def;
      un.animT += dt;
      finishTransientAnimation(un, 0.6);

      // 战士只追到攻击范围边缘；攻击起手/命中等待/收势期间都不主动移动。
      if (def.cls === 'warrior' && def.moveSpeed > 0) {
        // ── 当前交战目标优先；目标失效后再按离家、自身距离选择 ──
        var priority = warriorTarget(un);
        if ((un.anim === 'atk' || un.pendingHit >= 0) && (!priority || priority.uid !== un.pendingTarget)) {
          un.pendingHit = -1;
          un.pendingTarget = 0;
          un.atkTimer = 0;
          enterAnimation(un, 'idle');
        }
        var attacking = un.anim === 'atk' || un.pendingHit >= 0;
        var inRange = findTarget(un);
        var chase = !attacking && !inRange ? priority : null;
        var tx = chase ? chase.x : un.homeX;
        var ty = chase ? chase.y : un.homeY;
        if (!attacking && !inRange) {
          un.returnRouteT = (un.returnRouteT || 0) - dt;
          var routeTarget = chase ? chase.uid : 0;
          if (!un.returnPath || un.returnRouteT <= 0 || un.routeTarget !== routeTarget) {
            un.returnPath = returnRoute(un, chase);
            un.routeTarget = routeTarget;
            un.returnRouteT = 0.35;
          }
          while (un.returnPath.length && S.dist2(un.x, un.y,
            un.returnPath[0].x, un.returnPath[0].y) < (un.returnPath.length === 1 ? 0.25 : 9)) un.returnPath.shift();
          if (un.returnPath.length) { tx = un.returnPath[0].x; ty = un.returnPath[0].y; }
          else { tx = un.x; ty = un.y; }
        } else { un.returnPath = null; un.returnRouteT = 0; }
        var dx = tx - un.x;
        var dy = ty - un.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        // 与 findTarget/命中检查共用中心距口径，不再追到敌人的北侧偏移点。
        var remaining = d;
        if (!attacking && !inRange && remaining > (chase ? 0 : 1)) {
          // ── 追击看向目标，绕行路点只决定移动，避免前后朝向来回切换 ──
          selectVerticalRig(un, chase ? chase.y : ty);
          var step = Math.min(remaining, def.moveSpeed * dt);
          un.x += dx / d * step;
          un.y += dy / d * step;
          un.facing = (chase ? chase.x - un.x : dx) >= 0 ? 1 : -1;
          if (un.anim === 'idle' || un.anim === 'move') enterAnimation(un, 'move');
        } else if (un.anim === 'move') {
          enterAnimation(un, 'idle');
        }
        var uu = L.ui;
        un.x = S.clamp(un.x, uu.field.x + def.radius, uu.field.x + uu.field.w - def.radius);
        un.y = S.clamp(un.y, uu.placeTop, uu.placeBottom);
        // ── 归位且脱离交战才恢复朝前守卫，攻击收势仍保留朝向 ──
        if (!priority && un.anim === 'idle' &&
            S.dist2(un.x, un.y, un.homeX, un.homeY) <= 1) {
          un.rigId = def.directionRig.back;
        }
      }

      // 治疗命中帧才结算生命和特效，避免满血时空放治疗动作。
      if (def.cls === 'healer') {
        if (un.pendingHit >= 0) {
          un.pendingHit -= dt;
          if (un.pendingHit < 0) {
            un.pendingHit = -1;
            healAllies(un);
          }
        }
        un.atkTimer -= dt;
        if (un.atkTimer <= 0 && un.pendingHit < 0) {
          un.atkTimer = def.interval;
          if (findHealTarget(un)) {
            enterAnimation(un, 'atk');
            un.pendingHit = attackHitTime(un, 0.30);
          }
        }
        alive.push(un);
        continue;
      }

      // 攻击动作到达出手帧才结算
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
            // ── 近战有效起手即承诺这一刀，移动目标不因命中帧复验距离落空 ──
            if (def.cls === 'warrior' || attackInRange(un, tgt, true)) {
              resolveAttack(un, tgt);
            }
          }
        }
      }

      // 盾位不攻击；嘲讽逻辑由 updateTaunt 独立处理。
      if (def.cls === 'tank') {
        alive.push(un);
        continue;
      }

      un.atkTimer -= dt;
      if (un.atkTimer <= 0 && un.pendingHit < 0) {
        var best = findTarget(un);
        if (best) {
          selectAttackRig(un, best);
          un.atkTimer = def.interval;
          enterAnimation(un, 'atk');
          un.pendingHit = attackHitTime(un, 0.07);
          un.pendingTarget = best.uid;
          un.facing = best.x >= un.x ? 1 : -1;
        }
      }
      alive.push(un);
    }
    if (alive.length !== S.units.length) S.units = alive;
  }

  function healAllies(healer) {
    var def = healer.def;
    var amount = def.heal || 0;
    if (amount <= 0) return;
    var healedTargets = [];
    for (var i = 0; i < (def.healTargets || 1); i++) {
      var target = findHealTarget(healer, healedTargets);
      if (!target) break;
      healedTargets.push(target);
      healTarget(healer, target, amount);
    }
    if (healedTargets.length) A.GameAudio && A.GameAudio.play('heal');
  }

  function healTarget(healer, target, amount) {
    var healed = Math.min(amount, target.maxHp - target.hp);
    target.hp += healed;
    S.addFloat(target.x, target.y - target.def.radius - 14, '+' + Math.round(healed), '#6ff0a8');
    S.addEffect({
      type: 'heal', sourceUid: healer.uid, targetUid: target.uid,
      x: target.x, y: target.y - target.def.radius * 0.3,
      r: target.def.radius, life: 0.5, max: 0.5, color: '#6ff0a8',
    });
  }

  function findHealTarget(healer, excluded) {
    var range2 = healer.def.range * healer.def.range;
    var target = null;
    for (var i = 0; i < S.units.length; i++) {
      var ally = S.units[i];
      if (excluded && excluded.indexOf(ally) >= 0) continue;
      if (ally === healer || ally.dead || ally.hp <= 0 || ally.hp >= ally.maxHp) continue;
      if (S.dist2(healer.x, healer.y, ally.x, ally.y) > range2) continue;
      // 按当前剩余生命值选择单个目标；同血量按 uid 稳定选择。
      if (!target || ally.hp < target.hp || (ally.hp === target.hp && ally.uid < target.uid)) target = ally;
    }
    return target;
  }

  // ── 无交战目标时：离家最近，其次离自己最近，平局按uid稳定 ──

  // 攻击距离独立于脚底碰撞；所有阶段共用中心距与目标半径口径。

  // ── 远程前方180度：朝屏幕上方，左右边界包含，背后不命中 ──

  // ── 三星近战连带：仅伤害主目标附近且仍在自身近战范围内的其他怪 ──

  function resolveBaseHit(e, goalX, baseY) {
    S.baseHp -= e.def.baseDamage;
    S.shake = Math.max(S.shake, 0.2);
    S.goalHitT = 0.3;
    S.addFloat(goalX, baseY - 72, '-' + e.def.baseDamage, '#ff7a8a');
    A.GameAudio && A.GameAudio.play('base');
  }

  function resolveBossBaseHit(e, goalX, baseY) {
    resolveBaseHit(e, goalX, baseY);
    resolveBossGroundHit(e);
  }

  function resolveBossGroundHit(e) {
    S.shake = Math.max(S.shake, 0.35);
    var duration = C.BOSS_IMPACT.duration;
    S.addEffect({ type: 'boss-ground-impact', x: e.x, y: e.y,
      life: duration, max: duration });
    for (var i = 0; i < S.units.length; i++) {
      var unit = S.units[i];
      if (!unit.dead && S.dist2(unit.x, unit.y, e.x, e.y) <= 95 * 95) damageUnit(unit, 22);
    }
  }

  // ── 被嘲讽家具绕过非目标队友，不能被挡成永久无伤卡怪 ──
  function moveToTaunt(e, target, dt) {
    e.tauntRouteT = (e.tauntRouteT || 0) - dt;
    if (!e.tauntRoute || e.tauntRouteT <= 0 || e.tauntRouteUid !== target.uid) {
      e.tauntRoute = returnRoute(e, target, e.def.radius + target.def.radius + 12);
      e.tauntRouteT = 0.35;
      e.tauntRouteUid = target.uid;
    }
    while (e.tauntRoute.length && S.dist2(e.x, e.y,
      e.tauntRoute[0].x, e.tauntRoute[0].y) < 9) e.tauntRoute.shift();
    if (!e.tauntRoute.length) return;
    var point = e.tauntRoute[0], dx = point.x - e.x, dy = point.y - e.y;
    var distance = Math.sqrt(dx * dx + dy * dy);
    var step = Math.min(distance, e.speed * (e.slowT > 0 ? e.slowFactor : 1) * dt);
    e.x += dx / distance * step;
    e.y += dy / distance * step;
  }

  function moveToBase(e, goalX, dt) {
    var u = L.ui;
    var sp = e.speed * (e.slowT > 0 ? e.slowFactor : 1);
    if (e.y >= u.baseStopY - 100) {
      var stepX = sp * dt * 0.85;
      e.x += S.clamp(goalX - e.x, -stepX, stepX);
    }
    e.y += sp * dt;
  }

  function updateEnemies(dt) {
    var u = L.ui;
    var alive = [];
    var tanks = tauntCandidates();
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.dead) {
        e.animT += dt;
        e.dieT -= dt;
        if (e.dieT > 0) alive.push(e);
        // 敌方怪物倒地后直接退场；只有玩家英雄保留死亡烟雾。
        continue;
      }
      if (e.spawnT > 0) e.spawnT -= dt;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      e.animT += dt;
      finishTransientAnimation(e, 0.5);
      if (e.slowT > 0) {
        e.slowT -= dt;
        if (e.slowT <= 0) e.slowFactor = 1;
      }
      if (e.atkTimer > 0) e.atkTimer -= dt;

      var goalBar = u.guardianBar;
      var goalX = S.clamp(e.x, goalBar.x, goalBar.x + goalBar.w);

      if (e.pendingHit >= 0) {
        e.pendingHit -= dt;
        if (e.pendingHit < 0) {
          e.pendingHit = -1;
          if (e.pendingKind === 'base') {
            e.pendingKind = '';
            if (e.def.tier === 'boss') resolveBossBaseHit(e, goalX, u.base.y);
            else resolveBaseHit(e, goalX, u.base.y);
          } else if (e.pendingKind === 'boss-aoe') {
            e.pendingKind = '';
            resolveBossGroundHit(e);
          } else {
            var preferred = tauntTarget(e, tanks);
            var hitUnit = preferred && enemyCanReach(e, preferred) ? preferred : null;
            for (var hu = 0; !preferred && hu < S.units.length; hu++) {
              if (S.units[hu].uid === e.pendingTarget && !S.units[hu].dead) {
                hitUnit = S.units[hu];
                break;
              }
            }
            if (hitUnit) {
              damageUnit(hitUnit, e.atk);
              enemyImpactEffect(e, hitUnit);
              S.hitstop = Math.max(S.hitstop, 0.035);
            }
          }
        }
      }

      var taunt = tauntTarget(e, tanks);
      var blocker = taunt && enemyCanReach(e, taunt) ? taunt : null;
      var bestDy = Infinity;
      for (var j = 0; !taunt && j < S.units.length; j++) {
        var un = S.units[j];
        if (un.dead) continue;
        var dy = un.y - e.y;
        if (dy <= 0) continue;
        if (Math.abs(un.x - e.x) > un.def.radius + e.def.radius + 16) continue;
        if (dy > e.def.radius + un.def.radius + 26) continue;
        if (dy < bestDy) { bestDy = dy; blocker = un; }
      }

      // 整条守卫血条均可命中；范围外家具走向最近的血条边缘。
      var atBase = e.y >= u.baseStopY && e.x >= goalBar.x && e.x <= goalBar.x + goalBar.w;
      if (atBase && e.def.tier === 'boss') {
        if (e.anim === 'move') enterAnimation(e, 'idle');
        if (e.atkTimer <= 0 && e.pendingHit < 0) {
          e.atkTimer = e.def.interval;
          enterAnimation(e, 'aoe');
          e.pendingKind = 'base';
          e.pendingHit = attackHitTime(e, 0.48, 'aoe');
        }
      } else if (atBase) {
        if (e.anim === 'move') enterAnimation(e, 'idle');
        e.y = u.baseStopY;
        if (e.atkTimer <= 0 && e.pendingHit < 0) {
          selectAttackRig(e, { x: goalX, y: u.base.y });
          e.atkTimer = e.def.interval;
          enterAnimation(e, 'atk');
          e.pendingKind = 'base';
          e.pendingHit = attackHitTime(e, 0.18);
        }
      } else if (blocker) {
        if (e.anim === 'move') enterAnimation(e, 'idle');
        if (e.atkTimer <= 0 && e.pendingHit < 0) {
          selectAttackRig(e, blocker);
          e.atkTimer = e.def.interval;
          if (e.def.tier === 'boss' && (e.singleAttackCount || 0) >= 3) {
            e.singleAttackCount = 0;
            enterAnimation(e, 'aoe');
            e.pendingKind = 'boss-aoe';
            e.pendingHit = attackHitTime(e, 0.48, 'aoe');
          } else {
            if (e.def.tier === 'boss') e.singleAttackCount = (e.singleAttackCount || 0) + 1;
            enterAnimation(e, 'atk');
            e.pendingKind = '';
            e.pendingHit = attackHitTime(e, 0.18);
            e.pendingTarget = blocker.uid;
          }
        }
      } else {
        if (taunt && e.y >= u.placeTop) {
          moveToTaunt(e, taunt, dt);
        } else {
          moveToBase(e, goalX, dt);
        }
        if (e.y > u.baseStopY) e.y = u.baseStopY;
        if (e.anim === 'idle' || e.anim === 'move') enterAnimation(e, 'move');
      }
      e.x = S.clamp(e.x, u.field.x + e.def.radius, u.field.x + u.field.w - e.def.radius);
      alive.push(e);
    }
    if (alive.length !== S.enemies.length) S.enemies = alive;
  }

  function updateEffects(dt) {
    var alive = [];
    for (var i = 0; i < S.effects.length; i++) {
      var e = S.effects[i];
      e.life -= dt;
      if (e.life <= 0) continue;
      if (e.type === 'spark') {
        e.x += (e.vx || 0) * dt;
        e.y += (e.vy || 0) * dt;
        e.vx *= 0.93;
        e.vy *= 0.93;
      } else if (e.type === 'smoke') {
        e.y -= 10 * dt;
      }
      alive.push(e);
    }
    S.effects = alive;

    var fl = [];
    for (var k = 0; k < S.floats.length; k++) {
      var f = S.floats[k];
      f.life -= dt;
      f.y -= 26 * dt;
      if (f.life > 0) fl.push(f);
    }
    S.floats = fl;
  }

  // 只恢复本局合照；不重建波次、不治疗/复活宠物、不结算击杀饼干。
  function revive(runToken) {
    if (S.phase !== 'lose' || (runToken !== undefined && runToken !== S.runToken) ||
        S.revivesUsed >= C.REVIVES_PER_RUN) return false;
    var north = typeof L.ui.spawnY === 'number' ? L.ui.spawnY : L.ui.field.y;
    for (var i = 0; i < S.enemies.length; i++) {
      var enemy = S.enemies[i];
      if (enemy.dead || enemy.hp <= 0) continue;
      // 北界附近不向南搬回；其余怪物至少退 120 逻辑像素，最多到出生北界。
      enemy.y = Math.min(enemy.y, Math.max(north, enemy.y - C.REVIVE_KNOCKBACK));
      enemy.pendingTarget = 0;
      enemy.pendingHit = -1;
      enemy.atkTimer = Math.max(1, enemy.atkTimer || 0);
      enemy.taunted = 0;
      enemy.anim = 'move';
      enemy.animT = 0;
    }
    for (var ui = 0; ui < S.units.length; ui++) {
      var unit = S.units[ui];
      if (unit.dead || unit.hp <= 0) continue;
      unit.pendingTarget = 0;
      unit.pendingHit = -1;
      unit.atkTimer = Math.max(1, unit.atkTimer || 0);
      unit.anim = 'idle';
      unit.animT = 0;
    }
    S.projectiles.length = 0;
    S.effects.length = 0;
    S.floats.length = 0;
    S.hitstop = 0;
    S.shake = 0;
    S.goalHitT = 0;
    S.drag = null;
    S.dragging = null;
    S.inspect = null;
    S.baseHp = C.REVIVE_HP;
    S.revivesUsed++;
    S.runRecorded = false; // 保留 runFinalization，下一次结算不重复 games。
    S.phase = 'playing';
    A.Input && A.Input.cancel();
    S.toastMsg('合照恢复 ' + C.REVIVE_HP + '，继续守护！', 1.8);
    A.GameAudio && A.GameAudio.syncPhase(S.phase);
    return true;
  }

  function remainingEnemies() {
    return S.enemies.length + S.spawnQueue.length;
  }

  A.Battle = {
    update: update,
    startTutorialEncounter: startTutorialEncounter,
    startTutorialPair: startTutorialPair,
    revive: revive,
    tryDeploy: tryDeploy,
    findDeployPoint: findDeployPoint,
    deployBlockReason: deployBlockReason,
    canAfford: canAfford,
    getUpgradePreview: getUpgradePreview,
    upgradeUnit: upgradeUnit,
    sellPrice: sellPrice,
    sellUnit: sellUnit,
    buyCard: buyCard,
    buyCardAtCenter: buyCardAtCenter,
    remainingEnemies: remainingEnemies,
    findTarget: findTarget,
    placeHero: placeHero,
  };
  // ── 对外部署接口接收屏幕坐标，内部战斗始终使用固定地图坐标 ──
  var screenCoordinates = { tryDeploy: 1, findDeployPoint: 1, deployBlockReason: 1, buyCard: 1, placeHero: 1 };
  if (A.BattleWorld) Object.keys(A.Battle).forEach(function (key) {
    A.Battle[key] = A.BattleWorld.wrapBattle(A.Battle[key], screenCoordinates[key], key === 'findDeployPoint');
  });
})();
