/* 现状：部署、购买与出售；保持原战斗规则。 */
(function () {
  var A = window.AIGCUtils;
  var C = A.Config;
  var S = A.State;
  var L = A.Layout;
  var enterAnimation = A.BattleAnimation.enterAnimation;

  // ---- 部署、购买与出售 ----
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
    var point = findDeployPoint(card, x, y);
    if (!point) return null;
    x = point.x;
    y = point.y;
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
      spentGold: card.cost, // 兼容字段；只记录真实购入价，没有局内饼干升级。
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

  function getUpgradePreview() { return null; }

  function upgradeUnit() { return false; }

  function canSellUnit(unit) {
    return !!(unit && !unit.dead && unit.hp > 0 && unit.def &&
      S.units.indexOf(unit) >= 0 && unit.maxHp > 0 &&
      typeof unit.purchaseCost === 'number' && isFinite(unit.purchaseCost) && unit.purchaseCost >= 0);
  }

  function sellPrice(unit) {
    if (!canSellUnit(unit)) return 0;
    var cost = unit.purchaseCost;
    var ratio = unit.hp / unit.maxHp;
    if (ratio >= 0.6) return Math.floor(cost * 0.5);
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

  function findDeployPoint(card, x, y) {
    var u = L.ui;
    if (!card || !isFinite(x) || !isFinite(y)) return null;
    var left = u.field.x + card.radius + 4;
    var right = u.field.x + u.field.w - card.radius - 4;
    var top = u.placeTop, bottom = u.placeBottom;
    if (left > right || top > bottom) return null;
    x = S.clamp(x, left, right);
    y = S.clamp(y, top, bottom);
    function free(px, py) {
      var groups = [S.units, S.enemies];
      for (var gi = 0; gi < groups.length; gi++) {
        for (var i = 0; i < groups[gi].length; i++) {
          var actor = groups[gi][i];
          if (actor.dead) continue;
          var gap = card.radius + actor.def.radius + C.ACTOR_BODY_GAP + 0.5;
          if (gi === 0) gap = Math.max(C.UNIT_MIN_GAP, gap);
          if (S.dist2(px, py, actor.x, actor.y) < gap * gap) return false;
        }
      }
      return true;
    }
    if (free(x, y)) return { x: x, y: y };
    // 在手指周围小范围吸附；先横向/北侧避让，不移动已有角色或怪物。
    for (var radius = 8; radius <= 72; radius += 8) {
      for (var step = 0; step < 24; step++) {
        var angle = -Math.PI / 2 + step * Math.PI * 2 / 24;
        var px = x + Math.cos(angle) * radius;
        var py = y + Math.sin(angle) * radius;
        if (px < left || px > right || py < top || py > bottom) continue;
        if (free(px, py)) return { x: px, y: py };
      }
    }
    return null;
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
    if (!findDeployPoint(card, x, y)) return 'occupied';
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
    if (reason === 'occupied') {
      S.toastMsg('附近没有可放下的位置', 1.0);
      return false;
    }
    if (reason === 'gold') {
      S.toastMsg('饼干不足', 0.9);
      return false;
    }
    // 死亡动画中的英雄不算占位
    if (reason === 'cap') {
      S.toastMsg('上场席位已满（' + S.heroCap + '），可花饼干扩建', 1.3);
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

  function buyCardAtCenter(index) {
    var slot = S.shop[index];
    if (!slot || slot.sold) return false;
    var u = L.ui;
    var rect = L.shopRect(index);
    var x = u.field.x + u.field.w * 0.5;
    var y = u.placeBottom - 10;
    return buyCard(index, x, y);
  }

  A.BattleDeployment = {
    copyDef: copyDef,
    placeHero: placeHero,
    canAfford: canAfford,
    getUpgradePreview: getUpgradePreview,
    upgradeUnit: upgradeUnit,
    canSellUnit: canSellUnit,
    sellPrice: sellPrice,
    sellUnit: sellUnit,
    findDeployPoint: findDeployPoint,
    deployBlockReason: deployBlockReason,
    tryDeploy: tryDeploy,
    buyCard: buyCard,
    buyCardAtCenter: buyCardAtCenter,
  };
})();
