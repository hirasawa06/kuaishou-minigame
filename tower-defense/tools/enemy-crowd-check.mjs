import { readBattleSource } from './lib/battle-source.mjs';
// ── 密集攻击回归：接触宠物时沿原方向退让，不吸到同一排队点 ──
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../package/gameplay/', import.meta.url));
const sandbox = { innerWidth: 414, innerHeight: 896 };
sandbox.window = sandbox;
sandbox.AIGCUtils = { Layout: { w: 414, h: 896, safeTop: 0, usableH: 896 } };
vm.createContext(sandbox);
for (const name of ['config', 'layout', 'state']) {
  vm.runInContext(fs.readFileSync(root + name + '.js', 'utf8'), sandbox);
}
const A = sandbox.AIGCUtils, S = A.State;
A.Layout.calc();
vm.runInContext(readBattleSource().replace(
  'A.Battle = {', 'A.Battle = { testCollisions: A.BattleSpatial.resolveBodyCollisions,'), sandbox);
const defender = { uid: 1, def: S.heroAtStar('tank', 1), x: 207, y: 350 };
const def = A.Config.ENEMIES.small;
const distance = defender.def.radius + def.radius + A.Config.ACTOR_BODY_GAP + 0.5;
S.units = [defender];
S.enemies = [-1, 1].map((side, i) => ({ uid: i + 2, def,
  x: defender.x + side * distance * 0.8,
  y: defender.y - distance * 0.6 + 0.1, anim: 'atk', pendingHit: 0.1 }));
const starts = S.enemies.map(e => ({ x: e.x, y: e.y }));
A.Battle.testCollisions();
for (let i = 0; i < S.enemies.length; i++) {
  const e = S.enemies[i], start = starts[i];
  assert(Math.hypot(e.x - start.x, e.y - start.y) < 1,
    '轻微接触不应把侧面攻击者闪现到宠物正上方');
  assert(e.y < defender.y, '怪物保持在宠物北侧');
}
for (let frame = 0; frame < 120; frame++) A.Battle.testCollisions();
for (let i = 0; i < S.enemies.length; i++) {
  assert(Math.hypot(S.enemies[i].x - starts[i].x, S.enemies[i].y - starts[i].y) < 1,
    '持续扎堆攻击应保持稳定');
}
console.log('双侧密集攻击、小接触位移及120帧稳定性：通过');
