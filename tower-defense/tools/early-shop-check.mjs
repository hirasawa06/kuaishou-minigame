// ── 固定种子统计早期重复率，并核对关卡、波次及锁卡边界 ──
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
let seed;
const math = Object.create(Math);
math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const sandbox = { AIGCUtils: {}, Math: math };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const name of ['config', 'state']) {
  vm.runInContext(fs.readFileSync(new URL('../package/gameplay/' + name + '.js', import.meta.url), 'utf8'), sandbox);
}
const { Config: C, State: S } = sandbox.AIGCUtils;
S.phase = 'playing';
S.notifyAction = () => {};
S.toastMsg = () => {};
function sample(level, wave, size, locked = false) {
  seed = 123456;
  S.currentLevel = level;
  S.waveIndex = wave;
  const ids = C.HEROES.slice(0, size).map(h => h.id);
  S.isHeroUnlocked = id => ids.includes(id);
  let duplicates = 0, matches = 0;
  const samples = 30000;
  for (let i = 0; i < samples; i++) {
    const kept = { cardId: ids[0], star: 1, sold: false, locked: true };
    S.shop = locked ? [null, null, null, kept] : [];
    S.rollShop();
    assert.equal(S.shop.length, 4);
    const drawn = S.shop.map(s => s.cardId);
    assert(drawn.every(id => ids.includes(id)));
    duplicates += new Set(drawn).size < drawn.length;
    if (locked) {
      assert.equal(S.shop[3], kept, '后槽锁卡也必须先计入权重');
      matches += drawn.slice(0, 3).includes(ids[0]);
    }
  }
  return { duplicates: duplicates / samples, matches: matches / samples };
}
for (const size of [4, 5]) {
  const normal = sample(2, 4, size);
  const early = sample(2, 0, size);
  assert(early.duplicates < normal.duplicates * 0.75);
  assert(early.duplicates > 0, '不能完全禁止重复');
  assert.deepEqual(sample(2, 1, size), early);
  const third = sample(2, 2, size), fourth = sample(2, 3, size);
  assert(early.duplicates < third.duplicates && third.duplicates < fourth.duplicates && fourth.duplicates < normal.duplicates);
  assert.deepEqual(sample(1, 0, size), normal, '第一关沿用独立均匀抽卡');
  assert.deepEqual(sample(3, 0, size), early, '后续关卡也应用早期规则');
  const earlyLock = sample(2, 0, size, true);
  const normalLock = sample(2, 4, size, true);
  assert(earlyLock.matches < normalLock.matches * 0.5);
  console.log(`${size}角色：重复率 ${(normal.duplicates * 100).toFixed(1)}% → ${(early.duplicates * 100).toFixed(1)}%；锁卡同款率 ${(normalLock.matches * 100).toFixed(1)}% → ${(earlyLock.matches * 100).toFixed(1)}%`);
  console.log(`逐波重复率：${[early, early, third, fourth, normal].map(x => (x.duplicates * 100).toFixed(1)).join(' → ')}%`);
}
sample(2, 0, 1); // 单角色时仍可正常填满
S.isHeroUnlocked = () => false;
S.rollShop();
assert(S.shop.every(s => s.sold && s.cardId === null));
S.isHeroUnlocked = () => true;
S.shop = Array.from({ length: 4 }, () => ({ cardId: C.HEROES[0].id, star: 2, sold: false, locked: true }));
S.gold = 100;
seed = 42;
S.rollShop();
assert.equal(seed, 42, '全锁定不消耗随机数');
assert.equal(S.refreshShop(), false);
assert.equal(S.gold, 100);
S.shop[0].locked = false;
assert(S.refreshShop());
assert.equal(S.gold, 100 - C.REFRESH_COST);
console.log('early shop: ok');
