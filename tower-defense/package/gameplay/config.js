/* gameplay/config.js — 全部数值：英雄、敌人、波次、饼干经济
 * 单位长度：逻辑像素；速度：逻辑像素/秒；时间：秒
 */
(function () {
  var A = window.AIGCUtils;

  var C = {
    // ── 屏幕与区域（竖屏，布局在 layout.js 里按实际尺寸计算）──
    designW: 414,
    designH: 896,
    hudH: 52,
    trayH: 200,
    cardGap: 10,
    cardCount: 4,
    laneCount: 3,

    // ── 体力（真实时间毫秒；不受战斗倍速或离线影响）──
    STAMINA_MAX: 30,
    STAMINA_COST: 5,
    STAMINA_RECOVERY_MS: 180000,
    STAMINA_AD_REWARD: 10,
    REVIVE_HP: 50,
    REVIVES_PER_RUN: 1,
    REVIVE_KNOCKBACK: 120,
    REWARDED_TIMEOUT_MS: 120000, // 无回调时只解锁，不推断广告完成

    // ── 经济 ──
    GOLD_START: 20,
    GOLD_START_FIRST_LEVEL: 42, // 一星镭射7 + 扩建15 + 刷新3 + 二星镭射14 + 余留3
    BISCUIT_INTERVAL: 5, // 战斗有效时间秒数，不随倍速加快
    BASE_HP: 100,
    UNIT_CAP_START: 3,      // 初始可上场英雄数
    UNIT_CAP_FIRST_LEVEL: 1, // 第一关初始席位
    UNIT_CAP_MAX: 20,       // 上限
    UNIT_CAP_STEP: 1,       // 每次购买 +1
    UNIT_MIN_GAP: 32,
    // 单位脚底圆形体积之间保留的最小空气缝；只用于移动中的避让，不改攻击距离。
    ACTOR_BODY_GAP: 2,
    ATTACK_DISTANCE_EPSILON: 0.5,
    ATTACK_CHASE_INSET: 1,
    ATTACK_RELEASE_MARGIN: 1,

    // 卡池刷新：每次固定消耗3钱币
    REFRESH_COST: 3,
    // ── 第二关起逐波放开重复，第五波起恢复独立均匀抽卡 ──
    SHOP_REPEAT_WEIGHTS: [0.15, 0.15, 0.4, 0.7],
    // 买人口：每次涨价
    CAP_COST: 15,
    CAP_COST_STEP: 10,

    // 清波奖励
    WAVE_GOLD_BONUS: 6,

    // ── 五英雄（未购买商店卡同名同星两张合成；旧基础数值为 1 星）──
    HERO_MAX_STAR: 3,
    HERO_STAR_SCALES: [1, 1.6, 2.6],
    HERO_STAR_COST_SCALES: [1, 2, 4],
    HERO_STAR_SPEED_SCALES: [1, 1.15, 1.30],
    // ── 主动位移速度：与攻击速度分别配置，驻守角色保持为 0 ──
    HERO_STAR_MOVE_SPEED_SCALES: [1, 1.25, 1.5],
    // ── 三星机制：费用与一、二星行为保持，参数集中用于玩法及收藏 ──
    HERO_THREE_STAR_EFFECTS: {
      tank: { damageReduction: 0.4 },
      war: { attackMultiplier: 1.25, cleaveRatio: 0.5, cleaveRange: 60 },
      arch: { extraShotRatio: 0.5 },
      mage: { echoRatio: 0.5 },
      healer: { healTargets: 2 }
    },
    // ── 收藏数值目录：新属性登记后自动进入档案，消耗固定末行 ──
    HERO_DETAIL_STATS: [
      { key: 'hp', label: '生命' },
      { key: 'atk', label: '攻击', hiddenClass: 'healer' },
      { key: 'heal', label: '治疗量' },
      { key: 'range', label: '攻击距离', healerLabel: '治疗距离' },
      { key: 'taunt', label: '嘲讽范围' },
      { key: 'splash', label: '群攻范围' },
      { key: 'moveSpeed', label: '速度' },
      { key: 'cost', label: '消耗饼干' }
    ],
    HERO_STAR_RANGE_SCALES: [1, 1.10, 1.20],
    // 解锁所需的可进入关卡；以存档 completedLevel + 1 判断，不以当前选关判断。
    HERO_UNLOCK_LEVELS: { war: 1, arch: 1, tank: 2, mage: 2, healer: 3 },
    // atk: 攻击力  hp: 生命  interval: 攻击间隔(=攻速)  range: 攻击半径
    // moveSpeed: 移动速度（0=驻守）  splash: 群体攻击范围  taunt: 嘲讽范围
    HEROES: [
      {
        id: 'tank', name: '柴不破', cls: 'tank', clsName: '守卫',
        icon: 'tank-back-idle', cost: 8,
        // 体型扩大后的承伤补偿：生命与整体尺寸同为上一版的 1.2 倍。
        hp: 1080, atk: 0, interval: 1.0,
        // 逻辑直径 45.6；仅决定脚底占地、部署和阻挡，不随盾牌外沿变化。
        range: 0, radius: 22.8, moveSpeed: 0,
        taunt: 115.2, splash: 0,
        color: '#5b8bd0',
        desc: '嘲讽周围敌人，只会格挡，不造成伤害',
      },
      {
        id: 'war', name: '锤锤喵', cls: 'warrior', clsName: '战士',
        icon: 'war-front-idle', cost: 6,
        // 体型扩大后的承伤与输出补偿。
        hp: 504, atk: 50.4, interval: 0.8,
        // 逻辑直径 43.2；攻击与追击距离同步扩大 1.2 倍。
        range: 44.16, radius: 21.6, moveSpeed: 52,
        taunt: 0, splash: 0,
        aggro: 312,
        directionRig: { front: 'war-front', back: 'war-back' },
        color: '#e07a3a',
        desc: '主动出击寻敌，中血量近战输出',
      },
      {
        id: 'arch', name: '镭射喵', cls: 'archer', clsName: '射手',
        icon: 'arch-back-idle', cost: 7,
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
        id: 'mage', name: '哈利汪', cls: 'mage', clsName: '法师',
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
        id: 'healer', name: '奶糖喵', cls: 'healer', clsName: '回复',
        icon: 'healer-back-idle', cost: 8,
        hp: 288, atk: 0, interval: 2.0,
        range: 168, radius: 20.4, moveSpeed: 0,
        heal: 36, taunt: 0, splash: 0,
        color: '#79dcb5',
        desc: '每两秒单体治疗范围内剩余生命最低的受伤队友',
      },
    ],

    // ── 敌人四档 ──
    // small 血少量多 / normal 标准 / elite 精英 / boss 首领
    ENEMIES: {
      small: {
        id: 'small', name: '台灯小怪', tier: 'small', icon: 'enemy-small',
        hp: 77, atk: 10, interval: 0.9, speed: 62,
        radius: 11, color: '#8fd06a', baseDamage: 2, gold: 1, goldMax: 2,
        attackEffect: 'bump', impactColor: '#ffd27a',
      },
      normal: {
        id: 'normal', name: '床头柜怪', tier: 'normal', species: 'bedside-table', icon: 'enemy-normal',
        hp: 262, atk: 18, interval: 1.0, speed: 38,
        radius: 15, color: '#d9a05a', baseDamage: 4, gold: 6,
        attackEffect: 'bump', impactColor: '#ffd27a', hitReaction: 'none',
      },
      elite: {
        id: 'elite', name: '沙发精英', tier: 'elite', species: 'sofa', icon: 'enemy-elite',
        hp: 983, atk: 39, interval: 1.2, speed: 30,
        radius: 19, color: '#c58ad9', baseDamage: 8, gold: 12,
        attackEffect: 'bump', impactColor: '#e4a878',
      },
      boss: {
        id: 'boss', name: '双开门冰箱怪', tier: 'boss', species: 'double-door-fridge', icon: 'enemy-boss',
        hp: 4200, atk: 70, interval: 1.35, speed: 21,
        radius: 25, color: '#e04e6e', baseDamage: 14, gold: 60, splash: 90,
      },
    },

    // 每波敌人血量 / 攻击成长
    waveHpScale: 1.13,
    waveAtkScale: 1.08,
    spawnBatchMin: 1,
    spawnBatchMax: 3,
    spawnBatchGap: 1.5,
    waveGap: 6.0,
    firstWaveDelay: 5.0,

    // 用户确认的冰箱砸地：三帧共享冰裂圆心，末帧残光渐隐。
    BOSS_IMPACT: { src: 'res/Image/ingame/effects/boss-ground-impact.png?v=1',
      cell: 256, frames: 3, timeline: [0, 0.10, 0.30], duration: 0.70, drawSize: 260,
      offsetYRatio: 0.08 },

    // 十个独立关卡：首关五波，其余十波；名称与倍率为首轮可调数值。
    LEVELS: [
      { name: '新手引导', hpScale: 1.00, atkScale: 1.00, map: 'grass', guardian: 'photo', guardianName: '主人合照' },
      { name: '沙发防线', hpScale: 1.08, atkScale: 1.05, map: 'carpet', guardian: 'toy', guardianName: '宠物玩具' },
      { name: '窗边警报', hpScale: 1.16, atkScale: 1.10, map: 'wood', guardian: 'photo', guardianName: '合照' },
      { name: '地毯守卫', hpScale: 1.24, atkScale: 1.15, map: 'carpet', guardian: 'photo', guardianName: '合照' },
      { name: '书柜反击', hpScale: 1.32, atkScale: 1.20, map: 'wood', guardian: 'bed', guardianName: '宠物的窝' },
      { name: '餐厅危机', hpScale: 1.40, atkScale: 1.25, map: 'dining', guardian: 'food', guardianName: '宠物粮' },
      { name: '走廊突围', hpScale: 1.48, atkScale: 1.30, map: 'corridor', guardian: 'toy', guardianName: '宠物玩具' },
      { name: '卧室保卫', hpScale: 1.56, atkScale: 1.35, map: 'wood', guardian: 'bed', guardianName: '宠物的窝' },
      { name: '家具围攻', hpScale: 1.64, atkScale: 1.40, map: 'corridor', guardian: 'toy', guardianName: '宠物玩具' },
      { name: '家园决战', hpScale: 1.72, atkScale: 1.45, map: 'grass', guardian: 'photo', guardianName: '合照' },
    ],

    // ── 波次表 ──
    // groups: [敌人 id, 数量]
    WAVES: [
      { groups: [['small', 8]] },
      { groups: [['small', 8], ['normal', 2]] },
      { groups: [['normal', 6], ['small', 6]] },
      { groups: [['elite', 1], ['small', 13]] },
      { groups: [['normal', 15], ['elite', 1]] },
      { groups: [['elite', 2], ['small', 12], ['normal', 4]] },
      { groups: [['normal', 10], ['elite', 2], ['small', 8]] },
      { groups: [['boss', 1], ['elite', 3], ['normal', 10], ['small', 8]] },
    ],
  };

  // 旧绘制读取等级字段时也使用新星级数值；不再提供饼干升级规则。
  C.HERO_MAX_LEVEL = C.HERO_MAX_STAR;
  C.HERO_LEVEL_SCALES = C.HERO_STAR_SCALES;

  // 静态 WAVES 为八波母表；战斗与绘制必须使用按关卡查询接口。
  // 首关只出现台灯和床头柜，沙发精英从后续关卡开始出现。
  var firstLevelWaves = [
    { groups: [['small', 8]] },
    { groups: [['small', 10], ['normal', 3]] },
    { groups: [['normal', 6], ['small', 6]] },
    { groups: [['small', 12]] },
    { groups: [['normal', 9]] }
  ];
  C.LEVELS.forEach(function (level) { level.hpScale = 1; level.atkScale = 1; });
  C.wavesForLevel = function (level) {
    if (level === 1) return firstLevelWaves;
    var extra = Math.max(0, Math.min(C.LEVELS.length, level || 2) - 2);
    return C.WAVES.map(function (wave, index) {
      var groups = wave.groups.map(function (group) {
        return [group[0] === 'boss' && level !== 5 && level !== 10 ? 'normal' : group[0], group[1]];
      });
      var target = groups.filter(function (group) { return group[0] === 'small'; })[0] ||
        groups.filter(function (group) { return group[0] === 'normal'; })[0];
      // 每关总量增加10只，均匀分配到8波，后段承担余量。
      var waveExtra = index >= 6 ? 2 : 1;
      target[1] += extra * waveExtra;
      return { groups: groups };
    });
  };
  C.heroUnlockLevel = function (id) {
    return C.HERO_UNLOCK_LEVELS[id] || 0;
  };
  for (var hi = 0; hi < C.HEROES.length; hi++) {
    C.HEROES[hi].unlockLevel = C.heroUnlockLevel(C.HEROES[hi].id);
  }

  C.ENEMY_STOP_PAD = 6;
  C.ENEMY_GUARD_PAD = 46;

  // 兼容旧字段名（部分绘制/校验脚本仍在读）
  C.UNIT_CAP = C.UNIT_CAP_START;

  A.Config = C;
})();
