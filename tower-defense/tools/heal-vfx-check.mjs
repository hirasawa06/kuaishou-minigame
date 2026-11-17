import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = new URL('../package/gameplay/', import.meta.url);
const healerSpec = JSON.parse(fs.readFileSync(new URL('src/animation-specs/healer.json', import.meta.url), 'utf8'));
assert.equal(healerSpec.frames.heal.file, '奶糖喵治疗动作-v2.png', '治疗使用用户指定的独立帧');
assert.equal(healerSpec.frames.idle.file, '奶糖喵动作.png', '待机保持原素材');
assert.equal(healerSpec.frames.hurt.file, '奶糖喵动作.png', '受击保持原素材');
const calls = [];
const target = { uid: 2, x: 100, y: 150, hp: 10, def: { radius: 20 } };
const state = { units: [target], enemies: [], effects: [{ type: 'heal', targetUid: 2, life: 0.25, max: 0.5 }] };
const draw = { color: () => ({}), softEllipse: () => {}, texture: (...args) => calls.push(args) };
const A = { Config: {}, State: state, Layout: {}, Render: { draw },
  Assets: { entry: key => ({ tex: key, w: 100, h: 100 }) } };
vm.runInNewContext(fs.readFileSync(new URL('render/scene.js', root), 'utf8'), { window: { AIGCUtils: A } });
assert.equal(typeof A.Scene.drawGroundEffects, 'function', '治疗需要独立的角色下方绘制阶段');
A.Scene.drawGroundEffects();
assert.equal(calls.length, 1, '角色下方只绘制光环');
assert.equal(calls[0][0], 'heal-aura');
A.Scene.drawEffects();
assert.equal(calls.length, 3, '参考图为一个光环与左右两枚十字');
assert.ok(calls[1][7] < target.x && calls[2][7] > target.x, '十字分列身体左右');
assert.ok(calls[1][9] > calls[2][9], '左侧十字大于右侧');
assert.ok(calls[2][8] < calls[1][8], '右侧十字高于左侧');
assert.equal(calls[0][0], 'heal-aura');
assert.equal(calls[0][11].a, 1, '中点完全显示');
const y = calls[0][8];
target.y += 10;
calls.length = 0;
A.Scene.drawGroundEffects();
assert.equal(calls[0][8], y + 10, '光环跟随受治疗者');
for (const life of [0, 0.5]) {
  calls.length = 0;
  state.effects[0].life = life;
  A.Scene.drawGroundEffects();
  A.Scene.drawEffects();
  assert.equal(calls[0][11].a, 0, '开始和结束均透明');
  assert.ok(calls.every(call => call[11].a === 0), '上下两层同步淡入淡出');
}
const game = fs.readFileSync(new URL('game.js', root), 'utf8');
assert.ok(game.indexOf('Scene.drawGroundEffects()') < game.indexOf('Scene.drawEnemy(actors'), '治疗层在所有角色之前');
assert.ok(game.indexOf('Scene.drawEffects()') > game.indexOf('Scene.drawUnit(actors'), '十字在全部角色之后绘制');
const battle = fs.readFileSync(new URL('play/battle.js', root), 'utf8');
assert.match(battle, /r: target.def.radius, life: 0\.5, max: 0\.5/);
// ── 不同角色和入场缩放：光环中心必须落在脚底支点，而非贴图底边 ──
state.effects[0].life = 0.25;
target.def.id = 'test';
for (const pivot of [[0.5, 0.88], [0.42, 0.81], [0.58, 0.9]]) {
  A.Rigs = { test: { scale: 0.887, parts: [{ pivot }] } };
  for (const spawnT of [0, 0.15]) {
    target.spawnT = spawnT;
    calls.length = 0;
    A.Scene.drawGroundEffects();
    const size = 20 * 3.05 * 0.887 * (1 - 0.14 * spawnT / 0.3);
    const aura = calls[0];
    const centerX = aura[7] + aura[9] * 0.525;
    const centerY = aura[8] + aura[10] * 0.68;
    assert.ok(Math.abs(centerX - (target.x + (pivot[0] - 0.5) * size)) < 0.001, '光环横向中心对齐角色脚底');
    assert.ok(Math.abs(centerY - (target.y - 3 + (pivot[1] - 0.5) * size)) < 0.001, '光环纵向中心对齐角色脚底');
  }
}
console.log('治疗特效：时长、淡入淡出、跟随和角色下方层级通过');
