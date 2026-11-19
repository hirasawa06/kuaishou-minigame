/* gameplay/anim/defs.js — 单位关键帧动画表
 *
 * pivot：分件锚点在单元格内的归一化坐标（0~1），旋转围绕它进行。
 * 时间单位：秒；rot 单位：度；dx/dy 单位：逻辑像素（随 size 缩放会更稳，这里按 40px 视觉尺寸调）。
 */
(function () {
  var A = window.AIGCUtils;
  var archSpec = A.CharacterAnimations.arch;
  var tankSpec = A.CharacterAnimations.tank;
  var lampSpec = A.CharacterAnimations.lamp;
  var normalSpec = A.CharacterAnimations.normal;
  var warSpec = A.CharacterAnimations.war;
  var mageSpec = A.CharacterAnimations.mage;
  var healerSpec = A.CharacterAnimations.healer;
  var eliteSpec = A.CharacterAnimations.elite;
  var bossSpec = A.CharacterAnimations.boss;

  // 柴不破：战场与卡牌统一使用背视完整姿势帧。
  var shiba = {
    // 22.8 * 3.05 * 0.863 ≈ 60：按整体 1.2 倍放大后的贴图上限。
    scale: 0.863,
    parts: [
      { icon: tankSpec.frames.idle, pivot: [0.50, 0.88] },
    ],
    states: {
      // 待机：呼吸（身体轻微上下 + 纵向缩放），盾牌滞后半拍
      idle: {
        dur: 2.4, loop: true, ease: 'inOutSine',
        keys: [
          { t: 0.0, mods: [{ icon: tankSpec.frames.idle, dy: 0, sy: 1.00 }] },
          { t: 1.2, mods: [{ icon: tankSpec.frames.idle, dy: -1.1, sy: 1.022, sx: 0.994 }] },
          { t: 2.4, mods: [{ icon: tankSpec.frames.idle, dy: 0, sy: 1.00 }] },
        ],
      },
      // 受击：完整背面姿势配合轻微位移；不缩放，避免出现“压扁”观感。
      hurt: {
        dur: tankSpec.states.hurt.duration, ease: 'outQuad',
        keys: [
          { t: 0.00, mods: [{ icon: tankSpec.frames.idle, alpha: 1 }] },
          // 向镜头方向轻退并失衡：保持原体积，不做“受击被压扁”的夸张形变。
          { t: 0.065, mods: [{ icon: tankSpec.frames.hurt, alpha: 1, dy: 1.8, rot: -1.5 }] },
          { t: 0.17, mods: [{ icon: tankSpec.frames.hurt, alpha: 1, dy: 3.6, rot: -3.0 }] },
          { t: 0.27, mods: [{ icon: tankSpec.frames.idle, alpha: 1, dy: 1.2, rot: -1.0 }] },
          { t: tankSpec.states.hurt.duration, mods: [{ icon: tankSpec.frames.idle, alpha: 1, dy: 0, sx: 1, sy: 1, rot: 0 }] },
        ],
      },
      // 晕倒：面朝上、头朝战场南侧，保持姿势直到通用烟雾接管；不渐隐。
      die: {
        dur: tankSpec.states.die.duration, ease: 'inQuad',
        keys: [
          { t: 0.00, mods: [{ icon: tankSpec.frames.idle, alpha: 1 }] },
          { t: 0.13, mods: [{ icon: tankSpec.frames.defeat, alpha: 1, dy: 2.4 }] },
          { t: tankSpec.states.die.duration, mods: [{ icon: tankSpec.frames.defeat, alpha: 1, dy: 2.4 }] },
        ],
      },
    },
  };

  // -- 射手猫背面 ------------------------------------------------
  // 完整姿势帧只负责角色，飞行光弹仍由战斗层绘制。
  function archerBack(side) {
    var frames = archSpec.frames;
    var states = archSpec.states;
    var direction = states.attack.directions[side];
    var fireIcon = frames[direction.frame];
    return {
      // 20.4 * 3.05 * 0.887 ≈ 55.2。
      scale: 0.887,
      muzzle: direction.muzzle,
      parts: [
        { icon: frames.idle, pivot: [0.50, 0.88] },
      ],
      states: {
        idle: {
          dur: states.idle.duration, loop: true, ease: 'inOutSine',
          keys: [
            { t: 0.0, mods: [{ icon: frames.idle, dy: 0, sy: 1.00 }] },
            { t: states.idle.duration / 2, mods: [{ icon: frames.idle, dy: -0.8, sy: 1.018, sx: 0.994 }] },
            { t: states.idle.duration, mods: [{ icon: frames.idle, dy: 0, sy: 1.00 }] },
          ],
        },
        // 小幅瞄准 -> 独立开火姿势 -> 小幅后坐 -> 回到待机。
        atk: {
          dur: states.attack.duration, ease: 'outQuad', hit: states.attack.hit,
          keys: [
            { t: 0.00, mods: [{ icon: frames.idle, dx: 0, dy: 0, rot: 0 }] },
            { t: 0.10, mods: [{ icon: frames.aim, dx: -0.35, dy: 0.35, rot: -0.8, sy: 0.99 }] },
            { t: states.attack.hit, mods: [{ icon: fireIcon, dx: 0.45, dy: -0.45, rot: 0.8, sx: 1.01 }] },
            { t: 0.18, mods: [{ icon: fireIcon, dx: 0.30, dy: -0.25, rot: 0.5, sx: 1.005 }] },
            { t: 0.26, mods: [{ icon: frames.recoil, dx: -0.65, dy: 0.55, rot: -1.2, sy: 0.985 }] },
            { t: states.attack.duration, mods: [{ icon: frames.idle, dx: 0, dy: 0, rot: 0, sy: 1 }] },
          ],
        },
        hurt: {
          dur: states.hurt.duration, ease: 'outQuad',
          keys: [
            { t: 0.00, mods: [{ icon: frames.idle, dy: 0, rot: 0 }] },
            { t: 0.06, mods: [{ icon: frames.idle, dy: 2.0, rot: 4, sy: 0.95 }] },
            { t: states.hurt.duration, mods: [{ icon: frames.idle, dy: 0, rot: 0, sy: 1 }] },
          ],
        },
        die: {
          dur: states.die.duration, ease: 'inQuad',
          keys: [
            { t: 0.00, mods: [{ icon: frames.idle, alpha: 1, sy: 1, dy: 0, rot: 0 }] },
            { t: 0.12, mods: [{ icon: frames.idle, alpha: 1, sy: 0.94, dy: 2.2, rot: 3 }] },
            { t: 0.28, mods: [{ icon: frames[states.die.frame], alpha: 1, sy: 1, dy: 3.5, rot: 0 }] },
            { t: states.die.duration, mods: [{ icon: frames[states.die.frame], alpha: 1, sy: 1, dy: 3.5, rot: 0 }] },
          ],
        },
      },
    };
  }

  var archerLeft = archerBack('left');
  var archerRight = archerBack('right');

  // 台灯小怪：移动时以跳步向基地推进，攻击由灯罩前撞完成。
  var lampMinion = {
    scale: 1.08,
    parts: [
      { icon: lampSpec.frames.idle, pivot: [0.50, 0.89] },
    ],
    states: {
      idle: {
        dur: lampSpec.states.idle.duration, loop: true, ease: 'inOutSine',
        keys: [
          { t: 0.00, mods: [{ icon: lampSpec.frames.idle, dy: 0, sy: 1.00 }] },
          { t: 0.60, mods: [{ icon: lampSpec.frames.idle, dy: -0.8, sy: 1.016, sx: 0.994 }] },
          { t: lampSpec.states.idle.duration, mods: [{ icon: lampSpec.frames.idle, dy: 0, sy: 1.00 }] },
        ],
      },
      move: {
        dur: lampSpec.states.move.duration, loop: true, ease: 'outQuad',
        keys: [
          { t: 0.00, mods: [{ icon: lampSpec.frames.idle, dy: 0, sy: 1.00 }] },
          { t: 0.12, mods: [{ icon: lampSpec.frames.hop, dy: -5.2, sy: 0.97, sx: 1.03 }] },
          { t: 0.30, mods: [{ icon: lampSpec.frames.hop, dy: -2.8, sy: 1.00, sx: 1.00 }] },
          { t: lampSpec.states.move.duration, mods: [{ icon: lampSpec.frames.idle, dy: 0, sy: 1.00, sx: 1.00 }] },
        ],
      },
      atk: {
        dur: lampSpec.states.attack.duration, ease: 'inOutSine', hit: lampSpec.states.attack.hit,
        keys: [
          { t: 0.00, mods: [{ icon: lampSpec.frames.idle, dy: 0, rot: 0 }] },
          { t: 0.12, mods: [{ icon: lampSpec.frames.windup, dy: -1.2, rot: -2.5, sx: 0.99 }] },
          { t: lampSpec.states.attack.hit, mods: [{ icon: lampSpec.frames.impact, dy: 3.1, rot: 1.5, sx: 1.03 }] },
          { t: 0.31, mods: [{ icon: lampSpec.frames.impact, dy: 1.0, rot: 0.5, sx: 1.01 }] },
          { t: lampSpec.states.attack.duration, mods: [{ icon: lampSpec.frames.idle, dy: 0, rot: 0, sx: 1 }] },
        ],
      },
      hurt: {
        dur: lampSpec.states.hurt.duration, ease: 'outQuad',
        keys: [
          { t: 0.00, mods: [{ icon: lampSpec.frames.idle, dy: 0, rot: 0 }] },
          { t: 0.10, mods: [{ icon: lampSpec.frames.hurt, dy: 2.2, rot: -3.0, sx: 1.01 }] },
          { t: lampSpec.states.hurt.duration, mods: [{ icon: lampSpec.frames.idle, dy: 0, rot: 0, sx: 1 }] },
        ],
      },
      die: {
        dur: lampSpec.states.die.duration, ease: 'inQuad',
        keys: [
          { t: 0.00, mods: [{ icon: lampSpec.frames.idle, alpha: 1, dy: 0 }] },
          { t: 0.18, mods: [{ icon: lampSpec.frames.defeat, alpha: 1, dy: 3.0 }] },
          { t: lampSpec.states.die.duration, mods: [{ icon: lampSpec.frames.defeat, alpha: 1, dy: 3.0 }] },
        ],
      },
    },
  };

  // 床头柜普通怪：移动帧按待机的 86% 绘制，受击保持待机，不额外播放动效。
  var bedsideNormal = {
    scale: 1.30,
    parts: [{ icon: normalSpec.frames.idle, pivot: [0.50, 0.88] }],
    states: {
      idle: {
        dur: normalSpec.states.idle.duration, loop: true, ease: 'inOutSine',
        keys: [
          { t: 0.00, mods: [{ icon: normalSpec.frames.idle, dy: 0, sy: 1 }] },
          { t: 0.70, mods: [{ icon: normalSpec.frames.idle, dy: -0.8, sy: 1.016, sx: 0.994 }] },
          { t: normalSpec.states.idle.duration, mods: [{ icon: normalSpec.frames.idle, dy: 0, sy: 1, sx: 1 }] },
        ],
      },
      move: {
        dur: normalSpec.states.move.duration, loop: true, ease: 'outQuad',
        keys: [
          { t: 0.00, mods: [{ icon: normalSpec.frames.idle, dy: 0, sy: 1 }] },
          { t: 0.20, mods: [{ icon: normalSpec.frames.hop, dy: -2.2, sy: 0.86, sx: 0.86 }] },
          { t: normalSpec.states.move.duration, mods: [{ icon: normalSpec.frames.idle, dy: 0, sy: 1, sx: 1 }] },
        ],
      },
      atk: {
        dur: normalSpec.states.attack.duration, ease: 'inOutSine', hit: normalSpec.states.attack.hit,
        keys: [
          { t: 0.00, mods: [{ icon: normalSpec.frames.idle, dy: 0, rot: 0 }] },
          { t: 0.16, mods: [{ icon: normalSpec.frames.windup, dy: 1.8, rot: -2.0, sx: 1.025, sy: 0.96 }] },
          { t: normalSpec.states.attack.hit, mods: [{ icon: normalSpec.frames.impact, dy: -2.2, rot: 1.2, sx: 1.03, sy: 0.99 }] },
          { t: 0.42, mods: [{ icon: normalSpec.frames.impact, dy: 0.4, rot: 0.2, sx: 1.005 }] },
          { t: normalSpec.states.attack.duration, mods: [{ icon: normalSpec.frames.idle, dy: 0, rot: 0, sx: 1, sy: 1 }] },
        ],
      },
      die: {
        dur: normalSpec.states.die.duration, ease: 'inQuad',
        keys: [
          { t: 0.00, mods: [{ icon: normalSpec.frames.idle, alpha: 1, dy: 0 }] },
          { t: 0.22, mods: [{ icon: normalSpec.frames.defeat, alpha: 1, dy: 2.4 }] },
          { t: normalSpec.states.die.duration, mods: [{ icon: normalSpec.frames.defeat, alpha: 1, dy: 2.4 }] },
        ],
      },
    },
  };

  // 近战猫：根据目标与移动方向切换正面 / 背面整姿势帧。
  function meleeCat(side) {
    var frames = warSpec.frames;
    var states = warSpec.states;
    var key = side === 'front' ? 'front' : 'back';
    return {
      // 21.6 * 3.05 * 0.874 ≈ 57.6。
      scale: 0.874,
      parts: [{ icon: frames[key + 'Idle'], pivot: [0.50, 0.88] }],
      states: {
        idle: {
          dur: states.idle.duration, loop: true, ease: 'inOutSine',
          keys: [
            { t: 0.00, mods: [{ icon: frames[key + 'Idle'], dy: 0, sy: 1 }] },
            { t: 0.70, mods: [{ icon: frames[key + 'Idle'], dy: -0.8, sy: 1.016, sx: 0.994 }] },
            { t: states.idle.duration, mods: [{ icon: frames[key + 'Idle'], dy: 0, sy: 1 }] },
          ],
        },
        move: {
          dur: states.move.duration, loop: true, ease: 'outQuad',
          keys: [
            { t: 0.00, mods: [{ icon: frames[key + 'Idle'], dy: 0, sy: 1 }] },
            { t: 0.15, mods: [{ icon: frames[key + 'Walk'], dy: -2.4, sy: 0.985, sx: 1.015 }] },
            { t: states.move.duration, mods: [{ icon: frames[key + 'Idle'], dy: 0, sy: 1, sx: 1 }] },
          ],
        },
        atk: {
          dur: states.attack.duration, ease: 'inOutSine', hit: states.attack.hit,
          keys: [
            { t: 0.00, mods: [{ icon: frames[key + 'Idle'], dy: 0, rot: 0 }] },
            { t: 0.12, mods: [{ icon: frames[key + 'Windup'], dy: -0.8, rot: -2 }] },
            { t: states.attack.hit, mods: [{ icon: frames[key + 'Impact'], dy: 1.8, rot: 1.4, sx: 1.02 }] },
            { t: 0.30, mods: [{ icon: frames[key + 'Impact'], dy: 0.5, rot: 0.5, sx: 1.01 }] },
            { t: states.attack.duration, mods: [{ icon: frames[key + 'Idle'], dy: 0, rot: 0, sx: 1 }] },
          ],
        },
        hurt: {
          dur: states.hurt.duration, ease: 'outQuad',
          keys: [
            { t: 0.00, mods: [{ icon: frames[key + 'Idle'], dy: 0, rot: 0 }] },
            { t: 0.10, mods: [{ icon: frames[key + 'Hurt'], dy: 2.2, rot: -2.2, sx: 1.01 }] },
            { t: states.hurt.duration, mods: [{ icon: frames[key + 'Idle'], dy: 0, rot: 0, sx: 1 }] },
          ],
        },
        die: {
          dur: states.die.duration, ease: 'inQuad',
          keys: [
            { t: 0.00, mods: [{ icon: frames[key + 'Idle'], alpha: 1, dy: 0 }] },
            { t: 0.18, mods: [{ icon: frames[key + 'Defeat'], alpha: 1, dy: 3 }] },
            { t: states.die.duration, mods: [{ icon: frames[key + 'Defeat'], alpha: 1, dy: 3 }] },
          ],
        },
      },
    };
  }

  var meleeCatFront = meleeCat('front');
  var meleeCatBack = meleeCat('back');

  // 哈利汪：法师位固定使用背面，紫色范围法术由运行时投射物与落点光圈表达。
  var mageDog = {
    // 20.4 * 3.05 * 0.887 ≈ 55.2。
    scale: 0.887,
    muzzle: mageSpec.states.attack.muzzle,
    parts: [{ icon: mageSpec.frames.idle, pivot: [0.50, 0.88] }],
    states: {
      idle: {
        dur: mageSpec.states.idle.duration, loop: true, ease: 'inOutSine',
        keys: [
          { t: 0.00, mods: [{ icon: mageSpec.frames.idle, dy: 0, sy: 1 }] },
          { t: 1.10, mods: [{ icon: mageSpec.frames.idle, dy: -0.8, sy: 1.016, sx: 0.994 }] },
          { t: mageSpec.states.idle.duration, mods: [{ icon: mageSpec.frames.idle, dy: 0, sy: 1 }] },
        ],
      },
      atk: {
        dur: mageSpec.states.attack.duration, ease: 'inOutSine', hit: mageSpec.states.attack.hit,
        keys: [
          { t: 0.00, mods: [{ icon: mageSpec.frames.idle, dy: 0, rot: 0 }] },
          { t: 0.16, mods: [{ icon: mageSpec.frames.windup, dy: -1.1, rot: -1.2, sx: 0.99 }] },
          { t: mageSpec.states.attack.hit, mods: [{ icon: mageSpec.frames.release, dy: -1.8, rot: 1.1, sx: 1.015 }] },
          { t: 0.38, mods: [{ icon: mageSpec.frames.recover, dy: 0.5, rot: 0.3, sx: 1.005 }] },
          { t: mageSpec.states.attack.duration, mods: [{ icon: mageSpec.frames.idle, dy: 0, rot: 0, sx: 1 }] },
        ],
      },
      hurt: {
        dur: mageSpec.states.hurt.duration, ease: 'outQuad',
        keys: [
          { t: 0.00, mods: [{ icon: mageSpec.frames.idle, dy: 0, rot: 0 }] },
          { t: 0.09, mods: [{ icon: mageSpec.frames.hurt, dy: 2.0, rot: -2.0, sx: 1.01 }] },
          { t: mageSpec.states.hurt.duration, mods: [{ icon: mageSpec.frames.idle, dy: 0, rot: 0, sx: 1 }] },
        ],
      },
      die: {
        dur: mageSpec.states.die.duration, ease: 'inQuad',
        keys: [
          { t: 0.00, mods: [{ icon: mageSpec.frames.idle, alpha: 1, dy: 0 }] },
          { t: 0.18, mods: [{ icon: mageSpec.frames.defeat, alpha: 1, dy: 3.0 }] },
          { t: mageSpec.states.die.duration, mods: [{ icon: mageSpec.frames.defeat, alpha: 1, dy: 3.0 }] },
        ],
      },
    },
  };

  // 奶糖喵：固定背面驻守；绿色治疗连线与数值反馈继续由战斗层绘制。
  var healerCat = {
    frameTransforms: healerSpec.frameTransforms,
    // 20.4 * 3.05 * 0.887 ≈ 55.2。
    scale: 0.887,
    // 法杖绿球：相对角色脚底锚点的施法源，不能从身体中心发光。
    castOrigin: [-19, -25],
    parts: [{ icon: healerSpec.frames.idle, pivot: [0.50, 0.88] }],
    states: {
      idle: {
        dur: healerSpec.states.idle.duration, loop: true, ease: 'inOutSine',
        keys: [
          { t: 0.00, mods: [{ icon: healerSpec.frames.idle, dy: 0, sy: 1 }] },
          // 驻守治疗位保持稳定轮廓，任意待机时刻切换施法都不归零跳动。
          { t: 1.00, mods: [{ icon: healerSpec.frames.idle, dy: 0, sy: 1, sx: 1 }] },
          { t: healerSpec.states.idle.duration, mods: [{ icon: healerSpec.frames.idle, dy: 0, sy: 1 }] },
        ],
      },
      atk: {
        dur: healerSpec.states.attack.duration, ease: 'inOutSine', hit: healerSpec.states.attack.hit,
        keys: [
          { t: 0.00, mods: [{ icon: healerSpec.frames.idle, dy: 0, rot: 0 }] },
          { t: healerSpec.states.attack.hit, mods: [{ icon: healerSpec.frames.heal, dy: 0, rot: 0, sx: 1 }] },
          { t: healerSpec.states.attack.duration, mods: [{ icon: healerSpec.frames.idle, dy: 0, rot: 0, sx: 1 }] },
        ],
      },
      hurt: {
        dur: healerSpec.states.hurt.duration, ease: 'outQuad',
        keys: [
          { t: 0.00, mods: [{ icon: healerSpec.frames.idle, dy: 0, rot: 0 }] },
          { t: 0.10, mods: [{ icon: healerSpec.frames.hurt, dy: 2.0, rot: -2.0, sx: 1.01 }] },
          { t: healerSpec.states.hurt.duration, mods: [{ icon: healerSpec.frames.idle, dy: 0, rot: 0, sx: 1 }] },
        ],
      },
      die: {
        dur: healerSpec.states.die.duration, ease: 'inQuad',
        keys: [
          { t: 0.00, mods: [{ icon: healerSpec.frames.idle, alpha: 1, dy: 0, rot: 0 }] },
          { t: 0.18, mods: [{ icon: healerSpec.frames.idle, alpha: 1, dy: 3.0, rot: -3.0, sy: 0.95 }] },
          { t: healerSpec.states.die.duration, mods: [{ icon: healerSpec.frames.idle, alpha: 1, dy: 3.0, rot: -3.0, sy: 0.95 }] },
        ],
      },
    },
  };

  // 沙发精英：整体家具以姿势帧表达蓄力、震击与侧翻倒地，不增加肢体或专属战斗分支。
  var sofaElite = {
    scale: 1.35,
    parts: [{ icon: eliteSpec.frames.idle, pivot: [0.50, 0.88] }],
    states: {
      idle: {
        dur: eliteSpec.states.idle.duration, loop: true, ease: 'inOutSine',
        keys: [
          { t: 0.00, mods: [{ icon: eliteSpec.frames.idle, dy: 0, sy: 1 }] },
          { t: 1.15, mods: [{ icon: eliteSpec.frames.idle, dy: -0.9, sy: 1.018, sx: 0.993 }] },
          { t: eliteSpec.states.idle.duration, mods: [{ icon: eliteSpec.frames.idle, dy: 0, sy: 1, sx: 1 }] },
        ],
      },
      move: {
        dur: eliteSpec.states.move.duration, loop: true, ease: 'outQuad',
        keys: [
          { t: 0.00, mods: [{ icon: eliteSpec.frames.idle, dy: 0, sy: 1 }] },
          { t: 0.20, mods: [{ icon: eliteSpec.frames.move, dy: -3.0, sy: 0.98, sx: 1.025 }] },
          { t: eliteSpec.states.move.duration, mods: [{ icon: eliteSpec.frames.idle, dy: 0, sy: 1, sx: 1 }] },
        ],
      },
      atk: {
        dur: eliteSpec.states.attack.duration, ease: 'inOutSine', hit: eliteSpec.states.attack.hit,
        keys: [
          { t: 0.00, mods: [{ icon: eliteSpec.frames.idle, dy: 0, rot: 0 }] },
          { t: 0.18, mods: [{ icon: eliteSpec.frames.windup, dy: 1.4, rot: -2.8, sx: 1.035, sy: 0.955 }] },
          { t: eliteSpec.states.attack.hit, mods: [{ icon: eliteSpec.frames.impact, dy: -1.8, rot: 1.5, sx: 1.02, sy: 0.985 }] },
          { t: 0.43, mods: [{ icon: eliteSpec.frames.impact, dy: 0.8, rot: 0.4, sx: 1.005 }] },
          { t: eliteSpec.states.attack.duration, mods: [{ icon: eliteSpec.frames.idle, dy: 0, rot: 0, sx: 1, sy: 1 }] },
        ],
      },
      hurt: {
        dur: eliteSpec.states.hurt.duration, ease: 'outQuad',
        keys: [
          { t: 0.00, mods: [{ icon: eliteSpec.frames.idle, dy: 0, rot: 0 }] },
          { t: 0.10, mods: [{ icon: eliteSpec.frames.idle, dy: 2.4, rot: -3.2, sx: 1.01, sy: 0.97 }] },
          { t: eliteSpec.states.hurt.duration, mods: [{ icon: eliteSpec.frames.idle, dy: 0, rot: 0, sx: 1, sy: 1 }] },
        ],
      },
      die: {
        dur: eliteSpec.states.die.duration, ease: 'inQuad',
        keys: [
          { t: 0.00, mods: [{ icon: eliteSpec.frames.idle, alpha: 1, dy: 0, rot: 0 }] },
          { t: 0.24, mods: [{ icon: eliteSpec.frames.defeat, alpha: 1, dy: 2.0, rot: 0, sx: 1, sy: 1 }] },
          { t: eliteSpec.states.die.duration, mods: [{ icon: eliteSpec.frames.defeat, alpha: 1, dy: 2.0, rot: 0, sx: 1, sy: 1 }] },
        ],
      },
    },
  };

  // 双开门冰箱首领：单体拳击与相框范围砸击共用完整姿势帧，特效保持在战斗层。
  var fridgeBoss = {
    scale: 1.95,
    parts: [{ icon: bossSpec.frames.idle, pivot: [0.50, 0.88] }],
    states: {
      idle: {
        dur: bossSpec.states.idle.duration, loop: true, ease: 'inOutSine',
        keys: [
          { t: 0.00, mods: [{ icon: bossSpec.frames.idle, dy: 0, sy: 1 }] },
          { t: 1.20, mods: [{ icon: bossSpec.frames.idle, dy: -0.7, sy: 1.012, sx: 0.996 }] },
          { t: bossSpec.states.idle.duration, mods: [{ icon: bossSpec.frames.idle, dy: 0, sy: 1, sx: 1 }] },
        ],
      },
      move: {
        dur: bossSpec.states.move.duration, loop: true, ease: 'inOutSine',
        keys: [
          { t: 0.00, mods: [{ icon: bossSpec.frames.moveLeft, dy: 0 }] },
          { t: bossSpec.states.move.duration / 2, mods: [{ icon: bossSpec.frames.moveRight, dy: 0 }] },
          { t: bossSpec.states.move.duration, mods: [{ icon: bossSpec.frames.moveLeft, dy: 0 }] },
        ],
      },
      atk: {
        dur: bossSpec.states.attack.duration, ease: 'inOutSine', hit: bossSpec.states.attack.hit,
        keys: [
          { t: 0.00, mods: [{ icon: bossSpec.frames.idle, dy: 0 }] },
          { t: 0.18, mods: [{ icon: bossSpec.frames.singleWindup, dy: 0 }] },
          { t: bossSpec.states.attack.hit, mods: [{ icon: bossSpec.frames.singleImpact, dy: 0 }] },
          { t: 0.48, mods: [{ icon: bossSpec.frames.singleRecover, dy: 0 }] },
          { t: bossSpec.states.attack.duration, mods: [{ icon: bossSpec.frames.idle, dy: 0 }] },
        ],
      },
      aoe: {
        dur: bossSpec.states.aoe.duration, ease: 'inOutSine', hit: bossSpec.states.aoe.hit,
        keys: [
          { t: 0.00, mods: [{ icon: bossSpec.frames.idle, dy: 0 }] },
          { t: 0.18, mods: [{ icon: bossSpec.frames.aoeWindup, dy: 0 }] },
          { t: 0.36, mods: [{ icon: bossSpec.frames.aoeCharge, dy: 0 }] },
          { t: bossSpec.states.aoe.hit, mods: [{ icon: bossSpec.frames.aoeImpact, dy: 0 }] },
          { t: bossSpec.states.aoe.duration, mods: [{ icon: bossSpec.frames.idle, dy: 0 }] },
        ],
      },
      hurt: {
        dur: bossSpec.states.hurt.duration, ease: 'outQuad',
        keys: [
          { t: 0.00, mods: [{ icon: bossSpec.frames.idle, dy: 0 }] },
          { t: 0.10, mods: [{ icon: bossSpec.frames.hurt, dy: 1.8, rot: -1.8 }] },
          { t: bossSpec.states.hurt.duration, mods: [{ icon: bossSpec.frames.idle, dy: 0, rot: 0 }] },
        ],
      },
      die: {
        dur: bossSpec.states.die.duration, ease: 'inQuad',
        keys: [
          { t: 0.00, mods: [{ icon: bossSpec.frames.idle, alpha: 1, dy: 0 }] },
          { t: 0.24, mods: [{ icon: bossSpec.frames.dieFall, alpha: 1, dy: 0 }] },
          { t: bossSpec.states.die.duration, mods: [{ icon: bossSpec.frames.dieLanded, alpha: 1, dy: 0 }] },
        ],
      },
    },
  };

  // 盾位：柴犬关键帧动画。config 里的英雄 id 为 'tank'
  A.Rigs = {
    tank: shiba,
    arch: archerRight,
    'arch-left': archerLeft,
    'arch-right': archerRight,
    war: meleeCatBack,
    'war-front': meleeCatFront,
    'war-back': meleeCatBack,
    mage: mageDog,
    healer: healerCat,
    small: lampMinion,
    normal: bedsideNormal,
    elite: sofaElite,
    boss: fridgeBoss,
  };
})();
