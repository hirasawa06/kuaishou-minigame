import { readBattleSource } from './lib/battle-source.mjs';
// ── 波次成长：每两波一档，血量与攻击同步；数量和奖励保持 ──
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const math = Object.create(Math);
math.random = () => 0.5;
const c = { AIGCUtils: {}, Math: math };
c.window = c;
vm.createContext(c);
const root = new URL('../package/gameplay/', import.meta.url);
for (const file of ['config.js', 'state.js']) {
  vm.runInContext(fs.readFileSync(new URL(file, root), 'utf8'), c);
}
vm.runInContext(readBattleSource().replace(
  'A.Battle = {', 'A.Battle = { testBuildWave: buildWave,'), c);
const { Config: C, State: S, Battle: B } = c.AIGCUtils;
let toast;
S.toastMsg = text => { toast = text; };
for (const level of [1, 2, 5, 10]) {
  S.currentLevel = level;
  const waves = S.getWaves();
  for (let index = 0; index < waves.length; index++) {
    B.testBuildWave(index);
    assert.equal(toast, index > 0 && index % 2 === 0
      ? '家具们变强了' : '第 ' + (index + 1) + ' 波来袭');
    const tier = Math.floor(index / 2);
    assert.equal(S.spawnQueue.length, waves[index].groups.reduce((sum, group) => sum + group[1], 0));
    for (const enemy of S.spawnQueue) {
      assert(Math.abs(enemy.hp - Math.pow(C.waveHpScale, tier)) < 1e-10);
      assert(Math.abs(enemy.atk - Math.pow(C.waveAtkScale, tier)) < 1e-10);
    }
  }
}
console.log('四关实际波次队列：每两波血量/攻击成长及数量检查通过');
