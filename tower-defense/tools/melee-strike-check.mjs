import { readBattleSource } from './lib/battle-source.mjs';
// ── 近战起手回归：移动目标不因延迟结算连续落空，包围时一刀锁一个目标 ──
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../package/gameplay/', import.meta.url);
const ctx = { window: null };
ctx.window = ctx;
const A = ctx.AIGCUtils = { Layout: { w: 414, h: 896, safeTop: 0, usableH: 896 } };
vm.createContext(ctx);
for (const name of ['config.js', 'layout.js', 'state.js']) {
  vm.runInContext(fs.readFileSync(new URL(name, root), 'utf8'), ctx);
}
A.Layout.calc();
vm.runInContext(readBattleSource().replace(
  'A.Battle = {', 'A.Battle = { testUnits: updateUnits,'), ctx);
const S = A.State;
S.addEffect = S.addFloat = () => {};
const monster = (uid, x, y) => ({ uid, def: A.Config.ENEMIES.small,
  x, y, hp: 10000, maxHp: 10000, dead: false });
for (const star of [1, 2, 3]) {
  const def = S.heroAtStar('war', star);
  const unit = { uid: 1, def, x: 207, y: 350, homeX: 207, homeY: 350,
    hp: def.hp, maxHp: def.hp, anim: 'idle', animT: 0, pendingHit: -1, atkTimer: 0 };
  const runner = monster(2, 207, 350 + def.range + A.Config.ENEMIES.small.radius - 0.1);
  S.units = [unit]; S.enemies = [runner];
  A.Battle.testUnits(0.01);
  assert.equal(unit.pendingTarget, runner.uid);
  runner.y += 10;
  A.Battle.testUnits(0.1);
  assert(runner.hp < 10000, '有效近战起手后，跑动目标不应因延迟重复验距而miss');
  unit.anim = 'idle'; unit.pendingHit = -1; unit.atkTimer = 0;
  const ring = Array.from({ length: 8 }, (_, i) => monster(i + 10,
    unit.x + Math.cos(i * Math.PI / 4) * 50, unit.y + Math.sin(i * Math.PI / 4) * 50));
  S.enemies = ring;
  A.Battle.testUnits(0.01);
  const locked = ring.find(e => e.uid === unit.pendingTarget);
  const rival = ring.find(e => e !== locked);
  rival.x = unit.x; rival.y = unit.y + 65;
  assert.equal(A.Battle.findTarget(unit), locked, '正在攻击的目标优先于更近家门的怪');
  A.Battle.testUnits(0.1);
  assert(locked.hp < 10000);
  assert.equal(rival.hp, 10000);
  // ── 攻击后目标跑出范围，绕行点在后方也应保持朝向追击目标 ──
  unit.anim = 'idle'; unit.animT = 0; unit.pendingHit = -1; unit.atkTimer = 1;
  unit.x = 207; unit.y = 350; unit.rigId = 'war-back'; unit.pendingTarget = 0;
  const chase = monster(40, 207, 230);
  S.enemies = [chase];
  unit.returnPath = [{ x: 207, y: 365 }, { x: 207, y: 280 }];
  unit.returnRouteT = 1; unit.routeTarget = chase.uid;
  A.Battle.testUnits(0.01);
  assert.equal(unit.rigId, 'war-back', '绕行点不能让追击中的角色突然回头');
  // ── 面朝身后怪物攻击结束后，待机必须继承本次攻击朝向 ──
  unit.x = 207; unit.y = 350; unit.homeX = 207; unit.homeY = 350;
  unit.anim = 'atk'; unit.animT = 0.59; unit.rigId = 'war-front';
  unit.pendingHit = -1; unit.atkTimer = 1;
  S.enemies = [monster(50, 207, 390)];
  A.Battle.testUnits(0.02);
  assert.equal(unit.anim, 'idle');
  assert.equal(unit.rigId, 'war-front', '攻击转待机不能强制切回背面');
  S.enemies = []; unit.pendingTarget = 0;
  A.Battle.testUnits(0.02);
  assert.equal(unit.rigId, 'war-back', '归位且无目标的待机应朝向前方');
}
console.log('三星移动目标、包围锁定、绕行朝向与攻击转待机朝向继承：通过');
