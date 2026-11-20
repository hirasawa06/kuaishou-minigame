// 席位上限、合成自动锁定及刷新保留回归。
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const sandbox = { AIGCUtils: {} };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const name of ['config', 'state']) {
  vm.runInContext(fs.readFileSync(new URL('../package/gameplay/' + name + '.js', import.meta.url), 'utf8'), sandbox);
}
const { Config: C, State: S } = sandbox.AIGCUtils;
S.phase = 'playing';
S.isHeroUnlocked = () => true;
S.notifyAction = () => {};
S.toastMsg = () => {};
for (const level of [1, 2, C.LEVELS.length, 1]) {
  S.currentLevel = level;
  S.reset();
  assert.equal(S.heroCap, level === 1 ? 1 : 3, '新局席位按关卡分配，不继承上一关');
}
S.gold = 100000;
S.heroCap = C.UNIT_CAP_START;
S.capCost = 1;
while (S.heroCap < 20) assert(S.buyCap());
const gold = S.gold;
assert.equal(S.buyCap(), false);
assert.equal(S.heroCap, 20);
assert.equal(S.gold, gold, '满级后不应扣费');
for (const star of [1, 2]) {
  S.shop = [0, 1, 2, 3].map(() => ({ cardId: C.HEROES[0].id, star, sold: false, locked: false }));
  assert(S.mergeShopCards(0, 1));
  assert.equal(S.shop[1].star, star + 1);
  assert.equal(S.shop[1].locked, true);
  assert.equal(S.shop[0].sold, true);
  assert.equal(S.shop[0].locked, false);
  const merged = S.shop[1];
  S.refreshShop(true);
  assert.equal(S.shop[1], merged, '刷新应保留自动锁定卡片');
  assert(S.toggleShopLock(1));
  assert.equal(merged.locked, false, '合成后仍可手动解锁');
}
console.log('shop rules: ok');
