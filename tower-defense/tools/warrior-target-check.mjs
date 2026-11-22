import { readBattleSource } from './lib/battle-source.mjs';
// ── 守家目标回归：家门距离、自身距离、死亡/范围过滤及旧目标切换 ──
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../package/gameplay/', import.meta.url);
const ctx = { window: null };
ctx.window = ctx;
const A = ctx.AIGCUtils = { Layout: { w: 414, h: 896, safeTop: 0, usableH: 896 } };
vm.createContext(ctx);
for (const file of ['config.js', 'layout.js', 'state.js']) {
  vm.runInContext(fs.readFileSync(new URL(file, root), 'utf8'), ctx);
}
A.Layout.calc();
vm.runInContext(readBattleSource().replace(
  'A.Battle = {', 'A.Battle = { testPriority: A.BattleTargeting.homePriorityEnemy, testUnits: updateUnits,'), ctx);
const S = A.State;
for (const star of [1, 2, 3]) {
  const unit = { uid: 1, def: S.heroAtStar('war', star), x: 207, y: 400, pendingTarget: 0 };
  const nearSelf = { uid: 2, def: A.Config.ENEMIES.small, x: 207, y: 390 };
  const nearHome = { uid: 3, def: A.Config.ENEMIES.small, x: 230, y: 440 };
  S.enemies = [nearSelf, nearHome];
  assert.equal(A.Battle.findTarget(unit), nearHome, '无交战目标优先守家');
  assert.equal(A.Battle.testPriority(unit, 312), nearHome, '追击同样优先守家');
  nearSelf.y = nearHome.y;
  assert.equal(A.Battle.findTarget(unit), nearSelf, '离家相同选离自己近');
  nearSelf.dead = true;
  assert.equal(A.Battle.findTarget(unit), nearHome, '忽略死亡怪');
  nearHome.y = A.Layout.ui.baseStopY;
  assert.equal(A.Battle.findTarget(unit), null, '不越攻击范围');
  assert.equal(A.Battle.testPriority(unit, 10), null, '不越寻敌范围');
  nearSelf.dead = false; nearSelf.y = 390;
  nearHome.y = 520;
  assert.equal(A.Battle.findTarget(unit), nearSelf, '攻击范围内敌人优先于远处家门目标');
  Object.assign(unit, { homeX: 207, homeY: 400, hp: unit.def.hp, maxHp: unit.def.hp,
    anim: 'atk', animT: 0.01, pendingHit: 0.2, atkTimer: 1, pendingTarget: nearSelf.uid });
  S.units = [unit];
  A.Battle.testUnits(0.01);
  assert(unit.pendingHit > 0, '保留正在进行的攻击');
  assert.equal(unit.pendingTarget, nearSelf.uid, '正在攻击的目标优先');
  assert.equal(unit.y, 400, '攻击中不转去追其他怪');
  nearSelf.dead = true; unit.pendingHit = -1;
  assert.equal(A.Battle.findTarget(unit), null, '旧目标死后，远处家门目标需要追击');
  A.Battle.testUnits(0.01);
  assert.equal(unit.routeTarget, nearHome.uid, '旧目标失效后追家门最近的怪');
}
console.log('锤锤喵三星守家/自身距离排序、旧目标切换、死亡及范围过滤：通过');
