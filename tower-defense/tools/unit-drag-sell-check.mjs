import { readBattleSource } from './lib/battle-source.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../package/gameplay/', import.meta.url);
const ctx = { window: null }; ctx.window = ctx;
const A = ctx.AIGCUtils = { Layout: { w: 414, h: 896, safeTop: 0, usableH: 896 } };
vm.createContext(ctx);
for (const file of ['config.js', 'layout.js', 'state.js', 'play/battle.js']) {
  vm.runInContext(file === 'play/battle.js' ? readBattleSource() : fs.readFileSync(new URL(file, root), 'utf8'), ctx);
}
vm.runInContext(fs.readFileSync(new URL('input.js', root), 'utf8').replace(
  'A.Input = {', 'A.Input = { testDown: onDown, testMove: onMove, testUp: onUp,'), ctx);
A.Layout.calc();
const ghostCalls = [];
A.Rigs = {};
A.Render = { draw: { color: () => ({}) } };
A.Anim = { draw: (...args) => ghostCalls.push(args) };
vm.runInContext(fs.readFileSync(new URL('render/scene.js', root), 'utf8'), ctx);
const S = A.State, u = A.Layout.ui;
for (const id of ['war', 'arch', 'tank', 'mage', 'healer']) {
  S.phase = 'playing'; S.shop = []; S.gold = 0; S.enemies = []; S.projectiles = [];
  const def = S.heroAtStar(id, 1);
  const unit = { uid: 1, def, x: u.field.x + 70, y: u.field.y + 130,
    hp: def.hp, maxHp: def.hp, purchaseCost: 10, pendingHit: -1 };
  S.units = [unit];
  A.Input.testDown(unit.x, unit.y);
  A.Input.testMove(unit.x + 30, unit.y + 30);
  assert(A.Input.getDrag().active, id + '可启动拖动');
  A.Rigs[id] = { scale: 1 };
  ghostCalls.length = 0;
  A.Scene.drawDragGhost();
  assert.equal(ghostCalls.length, 1, id + '显示拖动身体');
  assert.equal(ghostCalls[0][2], unit.x + 30, '副本跟随拖动横坐标');
  assert.equal(ghostCalls[0][5].alpha, 0.7, '拖动副本半透明');
  A.Input.testUp(unit.x + 30, unit.y + 30);
  assert.equal(S.units.length, 1, '战场松手不出售或改变站位');
  A.Input.testDown(unit.x, unit.y);
  A.Input.testMove(u.sellZone.x + u.sellZone.w / 2, u.sellZone.y + u.sellZone.h / 2);
  A.Input.testUp(u.sellZone.x + u.sellZone.w / 2, u.sellZone.y + u.sellZone.h / 2);
  assert.equal(S.units.length, 0, id + '拖入出售区移除');
  assert.equal(S.gold, 5, '按实付与生命比例返还饼干');
  A.Input.testUp(u.sellZone.x + 20, u.sellZone.y + 20);
  assert.equal(S.gold, 5, '重复抬手不重复返还');
  S.units = [unit]; S.gold = 0;
  A.Input.testDown(unit.x, unit.y);
  A.Input.testMove(unit.x + 30, unit.y + 30);
  A.Input.cancel();
  assert.equal(A.Input.getDrag(), null, '取消后无拖动副本');
  assert.equal(S.dragging, null, '取消清空渲染状态');
  assert.equal(S.units.length, 1, '取消不出售');
  A.Input.testDown(unit.x, unit.y);
  A.Input.testMove(unit.x + 30, unit.y + 30);
  S.phase = 'paused';
  A.Input.testUp(u.sellZone.x + 20, u.sellZone.y + 20);
  assert.equal(S.gold, 0, '暂停时松手不出售');
  S.phase = 'playing';
  A.Input.testDown(unit.x, unit.y);
  A.Input.testMove(unit.x + 30, unit.y + 30);
  unit.dead = true; unit.hp = 0;
  ghostCalls.length = 0;
  A.Scene.drawDragGhost();
  assert.equal(ghostCalls.length, 0, '拖动途中死亡不残留副本');
  A.Input.testUp(u.sellZone.x + 20, u.sellZone.y + 20);
  assert.equal(S.gold, 0, '死亡角色不返还饼干');
}
console.log('五类角色拖动绘制、出售、取消、暂停、死亡及重复抬手检查通过');

// ── 出售血量门槛：60%含边界，低于门槛统一1块 ──
for (const [hp, expected] of [[100, 5], [60, 5], [59.999, 1], [30, 1], [1, 1], [0, 0]]) {
  const unit = { def: S.heroAtStar('arch', 1), hp, maxHp: 100, purchaseCost: 10 };
  S.units = [unit];
  assert.equal(A.Battle.sellPrice(unit), expected, '血量' + hp + '%的出售价格');
}
console.log('60%出售价格边界及低血统一1块通过');
