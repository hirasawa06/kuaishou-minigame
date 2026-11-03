/* gameplay/anim/defs.js — 单位分件动画表
 *
 * pivot：分件锚点在单元格内的归一化坐标（0~1），旋转围绕它进行。
 * 时间单位：秒；rot 单位：度；dx/dy 单位：逻辑像素（随 size 缩放会更稳，这里按 40px 视觉尺寸调）。
 */
(function () {
  var A = window.AIGCUtils;

  // 护盾柴犬：身体 + 盾牌两件
  // pivot 取分件在图集单元格内的握持点（盾牌绕爪子转，身体绕脚底转）
  var shiba = {
    parts: [
      { icon: 'unit-tank-1-body', pivot: [0.50, 0.88] },
      { icon: 'unit-tank-1-shield', pivot: [0.70, 0.78] },
    ],
    states: {
      // 待机：呼吸（身体轻微上下 + 纵向缩放），盾牌滞后半拍
      idle: {
        dur: 2.4, loop: true, ease: 'inOutSine',
        keys: [
          { t: 0.0, mods: [{ dy: 0, sy: 1.00 }, { dy: 0, rot: 0 }] },
          { t: 1.2, mods: [{ dy: -1.1, sy: 1.022, sx: 0.994 }, { dy: -0.6, rot: -1.8 }] },
          { t: 2.4, mods: [{ dy: 0, sy: 1.00 }, { dy: 0, rot: 0 }] },
        ],
      },
      // 攻击：后拉蓄力 → 顶盾 → 回位。hit=0.17 时结算伤害
      // 敌人自上而下，所以顶盾方向是右上（dy 为负）
      atk: {
        dur: 0.46, ease: 'outQuad', hit: 0.17,
        keys: [
          { t: 0.00, mods: [{ rot: 0, dx: 0, dy: 0 }, { rot: 0, dx: 0, dy: 0 }] },
          { t: 0.09, mods: [{ rot: -5, dx: -1.6, dy: 1.0, sy: 0.968 }, { rot: -8, dx: -1.5, dy: 1.4 }] },
          { t: 0.17, mods: [{ rot: 7, dx: 3.4, dy: -2.4, sx: 1.05, sy: 0.955 }, { rot: 16, dx: 2.6, dy: -5.0 }] },
          { t: 0.28, mods: [{ rot: 3, dx: 1.6, dy: -1.2 }, { rot: 8, dx: 1.4, dy: -2.4 }] },
          { t: 0.46, mods: [{ rot: 0, dx: 0, dy: 0 }, { rot: 0, dx: 0, dy: 0 }] },
        ],
      },
      // 受击：向后仰一下
      hurt: {
        dur: 0.22, ease: 'outQuad',
        keys: [
          { t: 0.00, mods: [{ rot: 0, dy: 0 }, { rot: 0 }] },
          { t: 0.06, mods: [{ rot: 5, dy: 2.2, sx: 1.04, sy: 0.96 }, { rot: -8 }] },
          { t: 0.22, mods: [{ rot: 0, dy: 0 }, { rot: 0 }] },
        ],
      },
      // 死亡：缩扁 + 淡出，配合 effector 的烟尘
      die: {
        dur: 0.4, ease: 'inQuad',
        keys: [
          { t: 0.00, mods: [{ sy: 1, sx: 1, dy: 0, alpha: 1 }, { rot: 0, dy: 0, alpha: 1 }] },
          { t: 0.40, mods: [{ sy: 0.55, sx: 1.15, dy: 9, alpha: 0.15 }, { rot: -24, dy: 7, alpha: 0.1 }] },
        ],
      },
    },
  };

  A.Rigs = {
    'tank-a': shiba,
  };
})();
