/* gameplay/profile.js — 个人资料、设置开关与虚拟地区排行榜
 *
 * 单机版本没有服务端，排行榜使用「按地区 id 稳定播种」的虚拟榜单：
 * 同一地区每次打开的顺序、关卡数和昵称都一致，不读取定位、不对应真实玩家。
 * 玩家自己的名次按最高通关关卡计算，固定贴在榜单下方。
 */
(function () {
  var A = window.AIGCUtils;
  var C = A.Config;

  var KEY = 'td_profile_v1';
  var ID_BASE = 100086;

  // 头像与地区在美术脚本/本地配置里各有一份，这里只保存索引
  var AVATARS = [
    { id: 'av-cat-orange', name: '哈利边牧' },
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
  var NICK_MIN = 2;
  var NICK_MAX = 8;

  var VIRTUAL_NAMES = [
    '奶油气泡', '柚柚不困', '南瓜灯灯', '毛豆先生', '星星糖', '小熊软糖',
    '橘子汽水', '阿柴同学', '米粒团团', '茶茶子', '呼噜呼噜', '汤圆儿',
    '树莓奶昔', '小笼包', '布丁汪汪', '爪爪印', '年糕团子', '豆腐脑',
    '麦麦', '糖霜面包', '锅巴脆脆', '栗子球', '小棕帽', '咕噜喵',
  ];

  var VIRTUAL_TOP = [
    { name: '月亮团子', avatar: 7 },
    { name: '奶油队长', avatar: 1 },
    { name: '熊猫阿布', avatar: 3 },
  ];

  var S = {};

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  S.clamp = clamp;

  function nowId() {
    return ID_BASE;
  }

  // 稳定哈希：同一字符串永远得到同一个 32 位种子
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
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

  function defaults() {
    return {
      nickname: NICK_DEFAULT,
      avatarIndex: 0,
      id: S.id || nowId(),
      region: 0,
      town: 0,
      music: true,
      sfx: true,
      bestWave: 0,      // 历史最高通关关卡（0 = 尚未通关）
      progressVersion: 2, // 本轮清除旧测试进度；只迁移一次，不反复清空新进度。
      completedLevel: 0, // 独立关卡进度；旧 bestWave 是波次，不能用于解锁
      tutorialComplete: false,
      tutorialStarComplete: false,
      clears: 0,
      games: 0,
      bestAt: 0,        // 首次达到 bestWave 的本地时间戳
    };
  }

  S.AVATARS = AVATARS;
  S.REGIONS = REGIONS;
  S.NICK_MIN = NICK_MIN;
  S.NICK_MAX = NICK_MAX;
  S.NICK_DEFAULT = NICK_DEFAULT;

  S.data = defaults();

  function load() {
    var stored = readStore();
    var base = defaults();
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
      if (typeof stored.bestAt === 'number') base.bestAt = stored.bestAt;
      if (stored.progressVersion !== 2) {
        base.completedLevel = 0;
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
    if (stored && stored.progressVersion !== 2) writeStore(base);
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

  S.regionDef = function () {
    return REGIONS[S.data.region] || REGIONS[0];
  };

  S.regionLabel = function () {
    var r = S.regionDef();
    var towns = r.towns || [];
    return towns[S.data.town] || towns[0] || r.name;
  };

  // 昵称清洗：去掉首尾空白，只保留中文 / 字母 / 数字，最长 8 个 Unicode 字符
  S.cleanNickname = function (raw) {
    var str = typeof raw === 'string' ? raw : '';
    str = str.replace(/[\s　]+/g, ' ');
    str = str.replace(/^\s+|\s+$/g, '');
    str = str.replace(/[^一-龥A-Za-z0-9]/g, '');
    var out = '';
    var n = 0;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charAt(i);
      out += ch;
      n++;
      if (n >= NICK_MAX) break;
    }
    return out;
  };

  // 校验返回 { ok, reason, value }，界面按 reason 给提示
  S.validateNickname = function (raw) {
    var value = S.cleanNickname(raw);
    if (!value) return { ok: false, reason: 'empty', value: value };
    var len = 0;
    for (var i = 0; i < value.length; i++) len++;
    if (len < NICK_MIN) return { ok: false, reason: 'short', value: value };
    return { ok: true, reason: '', value: value };
  };

  S.setNickname = function (raw) {
    var res = S.validateNickname(raw);
    if (!res.ok) return res;
    S.data.nickname = res.value;
    S.save();
    return res;
  };

  S.setAvatar = function (index) {
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
  S.recordRun = function (cleared, won) {
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
        }
      }
      A.State.unlockNotice = newlyUnlocked;
    }
    d.games += 1;
    if (won) d.clears += 1;
    if (cleared > d.bestWave) {
      d.bestWave = cleared;
      d.bestAt = Date.now();
    }
    S.save();
  };

  // ── 虚拟榜单 ────────────────────────────────────────────────
  // 每个地区用固定种子生成固定名次，不随时间/设备变化；
  // 名次分数按地区档位 + 递减噪声生成，保证降序且区间稳定。
  S.buildRanking = function () {
    var region = S.regionDef();
    var seed = hash(region.seed + '|' + S.regionLabel());
    var rnd = mulberry(seed);
    var list = [];
    var seen = {};
    var topWave = 40;
    var i;
    for (i = 0; i < VIRTUAL_TOP.length; i++) {
      var t = VIRTUAL_TOP[i];
      var wave = topWave - i * 2 - Math.floor(rnd() * 2);
      list.push({
        name: t.name, avatar: t.avatar, wave: wave,
        mine: false,
        tie: 0,
      });
      seen[t.name] = true;
    }
    var pool = VIRTUAL_NAMES.slice();
    // 用地区种子稳定洗牌，避免不同地区出现完全相同的顺序
    for (i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    var waveCursor = topWave - VIRTUAL_TOP.length * 2;
    for (i = 0; i < pool.length; i++) {
      var name = pool[i];
      if (seen[name]) continue;
      waveCursor -= 1 + Math.floor(rnd() * 3);
      if (waveCursor < 6) break;
      list.push({
        name: name,
        avatar: Math.floor(rnd() * AVATARS.length),
        wave: waveCursor,
        mine: false,
        tie: 0,
      });
      seen[name] = true;
      if (list.length >= 15) break;
    }
    list.sort(function (a, b) { return b.wave - a.wave; });
    for (i = 0; i < list.length; i++) list[i].rank = i + 1;

    var d = S.data;
    var mineWave = d.bestWave || 0;
    var myRank = 0;
    if (mineWave > 0) {
      for (i = 0; i < list.length; i++) {
        if (mineWave >= list[i].wave) { myRank = i + 1; break; }
      }
      if (!myRank) myRank = list.length + 1;
    }
    return {
      region: region,
      town: S.regionLabel(),
      list: list,
      mineWave: mineWave,
      myRank: myRank,
      onBoard: mineWave > 0,
      nickname: d.nickname,
      avatar: d.avatarIndex,
    };
  };

  // 模块加载即读取本地存档，后续布局与界面直接使用 S.data
  load();

  A.Profile = S;
})();
