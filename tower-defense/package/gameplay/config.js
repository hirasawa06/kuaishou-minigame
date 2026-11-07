/* gameplay/config.js — 全部数值：英雄、敌人、波次、金币经济
 * 单位长度：逻辑像素；速度：逻辑像素/秒；时间：秒
 */
(function () {
  var A = window.AIGCUtils;

  var C = {
    // ── 屏幕与区域（竖屏，布局在 layout.js 里按实际尺寸计算）──
    designW: 414,
    designH: 896,
    hudH: 76,
    trayH: 200,
    cardGap: 10,
    cardCount: 4,
    laneCount: 3,

    // ── 经济 ──
    GOLD_START: 30,
    BASE_HP: 100,
    UNIT_CAP_START: 4,      // 初始可上场英雄数
    UNIT_CAP_MAX: 10,       // 上限
    UNIT_CAP_STEP: 1,       // 每次购买 +1
    UNIT_MIN_GAP: 32,

    // 卡池刷新：每次刷新后价格上浮，形成节奏
    REFRESH_COST: 2,
    REFRESH_COST_STEP: 1,
    REFRESH_COST_MAX: 8,
    // 买人口：每次涨价
    CAP_COST: 15,
    CAP_COST_STEP: 10,

    // 清波奖励
    WAVE_GOLD_BONUS: 6,

    // ── 四英雄（卡池随机可重复）──
    // atk: 攻击力  hp: 生命  interval: 攻击间隔(=攻速)  range: 攻击半径
    // moveSpeed: 移动速度（0=驻守）  splash: 群体攻击范围  taunt: 嘲讽范围
    HEROES: [
      {
        id: 'tank', name: '铁盾柴犬', cls: 'tank', clsName: '盾',
        icon: 'unit-tank-1', cost: 8,
        hp: 900, atk: 0, interval: 1.0,
        range: 0, radius: 17, moveSpeed: 0,
        taunt: 96, splash: 0,
        color: '#5b8bd0',
        desc: '嘲讽周围敌人，只会格挡，不造成伤害',
      },
      {
        id: 'war', name: '近战猫', cls: 'warrior', clsName: '战',
        icon: 'unit-war-1', cost: 6,
        hp: 420, atk: 42, interval: 0.8,
        range: 46, radius: 15, moveSpeed: 52,
        taunt: 0, splash: 0,
        aggro: 260,
        color: '#e07a3a',
        desc: '主动出击寻敌，中血量近战输出',
      },
      {
        id: 'arch', name: '游侠猫', cls: 'archer', clsName: '射手',
        icon: 'unit-arch-1', cost: 7,
        hp: 180, atk: 96, interval: 1.15,
        range: 260, radius: 14, moveSpeed: 0,
        taunt: 0, splash: 0,
        color: '#3fbf78',
        desc: '射程最远，血量最少，单体高伤',
      },
      {
        id: 'mage', name: '法师狗', cls: 'mage', clsName: '法师',
        icon: 'unit-mage-1', cost: 9,
        hp: 150, atk: 54, interval: 1.5,
        range: 170, radius: 14, moveSpeed: 0,
        taunt: 0, splash: 70,
        color: '#a583f0',
        desc: '中距离范围伤害，全场血量最少',
      },
    ],

    // ── 敌人四档 ──
    // small 血少量多 / normal 标准 / elite 精英 / boss 首领
    ENEMIES: {
      small: {
        id: 'small', name: '小怪', tier: 'small', icon: 'enemy-small',
        hp: 70, atk: 8, interval: 0.9, speed: 62,
        radius: 11, color: '#8fd06a', baseDamage: 2, gold: 2,
      },
      normal: {
        id: 'normal', name: '普通怪', tier: 'normal', icon: 'enemy-normal',
        hp: 240, atk: 16, interval: 1.0, speed: 38,
        radius: 15, color: '#d9a05a', baseDamage: 4, gold: 5,
      },
      elite: {
        id: 'elite', name: '精英怪', tier: 'elite', icon: 'enemy-elite',
        hp: 900, atk: 34, interval: 1.2, speed: 30,
        radius: 19, color: '#a86fe0', baseDamage: 8, gold: 16,
      },
      boss: {
        id: 'boss', name: '首领', tier: 'boss', icon: 'enemy-boss',
        hp: 4200, atk: 70, interval: 1.35, speed: 21,
        radius: 25, color: '#e04e6e', baseDamage: 14, gold: 60, splash: 90,
      },
    },

    // 每波敌人血量 / 攻击成长
    waveHpScale: 1.13,
    waveAtkScale: 1.08,
    spawnGap: 0.75,
    waveGap: 6.0,
    firstWaveDelay: 5.0,

    // ── 波次表 ──
    // groups: [敌人 id, 数量]
    WAVES: [
      { groups: [['small', 8]] },
      { groups: [['small', 10], ['normal', 3]] },
      { groups: [['normal', 6], ['small', 6]] },
      { groups: [['elite', 1], ['small', 12]] },
      { groups: [['normal', 9], ['elite', 1]] },
      { groups: [['elite', 2], ['small', 14]] },
      { groups: [['normal', 10], ['elite', 2], ['small', 10]] },
      { groups: [['elite', 3], ['normal', 12]] },
      { groups: [['elite', 4], ['small', 16]] },
      { groups: [['boss', 1], ['elite', 3], ['normal', 8]] },
    ],
  };

  C.ENEMY_STOP_PAD = 6;
  C.ENEMY_GUARD_PAD = 46;

  // 兼容旧字段名（部分绘制/校验脚本仍在读）
  C.UNIT_CAP = C.UNIT_CAP_START;

  A.Config = C;
})();
