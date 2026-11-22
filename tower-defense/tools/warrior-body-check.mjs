import { readBattleSource } from './lib/battle-source.mjs';
// ── 锤锤喵缩小占地：星级一致、显示尺寸保持与窄缝直达 ──
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
A.Layout.calc();
vm.runInContext(readBattleSource().replace(
  'A.Battle = {', 'A.Battle = { testRoute: A.BattleSpatial.returnRoute,'), c);
for (const star of [1, 2, 3]) {
  const def = S.heroAtStar('war', star);
  assert.equal(def.radius, 18);
  assert.equal(def.visualRadius, 21.6);
}
const unit = { def: S.heroAtStar('war', 1), x: 207, y: 420, homeX: 207, homeY: 300 };
S.units = [unit, ...[164, 250].map(x => ({ def: S.heroAtStar('arch', 1), x, y: 360 }))];
const route = A.Battle.testRoute(unit);
assert.equal(route.length, 1, '45.2px队友间隙应能直达');
assert.equal(route[0].x, 207);
assert.equal(route[0].y, 300);
console.log('锤锤喵三档碰撞18/显示21.6及窄缝直达：通过');
