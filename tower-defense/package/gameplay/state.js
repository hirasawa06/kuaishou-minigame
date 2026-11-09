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
    phase: 'loading',  // loading / menu / playing / paused / win / lose / error
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
    shop: [],          // 4 张随机英雄卡：{ cardId, sold }
    refreshCost: C.REFRESH_COST,
    heroCap: C.UNIT_CAP_START,
    capCost: C.CAP_COST,
    drag: null,
    dragging: null,
    inspect: null,
    inspectT: 0,
    shake: 0,
    hitstop: 0,
    cardsPlaced: 0,
    assetErrors: [],
    ranking: null,     // 排行榜快照（由 Profile.buildRanking 生成）
    runRecorded: false, // 本局是否已计入存档，避免重复记录
    menuPanel: null,
    menuSoundEnabled: true,
    menuPressed: null,
    menuFeedback: null,
    selectedLevel: 1,
    currentLevel: 1,
    levelHpScale: 1,
    levelAtkScale: 1,
    menuSwipe: null,
    menuStartDelay: 0,
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

  // 卡池随机可重复：每次独立抽 4 张
  S.rollShop = function () {
    S.shop = [];
    for (var i = 0; i < C.cardCount; i++) {
      var h = C.HEROES[randInt(C.HEROES.length)];
      S.shop.push({ cardId: h.id, sold: false, born: S.time });
    }
  };

  // 花金币刷新卡池，价格逐次上浮
  S.refreshShop = function () {
    if (S.gold < S.refreshCost) {
      S.toastMsg('金币不足', 0.9);
      return false;
    }
    S.gold -= S.refreshCost;
    S.refreshCost = Math.min(C.REFRESH_COST_MAX, S.refreshCost + C.REFRESH_COST_STEP);
    S.rollShop();
    S.addFloat(S.shopAnchorX || 0, S.shopAnchorY || 0, '刷新 -' + (S.refreshCost - C.REFRESH_COST_STEP), '#ffd166');
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
    S.inspectT = 0;
    S.shake = 0;
    S.hitstop = 0;
    S.drag = null;
    S.dragging = null;
    S.assetErrors.length = 0;
    S.ranking = null;
    S.runRecorded = false;
    S.menuPanel = null;
    S.menuPressed = null;
    S.menuFeedback = null;
    S.menuStartDelay = 0;
    S.rollShop();
  };

  A.State = S;
})();
