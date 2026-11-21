import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../package/gameplay/', import.meta.url);
const c = { console, AIGCUtils: { Layout: { w: 414, h: 896, safeTop: 0, usableH: 896 } } };
c.window = c; vm.createContext(c);
for (const file of ['config','layout','state']) vm.runInContext(fs.readFileSync(new URL(file+'.js', root),'utf8'),c);
const A=c.AIGCUtils, S=A.State;A.Layout.calc();
c.pairChecks=0;
const source=fs.readFileSync(new URL('play/battle.js',root),'utf8');
vm.runInContext(source.replace('A.Battle = {','A.Battle = { testCollisions: resolveBodyCollisions,').replace('function separateBodies(a, b) {','function separateBodies(a, b) { pairChecks++;'),c);
S.units=[];
S.enemies=Array.from({length:120},(_,i)=>({uid:i+1,def:A.Config.ENEMIES.small,x:60+(i%3)*120,y:-1800+Math.floor(i/3)*60}));
const before=S.enemies.map(e=>[e.x,e.y]);
A.Battle.testCollisions();
assert(c.pairChecks<120*10,'远处角色不进入碰撞精算，当前次数'+c.pairChecks);
assert.deepEqual(S.enemies.map(e=>[e.x,e.y]),before,'无接触角色位置不变');
console.log('120怪物宽阶段检查通过，精算次数',c.pairChecks,'/ 原始7140');

// ── 与优化前求解器逐帧对比：密集接触、跨桶移动、不同体型和固定宠物 ──
const { execFileSync } = await import('node:child_process');
const original=execFileSync('git',['show','e51b07d:tower-defense/package/gameplay/play/battle.js'],{encoding:'utf8'});
const old={AIGCUtils:{Layout:{w:414,h:896,safeTop:0,usableH:896}}};
old.window=old;vm.createContext(old);
for(const file of ['config','layout','state'])vm.runInContext(fs.readFileSync(new URL(file+'.js',root),'utf8'),old);
old.AIGCUtils.Layout.calc();
vm.runInContext(original.replace('A.Battle = {','A.Battle = { testCollisions: resolveBodyCollisions,'),old);
let seed=27;
const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
for(let scenario=0;scenario<12;scenario++) {
 const units=[{uid:501,def:S.heroAtStar('tank',1),x:207,y:350},{uid:502,def:S.heroAtStar('war',1),x:160,y:300}];
 const enemies=Array.from({length:40},(_,i)=>({uid:i+1,def:A.Config.ENEMIES[i%5===0?'elite':'small'],x:40+random()*330,y:240+random()*200}));
 S.units=structuredClone(units);S.enemies=structuredClone(enemies);
 const os=old.AIGCUtils.State;os.units=structuredClone(units);os.enemies=structuredClone(enemies);
 for(let frame=0;frame<6;frame++) {
  A.Battle.testCollisions();old.AIGCUtils.Battle.testCollisions();
  for(let i=0;i<S.enemies.length;i++)assert(Math.hypot(S.enemies[i].x-os.enemies[i].x,S.enemies[i].y-os.enemies[i].y)<1e-7,'与原求解结果一致');
 }
}
console.log('12组密集混合体型场景×6帧与原碰撞结果一致');
const { performance } = await import('node:perf_hooks');
for(const [name, engine] of [['旧版',old.AIGCUtils],['新版',A]]) {
 engine.State.units=[];
 engine.State.enemies=Array.from({length:120},(_,i)=>({uid:i+1,def:engine.Config.ENEMIES.small,x:60+(i%3)*120,y:-1800+Math.floor(i/3)*60}));
 for(let i=0;i<30;i++)engine.Battle.testCollisions();
 const start=performance.now();
 for(let i=0;i<300;i++)engine.Battle.testCollisions();
 console.log(name+'120怪物分散场景300次耗时(ms)',(performance.now()-start).toFixed(2));
}
