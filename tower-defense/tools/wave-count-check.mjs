import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context = { AIGCUtils: { Layout: { w: 414, h: 896, safeTop: 0, usableH: 896 } } };
context.window = context;
vm.createContext(context);
for (const file of ['config', 'layout', 'state']) vm.runInContext(fs.readFileSync(new URL('../package/gameplay/' + file + '.js', import.meta.url), 'utf8'), context);
vm.runInContext('Math.random = function () { return 0.5; };', context);
const A = context.AIGCUtils, C = A.Config, S = A.State;
A.Layout.calc();
vm.runInContext(fs.readFileSync(new URL('../package/gameplay/play/battle.js', import.meta.url), 'utf8').replace('A.Battle = {', 'A.Battle = { testBuild: buildWave, testSpawn: spawnEnemy,'), context);
S.toastMsg = () => {};
let previous = 0;
for (let level = 1; level <= 10; level++) {
  const waves = C.wavesForLevel(level);
  const counts = waves.map(w => w.groups.reduce((sum, g) => sum + g[1], 0));
  const total = counts.reduce((a, b) => a + b, 0);
  assert(total > previous); previous = total;
  assert.equal(waves.length, level === 1 ? 5 : 8);
  if (level === 1) assert(waves.every(w => w.groups.every(g => !['elite', 'boss'].includes(g[0]))));
  else {
    counts.forEach((count, i) => { if (i) assert(count >= counts[i - 1]); });
    assert.equal(total, 120 + (level - 2) * 10);
  }
  const bosses = waves.flatMap(w => w.groups).filter(g => g[0] === 'boss').reduce((sum, g) => sum + g[1], 0);
  assert.equal(bosses, [5, 10].includes(level) ? 1 : 0);
  assert.equal(C.LEVELS[level - 1].hpScale, 1);
  assert.equal(C.LEVELS[level - 1].atkScale, 1);
  console.log(`第${level}关: ${counts.join('/')}，合计${total}`);
}
for (const wave of [0, 4, 7]) {
  let expected;
  for (const level of [2, 5, 10]) {
    S.currentLevel = level; S.levelHpScale = level; S.levelAtkScale = level;
    A.Battle.testBuild(wave);
    const enemy = A.Battle.testSpawn(S.spawnQueue.find(p => p.id !== 'boss'));
    const sameType = C.ENEMIES[enemy.def.id];
    const strength = [enemy.hp / sameType.hp, enemy.atk / sameType.atk];
    if (expected) {
      assert(Math.abs(strength[0] - expected[0]) < 0.02);
      assert(Math.abs(strength[1] - expected[1]) < 1e-10);
    } else expected = strength;
  }
}
console.log('counts increase / boss levels / strength independent of level: ok');
