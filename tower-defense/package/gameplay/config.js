/* gameplay/config.js — 全部数值、卡牌、敌人、波次配置 */
// 单位长度：逻辑像素；速度：逻辑像素/秒；时间：秒
(function () {
  var A = window.AIGCUtils;

  var C = {
    // ── 屏幕与区域（竖屏，布局在 layout.js 里按实际尺寸计算）──
    designW: 414,
    designH: 896,
    hudH: 92,          // 顶部 HUD 高度
    trayH: 186,        // 底部卡牌托盘高度
    energyBarH: 30,    // 能量条高度
    cardGap: 10,
    cardCount: 4,
    laneCount: 3,

    // ── 资源 ──
    ENERGY_MAX: 10,
    ENERGY_START: 5,
    ENERGY_REGEN: 1.25,     // 每秒回复（攒满约 8 秒）
    BASE_HP: 100,
    UNIT_CAP: 11,           // 同时在场上限
    KILL_ENERGY: 0.22,      // 每击杀回能
    UNIT_MIN_GAP: 34,       // 单位部署最小间距
    CARD_SCROLL_SPEED: 26,  // 卡牌传送带左移速度（约 4 秒走完一张卡）
    WAVE_ENERGY_BONUS: 1.0, // 清波回能

    // ── 卡牌（4 类 × 2 种）──
    // range 为对左侧放方向的可攻击半径；speed 为攻击间隔
    CARDS: [
      {
        id: 'tank-a', name: '铁盾卫', cls: 'tank', clsName: '坦克',
        icon: 'unit-tank-1', cost: 4, hp: 700, atk: 24, interval: 1.2,
        range: 74, radius: 17, color: '#5b8bd0', desc: '高血量的前排肉盾',
      },
      {
        id: 'tank-b', name: '石像守卫', cls: 'tank', clsName: '坦克',
        icon: 'unit-tank-2', cost: 6, hp: 1260, atk: 30, interval: 1.5,
        range: 78, radius: 19, color: '#7c92be', desc: '极硬，慢速反击',
      },
      {
        id: 'war-a', name: '剑士', cls: 'warrior', clsName: '战士',
        icon: 'unit-war-1', cost: 3, hp: 350, atk: 38, interval: 0.82,
        range: 62, radius: 15, color: '#e07a3a', desc: '性价比近战输出',
      },
      {
        id: 'war-b', name: '狂战士', cls: 'warrior', clsName: '战士',
        icon: 'unit-war-2', cost: 5, hp: 500, atk: 60, interval: 0.92,
        range: 64, radius: 16, color: '#ff9a4a', desc: '高攻速高爆发',
      },
      {
        id: 'arch-a', name: '弓手', cls: 'archer', clsName: '射手',
        icon: 'unit-arch-1', cost: 3, hp: 190, atk: 33, interval: 0.87,
        range: 230, radius: 14, color: '#46c47a', desc: '远程单体',
      },
      {
        id: 'arch-b', name: '连弩手', cls: 'archer', clsName: '射手',
        icon: 'unit-arch-2', cost: 5, hp: 260, atk: 24, interval: 0.44,
        range: 205, radius: 15, color: '#35a864', desc: '高速连射单体',
      },
      {
        id: 'mage-a', name: '火法师', cls: 'mage', clsName: '法师',
        icon: 'unit-mage-1', cost: 5, hp: 210, atk: 50, interval: 1.6,
        range: 215, radius: 14, color: '#d8623c', splash: 62, desc: '范围伤害',
      },
      {
        id: 'mage-b', name: '冰法师', cls: 'mage', clsName: '法师',
        icon: 'unit-mage-2', cost: 4, hp: 220, atk: 29, interval: 1.38,
        range: 215, radius: 14, color: '#5ab6e8', splash: 58,
        slow: { factor: 0.45, duration: 1.8 }, desc: '范围减速',
      },
    ],

    // ── 敌人 ──
    // guardRange：可攻击我方单位的距离；stopRange：被单位阻挡时停下
    ENEMIES: {
      grunt: {
        id: 'grunt', name: '小怪', icon: 'enemy-grunt',
        hp: 180, atk: 16, interval: 0.95, speed: 38,
        radius: 15, color: '#6fbf6f', baseDamage: 3,
      },
      runner: {
        id: 'runner', name: '疾行兵', icon: 'enemy-runner',
        hp: 115, atk: 11, interval: 0.78, speed: 72,
        radius: 13, color: '#e8c95a', baseDamage: 2,
      },
      brute: {
        id: 'brute', name: '重甲兵', icon: 'enemy-brute',
        hp: 660, atk: 42, interval: 1.28, speed: 28,
        radius: 19, color: '#b06a5a', baseDamage: 5,
      },
      boss: {
        id: 'boss', name: '首领', icon: 'enemy-boss',
        hp: 3000, atk: 82, interval: 1.4, speed: 19,
        radius: 25, color: '#d05a8a', baseDamage: 10, splash: 70,
      },
    },

    // 每波敌人血量 / 攻击成长
    waveHpScale: 1.14,
    waveAtkScale: 1.09,
    spawnGap: 0.85,        // 同一波内刷怪间隔
    waveGap: 5.0,          // 波间准备时间
    firstWaveDelay: 4.0,

    // ── 波次表 ──
    // groups: [敌人 id, 数量]，按顺序生成
    WAVES: [
      { groups: [['grunt', 6]] },
      { groups: [['grunt', 7], ['runner', 4]] },
      { groups: [['grunt', 9], ['runner', 5]] },
      { groups: [['brute', 3], ['grunt', 8]] },
      { groups: [['runner', 8], ['brute', 3], ['grunt', 5]] },
      { groups: [['brute', 5], ['grunt', 10]] },
      { groups: [['runner', 10], ['brute', 4]] },
      { groups: [['grunt', 11], ['brute', 5], ['runner', 5]] },
      { groups: [['brute', 6], ['runner', 9]] },
      { groups: [['boss', 1], ['brute', 3], ['grunt', 7], ['runner', 6]] },
    ],
  };

  // 敌人基础半径与停止距离（与单位半径相加）
  C.ENEMY_STOP_PAD = 6;
  C.ENEMY_GUARD_PAD = 46;

  A.Config = C;
})();
