// ── 加载页回归：真实进度、原图比例、首屏无字体依赖与短屏安全区 ──
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = new URL('../package/gameplay/', import.meta.url);
const sandbox = { window: null };
sandbox.window = sandbox;
const A = sandbox.AIGCUtils = { Layout: { w: 390, h: 845, safeTop: 0, usableH: 845 } };
vm.createContext(sandbox);
for (const name of ['config.js', 'layout.js', 'state.js']) {
  vm.runInContext(fs.readFileSync(new URL(name, root), 'utf8'), sandbox);
}
let ratio = 0, images = true;
const calls = [];
A.Scene = { COL: {} };
A.Assets = {
  progress: () => ({ ratio }),
  entry: key => images ? { tex: key, w: key === 'loading-background' ? 780 : 640,
    h: key === 'loading-background' ? 1690 : 220 } : null
};
A.Render = { draw: {
  color: c => c,
  rect: (...args) => calls.push(['rect', ...args]),
  roundRect: (...args) => calls.push(['round', ...args]),
  texture: (...args) => calls.push(['texture', ...args])
} };
vm.runInContext(fs.readFileSync(new URL('render/hud.js', root), 'utf8'), sandbox);
A.State.phase = 'loading';
for (const [w, h] of [[390, 845], [414, 896], [360, 640], [390, 548]]) {
  A.Layout.w = w; A.Layout.h = h;
  for (ratio of [0, 0.57, 1]) {
    calls.length = 0;
    A.Hud.drawLoading();
    const rounds = calls.filter(c => c[0] === 'round');
    const bar = rounds[0], ui = A.Layout.ui;
    assert(bar[2] >= ui.contentTop && bar[2] + bar[4] <= ui.contentBottom + 1e-8);
    assert.equal(rounds.length, ratio === 0 ? 2 : 3);
    if (ratio > 0) assert(Math.abs(rounds[2][3] - bar[3] * ratio) < 1e-8);
    assert.equal(calls.filter(c => c[0] === 'texture').length, 3);
  }
}
images = false;
A.Hud.drawLoading();
console.log('四种竖屏×三档真实进度、纹理显示、首帧无素材兜底：通过');
