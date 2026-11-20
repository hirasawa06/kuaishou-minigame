/* gameplay/profile.js — 个人资料、声音设置、关卡进度与持久体力 */
(function () {
  var A = window.AIGCUtils;
  var C = A.Config;

  var KEY = 'td_profile_v1';
  var ID_BASE = 100086;

  // 头像与地区在美术脚本/本地配置里各有一份，这里只保存索引
  var AVATARS = [
    { id: 'av-cat-orange', name: '哈利汪' },
    { id: 'av-bear-cream', name: '柴不破' },
    { id: 'av-rabbit-pink', name: '锤锤喵' },
    { id: 'av-cat-gray', name: '镭射喵' },
    { id: 'av-dog-brown', name: '奶糖喵' },
    { id: 'av-fox-red', name: '台灯小怪' },
    { id: 'av-cat-blue', name: '床头柜怪' },
    { id: 'av-dog-yellow', name: '冰箱Boss' },
    { id: 'av-cat-green', name: '沙发精英' },
  ];

  // 虚拟地区：地区身份统一为中国，切换的是地区内的虚拟小镇
  var REGIONS = [
    {
      id: 'cn',
      name: '中国',
      sub: '全国',
      seed: 'cn-all',
      towns: ['星光小镇', '森林营地', '云朵海湾'],
    },
  ];

  var NICK_DEFAULT = '暖阳小橘';

  var S = {};

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  S.clamp = clamp;

  function nowId() {
    return ID_BASE;
  }

  function readStore() {
    try {
      if (typeof KwaiStorage !== 'undefined' && KwaiStorage.getSync) {
        return KwaiStorage.getSync(KEY);
      }
      if (window.localStorage) {
        var raw = window.localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
      }
    } catch (e) {
      // 读写失败不应打断启动，使用内存默认值
    }
    return null;
  }

  function writeStore(data) {
    try {
      if (typeof KwaiStorage !== 'undefined' && KwaiStorage.setSync) {
        KwaiStorage.setSync(KEY, data);
        return true;
      }
      if (window.localStorage) {
        window.localStorage.setItem(KEY, JSON.stringify(data));
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  }

  function validTimestamp(value) {
    return typeof value === 'number' && isFinite(value) && value >= 0 && value <= 8640000000000000;
  }

  function staminaNow(value) {
    // 恢复使用可持久的 Unix 时间，不使用仅适合单次运行的帧时钟。
    if (validTimestamp(value)) return Math.floor(value);
    var current = Date.now();
    return validTimestamp(current) ? Math.floor(current) : 0;
  }

  // 满时不更新存档时间；下一次扣费重新开始计时，避免每帧写入。
  // 未满保留连续恢复间隔的余数，时钟倒退则等待原时间线追平。
  function refreshStamina(now) {
    var d = S.data;
    var beforeValue = d.stamina;
    var beforeAt = d.lastRecoveryAt;
    if (typeof d.stamina !== 'number' || !isFinite(d.stamina)) {
      d.stamina = C.STAMINA_MAX;
      d.lastRecoveryAt = now;
    } else {
      d.stamina = clamp(Math.floor(d.stamina), 0, C.STAMINA_MAX);
      if (!validTimestamp(d.lastRecoveryAt)) d.lastRecoveryAt = now;
      else d.lastRecoveryAt = Math.floor(d.lastRecoveryAt);
    }
    if (d.stamina < C.STAMINA_MAX && now >= d.lastRecoveryAt) {
      var recovered = Math.floor((now - d.lastRecoveryAt) / C.STAMINA_RECOVERY_MS);
      if (recovered > 0) {
        d.stamina = Math.min(C.STAMINA_MAX, d.stamina + recovered);
        // 恢复满后丢弃剩余时间，不能作为下一次扣费的储备。
        d.lastRecoveryAt = d.stamina === C.STAMINA_MAX ? now :
          d.lastRecoveryAt + recovered * C.STAMINA_RECOVERY_MS;
      }
    }
    return d.stamina !== beforeValue || d.lastRecoveryAt !== beforeAt;
  }

  S.getStaminaSnapshot = function (now) {
    now = staminaNow(now);
    if (refreshStamina(now)) S.save();
    var d = S.data;
    return {
      value: d.stamina,
      max: C.STAMINA_MAX,
      nextRecoveryMs: d.stamina === C.STAMINA_MAX ? 0 :
        Math.max(0, d.lastRecoveryAt + C.STAMINA_RECOVERY_MS - now),
    };
  };

  // 默认每局扣配置费用；非法费用不扣费，失败也会保存已发生的恢复。
  S.consumeStamina = function (cost, now) {
    if (cost === undefined) cost = C.STAMINA_COST;
    if (typeof cost !== 'number' || !isFinite(cost) || cost <= 0 ||
        Math.floor(cost) !== cost || cost > C.STAMINA_MAX) return false;
    now = staminaNow(now);
    var changed = refreshStamina(now);
    var d = S.data;
    if (d.stamina < cost) {
      if (changed) S.save();
      return false;
    }
    if (d.stamina === C.STAMINA_MAX) d.lastRecoveryAt = Math.max(now, d.lastRecoveryAt);
    d.stamina -= cost;
    S.save();
    return true;
  };

  // 广告/其他明确奖励：先结算自然恢复，未满保留余数，满时丢弃储备。
  // 返回实际增加点数；非法参数或已满返回 0。
  S.addStamina = function (amount, now) {
    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0 ||
        Math.floor(amount) !== amount) return 0;
    now = staminaNow(now);
    var changed = refreshStamina(now);
    var d = S.data;
    var added = Math.min(amount, C.STAMINA_MAX - d.stamina);
    if (added > 0) {
      d.stamina += added;
      if (d.stamina === C.STAMINA_MAX) d.lastRecoveryAt = Math.max(now, d.lastRecoveryAt);
    }
    if (changed || added > 0) S.save();
    return added;
  };

  function defaults() {
    return {
      nickname: NICK_DEFAULT,
      avatarIndex: 3,
      id: S.id || nowId(),
      region: 0,
      town: 0,
      music: true,
      sfx: true,
      bestWave: 0,      // 历史最高通关关卡（0 = 尚未通关）
      progressVersion: 2, // 本轮清除旧测试进度；只迁移一次，不反复清空新进度。
      completedLevel: 0, // 独立关卡进度；旧 bestWave 是波次，不能用于解锁
      heroAcquiredAt: {}, // 新获得角色的Unix毫秒时间；旧存档不伪造历史时间。
      encounteredEnemies: {}, // 仅记录实际生成过的怪物。
      tutorialComplete: false,
      tutorialStarComplete: false,
      clears: 0,
      games: 0,
      stamina: C.STAMINA_MAX,
      lastRecoveryAt: staminaNow(), // Unix 毫秒；满体力不积攒额外恢复额度
      bestAt: 0,        // 首次达到 bestWave 的本地时间戳
    };
  }

  S.AVATARS = AVATARS;
  S.REGIONS = REGIONS;
  S.NICK_DEFAULT = NICK_DEFAULT;

  S.data = defaults();

  function load() {
    var stored = readStore();
    // ── 本地预览显式重置：同一请求只执行一次，不影响平台存档 ──
    var location = window.location;
    var local = location && (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
    var request = local && (location.search || '').match(/[?&]resetLocal=([a-zA-Z0-9-]+)/);
    var resetToken = request ? request[1] : '';
    var reset = resetToken && (!stored || stored.localResetRequest !== resetToken);
    if (reset) stored = null;
    var base = defaults();
    if (resetToken) base.localResetRequest = resetToken;
    else if (stored && stored.localResetRequest) base.localResetRequest = stored.localResetRequest;
    if (stored && typeof stored === 'object') {
      if (typeof stored.nickname === 'string') base.nickname = stored.nickname;
      if (typeof stored.avatarIndex === 'number') base.avatarIndex = stored.avatarIndex;
      if (typeof stored.id === 'number' && isFinite(stored.id)) base.id = stored.id;
      if (typeof stored.region === 'number') base.region = stored.region;
      if (typeof stored.town === 'number') base.town = stored.town;
      if (typeof stored.music === 'boolean') base.music = stored.music;
      if (typeof stored.sfx === 'boolean') base.sfx = stored.sfx;
      if (typeof stored.bestWave === 'number') base.bestWave = stored.bestWave;
      if (typeof stored.completedLevel === 'number' && isFinite(stored.completedLevel)) {
        base.completedLevel = clamp(Math.floor(stored.completedLevel), 0, C.LEVELS.length);
      }
      if (typeof stored.tutorialComplete === 'boolean') base.tutorialComplete = stored.tutorialComplete;
      if (typeof stored.tutorialStarComplete === 'boolean') base.tutorialStarComplete = stored.tutorialStarComplete;
      if (typeof stored.clears === 'number') base.clears = stored.clears;
      if (typeof stored.games === 'number') base.games = stored.games;
      if (typeof stored.stamina === 'number' && isFinite(stored.stamina)) {
        base.stamina = clamp(Math.floor(stored.stamina), 0, C.STAMINA_MAX);
        if (validTimestamp(stored.lastRecoveryAt)) base.lastRecoveryAt = Math.floor(stored.lastRecoveryAt);
      }
      if (typeof stored.bestAt === 'number') base.bestAt = stored.bestAt;
      if (stored.encounteredEnemies && typeof stored.encounteredEnemies === 'object') {
        for (var enemyId in C.ENEMIES) {
          if (stored.encounteredEnemies[enemyId] === true) base.encounteredEnemies[enemyId] = true;
        }
      }
      if (stored.heroAcquiredAt && typeof stored.heroAcquiredAt === 'object') {
        for (var ai = 0; ai < C.HEROES.length; ai++) {
          var heroId = C.HEROES[ai].id, acquiredAt = stored.heroAcquiredAt[heroId];
          if (validTimestamp(acquiredAt)) base.heroAcquiredAt[heroId] = Math.floor(acquiredAt);
        }
      }
      if (stored.progressVersion !== 2) {
        base.completedLevel = 0;
        base.heroAcquiredAt = {};
        base.encounteredEnemies = {};
        base.bestWave = 0;
        base.bestAt = 0;
        base.clears = 0;
        base.games = 0;
        base.tutorialComplete = false;
        base.tutorialStarComplete = false;
      }
    }
    base.avatarIndex = clamp(base.avatarIndex | 0, 0, AVATARS.length - 1);
    base.region = clamp(base.region | 0, 0, REGIONS.length - 1);
    base.town = clamp(base.town | 0, 0, REGIONS[base.region].towns.length - 1);
    if (!base.id) base.id = nowId();
    S.data = base;
    var availableAvatars = S.availableAvatarIndices();
    var avatarChanged = availableAvatars.indexOf(base.avatarIndex) < 0;
    if (avatarChanged) base.avatarIndex = availableAvatars[0];
    var staminaChanged = refreshStamina(staminaNow());
    if (!stored || stored.progressVersion !== 2 || staminaChanged || avatarChanged ||
        stored.stamina !== base.stamina || stored.lastRecoveryAt !== base.lastRecoveryAt) writeStore(base);
    return base;
  }

  S.load = load;

  S.save = function () {
    return writeStore(S.data);
  };

  S.avatar = function (index) {
    var i = index === undefined ? S.data.avatarIndex : index;
    return AVATARS[clamp(i | 0, 0, AVATARS.length - 1)];
  };
  S.availableAvatarIndices = function () {
    var heroes = ['mage', 'tank', 'war', 'arch', 'healer'];
    var enemies = { 5: 'small', 6: 'normal', 7: 'boss', 8: 'elite' };
    return [0, 1, 2, 3, 4, 5, 6, 8, 7].filter(function (index) {
      return index < 5 ? S.isHeroUnlocked(heroes[index]) :
        !!(S.data.encounteredEnemies && S.data.encounteredEnemies[enemies[index]]);
    });
  };
  S.recordEnemyEncounter = function (id) {
    if (!C.ENEMIES[id]) return;
    if (!S.data.encounteredEnemies) S.data.encounteredEnemies = {};
    if (S.data.encounteredEnemies[id]) return;
    S.data.encounteredEnemies[id] = true;
    S.save();
  };

  S.regionDef = function () {
    return REGIONS[S.data.region] || REGIONS[0];
  };

  S.regionLabel = function () {
    var r = S.regionDef();
    var towns = r.towns || [];
    return towns[S.data.town] || towns[0] || r.name;
  };

  S.setAvatar = function (index) {
    if (S.availableAvatarIndices().indexOf(index) < 0) return S.data.avatarIndex;
    S.data.avatarIndex = clamp(index | 0, 0, AVATARS.length - 1);
    S.save();
    return S.data.avatarIndex;
  };

  S.setRegion = function (regionIndex) {
    S.data.region = clamp(regionIndex | 0, 0, REGIONS.length - 1);
    S.data.town = 0;
    S.save();
    return S.data.town;
  };

  S.setTown = function (townIndex) {
    var r = S.regionDef();
    S.data.town = clamp(townIndex | 0, 0, (r.towns || []).length - 1);
    S.save();
    return S.data.town;
  };

  S.setMusic = function (on) {
    S.data.music = !!on;
    S.save();
  };

  S.setSfx = function (on) {
    S.data.sfx = !!on;
    S.save();
  };

  S.isLevelUnlocked = function (level) {
    return level >= 1 && level <= C.LEVELS.length && level <= S.data.completedLevel + 1;
  };

  // 英雄解锁完全复用持久关卡进度，不另存可与进度失同步的名单。
  S.isHeroUnlocked = function (id) {
    var required = C.heroUnlockLevel(id);
    return required > 0 && required <= S.data.completedLevel + 1;
  };

  // 一局结束：最高波次独立保留，只有胜利才解锁下一关。
  S.recordRun = function (cleared, won, finalization) {
    // Battle 传同一局的对象：失败先计 games，复活后胜利仅补 clears/进度。
    // 无第三参数的旧调用仍按独立一局记录。
    finalization = finalization || { gamesCounted: false, wonCounted: false };
    var d = S.data;
    var level = A.State ? A.State.currentLevel : 1;
    var previousCompleted = d.completedLevel;
    if (won && S.isLevelUnlocked(level)) {
      d.completedLevel = Math.max(d.completedLevel, level);
    }
    // 只在首次突破完成进度时生成本局提示；重玩、失败与旧存档加载不重放。
    if (A.State && d.completedLevel > previousCompleted) {
      var newlyUnlocked = [];
      for (var hi = 0; hi < C.HEROES.length; hi++) {
        var hero = C.HEROES[hi];
        var required = C.heroUnlockLevel(hero.id);
        if (required > previousCompleted + 1 && required <= d.completedLevel + 1) {
          newlyUnlocked.push(hero.id);
          if (!d.heroAcquiredAt[hero.id]) d.heroAcquiredAt[hero.id] = Date.now();
        }
      }
      A.State.unlockNotice = newlyUnlocked;
    }
    if (!finalization.gamesCounted) {
      d.games += 1;
      finalization.gamesCounted = true;
    }
    if (won && !finalization.wonCounted) {
      d.clears += 1;
      finalization.wonCounted = true;
    }
    if (cleared > d.bestWave) {
      d.bestWave = cleared;
      d.bestAt = Date.now();
    }
    S.save();
  };

  // 模块加载即读取本地存档，后续布局与界面直接使用 S.data
  load();

  A.Profile = S;
})();
