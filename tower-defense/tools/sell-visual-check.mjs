import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../package/gameplay/render/battle-shop.js',import.meta.url),'utf8');
for(const bottomInset of [0,34,68]) {
 const sell={x:0,y:896-bottomInset-72,w:414,h:72},original={...sell},calls=[];
 const draw={color:hex=>hex,circle:(...args)=>calls.push(['circle',...args]),
  roundRect:(...args)=>calls.push(['rect',...args]),textWidth:()=>80,
  centeredText:(...args)=>calls.push(['text',...args])};
 const A={Config:{},State:{},Layout:{ui:{h:896,sellZone:sell}},Battle:{sellPrice:()=>5},
  Render:{draw,push:(...args)=>calls.push(['glyph',...args]),setClipRect:r=>calls.push(['clip',r])}};
 vm.runInNewContext(source,{window:{AIGCUtils:A}});
 A.BattleShopUI.drawSellZone({});
 assert.equal(calls.filter(c=>c[0]==='glyph'&&c[6].mode===16).length,1,'狗饼干统一轮廓绘制');
 assert.deepEqual(sell,original,'操作区不变');
 assert.equal(calls.find(c=>c[0]==='text')[3],sell.y+sell.h*.56,'文案位置不变');
 if(bottomInset)assert(calls.some(c=>c[0]==='rect'&&c[2]<=sell.y+sell.h&&c[2]+c[4]>=896&&c[6]==='#874732'), '底色延伸到画布底部');
 assert(calls.some(c=>c[0]==='clip'&&c[1]===sell),'原圆弧裁切不变');
}
console.log('出售底色覆盖底部安全区，操作区/圆弧/文案位置保持');
