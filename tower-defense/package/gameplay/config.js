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
    // 单位脚底圆形体积之间保留的最小空气缝；只用于移动中的避让，不改攻击距离。
    ACTOR_BODY_GAP: 2,

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
        id: 'tank', name: '柴不破', cls: 'tank', clsName: '盾',
        icon: 'unit-tank-1', cost: 8,
        // 体型扩大后的承伤补偿：生命与整体尺寸同为上一版的 1.2 倍。
        hp: 1080, atk: 0, interval: 1.0,
        // 逻辑直径 45.6；仅决定脚底占地、部署和阻挡，不随盾牌外沿变化。
        range: 0, radius: 22.8, moveSpeed: 0,
        taunt: 115.2, splash: 0,
        color: '#5b8bd0',
        desc: '嘲讽周围敌人，只会格挡，不造成伤害',
      },
      {
        id: 'war', name: '锤锤喵', cls: 'warrior', clsName: '战',
        icon: 'war-front-idle', cost: 6,
        // 体型扩大后的承伤与输出补偿。
        hp: 504, atk: 50.4, interval: 0.8,
        // 逻辑直径 43.2；攻击与追击距离同步扩大 1.2 倍。
        range: 55.2, radius: 21.6, moveSpeed: 52,
        taunt: 0, splash: 0,
        aggro: 312,
        directionRig: { front: 'war-front', back: 'war-back' },
        color: '#e07a3a',
        desc: '主动出击寻敌，中血量近战输出',
      },
      {
        id: 'arch', name: '镭射喵', cls: 'archer', clsName: '射手',
        icon: 'unit-arch-1', cost: 7,
        // 体型扩大后的承伤与输出补偿。
        hp: 216, atk: 115.2, interval: 1.15,
        // 逻辑直径 40.8；攻击距离同步扩大 1.2 倍。
        range: 312, radius: 20.4, moveSpeed: 0,
        taunt: 0, splash: 0,
        attackRig: { left: 'arch-left', right: 'arch-right' },
        color: '#3fbf78',
        desc: '射程最远，血量最少，单体高伤',
      },
      {
        id: 'mage', name: '哈利边牧', cls: 'mage', clsName: '法师',
        icon: 'mage-back-idle', cost: 9,
        // 体型扩大后的承伤与输出补偿。
        hp: 180, atk: 64.8, interval: 1.5,
        // 逻辑直径 40.8；攻击与范围伤害同步扩大 1.2 倍。
        range: 204, radius: 20.4, moveSpeed: 0,
        taunt: 0, splash: 84,
        color: '#a583f0',
        desc: '中距离范围伤害，全场血量最少',
      },
      {
        id: 'healer', name: '奶糖喵', cls: 'healer', clsName: '治疗',
        icon: 'ui-heart', cost: 8,
        hp: 288, atk: 0, interval: 2.0,
        range: 168, radius: 20.4, moveSpeed: 0,
        heal: 36, taunt: 0, splash: 0,
        color: '#79dcb5',
        desc: '每两秒为范围内受伤队友恢复生命，不攻击',
      },
    ],

    // ── 敌人四档 ──
    // small 血少量多 / normal 标准 / elite 精英 / boss 首领
    ENEMIES: {
      small: {
        id: 'small', name: '台灯小怪', tier: 'small', icon: 'enemy-small',
        hp: 70, atk: 8, interval: 0.9, speed: 62,
        radius: 11, color: '#8fd06a', baseDamage: 2, gold: 2,
        attackEffect: 'bump', impactColor: '#ffd27a',
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

    // 十个独立关卡，各自包含下方十波；名称与倍率为首轮可调数值。
    LEVELS: [
      { name: '客厅初战', hpScale: 1.00, atkScale: 1.00 },
      { name: '沙发防线', hpScale: 1.08, atkScale: 1.05 },
      { name: '窗边警报', hpScale: 1.16, atkScale: 1.10 },
      { name: '地毯守卫', hpScale: 1.24, atkScale: 1.15 },
      { name: '书柜反击', hpScale: 1.32, atkScale: 1.20 },
      { name: '餐厅危机', hpScale: 1.40, atkScale: 1.25 },
      { name: '走廊突围', hpScale: 1.48, atkScale: 1.30 },
      { name: '卧室保卫', hpScale: 1.56, atkScale: 1.35 },
      { name: '家具围攻', hpScale: 1.64, atkScale: 1.40 },
      { name: '家园决战', hpScale: 1.72, atkScale: 1.45 },
    ],

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
