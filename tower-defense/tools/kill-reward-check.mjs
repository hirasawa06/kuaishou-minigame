// ── 击败奖励：随机边界、固定奖励、飘字与重复结算 ──
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const math = Object.create(Math);
const context = { AIGCUtils: {}, Math: math };
context.window = context;
vm.createContext(context);
const root = new URL('../package/gameplay/', import.meta.url);
for (const file of ['config.js', 'state.js']) {
  vm.runInContext(fs.readFileSync(new URL(file, root), 'utf8'), context);
}
vm.runInContext(fs.readFileSync(new URL('play/battle.js', root), 'utf8').replace(
  'A.Battle = {', 'A.Battle = { testDamage: damageEnemy,'), context);
const { State: S, Config: C, Battle: B } = context.AIGCUtils;
S.addEffect = () => {};
for (const [roll, expected] of [[0, 1], [0.4999, 1], [0.5, 2], [0.9999, 2]]) {
  for (const [id, reward] of [['small', expected], ['normal', 6], ['elite', 12], ['boss', 60]]) {
    math.random = () => roll;
    S.gold = 20; S.goldEarned = 0; S.kills = 0;
    const floats = [];
    S.addFloat = (...args) => floats.push(args);
    const enemy = { def: C.ENEMIES[id], hp: 1, x: 100, y: 100 };
    B.testDamage(enemy, 1, true);
    assert.equal(S.gold, 20 + reward);
    assert.equal(S.goldEarned, reward);
    assert.equal(floats[0][2], String(reward));
    B.testDamage(enemy, 1, true);
    assert.equal(S.gold, 20 + reward, '死亡后不重复发奖励');
    assert.equal(S.kills, 1);
  }
}
console.log('台灯随机1/2边界、其他固定奖励及单次结算检查通过');
