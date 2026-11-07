/* gameplay/anim/defs.js — 单位分件动画表
 *
 * pivot：分件锚点在单元格内的归一化坐标（0~1），旋转围绕它进行。
 * 时间单位：秒；rot 单位：度；dx/dy 单位：逻辑像素（随 size 缩放会更稳，这里按 40px 视觉尺寸调）。
 */
(function () {
  var A = window.AIGCUtils;
  var tankFrames = A.CharacterAnimations.tank.frames;

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

  // 盾位：柴犬分件动画。config 里的英雄 id 为 'tank'
  A.Rigs = {
    tank: shiba,
  };
})();
