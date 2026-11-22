import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c={AIGCUtils:{Layout:{w:414,h:896,safeTop:0,usableH:896}}};c.window=c;vm.createContext(c);
for(const f of ['config','layout','state'])vm.runInContext(fs.readFileSync(new URL('../package/gameplay/'+f+'.js',import.meta.url),'utf8'),c);
const A=c.AIGCUtils,S=A.State,C=A.Config;A.Layout.calc();
A.Profile={data:{tutorialStarComplete:false}};
for(const complete of [false,true])for(const level of [1,2,10]){
 A.Profile.data.tutorialStarComplete=complete;S.currentLevel=level;S.reset();
 assert.equal(S.gold,!complete&&level===1?42:20);
}
for(const [id,hp,atk,gold] of [['small',143,17,1],['normal',317,30,6],['elite',1189,65,12]]){
 assert.equal(C.ENEMIES[id].hp,hp);assert.equal(C.ENEMIES[id].atk,atk);assert.equal(C.ENEMIES[id].gold,gold);
}
assert.equal(C.ENEMIES.boss.hp,5082);assert.equal(C.ENEMIES.boss.atk,116);assert.equal(C.ENEMIES.boss.gold,60);
assert.equal(C.waveHpScale,1.15);assert.equal(C.waveAtkScale,1.08);
assert.equal(C.ENEMIES.small.goldMax,2);
console.log('首次教学42、其余开局20、小怪血量攻击奖励检查通过');
