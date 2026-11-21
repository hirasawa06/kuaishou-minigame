import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../package/gameplay/', import.meta.url);
const A = { Layout: { w: 414, h: 896, safeTop: 0, usableH: 896 } };
const ctx = { window: { AIGCUtils: A }, console };
vm.createContext(ctx);
for (const f of ['config.js', 'layout.js']) vm.runInContext(fs.readFileSync(new URL(f, root), 'utf8'), ctx);
for (const [w, h] of [[414, 896], [390, 844], [360, 640]]) {
  A.Layout.w = w; A.Layout.h = h;
  const u = A.Layout.calc();
  assert(Math.abs(u.shop.x + u.shop.w / 2 - (u.safeLeft + u.safeRight) / 2) < 0.01,
    '手机缩放后的卡池居中');
  assert(Math.abs(u.battleLeft + 207 * u.battleScale - (u.safeLeft + u.safeRight) / 2) < 0.01,
    '托盘与控件共享居中原点');
}
const calls = [];
const gl = new Proxy({}, { get: (_, k) => {
  if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
  if (k === 'getUniformLocation') return (_, name) => name === 'uAdd' ? 0 : name;
  if (k === 'getAttribLocation') return () => 1;
  if (k === 'uniform1f') return (loc, val) => { if (loc === 0) calls.push(['add', val]); };
  if (k === 'blendFunc' || k === 'blendFuncSeparate' || k === 'blendEquation') return (...args) => calls.push([k, ...args]);
  if (String(k).startsWith('create')) return () => ({});
  if (['SRC_ALPHA', 'ONE_MINUS_SRC_ALPHA', 'ONE', 'FUNC_ADD'].includes(k)) return k;
  return () => {};
} });
vm.runInContext(fs.readFileSync(new URL('render/gl.js', root), 'utf8'), ctx);
A.Render.init({ getContext: () => gl });
const R = A.Render;
R.beginFrame([0, 0, 0]);
R.setAdditive(true);
R.push(0, 0, 10, 10, { r: 1, g: 1, b: 1, a: 1 }); R.flush();
R.setAdditive(false);
calls.length = 0;
R.push(0, 0, 10, 10, { r: 0, g: 0, b: 0, a: 0.25 }); R.flush();
assert(calls.some(c => c[0] === 'add' && c[1] === 0), '句柄0也恢复普通透明绘制');
assert(calls.some(c => c[0] === 'blendFuncSeparate' && c[1] === 'SRC_ALPHA' && c[2] === 'ONE_MINUS_SRC_ALPHA' && c[3] === 'ONE' && c[4] === 'ONE_MINUS_SRC_ALPHA'),
  '每批保持正确颜色混合与不透明画布，描边不透出网页底色');
assert(calls.some(c => c[0] === 'blendEquation' && c[1] === 'FUNC_ADD'));
console.log('手机托盘居中、零值uniform与逐批混合状态恢复检查通过');
