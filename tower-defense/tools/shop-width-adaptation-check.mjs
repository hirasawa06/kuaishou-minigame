import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
for (const [w,h,top,bottom] of [[375,667,0,0],[430,932,0,0],[375,667,20,0],[390,844,47,34]]) {
 const context = { AIGCUtils:{Layout:{w,h}}, KwaiBase:{getSystemInfo:()=>({safeArea:{left:0,right:w,top,bottom:h-bottom}})} };
 context.window=context; vm.createContext(context);
 for (const f of ['config.js','layout.js']) vm.runInContext(fs.readFileSync(new URL('../package/gameplay/'+f,import.meta.url),'utf8'),context);
 const u=context.AIGCUtils.Layout.calc(), s=w/414;
 assert.ok(u.battleScale<=s && u.battleScale>=s*0.85, `${w}x${h}: compact scale within 15%`);
 assert.ok(Math.abs(u.battleLeft-(w-414*u.battleScale)/2)<1e-8);
 assert.ok(u.shop.y+u.shop.cellH*2+u.shop.gap<=u.contentBottom-20*u.battleScale+1);
 assert.ok(u.pauseBtn.y>=u.contentTop);
 assert.ok(u.pauseBtn.x+u.pauseBtn.w<=u.safeRight);
 console.log(`${w}x${h}: compact centered shop, bottom spacing and HUD: ok`);
}
