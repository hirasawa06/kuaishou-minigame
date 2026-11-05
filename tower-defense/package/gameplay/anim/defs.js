/* gameplay/anim/defs.js — 单位分件动画表
 *
 * pivot：分件锚点在单元格内的归一化坐标（0~1），旋转围绕它进行。
 * 时间单位：秒；rot 单位：度；dx/dy 单位：逻辑像素（随 size 缩放会更稳，这里按 40px 视觉尺寸调）。
 */
(function () {
  var A = window.AIGCUtils;
  var archSpec = A.CharacterAnimations.arch;
  var tankSpec = A.CharacterAnimations.tank;
  var lampSpec = A.CharacterAnimations.lamp;
  var warSpec = A.CharacterAnimations.war;

  // 护盾柴犬：战场始终使用背视完整姿势；卡牌仍可复用正面分件图。
  var shiba = {
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
      // 受击：改用情绪版同风格的完整姿势；第二分件隐藏，避免双盾重影。
      hurt: {
        dur: tankSpec.states.hurt.duration, ease: 'outQuad',
        keys: [
          { t: 0.00, mods: [{ icon: tankSpec.frames.idle, alpha: 1 }] },
          // 向镜头方向轻退并失衡：保持原体积，不做“受击被压扁”的夸张形变。
          { t: 0.065, mods: [{ icon: tankSpec.frames.hurt, alpha: 1, dy: 1.8, sx: 1.01, sy: 1.00, rot: -1.5 }] },
          { t: 0.17, mods: [{ icon: tankSpec.frames.hurt, alpha: 1, dy: 3.6, sx: 1.02, sy: 0.99, rot: -3.0 }] },
          { t: 0.27, mods: [{ icon: tankSpec.frames.idle, alpha: 1, dy: 1.2, sx: 1.01, sy: 1.00, rot: -1.0 }] },
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
      scale: 1.30,
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

  // 近战猫：根据目标与移动方向切换正面 / 背面整姿势帧。
  function meleeCat(side) {
    var frames = warSpec.frames;
    var states = warSpec.states;
    var key = side === 'front' ? 'front' : 'back';
    return {
      scale: 1.12,
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

  // 盾位：柴犬分件动画。config 里的英雄 id 为 'tank'
  A.Rigs = {
    tank: shiba,
    arch: archerRight,
    'arch-left': archerLeft,
    'arch-right': archerRight,
    war: meleeCatBack,
    'war-front': meleeCatFront,
    'war-back': meleeCatBack,
    small: lampMinion,
  };
})();
