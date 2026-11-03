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
    energy: C.ENERGY_START,
    baseHp: C.BASE_HP,
    waveIndex: 0,
    waveState: 'prep',
    waveTimer: C.firstWaveDelay,
    spawnQueue: [],
    spawnTimer: 0,
    kills: 0,
    uid: 1,
    units: [],
    enemies: [],
    projectiles: [],
    effects: [],
    floats: [],
    toast: null,
    slots: [],         // 卡槽：{ cardId, x, entering }
    deck: [],
    dragging: null,
    inspect: null,
    inspectT: 0,
    shake: 0,
    hitstop: 0,
    cardsPlaced: 0,
  };

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = randInt(i + 1);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  S.shuffleDeck = shuffle;

  S.newDeck = function () {
    return shuffle(C.CARDS.slice());
  };

  S.drawCardId = function () {
    if (!S.deck || S.deck.length === 0) S.deck = S.newDeck();
    return S.deck.pop().id;
  };

  S.cardById = function (id) {
    for (var i = 0; i < C.CARDS.length; i++) if (C.CARDS[i].id === id) return C.CARDS[i];
    return null;
  };

  // 初始化卡牌传送带：铺满可视宽度 + 右侧一张待入场
  S.initSlots = function () {
    var L = A.Layout;
    var gap = L.ui.cardGap;
    var w = L.ui.cardW;
    var step = w + gap;
    S.slots.length = 0;
    S.slotSeq = 0;
    var max = Math.ceil(L.ui.cards.w / step) + 1;
    for (var i = 0; i <= max; i++) {
      S.slots.push({
        uid: ++S.slotSeq,
        cardId: S.drawCardId(),
        x: i * step,
        target: i * step,
      });
    }
  };

  S.reflowSlots = function () {
    var L = A.Layout;
    var step = L.ui.cardW + L.ui.cardGap;
    for (var i = 0; i < S.slots.length; i++) {
      S.slots[i].x = i * step;
      S.slots[i].target = i * step;
    }
  };

  S.reset = function () {
    S.phase = 'playing';
    S.time = 0;
    S.energy = C.ENERGY_START;
    S.baseHp = C.BASE_HP;
    S.waveIndex = 0;
    S.waveState = 'prep';
    S.waveTimer = C.firstWaveDelay;
    S.spawnQueue = [];
    S.spawnTimer = 0;
    S.kills = 0;
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
    S.slotSeq = 0;
    S.deck = S.newDeck();
    S.initSlots();
  };

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

  S.randInt = randInt;
  S.rand = rand;
  S.clamp = clamp;
  S.dist2 = dist2;

  A.State = S;
})();
