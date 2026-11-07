/* gameplay/anim/defs.js — 单位分件动画表
 *
 * pivot：分件锚点在单元格内的归一化坐标（0~1），旋转围绕它进行。
 * 时间单位：秒；rot 单位：度；dx/dy 单位：逻辑像素（随 size 缩放会更稳，这里按 40px 视觉尺寸调）。
 */
(function () {
  var A = window.AIGCUtils;
  var tankFrames = A.CharacterAnimations.tank.frames;
  var archSpec = A.CharacterAnimations.arch;

  // 盾犬战场背视：完整姿势帧与角色动画规格共用图集。
  // 卡牌正面图独立保留，不改变角色配置和碰撞范围。
  var shiba = {
    parts: [
      { icon: tankFrames.idle, pivot: [0.50, 0.88] },
    ],
    states: {
      idle: {
        dur: 2.4, loop: true, ease: 'inOutSine',
        keys: [
          { t: 0.0, mods: [{ icon: tankFrames.idle, dy: 0, sy: 1 }] },
          { t: 1.2, mods: [{ icon: tankFrames.idle, dy: -1.1, sy: 1.022, sx: 0.994 }] },
          { t: 2.4, mods: [{ icon: tankFrames.idle, dy: 0, sy: 1 }] },
        ],
      },
      hurt: {
        dur: 0.22, ease: 'outQuad',
        keys: [
          { t: 0.00, mods: [{ icon: tankFrames.idle, dy: 0, rot: 0 }] },
          { t: 0.06, mods: [{ icon: tankFrames.hurt, dy: 2.2, rot: -3 }] },
          { t: 0.17, mods: [{ icon: tankFrames.hurt, dy: 3.6, rot: -3 }] },
          { t: 0.22, mods: [{ icon: tankFrames.idle, dy: 0, rot: 0 }] },
        ],
      },
      die: {
        dur: 0.4, ease: 'inQuad',
        keys: [
          { t: 0.00, mods: [{ icon: tankFrames.idle, alpha: 1, dy: 0 }] },
          { t: 0.13, mods: [{ icon: tankFrames.defeat, alpha: 1, dy: 2.4 }] },
          { t: 0.4, mods: [{ icon: tankFrames.defeat, alpha: 1, dy: 2.4 }] },
        ],
      },
    },
  };

  // 射手猫背视：左/右开火姿势根据当前目标朝向选择。
  // 投射物及伤害仍由原战斗逻辑处理，Rig 只负责视觉姿势。
  function archerBack(side) {
    var frames = archSpec.frames;
    var states = archSpec.states;
    var fireFrame = frames[states.attack.directions[side].frame];
    var hit = states.attack.hit;
    return {
      scale: 1.15,
      parts: [{ icon: frames.idle, pivot: [0.50, 0.88] }],
      states: {
        idle: {
          dur: states.idle.duration, loop: true, ease: 'inOutSine',
          keys: [
            { t: 0, mods: [{ icon: frames.idle, dy: 0, sy: 1 }] },
            { t: states.idle.duration / 2, mods: [{ icon: frames.idle, dy: -0.8, sy: 1.018 }] },
            { t: states.idle.duration, mods: [{ icon: frames.idle, dy: 0, sy: 1 }] },
          ],
        },
        atk: {
          dur: states.attack.duration, ease: 'outQuad', hit: hit,
          keys: [
            { t: 0, mods: [{ icon: frames.idle, dy: 0, rot: 0 }] },
            { t: 0.04, mods: [{ icon: frames.aim, dy: 0.4, rot: -0.8 }] },
            { t: hit, mods: [{ icon: fireFrame, dy: -0.5, rot: 0.8 }] },
            { t: 0.18, mods: [{ icon: fireFrame, dy: -0.25, rot: 0.5 }] },
            { t: 0.26, mods: [{ icon: frames.recoil, dy: 0.55, rot: -1.2, sy: 0.985 }] },
            { t: states.attack.duration, mods: [{ icon: frames.idle, dy: 0, rot: 0, sy: 1 }] },
          ],
        },
        hurt: {
          dur: states.hurt.duration, ease: 'outQuad',
          keys: [
            { t: 0, mods: [{ icon: frames.idle, dy: 0, rot: 0 }] },
            { t: 0.06, mods: [{ icon: frames.idle, dy: 2, rot: 4, sy: 0.95 }] },
            { t: states.hurt.duration, mods: [{ icon: frames.idle, dy: 0, rot: 0, sy: 1 }] },
          ],
        },
        die: {
          // 保持当前战斗逻辑的 0.4 秒移除时间。
          dur: 0.4, ease: 'inQuad',
          keys: [
            { t: 0, mods: [{ icon: frames.idle, dy: 0, rot: 0 }] },
            { t: 0.12, mods: [{ icon: frames.idle, dy: 2.2, rot: 3, sy: 0.94 }] },
            { t: 0.28, mods: [{ icon: frames.defeat, dy: 3.5, rot: 0 }] },
            { t: 0.4, mods: [{ icon: frames.defeat, dy: 3.5, rot: 0 }] },
          ],
        },
      },
    };
  }

  // 盾位：柴犬分件动画。config 里的英雄 id 为 'tank'
  A.Rigs = {
    tank: shiba,
    arch: archerBack('right'),
    'arch-left': archerBack('left'),
  };
})();
