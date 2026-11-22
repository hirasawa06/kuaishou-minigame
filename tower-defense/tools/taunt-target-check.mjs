import { readBattleSource } from './lib/battle-source.mjs';
// ── 嘲讽优先：猫在前方、起手后接管、范围外与盾死亡恢复 ──
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c = { AIGCUtils: { Layout: { w: 414, h: 896, safeTop: 0, usableH: 896 } } };
c.window = c;
vm.createContext(c);
const root = new URL('../package/gameplay/', import.meta.url);
for (const file of ['config.js', 'layout.js', 'state.js']) {
  vm.runInContext(fs.readFileSync(new URL(file, root), 'utf8'), c);
}
const A = c.AIGCUtils, S = A.State;
A.Layout.calc(); S.addFloat = S.addEffect = () => {};
vm.runInContext(readBattleSource().replace(
  'A.Battle = {', 'A.Battle = { testEnemies: updateEnemies,'), c);
function setup(id = 'small') {
  const tank = { uid: 1, def: S.heroAtStar('tank', 1), x: 207, y: 340, hp: 1000, maxHp: 1000 };
  const cat = { uid: 2, def: S.heroAtStar('war', 1), x: 207, y: 320, hp: 1000, maxHp: 1000 };
  const def = A.Config.ENEMIES[id];
  const enemy = { uid: 3, def, x: 207, y: 300, hp: def.hp, atk: def.atk,
    speed: def.speed, anim: 'idle', animT: 0, atkTimer: 0, pendingHit: -1 };
  S.units = [cat, tank]; S.enemies = [enemy];
  return { tank, cat, enemy };
}
for (const id of ['small', 'normal', 'elite', 'boss']) {
  const { tank, cat, enemy } = setup(id);
  A.Battle.testEnemies(0.01);
  assert.equal(enemy.pendingTarget, tank.uid, '猫在前方仍先攻击盾');
  enemy.pendingHit = 0.001;
  A.Battle.testEnemies(0.01);
  assert.equal(tank.hp, 1000 - enemy.atk);
  assert.equal(cat.hp, 1000);
}
{
  const { tank, cat, enemy } = setup();
  enemy.pendingTarget = cat.uid; enemy.pendingHit = 0.001; enemy.atkTimer = 1;
  A.Battle.testEnemies(0.01);
  assert.equal(cat.hp, 1000, '嘲讽接管已起手的单体攻击');
  assert.equal(tank.hp, 1000 - enemy.atk);
}
for (const mode of ['dead', 'outside', 'behind']) {
  const { tank, cat, enemy } = setup();
  if (mode === 'dead') tank.dead = true;
  if (mode === 'outside') tank.x = 400;
  if (mode === 'behind') tank.y = 290;
  A.Battle.testEnemies(0.01);
  assert.equal(enemy.pendingTarget, cat.uid, '无有效嘲讽时恢复前排目标');
}
{
  const { tank, cat, enemy } = setup();
  tank.y = 400;
  A.Battle.testEnemies(0.01);
  assert.equal(enemy.pendingHit, -1, '未到盾攻击距离时不隔空攻击或转打猫');
  assert.equal(cat.hp, 1000);
}
console.log('四类家具嘲讽优先、起手接管、失效恢复及攻击距离：通过');
// ── 全帧复现：固定奶糖挡在盾前，家具必须绕行而非永久无伤卡住 ──
S.reset(); S.phase = 'playing'; S.shop = [];
{
  const { tank, cat, enemy } = setup();
  tank.y = 400;
  cat.y = 340; cat.def = S.heroAtStar('healer', 1); cat.def.heal = 0;
  const oldTankHp = tank.hp, oldBlockHp = cat.hp;
  enemy.maxHp = enemy.hp;
  for (let frame = 0; frame < 1800; frame++) A.Battle.update(1 / 60, 1 / 60, true);
  assert(tank.hp < oldTankHp, '绕过固定角色后盾应实际承伤');
  assert.equal(cat.hp, oldBlockHp, '仍不改打挡路的非嘲讽目标');
}
console.log('30秒完整更新：嘲讽家具绕开固定队友并攻击盾位：通过');
