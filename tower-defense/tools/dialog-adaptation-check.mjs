import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
for (const [w,h,top,bottom] of [[375,667,0,0],[430,932,0,0],[320,568,20,20],[390,844,47,34]]) {
 const c={AIGCUtils:{Layout:{w,h}},KwaiBase:{getSystemInfo:()=>({safeArea:{left:0,right:w,top,bottom:h-bottom}})}};
 c.window=c;vm.createContext(c);
 for(const f of ['config.js','layout.js'])vm.runInContext(fs.readFileSync(new URL('../package/gameplay/'+f,import.meta.url),'utf8'),c);
 const u=c.AIGCUtils.Layout.calc();
 assert.ok(u.dialogs, 'shared modal adaptation missing');
 for(const [name,key] of [['settings','sheet'],['stamina','sheet'],['avatarPick','sheet'],['invite','sheet'],['pausePanel','panel'],['result','panel']]){
  const p=u[name][key], t=u.dialogs[name];
  assert.ok(p.x>=u.safeLeft && p.x+p.w<=u.safeRight);
  assert.ok(p.y>=u.contentTop && p.y+p.h<=u.contentBottom-8);
  assert.ok(p.w<=(u.safeRight-u.safeLeft)*.8+1);
  const base=t.base[name][key];
  const g=t.base[name];
  const bottom=name==='settings' ? g.versionY+18 :
    name==='stamina' ? g.ad.y+g.ad.h :
    name==='avatarPick' ? g.save.y+g.save.h :
    name==='invite' ? g.copy.y+g.copy.h :
    name==='pausePanel' ? g.btn('home').y+g.btn('home').h :
    t.base.resultHome.y+t.base.resultHome.h;
  assert.ok(Math.abs(base.y+base.h-bottom-20)<1e-7, name+'底部内边距20');
  assert.ok(p.w <= 340 * u.contentH / 836 + 1, 'short-screen dialog height budget missing');
  assert.ok(Math.abs(p.w-base.w*t.scale)<1e-7);
 }
 const g=u.avatarPick, r=g.rect(0);
 assert.ok(r.x>=g.sheet.x && r.x+r.w<=g.sheet.x+g.sheet.w);
 assert.ok(g.save.y+g.save.h<=g.sheet.y+g.sheet.h);
 console.log(`${w}x${h}: dialogs and avatar hit geometry: ok`);
}
// ── 绘制变换不修改UV；全屏遮罩及异常后的状态恢复单独验证 ──
const quads=[];
const render={color:()=>({}),push:(...args)=>quads.push(args)};
const c={AIGCUtils:{Layout:{ui:{w:375,h:667}},Render:render}};
c.window=c;vm.createContext(c);
vm.runInContext(fs.readFileSync(new URL('../package/gameplay/render/draw.js',import.meta.url),'utf8'),c);
const original=render.push;
render.draw.withTransform({scale:.8,x:10,y:20},()=>{
 render.push(100,200,40,50,{}, {r:10,hw:20,hh:25,u0:.2});
 render.draw.rect(0,0,375,667,{});
});
assert.deepEqual(quads[0].slice(0,4),[90,180,32,40]);
assert.equal(quads[0][5].r,8);
assert.equal(quads[0][5].u0,.2);
assert.deepEqual(quads[1].slice(0,4),[0,0,375,667]);
assert.equal(render.push,original);
assert.throws(()=>render.draw.withTransform({scale:.8,x:0,y:0},()=>{throw Error('test')}));
assert.equal(render.push,original);
console.log('modal drawing transform / full-screen mask / restoration: ok');
