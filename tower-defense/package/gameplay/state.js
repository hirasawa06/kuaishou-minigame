/* gameplay/state.js — 运行时数据模型与工具函数 */
(function () {
  var A = window.AIGCUtils;
  var C = A.Config;

  function rand(n) { return Math.random() * n; }
  function randInt(n) { return Math.floor(Math.random() * n); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function dist2(ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }

  var S = {
    phase: 'loading',  // loading / menu / playing / paused / win / lose / vfxLab / error
    time: 0,
    gold: C.GOLD_START,
    baseHp: C.BASE_HP,
    waveIndex: 0,
    waveState: 'prep',
    waveTimer: C.firstWaveDelay,
    spawnQueue: [],
    spawnTimer: 0,
    kills: 0,
    goldEarned: 0,
    uid: 1,
    units: [],
    enemies: [],
    projectiles: [],
    effects: [],
    floats: [],
    toast: null,
    shop: [],          // 4 格：{ cardId, star: 1..3, sold, locked, born }
    unlockNotice: [],  // 本局首次突破进度新解锁的英雄 id，保留至 reset
    refreshCost: C.REFRESH_COST,
    heroCap: C.UNIT_CAP_START,
    capCost: C.CAP_COST,
    drag: null,
    dragging: null,
    inspect: null,
    upgradeUnit: null, // 兼容旧角色详情选中字段；不再允许直接金币升级
    inspectT: 0,
    shake: 0,
    goalHitT: 0,
    hitstop: 0,
    cardsPlaced: 0,
    assetErrors: [],
    ranking: null,     // 排行榜快照（由 Profile.buildRanking 生成）
    runRecorded: false, // 本局是否已计入存档，避免重复记录
    menuPanel: null,
    menuSoundEnabled: true,
    menuPressed: null,
    menuFeedback: null,

    shopPressed: null,
    shopFeedback: null,

    battleSpeed: 1,
    selectedLevel: 1,
    currentLevel: 1,
    levelHpScale: 1,
    levelAtkScale: 1,
    menuSwipe: null,
    menuSlide: null,   // 首页选关吸附动画；切换完成后才更新 selectedLevel

    menuStartDelay: 0,
    // 动作场是独立预览状态，不写入对局、波次或玩家存档。
    bossLab: null,
  };

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = randInt(i + 1);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  S.shuffleDeck = shuffle;

  S.heroById = function (id) {
    for (var i = 0; i < C.HEROES.length; i++) if (C.HEROES[i].id === id) return C.HEROES[i];
    return null;
  };

  // 兼容旧调用名
  S.cardById = S.heroById;

  S.wavesForLevel = function (level) {
    return C.wavesForLevel(level === undefined ? S.currentLevel : level);
  };
  S.getWaves = S.wavesForLevel;

  S.isHeroUnlocked = function (id) {
    if (!S.heroById(id)) return false;
    if (A.Profile && typeof A.Profile.isHeroUnlocked === 'function') {
      return A.Profile.isHeroUnlocked(id);
    }
    return C.heroUnlockLevel(id) === 1;
  };

  // 可选引导模块：仅从实际成功的业务路径调用，未接入时完全无影响。
  S.notifyAction = function (action, detail) {
    if (A.Tutorial && typeof A.Tutorial.onAction === 'function') {
      A.Tutorial.onAction(action, detail);
    }
  };

  function validStar(star) {
    return typeof star === 'number' && isFinite(star) &&
      Math.floor(star) === star && star >= 1 && star <= C.HERO_MAX_STAR;
  }

  function copyDef(value) {
    if (!value || typeof value !== 'object') return value;
    var out = Array.isArray(value) ? [] : {};
    for (var key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) out[key] = copyDef(value[key]);
    }
    return out;
  }

  // 属性与购买价格统一从配置母版派生，收藏预览不要求已解锁。
  S.heroAtStar = function (id, star) {
    var base = S.heroById(id);
    if (!base || !validStar(star)) return null;
    var def = copyDef(base);
    var scale = C.HERO_STAR_SCALES[star - 1];
    def.hp = base.hp * scale;
    def.atk = base.atk * scale;
    if (base.heal !== undefined) def.heal = base.heal * scale;
    var speed = C.HERO_STAR_SPEED_SCALES[star - 1];
    var reach = C.HERO_STAR_RANGE_SCALES[star - 1];
    def.interval = base.interval / speed;
    def.range = (base.range || 0) * reach;
    def.taunt = (base.taunt || 0) * reach;
    def.splash = (base.splash || 0) * reach;
    if (base.aggro !== undefined) def.aggro = base.aggro * reach;
    def.cost = base.cost * C.HERO_STAR_COST_SCALES[star - 1];
    def.star = star;
    return def;
  };

  S.shopCost = function (slot) {
    if (!slot || slot.sold || !validStar(slot.star)) return 0;
    var base = S.heroById(slot.cardId);
    return base ? base.cost * C.HERO_STAR_COST_SCALES[slot.star - 1] : 0;
  };

  function shopSlot(index) {
    if (typeof index !== 'number' || Math.floor(index) !== index ||
        index < 0 || index >= C.cardCount) return null;
    var slot = S.shop[index];
    return slot && !slot.sold && validStar(slot.star) &&
      S.isHeroUnlocked(slot.cardId) ? slot : null;
  }

  function lockedSlot(slot) {
    return !!(slot && !slot.sold && slot.locked === true &&
      validStar(slot.star) && S.isHeroUnlocked(slot.cardId));
  }

  S.mergeShopCards = function (sourceIndex, targetIndex) {
    if (S.phase !== 'playing' || sourceIndex === targetIndex) return false;
    var source = shopSlot(sourceIndex), target = shopSlot(targetIndex);
    if (!source || !target || source === target || source.cardId !== target.cardId ||
        source.star !== target.star || target.star >= C.HERO_MAX_STAR) return false;
    var fromStar = target.star;
    target.star++;
    target.born = S.time;
    target.age = 0;
    target.locked = target.locked === true;
    source.cardId = null;
    source.sold = true;
    source.locked = false;
    S.notifyAction('merge', { sourceIndex: sourceIndex, targetIndex: targetIndex,
      cardId: target.cardId, fromStar: fromStar, star: target.star, cost: 0 });
    return true;
  };

  S.toggleShopLock = function (index) {
    if (S.phase !== 'playing') return false;
    var slot = shopSlot(index);
    if (!slot) return false;
    slot.locked = !slot.locked;
    S.notifyAction('lock', { index: index, cardId: slot.cardId,
      star: slot.star, locked: slot.locked });
    return true;
  };

  // 手动刷新才补空位；锁定的任意星级卡保留原槽和原对象，不消耗抽卡随机数。
  S.rollShop = function () {
    var unlocked = [];
    for (var hi = 0; hi < C.HEROES.length; hi++) {
      if (S.isHeroUnlocked(C.HEROES[hi].id)) unlocked.push(C.HEROES[hi]);
    }
    for (var i = 0; i < C.cardCount; i++) {
      if (lockedSlot(S.shop[i])) continue;
      if (!unlocked.length) {
        S.shop[i] = { cardId: null, star: 1, sold: true, locked: false, born: S.time };
        continue;
      }
      var h = unlocked[randInt(unlocked.length)];
      S.shop[i] = { cardId: h.id, star: 1, sold: false, locked: false, born: S.time };
    }
    S.shop.length = C.cardCount;
  };

  // 花金币刷新卡池，价格逐次上浮；全部锁定不扣金币，也不涨刷新费。
  S.refreshShop = function () {
    var allLocked = true;
    for (var i = 0; i < C.cardCount; i++) {
      if (!lockedSlot(S.shop[i])) { allLocked = false; break; }
    }
    if (allLocked) {
      S.toastMsg('卡池已全部锁定', 1.0);
      return false;
    }
    if (S.gold < S.refreshCost) {
      S.toastMsg('金币不足', 0.9);
      return false;
    }
    var paid = S.refreshCost;
    S.gold -= paid;
    S.refreshCost = Math.min(C.REFRESH_COST_MAX, S.refreshCost + C.REFRESH_COST_STEP);
    S.rollShop();
    S.addFloat(S.shopAnchorX || 0, S.shopAnchorY || 0, '刷新 -' + paid, '#ffd166');
    S.notifyAction('refresh', { cost: paid });
    return true;
  };

  S.capUpgradeCost = function () {
    return S.capCost;
  };

  S.buyCap = function () {
    if (S.heroCap >= C.UNIT_CAP_MAX) {
      S.toastMsg('上场席位已满级', 1.0);
      return false;
    }
    if (S.gold < S.capCost) {
      S.toastMsg('金币不足', 0.9);
      return false;
    }
    S.gold -= S.capCost;
    S.heroCap = Math.min(C.UNIT_CAP_MAX, S.heroCap + C.UNIT_CAP_STEP);
    S.capCost += C.CAP_COST_STEP;
    S.toastMsg('上场席位 +' + C.UNIT_CAP_STEP + '，当前 ' + S.heroCap, 1.2);
    S.notifyAction('cap', { heroCap: S.heroCap });
    return true;
  };

  S.liveUnits = function () {
    var n = 0;
    for (var i = 0; i < S.units.length; i++) if (!S.units[i].dead) n++;
    return n;
  };

  S.randInt = randInt;
  S.rand = rand;
  S.clamp = clamp;
  S.dist2 = dist2;

  S.addFloat = function (x, y, text, color) {
    S.floats.push({ x: x, y: y, text: text, color: color || '#ffffff', life: 0.85, max: 0.85 });
    if (S.floats.length > 40) S.floats.shift();
  };

  S.addEffect = function (e) {
    S.effects.push(e);
    if (S.effects.length > 90) S.effects.shift();
  };

  S.toastMsg = function (text, life) {
    S.toast = { text: text, life: life || 1.4, max: life || 1.4 };
  };

  S.reflowSlots = function () {
    // 新版本卡池固定 4 格，不再滚动，这里保留空实现兼容布局热更新
  };

  S.reset = function () {
    S.phase = 'playing';
    S.battleSpeed = 1;
    S.time = 0;
    S.gold = C.GOLD_START;
    S.baseHp = C.BASE_HP;
    S.waveIndex = 0;
    S.waveState = 'prep';
    S.waveTimer = C.firstWaveDelay;
    S.spawnQueue.length = 0;
    S.spawnTimer = 0;
    S.kills = 0;
    S.goldEarned = 0;
    S.heroCap = C.UNIT_CAP_START;
    S.capCost = C.CAP_COST;
    S.refreshCost = C.REFRESH_COST;
    S.cardsPlaced = 0;
    S.uid = 1;
    S.units.length = 0;
    S.enemies.length = 0;
    S.projectiles.length = 0;
    S.effects.length = 0;
    S.floats.length = 0;
    S.toast = null;
    S.inspect = null;
    S.upgradeUnit = null;
    S.inspectT = 0;
    S.shake = 0;
    S.goalHitT = 0;
    S.hitstop = 0;
    S.drag = null;
    S.dragging = null;
    S.assetErrors.length = 0;
    S.ranking = null;
    S.runRecorded = false;
    S.menuPanel = null;
    S.menuPressed = null;
    S.menuFeedback = null;
    S.shopPressed = null;
    S.shopFeedback = null;
    S.menuStartDelay = 0;
    S.unlockNotice = [];
    S.shop.length = 0; // 新局不继承上一局的锁卡。
    S.rollShop();
  };

  A.State = S;
})();
