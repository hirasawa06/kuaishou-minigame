import fs from 'node:fs';
import assert from 'node:assert/strict';
const source = fs.readFileSync(new URL('../package/gameplay/render/gl.js', import.meta.url), 'utf8');
const branch = source.slice(source.indexOf("'  } else if (vMode > -0.5) {'"));
const expression = branch.match(/float dist = ([^;]*);/)[1];
const normalized = expression.includes('/ shapeScale');
// ── 模拟手机mediump平方溢出，验证真实圆弧中央和边缘的距离 ──
function length16(x, y) {
  const square = x * x + y * y;
  return square > 65504 ? Infinity : Math.sqrt(square);
}
for (const width of [320, 375, 390, 414, 430]) {
  const rise = 72 * 0.4, radius = width * width / (8 * rise) + rise / 2;
  assert.equal(length16(0, radius), Infinity, '旧大圆算法应复现mediump溢出');
  for (const x of [0, width / 4, width / 2]) {
    for (const y of [0, 20, 40, 71]) {
      const scale = normalized ? radius : 1;
      const distance = length16(Math.abs(x) / scale, Math.abs(y - radius) / scale) * scale - radius;
      const expected = Math.hypot(x, y - radius) - radius;
      assert(Number.isFinite(distance), `${width}px出售背景距离必须有限`);
      assert(Math.abs(distance - expected) < 1e-8, '保留原圆弧轮廓');
    }
  }
}
console.log('五尺寸出售圆弧：mediump范围、原轮廓与底部填充通过');
