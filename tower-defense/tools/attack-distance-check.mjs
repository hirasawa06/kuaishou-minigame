// 回归：录屏中的基地边缘追击卡死，及统一范围/目标保持规则。
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
const A = sandbox.AIGCUtils, S = A.State, ui = A.Layout.calc();
const source = fs.readFileSync(root + 'play/battle.js', 'utf8');
vm.runInContext(source.replace('A.Battle = {',
  'A.Battle = { testUnits: updateUnits, testCollisions: resolveBodyCollisions, testRange: attackInRange,'), sandbox);
S.addFloat = () => {};
S.addEffect = () => {};

function makePair(star, enemyId, startX, targetX = 331) {
  const def = S.heroAtStar('war', star), enemyDef = A.Config.ENEMIES[enemyId];
  const unit = { uid: 1, def, star, x: startX, y: 550, homeX: startX, homeY: 550,
    hp: def.hp, maxHp: def.hp, anim: 'idle', animT: 0, pendingHit: -1, atkTimer: 0 };
  const enemy = { uid: 2, def: enemyDef, x: targetX, y: ui.baseStopY,
    hp: 10000, maxHp: 10000, anim: 'idle', animT: 0, pendingHit: -1, atkTimer: 0 };
  S.units = [unit]; S.enemies = [enemy]; S.gold = 30;
  return { unit, enemy };
}

let cases = 0;
for (const star of [1, 2, 3]) {
  for (const enemyId of ['small', 'normal', 'elite']) {
    for (let x = 240; x <= 290; x += 2) {
      const { enemy } = makePair(star, enemyId, x);
      for (let frame = 0; frame < 450; frame++) {
        A.Battle.testUnits(1 / 60);
        A.Battle.testCollisions();
      }
      assert(enemy.hp < 10000, `${star}星/${enemyId}/${x} 停在边缘不攻击`);
      cases++;
    }
  }
}

for (const targetX of [ui.field.x + 11, ui.field.x + ui.field.w - 11]) {
  for (const step of [1 / 60, 1 / 30]) {
    const startX = targetX < 100 ? targetX + 90 : targetX - 90;
    const { enemy } = makePair(3, 'small', startX, targetX);
    for (let t = 0; t < 8; t += step) {
      A.Battle.testUnits(step);
      A.Battle.testCollisions();
    }
    assert(enemy.hp < 10000, '墙边/不同步长追击必须命中');
    cases++;
  }
}

const { unit, enemy } = makePair(3, 'small', 240);
unit.y = enemy.y;
const reach = unit.def.range + enemy.def.radius;
enemy.x = unit.x + reach + 0.25;
assert(A.Battle.testRange(unit, enemy, false), '浮点边界容差');
enemy.x = unit.x + reach + 1;
assert(!A.Battle.testRange(unit, enemy, false), '不扩大新目标获取范围');
assert(A.Battle.testRange(unit, enemy, true), '已有目标小幅移动仍可攻击');
unit.pendingTarget = enemy.uid;
assert.equal(A.Battle.findTarget(unit), enemy);
enemy.x = unit.x + reach + 2;
assert(!A.Battle.testRange(unit, enemy, true), '目标真正离开范围必须停止命中');
assert.equal(A.Battle.findTarget(unit), null);
enemy.dead = true;
assert(!A.Battle.testRange(unit, enemy, true), '死亡目标不可命中');
console.log(`${cases}组基地边缘/体型/星级追击及容差、目标保持、离开范围：通过`);
