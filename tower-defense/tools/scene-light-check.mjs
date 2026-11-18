import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// ── 光影状态：批次切换、HUD恢复和下一帧复位 ──────────────
const uniforms = [];
const gl = new Proxy({}, { get: (_, key) => {
  if (key === 'getShaderParameter' || key === 'getProgramParameter') return () => true;
  if (key === 'getUniformLocation') return (_, name) => name;
  if (key === 'getAttribLocation') return () => 1;
  if (key === 'uniform4f') return (name, ...values) => { if (name === 'uSceneLight') uniforms.push(values); };
  if (String(key).startsWith('create')) return () => ({});
  return () => {};
} });
const A = {};
vm.runInNewContext(fs.readFileSync(new URL('../package/gameplay/render/gl.js', import.meta.url), 'utf8'), { window: { AIGCUtils: A }, console });
assert.equal(A.Render.init({ getContext: () => gl }), true);
const R = A.Render;
const quad = () => R.push(0, 0, 10, 10, { r: 1, g: 1, b: 1, a: 1 });
R.beginFrame([0, 0, 0]);
quad(); R.setSceneLight('character', 100, 60);
assert.equal(uniforms.at(-1)[0], 0, '旧批次先用原色提交');
quad(); R.setSceneLight('off');
assert.deepEqual(uniforms.at(-1), [1, 100, 60, 0.1]);
quad(); R.flush();
assert.equal(uniforms.at(-1)[0], 0, 'HUD不继承角色光影');
R.setSceneLight('character', 100, 60);
R.beginFrame([0, 0, 0]); quad(); R.flush();
assert.equal(uniforms.at(-1)[0], 0, '新帧强制恢复原色');
R.sceneLighting.enabled = false;
R.setSceneLight('character', 100, 60); quad(); R.flush();
assert.equal(uniforms.at(-1)[0], 0, '支持关闭光影进行对比');
console.log('光影批次隔离、HUD恢复、帧复位和开关通过');
