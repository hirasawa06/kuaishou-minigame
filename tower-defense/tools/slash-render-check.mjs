import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// ── 攻击特效必须完整返回，后续 HUD 才能继续绘制 ──────────────
const calls = [];
const state = { units: [], effects: [{ type: 'slash', x: 10, y: 20,
  tx: 40, ty: 60, life: 0.1, max: 0.2, color: '#ffffff' }] };
const A = { Config: {}, State: state, Layout: {},
  Assets: { sprite: () => ({ tex: {}, texW: 128, texH: 128, x: 0, y: 0, w: 120, h: 120 }) },
  Render: { setAdditive: value => calls.push(value), draw: {
    color: () => ({ r: 1, g: 1, b: 1 }), sprite: () => calls.push('slash'),
  } } };
vm.runInNewContext(fs.readFileSync(new URL('../package/gameplay/render/scene.js', import.meta.url), 'utf8'),
  { window: { AIGCUtils: A } });
assert.doesNotThrow(() => {
  A.Scene.drawEffects();
  calls.push('HUD');
}, '锤锤喵攻击绘制不能抛异常并阻断 HUD');
assert.deepEqual(calls, [true, 'slash', false, 'HUD'], '刀光绘制后恢复普通混合，再继续 HUD');
console.log('刀光绘制与后续 HUD 连续性检查通过');
