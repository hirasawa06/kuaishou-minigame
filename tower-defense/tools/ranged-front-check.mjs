// ── 远程扇形：边界、目标保持、出手及飞行中绕后、范围伤害隔离 ──
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../package/gameplay/', import.meta.url);
const context = { window: null };
context.window = context;
context.AIGCUtils = { Layout: { w: 414, h: 896, safeTop: 0, usableH: 896 } };
vm.createContext(context);
for (const name of ['config.js', 'layout.js', 'state.js']) {
  vm.runInContext(fs.readFileSync(new URL(name, root), 'utf8'), context);
}
const A = context.AIGCUtils, S = A.State;
A.Layout.calc();
vm.runInContext(fs.readFileSync(new URL('play/battle.js', root), 'utf8').replace(
  'A.Battle = {', 'A.Battle = { testTaunt: updateTaunt, testRange: attackInRange, testUnits: updateUnits, testProjectiles: updateProjectiles, testSplash: applySplash,'), context);
S.addEffect = S.addFloat = () => {};
const enemy = (uid, x, y) => ({ uid, def: A.Config.ENEMIES.normal, x, y, hp: 10000, maxHp: 10000 });
for (const id of ['arch', 'mage']) {
  for (const star of [1, 2, 3]) {
    const def = S.heroAtStar(id, star);
    const unit = { uid: 1, def, x: 207, y: 400, hp: def.hp, maxHp: def.hp,
      anim: 'idle', animT: 0, pendingHit: -1, atkTimer: 0 };
    const front = enemy(2, 207, 370), rear = enemy(3, 207, 400.001);
    for (const x of [157, 207, 257]) {
      assert(A.Battle.testRange(unit, enemy(4, x, 400), false));
      assert(!A.Battle.testRange(unit, enemy(4, x, 400.001), true));
    }
    S.units = [unit]; S.enemies = [rear, front]; S.projectiles = [];
    assert.equal(A.Battle.findTarget(unit), front);
    A.Battle.testUnits(0.01);
    assert.equal(unit.pendingTarget, front.uid);
    front.y = 410;
    A.Battle.testUnits(0.5);
    assert.equal(S.projectiles.length, 0, '出手前绕后不发射');
    const p = { sourceUnit: unit, targetUid: rear.uid, x: 207, y: 399,
      tx: 207, ty: 399, speed: 680, life: 1, dmg: 10, kind: 'light' };
    S.projectiles = [p];
    A.Battle.testProjectiles(0.1);
    assert.equal(rear.hp, 10000, '飞行中绕后不命中');
    front.y = 395;
    A.Battle.testSplash({ sourceUnit: unit, splash: 100, dmg: 10, kind: 'magic' }, 207, 400);
    assert(front.hp < 10000);
    assert.equal(rear.hp, 10000, '范围伤害不波及背后');
  }
}
assert(A.Battle.testRange({ def: S.heroAtStar('war', 1), x: 207, y: 400 }, enemy(2, 207, 410)));
console.log('两种远程×三星前方180度、出手/弹道/范围伤害及战士隔离：通过');
for (const star of [1, 2, 3]) {
  const tank = { uid: 1, def: S.heroAtStar('tank', star), x: 207, y: 400 };
  S.units = [tank];
  for (const [x, y, affected] of [[207, 370, true], [157, 400, true],
    [257, 400, true], [207, 400.001, false], [207, 100, false]]) {
    const e = enemy(2, x, y);
    e.taunted = 0; S.enemies = [e];
    A.Battle.testTaunt(1 / 60);
    assert.equal(e.taunted > 0, affected, '嘲讽前方/边界/背后/距离限制');
    if (!affected) { assert.equal(e.x, x); assert.equal(e.y, y); }
  }
  const e = enemy(2, 207, 390);
  e.taunted = 0; S.enemies = [e]; A.Battle.testTaunt(1 / 60);
  e.x = 197; e.y = 401;
  A.Battle.testTaunt(1 / 60);
  assert.equal(e.x, 197); assert.equal(e.y, 401, '越到背后立即停止吸附');
}
console.log('柴不破三星嘲讽前方180度、左右边界、距离及越过身后：通过');
