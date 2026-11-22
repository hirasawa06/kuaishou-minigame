// 现状：末尾施工卡可选中，但不可开局或消耗体力。
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../package/gameplay/', import.meta.url);
const context = { AIGCUtils: { Layout: { w: 414, h: 896 } } };
context.window = context;
vm.createContext(context);
for (const file of ['config.js', 'layout.js', 'state.js', 'profile.js', 'game.js']) {
  vm.runInContext(fs.readFileSync(new URL(file, root), 'utf8'), context);
}
const A = context.AIGCUtils, S = A.State;
A.Layout.calc();
S.phase = 'menu'; S.selectedLevel = 10;
assert.equal(A.Game.selectLevel(1), true, '第10关之后应能翻到施工卡');
assert.equal(S.menuSlide.to, 11);
S.menuSlide = null; S.selectedLevel = 11;
assert.equal(A.Game.selectLevel(1), false, '第11张为末张');
let staminaCalls = 0;
A.Profile.isLevelUnlocked = level => level <= 10;
A.Profile.consumeStamina = () => { staminaCalls++; return true; };
assert.equal(A.Game.start(), false, '施工卡不能被截断成第10关开局');
assert.equal(staminaCalls, 0);
assert.equal(S.phase, 'menu');
assert.equal(S.toast.text, '施工中...');
assert.equal(A.Config.LEVELS.length, 10, '正式关卡数量保持10');
assert.equal(A.Game.selectLevel(-1), true);
assert.equal(S.menuSlide.to, 10);
console.log('10→11翻页、末张边界、返回10、禁止开局及体力隔离通过');
// ---- 绘制验证：任意正式关卡数之后均复用施工图，无锁、去色、模糊或蒙层 ----
const calls = [];
const draw = new Proxy({}, { get: (_, key) => (...args) => {
  calls.push([key, ...args]);
  return key === 'color' ? args[0] : 0;
} });
A.Render = { draw, setMaskTexture() {} };
A.Scene = { COL: {}, icon() {} };
A.Assets = { entry: key => ({ tex: key, w: 768, h: 768 }) };
A.Profile.data = { completedLevel: 0 };
vm.runInContext(fs.readFileSync(new URL('render/hud.js', root), 'utf8'), context);
const menu = A.Layout.ui.menu;
for (const key of ['avatar', 'stamina', 'settings', 'collection']) menu[key] = null;
for (const count of [10, 11, 15]) {
  A.Config.LEVELS.length = count;
  S.selectedLevel = count + 1; S.menuSlide = null; S.toast = null;
  calls.length = 0;
  A.Hud.drawMenu();
  const cover = calls.find(c => c[0] === 'roundTexture' && c[1] === 'level-cover-construction');
  assert(cover, '末张始终使用统一施工封面');
  assert.equal(cover[7], false, '保留原色');
  assert.equal(cover[8], false, '不模糊');
  assert(!calls.some(c => c[0] === 'texture' && c[1] === 'home-level-lock'), '不绘制锁');
  assert(!calls.some(c => c[0] === 'roundRect' && c.at(-1) === '#000000'), '不叠黑色蒙层');
  assert(calls.some(c => c[0] === 'centeredText' && c[1] === String(count + 1)), '编号自动顺延');
}
console.log('10/11/15个正式关卡后施工图复用、动态编号、无锁无蒙层及原色绘制通过');
// ---- 非正方形容器：原图保持比例，UV居中裁切并用容器圆角裁剪 ----
const quads = [], clips = [];
A.Render = { setTexture() {}, push: (...args) => quads.push(args),
  setClipRect: (...args) => clips.push(args) };
vm.runInContext(fs.readFileSync(new URL('render/draw.js', root), 'utf8'), context);
A.Render.draw.roundTexture('construction', 10, 20, 400, 300, 20, false, false, { w: 1254, h: 1254 });
const opts = quads[0][5];
assert.equal(opts.u0, 0); assert.equal(opts.u1, 1);
assert.equal(opts.v0, 0.125); assert.equal(opts.v1, 0.875);
assert.equal(opts.mode, 1);
assert.equal(clips[0][0].w, 400); assert.equal(clips[0][1], 20);
assert.equal(clips[1][0], null);
console.log('原图等比铺满、居中裁切、圆角及裁剪状态恢复通过');
