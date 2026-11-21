import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const calls = [];
const context = { AIGCUtils: { Render: { color: () => ({}), push: () => {} } } };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../package/gameplay/render/draw.js', import.meta.url), 'utf8'), context);
const draw = context.AIGCUtils.Render.draw;
draw.texture = (...args) => calls.push(args);
for (const [w, h] of [[320, 180], [390, 260], [430, 340]]) {
  calls.length = 0;
  draw.nineSlice({ tex: {}, w: 416, h: 296 }, { x: 0, y: 500, w, h },
    { left: 32, right: 32, top: 32, bottom: 16, width: 414 }, 1);
  assert.equal(calls.length, 9);
  assert.equal(calls[0][9], 32);
  assert.equal(calls[0][10], 32);
  assert.equal(calls[8][9], 32);
  assert.equal(calls[8][10], 16);
  assert.equal(calls[8][7] + calls[8][9], w);
  assert.equal(calls[8][8] + calls[8][10], 500 + h);
  assert.equal(calls.reduce((sum, c) => sum + c[9] * c[10], 0), w * h);
  assert.ok(calls.every(c => c[3] + c[5] <= 414));
}
console.log('nine-slice geometry: ok');
for (const [w,h] of [[375,667],[430,932]]) {
 calls.length=0;
 draw.bookNineSlice({tex:{},w:831,h:1800},{x:0,y:0,w,h},{tex:{},w:68,h:64});
 assert.equal(calls.length,14);
 assert.equal(calls[0][9],48);
 assert.equal(calls[0][10],48);
 assert.equal(calls[3][4],96);
 assert.equal(calls[3][6],1592);
 for(const ring of calls.slice(9)) {
  assert.equal(ring[9],34); assert.equal(ring[10],32);
  assert.ok(ring[8]>48 && ring[8]+ring[10]<h-56);
 }
}
console.log('collection book corners / clean edge / undistorted rings: ok');
