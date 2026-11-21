import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// ── 截取实际提交的顶点，检查形状柔边与素材边界 ──
let vertices;
const gl = new Proxy({}, { get: (_, key) => {
  if (key === 'getShaderParameter' || key === 'getProgramParameter') return () => true;
  if (key === 'getAttribLocation') return () => 1;
  if (key === 'getUniformLocation') return (_, name) => name;
  if (key === 'bufferSubData') return (_, offset, data) => { vertices = Array.from(data); };
  if (String(key).startsWith('create')) return () => ({});
  return () => {};
} });
const A = {};
vm.runInNewContext(fs.readFileSync(new URL('../package/gameplay/render/gl.js', import.meta.url), 'utf8'),
  { window: { AIGCUtils: A }, console });
assert(A.Render.init({ getContext: () => gl }));
const R = A.Render, white = { r: 1, g: 1, b: 1, a: 1 };
function quad(mode, extra = {}) {
  R.push(20, 30, 100, 80, white, { mode, hw: 50, hh: 40, r: 12, ...extra });
  R.flush();
  return [0, 12, 24, 36].map(i => vertices.slice(i, i + 12));
}
for (const mode of [0, 2, 8, 9, 10, 11, 12, 13]) {
  const v = quad(mode);
  assert(v[0][0] < 20 && v[0][1] < 30, `模式${mode}柔边不被左上边界截断`);
  assert(v[2][0] > 120 && v[2][1] > 110, `模式${mode}柔边不被右下边界截断`);
  for (const p of v) {
    assert(Math.abs((p[0] - 20) / 100 - p[2]) < 1e-6, '距离场保持原横坐标');
    assert(Math.abs((p[1] - 30) / 80 - p[3]) < 1e-6, '距离场保持原纵坐标');
    assert.equal(p[8], 50); assert.equal(p[9], 40); assert.equal(p[10], 12);
  }
}
for (const mode of [1, 3, 4, 5, 6, 6.25, 7, 14]) {
  const v = quad(mode);
  assert.deepEqual(v[0].slice(0, 4), [20, 30, 0, 0], `模式${mode}保留素材及遮罩边界`);
  assert.deepEqual(v[2].slice(0, 4), [120, 110, 1, 1]);
}
const rotated = quad(0, { rot: Math.PI / 2 });
assert(Math.abs((rotated[0][0] + rotated[2][0]) / 2 - 70) < 1e-6);
assert(Math.abs((rotated[0][1] + rotated[2][1]) / 2 - 70) < 1e-6);
const gradient = quad(0, { bottomColor: { r: 0, g: 0, b: 0, a: 0 } });
assert.deepEqual(gradient[0].slice(4, 8), [1, 1, 1, 1], '扩展区域渐变不越界');
assert.deepEqual(gradient[2].slice(4, 8), [0, 0, 0, 0]);
console.log('UI柔边留白、距离场坐标、纹理遮罩隔离、旋转中心与渐变边界通过');
