/* gameplay/play/battle.js — 核心玩法：金币、卡池、英雄、敌人、投射物、波次 */
(function () {
  var A = window.AIGCUtils;
  var C = A.Config;
  var S = A.State;
  var L = A.Layout;

  // ── 波次 ───────────────────────────────────────────────────
  function buildWave(index) {
    var wave = S.getWaves()[index];
    if (!wave) return false;
    var queue = [];
    var hpScale = Math.pow(C.waveHpScale, index);
    var atkScale = Math.pow(C.waveAtkScale, index);
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
      hp: Math.round(def.hp * spec.hp * (S.levelHpScale === undefined ? 1 : S.levelHpScale)),
      maxHp: Math.round(def.hp * spec.hp * (S.levelHpScale === undefined ? 1 : S.levelHpScale)),
      atk: def.atk * spec.atk * (S.levelAtkScale === undefined ? 1 : S.levelAtkScale),
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
      taunted: 0,
    };
    S.enemies.push(e);
  }

  // ── 英雄 ───────────────────────────────────────────────────
  // 各实例保留独立的 1 星配置母版，实际属性由统一星级接口派生。
  function copyDef(value) {
    if (!value || typeof value !== 'object') return value;
    var out = Array.isArray(value) ? [] : {};
    for (var key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) out[key] = copyDef(value[key]);
    }
    return out;
  }

  function placeHero(card, x, y, star) {
    if (!card) return null;
    if (star === undefined) star = card.star === undefined ? 1 : card.star;
    if (!S.isHeroUnlocked(card.id)) return null;
    var base = S.heroById(card.id);
    card = S.heroAtStar(card.id, star);
    if (!base || !card || typeof x !== 'number' || !isFinite(x) ||
        typeof y !== 'number' || !isFinite(y)) return null;
    var u = L.ui;
    x = S.clamp(x, u.field.x + card.radius + 4, u.field.x + u.field.w - card.radius - 4);
    y = S.clamp(y, u.placeTop, u.placeBottom);
    // 新宠物被挤开后可能靠近前一只，因此重复扫几轮，直到所有脚底体积都分开。
    for (var pass = 0; pass < 8; pass++) {
      var adjusted = false;
      for (var pi = 0; pi < S.units.length; pi++) {
        var other = S.units[pi];
        if (other.dead) continue;
        var minGap = Math.max(C.UNIT_MIN_GAP,
          card.radius + other.def.radius + C.ACTOR_BODY_GAP + 0.5);
        var d = Math.sqrt(S.dist2(x, y, other.x, other.y));
        if (d >= minGap) continue;
        var nx = x - other.x, ny = y - other.y;
        var len = Math.sqrt(nx * nx + ny * ny);
        if (len < 0.001) {
          // 固定方向使同一个落点每次得到同样的结果，不因随机数闪跳。
          var ang = ((S.uid * 37 + other.uid * 53) % 360) * Math.PI / 180;
          nx = Math.cos(ang);
          ny = Math.sin(ang);
          len = 1;
        }
        x = S.clamp(other.x + nx / len * minGap,
          u.field.x + card.radius + 4, u.field.x + u.field.w - card.radius - 4);
        y = S.clamp(other.y + ny / len * minGap, u.placeTop, u.placeBottom);
        adjusted = true;
      }
      if (!adjusted) break;
    }
    // 边界已经没有可挪动空间时，不扣费、不生成重叠的宠物。
    for (var ci = 0; ci < S.units.length; ci++) {
      var check = S.units[ci];
      if (check.dead) continue;
      var required = Math.max(C.UNIT_MIN_GAP,
        card.radius + check.def.radius + C.ACTOR_BODY_GAP);
      if (Math.sqrt(S.dist2(x, y, check.x, check.y)) + 0.02 < required) return null;
    }
    // 部署不允许直接压在行进中的怪物上；避免刚落地的一帧就出现穿模。
    for (var ei = 0; ei < S.enemies.length; ei++) {
      var enemy = S.enemies[ei];
      if (enemy.dead) continue;
      var enemyGap = card.radius + enemy.def.radius + C.ACTOR_BODY_GAP;
      if (Math.sqrt(S.dist2(x, y, enemy.x, enemy.y)) + 0.02 < enemyGap) return null;
    }
    var baseDef = copyDef(base);
    var unit = {
      uid: S.uid++,
      def: card,
      baseDef: baseDef,
      star: star,
      level: star, // 兼容旧绘制字段；星级只在购买前的商店合成改变。
      x: x,
      y: y,
      homeX: x,
      homeY: y,
      rigId: card.id,
      facing: 1,
      hp: card.hp,
      maxHp: card.hp,
      purchaseCost: card.cost,
      spentGold: card.cost, // 兼容字段；只记录真实购入价，没有局内金币升级。
      atkTimer: card.cls === 'healer' ? card.interval : 0.3,
      hitFlash: 0,
      slowT: 0,
      spawnT: 0.3,
      dead: false,
      anim: 'idle',
      animT: 0,
      pendingHit: -1,
      pendingTarget: 0,
    };
    S.units.push(unit);
    return unit;
  }

  function canAfford(def) { return S.gold >= def.cost; }

  // 旧 UI 兼容出口：直接金币升级已移除，不提供可用升级预览。
  function getUpgradePreview() { return null; }
  function upgradeUnit() { return false; }

  // 只接受仍在场上的存活驻守单位；不读取会随平衡调整改变的 def.cost。
  function canSellUnit(unit) {
    return !!(unit && !unit.dead && unit.hp > 0 && unit.def &&
      unit.def.moveSpeed === 0 && S.units.indexOf(unit) >= 0 && unit.maxHp > 0 &&
      typeof unit.purchaseCost === 'number' && isFinite(unit.purchaseCost) && unit.purchaseCost >= 0);
  }

  function sellPrice(unit) {
    if (!canSellUnit(unit)) return 0;
    var cost = unit.purchaseCost;
    var ratio = unit.hp / unit.maxHp;
    if (ratio >= 0.6) return Math.floor(cost * 0.5);
    if (ratio >= 0.3) return Math.floor(cost * 0.3);
    return 1;
  }

  function sellUnit(unit) {
    if (S.phase !== 'playing' || !canSellUnit(unit)) return false;
    var price = sellPrice(unit);
    unit.pendingHit = -1;
    unit.pendingTarget = 0;
    // 不走死亡流程，不产生击杀、死亡烟雾或奖励；立即释放部署席位。
    S.units.splice(S.units.indexOf(unit), 1);
    for (var i = 0; i < S.enemies.length; i++) {
      var enemy = S.enemies[i];
      if (enemy.pendingTarget !== unit.uid) continue;
      enemy.pendingHit = -1;
      enemy.pendingTarget = 0;
      if (!enemy.dead && enemy.anim === 'atk') enterAnimation(enemy, 'idle');
    }
    // 当前飞弹只追踪敌人，但仍清掉任何指向出售单位的飞弹，避免悬空目标。
    for (var pi = S.projectiles.length - 1; pi >= 0; pi--) {
      if (S.projectiles[pi].targetUid === unit.uid) S.projectiles.splice(pi, 1);
    }
    S.gold += price;
    S.addFloat(unit.x, unit.y - unit.def.radius - 14, '+' + price, '#ffd166');
    A.GameAudio && A.GameAudio.play('sell');
    S.notifyAction('sell', { unit: unit, price: price });
    return true;
  }


  function deployBlockReason(card, x, y) {
    if (!card || typeof x !== 'number' || !isFinite(x) ||
        typeof y !== 'number' || !isFinite(y)) return 'outside';
    var u = L.ui;
    var interactive = u.interactiveRect;
    if (x < interactive.x || x > interactive.x + interactive.w ||
        y < interactive.y || y > interactive.y + interactive.h) return 'outside';
    if (x < u.field.x || x > u.field.x + u.field.w) return 'outside';
    if (y < u.field.y - 24 || y > u.base.y + 10) return 'outside';
    if (!canAfford(card)) return 'gold';
    if (S.liveUnits() >= S.heroCap) return 'cap';
    return null;
  }

  function tryDeploy(card, x, y, star) {
    if (S.phase !== 'playing' || !card) return false;
    if (star === undefined) star = 1;
    if (!S.isHeroUnlocked(card.id)) {
      S.toastMsg('角色尚未解锁', 1.0);
      return false;
    }
    // 星级、售价和战斗属性只取当前配置，避免调用方传入过时的卡牌对象。
    card = S.heroAtStar(card.id, star);
    if (!card) return false;
    var reason = deployBlockReason(card, x, y);
    if (reason === 'outside') return false;
    if (reason === 'gold') {
      S.toastMsg('金币不足', 0.9);
      return false;
    }
    // 死亡动画中的英雄不算占位
    if (reason === 'cap') {
      S.toastMsg('上场席位已满（' + S.heroCap + '），可花金币扩建', 1.3);
      return false;
    }
    var unit = placeHero(card, x, y, star);
    if (!unit) {
      S.toastMsg('这里没有可放下的位置', 1.0);
      return false;
    }
    S.gold -= card.cost;
    S.cardsPlaced++;
    S.addEffect({ type: 'ring', x: unit.x, y: unit.y, r: card.radius + 4, r2: card.radius + 26, life: 0.36, max: 0.36, color: card.color });
    S.addFloat(unit.x, unit.y - card.radius - 14, '-' + card.cost, '#ffd166');
    S.notifyAction('deploy', { unit: unit, cardId: card.id, star: star, cost: unit.purchaseCost });
    return true;
  }

  // 从卡池买下第 i 张：成功返回 true，卡位留空等刷新
  function buyCard(index, x, y) {
    if (typeof index !== 'number' || Math.floor(index) !== index ||
        index < 0 || index >= C.cardCount) return false;
    var slot = S.shop[index];
    if (!slot || slot.sold) return false;
    var def = S.heroAtStar(slot.cardId, slot.star);
    if (!def || S.shopCost(slot) !== def.cost) return false;
    if (!tryDeploy(def, x, y, slot.star)) return false;
    slot.sold = true;
    slot.locked = false;
    return true;
  }

  // 点卡（不拖拽）时直接以卡为中心落地放
  function buyCardAtCenter(index) {
    var slot = S.shop[index];
    if (!slot || slot.sold) return false;
    var u = L.ui;
    var rect = L.shopRect(index);
    var x = u.field.x + u.field.w * 0.5;
    var y = u.placeBottom - 10;
    return buyCard(index, x, y);
  }

  // ── 伤害 ───────────────────────────────────────────────────
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
      S.gold += g;
      S.goldEarned += g;
      S.addFloat(e.x, e.y - e.def.radius - 20, '+' + g, '#ffd166');
      S.addEffect({ type: 'pop', x: e.x, y: e.y, r: e.def.radius, life: 0.42, max: 0.42, color: e.def.color });
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
    u.hp -= dmg;
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

  // ── 投射物 ─────────────────────────────────────────────────
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
    if (stateName === 'idle' && entity.def.directionRig) {
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

  function attackHitTime(unit, fallback) {
    var rig = entityRig(unit);
    var state = rig && rig.states && rig.states.atk;
    return state && state.hit !== undefined ? state.hit : fallback;
  }

  function deathDuration(unit) {
    return stateDuration(unit, 'die', unit.def.deathDuration || 0.28);
  }

  function deathSmoke(unit) {
    S.addEffect({
      type: 'smoke', x: unit.x, y: unit.y, r: unit.def.radius,
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
      type: 'slash', x: enemy.x, y: enemy.y + enemy.def.radius * 0.5,
      tx: target.x, ty: target.y, life: 0.16, max: 0.16, color: color,
    });
    S.addEffect({
      type: 'glow', x: target.x, y: target.y - 2, r: 7,
      life: 0.14, max: 0.14, color: color,
    });
  }

  function projectileOrigin(unit) {
    var rig = activeRig(unit);
    var muzzle = rig && rig.muzzle;
    return {
      x: unit.x + (muzzle ? muzzle[0] : 0),
      y: unit.y + (muzzle ? muzzle[1] : -6),
    };
  }

  function fireProjectile(unit, target) {
    var def = unit.def;
    var origin = projectileOrigin(unit);
    var projectile = {
      x: origin.x, y: origin.y,
      tx: target.x, ty: target.y,
      targetUid: target.uid,
      speed: def.cls === 'archer' ? 680 : 420,
      kind: def.cls === 'archer' ? 'light' : def.cls === 'mage' ? 'magic' : 'fire',
      dmg: def.atk,
      splash: def.splash || 0,
      slow: def.slow || null,
      color: def.color,
      life: 1.6,
    };
    S.projectiles.push(projectile);
    return projectile;
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

  // ── 卡池（固定 4 格，不再滚动）──────────────────────────────
  function updateShop(dt) {
    // 占位：卡池静止，刷新由玩家触发；此处只推进新抽卡的出现动画
    for (var i = 0; i < S.shop.length; i++) {
      var sl = S.shop[i];
      if (sl.born !== undefined) sl.age = S.time - sl.born;
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
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt);
    if (S.goalHitT > 0) S.goalHitT = Math.max(0, S.goalHitT - dt);
    if (S.hitstop > 0) S.hitstop = Math.max(0, S.hitstop - dt);
    var battleDt = S.hitstop > 0 ? dt * 0.18 : dt;
    if (S.toast) {
      S.toast.life -= dt;
      if (S.toast.life <= 0) S.toast = null;
    }

    updateShop(dt);
    updateWaves(dt);
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
  // 现有 radius 是“脚底占地”的逻辑半径。这里把它落实为圆形体积：
  // 固定部署的宠物不被挤走；移动中的怪物、主动出击的战士负责退让。
  // 这不会影响攻击距离、嘲讽距离或贴图尺寸。
  function resolveBodyCollisions() {
    var actors = [];
    var i;
    for (i = 0; i < S.units.length; i++) {
      if (!S.units[i].dead) actors.push({ actor: S.units[i], kind: 'unit' });
    }
    for (i = 0; i < S.enemies.length; i++) {
      if (!S.enemies[i].dead) actors.push({ actor: S.enemies[i], kind: 'enemy' });
    }

    // 多轮清开同一帧的连锁挤压；没有重叠时立即退出，密集阵位才会用满上限。
    for (var pass = 0; pass < 24; pass++) {
      var adjusted = false;
      for (i = 0; i < actors.length; i++) {
        for (var j = i + 1; j < actors.length; j++) {
          if (separateBodies(actors[i], actors[j])) adjusted = true;
        }
      }
      if (!adjusted) break;
    }
  }

  function separateBodies(a, b) {
    var aa = a.actor;
    var bb = b.actor;
    var minDistance = aa.def.radius + bb.def.radius + C.ACTOR_BODY_GAP;
    // 求解后额外留出半个逻辑像素，避免多组连锁挤压在浮点误差下留下细缝重叠。
    var targetDistance = minDistance + 0.5;
    var dx = bb.x - aa.x;
    var dy = bb.y - aa.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= targetDistance) return false;

    // 完全重合时使用 uid 生成稳定方向，不能用随机数，否则画面会抖动。
    if (dist < 0.001) {
      var angle = ((aa.uid * 37 + bb.uid * 53) % 360) * Math.PI / 180;
      dx = Math.cos(angle);
      dy = Math.sin(angle);
      dist = 1;
    }
    var nx = dx / dist;
    var ny = dy / dist;
    var overlap = targetDistance - dist;
    var moveA = bodyMoveWeight(a, b);
    var moveB = bodyMoveWeight(b, a);
    var total = moveA + moveB;
    if (total <= 0) return false;

    // 只有一方可移动（怪物撞固定宠物、战士撞固定宠物）时，优先为移动方
    // 寻找能完整落在场地内的接触点，避免被边界夹住后仍然重叠。
    if ((moveA === 0) !== (moveB === 0)) {
      var movable = moveA > 0 ? a : b;
      var fixed = moveA > 0 ? b : a;
      // 怪物推进方向是向南。撞上固定宠物时必须先退回北侧排队，不能被挤到
      // 宠物和基地之间；战士则维持原来的接触方向。
      var queueNorth = movable.kind === 'enemy' && fixed.kind === 'unit';
      var direction = queueNorth ? -Math.PI / 2
        : moveA > 0 ? Math.atan2(-ny, -nx) : Math.atan2(ny, nx);
      return placeOutsideBody(movable, fixed, targetDistance, direction, queueNorth);
    }

    aa.x -= nx * overlap * moveA / total;
    aa.y -= ny * overlap * moveA / total;
    bb.x += nx * overlap * moveB / total;
    bb.y += ny * overlap * moveB / total;
    clampBody(a);
    clampBody(b);
    return true;
  }

  function placeOutsideBody(movable, fixed, targetDistance, startAngle, keepFirstFit) {
    var mover = movable.actor;
    var anchor = fixed.actor;
    var oldX = mover.x;
    var oldY = mover.y;
    var best = null;
    // 从原本的退让方向开始，左右逐步寻找；这样正常情况下不会横跳。
    for (var i = 0; i < 16; i++) {
      var step = i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 ? 1 : -1);
      var angle = startAngle + step * Math.PI / 12;
      mover.x = anchor.x + Math.cos(angle) * targetDistance;
      mover.y = anchor.y + Math.sin(angle) * targetDistance;
      clampBody(movable);
      if (Math.sqrt(S.dist2(mover.x, mover.y, anchor.x, anchor.y)) + 0.02 < targetDistance) continue;
      var cost = S.dist2(oldX, oldY, mover.x, mover.y);
      if (keepFirstFit) {
        best = { x: mover.x, y: mover.y, cost: cost };
        break;
      }
      if (!best || cost < best.cost) best = { x: mover.x, y: mover.y, cost: cost };
    }
    if (best) {
      mover.x = best.x;
      mover.y = best.y;
      return true;
    } else {
      mover.x = oldX;
      mover.y = oldY;
      return false;
    }
  }

  function bodyMoveWeight(body, other) {
    // 固定宠物保留部署阵位；战士与怪物接触时由战士退让，不能把攻击变成推怪。
    // 只改变敌人/战士这一对：怪物之间、怪物撞固定盾位仍沿用原来的分离规则。
    if (body.kind === 'unit') return body.actor.def.cls === 'warrior' ? 1 : 0;
    if (other.kind === 'unit' && other.actor.def.cls === 'warrior') return 0;
    return 1;
  }

  function clampBody(body) {
    var u = L.ui;
    var actor = body.actor;
    var r = actor.def.radius;
    actor.x = S.clamp(actor.x, u.field.x + r, u.field.x + u.field.w - r);
    if (body.kind === 'unit') {
      actor.y = S.clamp(actor.y, u.placeTop, u.placeBottom);
    } else if (actor.y > u.baseStopY) {
      actor.y = u.baseStopY;
    }
  }

  // 本局结果写入本地存档，排行榜与名片共用同一份最高关卡
  function recordRun(won) {
    if (S.runRecorded) return;
    S.runRecorded = true;
    var cleared = won ? S.getWaves().length : Math.max(0, S.waveIndex);
    if (A.Profile && A.Profile.recordRun) A.Profile.recordRun(cleared, won);
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
        spawnEnemy(S.spawnQueue.shift());
        S.spawnTimer = C.spawnGap;
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
      S.toastMsg('波次清除  +' + C.WAVE_GOLD_BONUS + ' 金币', 1.5);
    }
  }

  // ── 嘲讽 ───────────────────────────────────────────────────
  // 盾位不输出，但会把范围内的敌人拉向自己，为后排创造输出窗口
  function updateTaunt(dt) {
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.dead) continue;
      var best = null;
      var bestD = Infinity;
      for (var j = 0; j < S.units.length; j++) {
        var un = S.units[j];
        if (un.dead || un.def.cls !== 'tank' || !un.def.taunt) continue;
        var d2 = S.dist2(un.x, un.y, e.x, e.y);
        if (d2 <= un.def.taunt * un.def.taunt && d2 < bestD) {
          bestD = d2;
          best = un;
        }
      }
      if (best) {
        e.taunted = Math.max(e.taunted, 0.4);
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
        var attacking = un.anim === 'atk' || un.pendingHit >= 0;
        var inRange = findTarget(un);
        var chase = !attacking && !inRange ? nearestEnemy(un, def.aggro || 240) : null;
        var tx = chase ? chase.x : un.homeX;
        var ty = chase ? chase.y : un.homeY;
        var dx = tx - un.x;
        var dy = ty - un.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        // 与 findTarget/命中检查共用中心距口径，不再追到敌人的北侧偏移点。
        var remaining = chase ? Math.max(0, d - (def.range + chase.def.radius)) : d;
        if (!attacking && !inRange && remaining > (chase ? 0 : 4)) {
          selectVerticalRig(un, ty);
          var step = Math.min(remaining, def.moveSpeed * dt);
          un.x += dx / d * step;
          un.y += dy / d * step;
          un.facing = dx >= 0 ? 1 : -1;
          if (un.anim === 'idle' || un.anim === 'move') enterAnimation(un, 'move');
        } else if (un.anim === 'move') {
          enterAnimation(un, 'idle');
        }
        var uu = L.ui;
        un.x = S.clamp(un.x, uu.field.x + def.radius, uu.field.x + uu.field.w - def.radius);
        un.y = S.clamp(un.y, uu.placeTop, uu.placeBottom);
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
            var reach = def.range + tgt.def.radius;
            if (S.dist2(un.x, un.y, tgt.x, tgt.y) <= reach * reach) {
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
      if (un.atkTimer <= 0) {
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
    var target = findHealTarget(healer);
    if (!target) return;
    var healed = Math.min(amount, target.maxHp - target.hp);
    target.hp += healed;
    S.addFloat(target.x, target.y - target.def.radius - 14, '+' + Math.round(healed), '#6ff0a8');
    S.addEffect({
      type: 'heal', sourceUid: healer.uid, targetUid: target.uid,
      x: target.x, y: target.y - target.def.radius * 0.3,
      r: target.def.radius, life: 0.6, max: 0.6, color: '#6ff0a8',
    });
    A.GameAudio && A.GameAudio.play('heal');
  }

  function findHealTarget(healer) {
    var range2 = healer.def.range * healer.def.range;
    var target = null;
    for (var i = 0; i < S.units.length; i++) {
      var ally = S.units[i];
      if (ally === healer || ally.dead || ally.hp <= 0 || ally.hp >= ally.maxHp) continue;
      if (S.dist2(healer.x, healer.y, ally.x, ally.y) > range2) continue;
      // 按当前剩余生命值选择单个目标；同血量按 uid 稳定选择。
      if (!target || ally.hp < target.hp || (ally.hp === target.hp && ally.uid < target.uid)) target = ally;
    }
    return target;
  }

  function nearestEnemy(un, maxRange) {
    var best = null;
    var bestD = maxRange * maxRange;
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.dead) continue;
      var d2 = S.dist2(un.x, un.y, e.x, e.y);
      if (d2 < bestD) { bestD = d2; best = e; }
    }
    return best;
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
    if (def.cls === 'healer' || def.cls === 'tank') return;
    if (def.cls === 'warrior') {
      damageEnemy(best, def.atk, false);
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
      S.addEffect({
        type: 'glow', x: projectile.x, y: projectile.y, r: def.cls === 'archer' ? 7 : 8,
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
            enemyImpactEffect(e, hitUnit);
            S.hitstop = Math.max(S.hitstop, 0.035);
          }
        }
      }

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

      // 三路在底部汇向合照。敌人必须靠近相框本体才可造成伤害。
      var goalX = u.base.x + u.base.w * 0.5;
      var atBase = e.y >= u.baseStopY && Math.abs(e.x - goalX) <= Math.max(16, e.def.radius * 0.55);
      if (atBase && e.def.tier === 'boss') {
        if (e.anim === 'move') enterAnimation(e, 'idle');
        if (e.atkTimer <= 0) {
          e.atkTimer = e.def.interval;
          S.baseHp -= e.def.baseDamage;
          S.shake = Math.max(S.shake, 0.35);
          S.goalHitT = 0.3;
          S.addFloat(goalX, u.base.y - 72, '-' + e.def.baseDamage, '#ff7a8a');
          for (var bi = 0; bi < S.units.length; bi++) {
            var bu = S.units[bi];
            if (bu.dead) continue;
            if (S.dist2(bu.x, bu.y, e.x, e.y) <= 95 * 95) damageUnit(bu, 22);
          }
          A.GameAudio && A.GameAudio.play('base');
        }
      } else if (atBase) {
        if (e.anim === 'move') enterAnimation(e, 'idle');
        e.y = u.baseStopY;
        if (e.atkTimer <= 0) {
          e.atkTimer = e.def.interval;
          S.baseHp -= e.def.baseDamage;
          S.shake = Math.max(S.shake, 0.2);
          S.goalHitT = 0.3;
          S.addFloat(goalX, u.base.y - 72, '-' + e.def.baseDamage, '#ff7a8a');
          A.GameAudio && A.GameAudio.play('base');
        }
      } else if (blocker) {
        if (e.anim === 'move') enterAnimation(e, 'idle');
        if (e.atkTimer <= 0) {
          selectAttackRig(e, blocker);
          e.atkTimer = e.def.interval;
          enterAnimation(e, 'atk');
          e.pendingHit = attackHitTime(e, 0.18);
          e.pendingTarget = blocker.uid;
        }
      } else {
        var sp = e.speed * (e.slowT > 0 ? e.slowFactor : 1);
        if (e.y >= u.baseStopY - 100) {
          var dx = goalX - e.x;
          var stepX = sp * dt * 0.85;
          e.x += S.clamp(dx, -stepX, stepX);
        }
        e.y += sp * dt;
        if (e.y > u.baseStopY) e.y = u.baseStopY;
        if (e.anim === 'idle' || e.anim === 'move') enterAnimation(e, 'move');
      }
      e.x = S.clamp(e.x, u.field.x + e.def.radius, u.field.x + u.field.w - e.def.radius);
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

  function remainingEnemies() {
    return S.enemies.length + S.spawnQueue.length;
  }

  A.Battle = {
    update: update,
    tryDeploy: tryDeploy,
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
})();
