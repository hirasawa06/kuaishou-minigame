import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context = { AIGCUtils: { Layout: { w: 414, h: 896, safeTop: 0, usableH: 896 } } };
context.window = context;
vm.createContext(context);
for (const file of ['config', 'layout', 'state']) {
  vm.runInContext(fs.readFileSync(new URL('../package/gameplay/' + file + '.js', import.meta.url), 'utf8'), context);
}
const A = context.AIGCUtils, S = A.State;
for (const queue of [[], ['tank'], ['tank', 'mage']]) {
  S.phase = 'win'; S.unlockNotice = queue; S.unlockNoticeIndex = 0;
  assert.equal(S.newPetPending(), queue.length > 0);
  for (let i = 0; i < queue.length; i++) {
    assert.equal(S.unlockNotice[S.unlockNoticeIndex], queue[i]);
    assert(S.advanceNewPet());
  }
  assert(!S.newPetPending(), '浏览全部新宠后才显示原胜利弹窗');
  assert(!S.advanceNewPet());
  S.phase = 'lose'; S.unlockNoticeIndex = 0;
  assert(!S.newPetPending(), '失败不展示新宠');
}
for (const [w, h] of [[414, 896], [360, 780], [320, 568]]) {
  A.Layout.w = w; A.Layout.h = h; A.Layout.usableH = h;
  const u = A.Layout.calc(), g = u.newPet;
  assert(g.card.y >= u.contentTop);
  assert(g.button.y > g.card.y + g.card.h);
  assert(g.button.y + g.button.h <= u.contentBottom);
}
S.isHeroUnlocked = () => true; S.currentLevel = 1; S.reset();
assert.equal(S.unlockNoticeIndex, 0);
assert.equal(S.unlockNotice.length, 0);
console.log('new pet queue / result transition / layout / reset: ok');
