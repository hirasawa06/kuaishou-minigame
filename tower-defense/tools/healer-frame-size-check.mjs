import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// ── 治疗帧的留白补偿只作用于图片，不能插值成整只角色缩放 ──
const root = new URL('../package/gameplay/', import.meta.url);
const calls = [];
const A = { Render: { draw: { sprite: (...args) => calls.push(args) } },
  Assets: { tex: () => ({}) }, GameAtlas: { texW: 1024, texH: 1024, icons: {
    'healer-back-idle': [0, 0, 120, 120], 'healer-back-heal': [120, 0, 120, 120],
  } } };
const sandbox = { window: { AIGCUtils: A } };
for (const file of ['data/character-animations.js', 'anim/rig.js', 'anim/defs.js']) {
  vm.runInNewContext(fs.readFileSync(new URL(file, root), 'utf8'), sandbox);
}
const rig = A.Rigs.healer;
for (const t of [0, 0.25, 0.75, 1, 1.75, 2]) {
  const idle = A.Anim.sample(rig.states.idle, t)[0];
  const start = A.Anim.sample(rig.states.atk, 0)[0];
  for (const key of ['dx', 'dy', 'rot', 'sx', 'sy']) {
    assert.equal(idle[key], start[key], '任意待机时刻转治疗均不跳动：' + key);
  }
}
const transform = rig.frameTransforms['healer-back-heal'];
const point = ([x, y]) => [60 + (x - 60) * transform.scale + 120 * (transform.x || 0),
  60 + (y - 60) * transform.scale + 120 * (transform.y || 0)];
// 最终 120px 图集内的头部中段左右轮廓，人工标定，排除法杖与花饰。
for (const [source, reference] of [[[39, 48], [35, 32]], [[83, 48], [99, 32]]]) {
  const mapped = point(source);
  assert.ok(Math.hypot(mapped[0] - reference[0], mapped[1] - reference[1]) < 1,
    '治疗头部轮廓应对齐待机基准');
}
for (const t of [0, 0.1, 0.299, 0.3, 0.4, 0.499, 0.5]) {
  const pose = A.Anim.sample(rig.states.atk, t)[0];
  assert.equal(pose.dx, 0, '治疗不额外横移');
  assert.equal(pose.dy, 0, '治疗不额外上下漂移');
  assert.equal(pose.rot, 0, '治疗不额外旋转');
  assert.equal(pose.sx, 1, '治疗不额外横向伸缩');
  assert.equal(pose.sy, 1, '治疗不额外纵向伸缩');
}
A.Anim.draw(rig, { anim: 'atk', animT: 0.30 }, 100, 100, 60);
assert.ok(calls[0][10].h > 80, '治疗帧必须补偿透明留白，不能按原画布缩小角色');
calls.length = 0;
A.Anim.draw(rig, { anim: 'idle', animT: 0 }, 100, 100, 60);
assert.equal(calls[0][10].h, 60, '待机帧保持原尺寸');
console.log('治疗帧尺寸补偿与待机尺寸检查通过');
