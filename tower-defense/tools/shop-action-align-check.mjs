import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../package/gameplay/render/battle-shop.js',import.meta.url),'utf8');
const action=source.slice(source.indexOf('  function drawAction('),source.indexOf('  function drawStars('));
for(const s of [.85,1,430/414]) {
 const calls=[],D={color:()=>({}),textWidth:(v,size)=>String(v).length*size*.6,
  text:(...a)=>calls.push(['text',...a]),centeredText:(...a)=>calls.push(['center',...a])};
 const ctx={L:{ui:{battleScale:s}},D,image:(key,rect)=>{calls.push(['image',key,rect]);return true;},
  scaled:r=>r,pressScale:()=>1};vm.createContext(ctx);vm.runInContext(action,ctx);
 for(const [key,label,cost] of [['refresh','刷新',3],['cap','扩建',15]]) {
  calls.length=0;const box={x:10,y:50,w:114*s,h:48*s};ctx.drawAction(key,box,label,cost,true);
  const text=calls.filter(c=>c[0]==='center');
  assert.equal(text.length,2,'标签和数量均按可见字形居中');
  assert(text.every(c=>Math.abs(c[3]-(box.y+box.h/2-3*s))<1e-9),'内容整组对齐按钮主体中心（上移3px）');
  const width=D.textWidth(String(cost),20*s);
  assert(Math.abs(text[1][2]-(box.x+59*s+width/2))<1e-9,'数量向标签靠近4基准像素');
  const icon=calls.find(c=>c[0]==='image'&&c[1]==='battle-white-bone')[2];
  assert(Math.abs(icon.y+icon.h/2-(box.y+box.h/2-3*s))<1e-9,'图标垂直居中');
 }
}
console.log('刷新/扩建三比例：文字/数量/图标整组上移3px并垂直居中，数量间距缩小4px');
