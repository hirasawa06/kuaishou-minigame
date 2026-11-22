import { readBattleSource } from './lib/battle-source.mjs';
// ── 三星机制回归：低星隔离、伤害比例、目标去重与延迟结算 ──
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../package/gameplay/', import.meta.url);
const ctx = { window: null }; ctx.window = ctx;
const A = ctx.AIGCUtils = { Layout: { w: 414, h: 896, safeTop: 0, usableH: 896 } };
vm.createContext(ctx);
for (const file of ['config.js', 'layout.js', 'state.js']) {
  vm.runInContext(fs.readFileSync(new URL(file, root), 'utf8'), ctx);
}
A.Layout.calc();
vm.runInContext(readBattleSource().replace(
  'A.Battle = {', 'A.Battle = { testDamage: A.BattleDamage.damageUnit, testAttack: A.BattleCombat.resolveAttack, testHeal: healAllies, testProjectiles: A.BattleCombat.updateProjectiles,'), ctx);
const S = A.State; S.addEffect = S.addFloat = () => {};
const makeUnit = (id, star, uid = 1) => ({ uid, def: S.heroAtStar(id, star),
  x: 207, y: 350, hp: 1000, maxHp: 1000, anim: 'idle', animT: 0 });
const monster = (uid, x = 207, y = 330) => ({ uid, def: A.Config.ENEMIES.normal,
  x, y, hp: 10000, maxHp: 10000, anim: 'idle', animT: 0 });
for (const star of [1, 2, 3]) {
  const tank = makeUnit('tank', star); A.Battle.testDamage(tank, 100);
  assert.equal(tank.hp, star === 3 ? 940 : 900);
  const warrior = makeUnit('war', star), primary = monster(10), neighbor = monster(11, 217);
  assert(Math.abs(warrior.def.atk - 50.4 * [1, 1.6, 3.25][star - 1]) < 1e-8);
  S.enemies = [primary, neighbor];
  A.Battle.testAttack(warrior, primary);
  assert(Math.abs(10000 - primary.hp - warrior.def.atk) < 1e-8);
  assert(Math.abs(10000 - neighbor.hp - (star === 3 ? warrior.def.atk * 0.5 : 0)) < 1e-8);
  const archer = makeUnit('arch', star), target = monster(20);
  S.enemies = [target]; S.projectiles = [];
  A.Battle.testAttack(archer, target);
  assert.equal(S.projectiles.length, star === 3 ? 2 : 1);
  A.Battle.testProjectiles(0.1);
  assert(Math.abs(10000 - target.hp - archer.def.atk) < 1e-8);
  A.Battle.testProjectiles(0.2);
  assert(Math.abs(10000 - target.hp - archer.def.atk * (star === 3 ? 1.5 : 1)) < 1e-8);
  const mage = makeUnit('mage', star), a = monster(30), b = monster(31, 217);
  S.enemies = [a, b]; S.projectiles = [];
  A.Battle.testAttack(mage, a); A.Battle.testProjectiles(0.1);
  assert(Math.abs(10000 - a.hp - mage.def.atk) < 1e-8, '首次爆炸主目标只结算一次');
  const before = b.hp;
  A.Battle.testProjectiles(0.1); assert.equal(b.hp, before);
  A.Battle.testProjectiles(0.11);
  assert(Math.abs(10000 - a.hp - mage.def.atk * (star === 3 ? 1.5 : 1)) < 1e-8);
  assert(Math.abs(before - b.hp - (star === 3 ? mage.def.atk * 0.5 : 0)) < 1e-8);
  assert.equal(S.projectiles.length, 0, '二次爆炸不递归');
  const healer = makeUnit('healer', star), ally1 = makeUnit('tank', 1, 41), ally2 = makeUnit('war', 1, 42);
  ally1.hp = 100; ally2.hp = 200; S.units = [healer, ally1, ally2];
  A.Battle.testHeal(healer);
  assert(Math.abs(ally1.hp - 100 - healer.def.heal) < 1e-8);
  assert(Math.abs(ally2.hp - 200 - (star === 3 ? healer.def.heal : 0)) < 1e-8);
  assert.equal(healer.def.cost, 8 * [1, 2, 4][star - 1]);
}
// ── 发射后绕后的原目标仍命中一次，身后其他怪不被群攻 ──
const mage = makeUnit('mage', 1), behind = monster(81), other = monster(82, 217);
S.enemies = [behind, other]; S.projectiles = [];
A.Battle.testAttack(mage, behind);
behind.y = other.y = 360;
A.Battle.testProjectiles(0.2);
assert(Math.abs(10000 - behind.hp - mage.def.atk) < 1e-8);
assert.equal(other.hp, 10000);
console.log('五角色×三星机制、低星隔离、延迟/比例/目标去重及费用：通过');
