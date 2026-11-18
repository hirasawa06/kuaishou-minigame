import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// ── 防止切分支后只恢复旧光斑：圆心、双层和可见范围回归 ──
const actor = { x: 100, y: 120, def: { id: 'arch', radius: 20 }, spawnT: 0 };
const calls = [];
const A = { Config: {}, Layout: {}, State: { units: [actor], enemies: [], effects: [] },
  Rigs: { arch: { scale: 1, parts: [{ pivot: [0.5, 0.88] }] } },
  Assets: {}, Render: { draw: { color: () => ({}), softEllipse: (...args) => calls.push(args) } } };
vm.runInNewContext(fs.readFileSync(new URL('../package/gameplay/render/scene.js', import.meta.url), 'utf8'), { window: { AIGCUtils: A } });
A.Scene.drawGroundEffects();
assert.equal(calls.length, 2);
const size = 20 * 3.05;
assert.equal(calls[0][0], 100 + size * (59 / 120 - 0.5));
assert.equal(calls[0][1], 117 + size * (99 / 120 - 0.5));
assert.equal(calls[0][1], calls[1][1]);
assert.ok(calls[0][3] >= size * 0.6, '外围必须覆盖脚底与尾巴外的地面');
actor.anim = 'atk'; actor.animT = 0.3;
A.Scene.drawGroundEffects();
assert.equal(calls[2][1], calls[0][1]);
actor.dead = true;
A.Scene.drawGroundEffects();
assert.equal(calls.length, 4);
console.log('双脚中点、双层范围及动作稳定性通过');
