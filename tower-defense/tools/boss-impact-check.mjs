import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// ── 三阶段取帧、残光渐隐与地面层隔离 ────────────────────
const calls = [];
const A = { State: { units: [], enemies: [], effects: [] }, Layout: {},
  Assets: { entry: key => key === 'boss-impact' ? { tex: key, w: 768, h: 256 } : null },
  Render: { draw: { color: () => ({}), texture: (...args) => calls.push(args) } } };
const ctx = { window: { AIGCUtils: A } };
const root = new URL('../package/gameplay/', import.meta.url);
vm.runInNewContext(fs.readFileSync(new URL('config.js', root), 'utf8'), ctx);
vm.runInNewContext(fs.readFileSync(new URL('render/scene.js', root), 'utf8'), ctx);
for (const [age, frame] of [[0.02, 0], [0.15, 1], [0.45, 2]]) {
  A.State.effects = [{ type: 'boss-ground-impact', x: 100, y: 150, life: 0.7 - age, max: 0.7 }];
  A.Scene.drawGroundEffects();
  const call = calls.at(-1);
  assert.equal(call[3], frame * 256);
  assert.equal(call[9], 260);
  assert.equal(call[10], 260);
  assert.ok(call[11].a > 0 && call[11].a <= 1);
  const count = calls.length;
  A.Scene.drawEffects();
  assert.equal(calls.length, count, '上层不得重复绘制砸地');
}
assert.ok(calls[2][11].a < 1, '末帧必须渐隐');
assert.equal(calls[0][7], calls[2][7], '三帧共享圆心');
assert.equal(calls[0][8], calls[2][8]);
const shiftedY = calls.at(-1)[8];
A.Config.BOSS_IMPACT.offsetYRatio = 0;
A.Scene.drawGroundEffects();
assert.ok(Math.abs(shiftedY - calls.at(-1)[8] - 260 * 0.08) < 0.0001,
  '特效下移画布宽8%，不修改脚底锚点');
console.log('Boss三阶段、固定圆心、地面层和残光渐隐通过');
