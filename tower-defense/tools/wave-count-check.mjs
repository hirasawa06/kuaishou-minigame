import { readBattleSource } from './lib/battle-source.mjs';
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
vm.runInContext(readBattleSource().replace('A.Battle = {', 'A.Battle = { testBuild: buildWave, testSpawn: spawnEnemy, testWaves: updateWaves,'), context);
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
    assert.equal(total, 168 + (level - 2) * 10);
    for (const [index, base] of [[5, 24], [6, 36], [7, 48]]) {
      assert.equal(counts[index], base + (level - 2) * (index >= 6 ? 2 : 1));
    }
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
// ── 后三波必须按计时器逐批出场，队列未空不能进入清波结算 ──
for (const level of [2, 10]) for (const wave of [5, 6, 7]) {
  S.currentLevel = level; S.waveIndex = wave; S.enemies = [];
  A.Battle.testBuild(wave);
  const total = S.spawnQueue.length;
  A.Battle.testWaves(0);
  assert.equal(S.enemies.length, 3);
  assert.equal(S.spawnQueue.length, total - 3);
  A.Battle.testWaves(0.75);
  assert.equal(S.enemies.length, 3, '未到间隔不提前出下一批');
  A.Battle.testWaves(0.75);
  assert.equal(S.enemies.length, 6);
  assert.equal(S.waveState, 'spawning');
  while (S.spawnQueue.length) A.Battle.testWaves(1.5);
  assert.equal(S.enemies.length, total);
  assert.equal(S.waveState, 'fighting');
  assert.equal(S.waveIndex, wave, '全出完但未击败时不进入下一波');
}
console.log('第6/7/8波分批间隔、完整出场及清波门槛：通过');
// ── 随机极值：1～5只，批间1～2秒；最后一批按剩余截断 ──
for (const [roll, expected] of [[0, 1], [0.999999, 5]]) {
  vm.runInContext('Math.random = function () { return ' + roll + '; };', context);
  S.currentLevel = 2; S.waveIndex = 7; S.enemies = [];
  A.Battle.testBuild(7);
  A.Battle.testWaves(0);
  assert.equal(S.enemies.length, expected);
  assert(Math.abs(S.spawnTimer - (1 + roll)) < 1e-10);
  assert(S.spawnTimer >= 1 && S.spawnTimer <= 2);
  S.spawnQueue = S.spawnQueue.slice(0, 1);
  A.Battle.testWaves(2);
  assert.equal(S.enemies.length, expected + 1);
  assert.equal(S.spawnQueue.length, 0);
}
console.log('随机1～5只/1～2秒边界与末批截断：通过');
