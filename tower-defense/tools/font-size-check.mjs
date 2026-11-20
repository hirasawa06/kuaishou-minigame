// ── 最终字号合同：测量、绘制、居中及宽度约束使用同一字号 ──
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../package/gameplay/', import.meta.url));
const quads = [];
const textures = [];
const A = {
  Render: { push: (...quad) => quads.push(quad), setTexture() {} },
  Assets: { tex: name => { textures.push(name); return {}; } },
};
const context = vm.createContext({ window: { AIGCUtils: A } });
for (const file of ['data/font-atlas.js', 'render/draw.js']) {
  vm.runInContext(fs.readFileSync(root + file, 'utf8'), context);
}
const D = A.Render.draw;
const near = (a, b) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
assert.deepEqual(Array.from(D.fontSizes), [12, 14, 16, 20, 24, 32, 40]);
near(D.fontSize(1), 12);
near(D.fontSize(100), 40);

for (const size of [11.16, 16, 18, 24, 28, 32, 48, 52.5]) {
  quads.length = 0;
  D.centeredText('第10关', 120, 80, size, {});
  assert.equal(quads.length, 4, `${size}px文字缺失`);
  const left = Math.min(...quads.map(q => q[0]));
  const right = Math.max(...quads.map(q => q[0] + q[2]));
  const top = Math.min(...quads.map(q => q[1]));
  const bottom = Math.max(...quads.map(q => q[1] + q[3]));
  near((left + right) / 2, 120);
  near((top + bottom) / 2, 80);
  near(D.text('开始游戏', 0, 0, size, {}, 0), D.textWidth('开始游戏', size));
  const fitted = D.fitTextSize('开始游戏', size, 32);
  assert(D.fontSizes.includes(fitted));
  assert(fitted <= D.fontSize(size));
  const content = D.fitTextContent('开始游戏', fitted, 32);
  assert(D.textWidth(content, fitted) <= 32);
}
assert(textures.every(name => /^font-(18|28|48)(-\d+)?$/.test(name)));
for (const size of D.fontSizes) {
  textures.length = 0;
  quads.length = 0;
  D.text('1', 10, 20, size, {}, 0);
  const sourceSize = Number(textures[0].split('-')[1]);
  const glyph = A.FontAtlas[sourceSize].glyphs['1'];
  near(quads[0][2] / (glyph.w / 2) * sourceSize, size);
}
for (const width of [0, 3, 8, 24, 48, 100]) {
  const size = D.fitTextSize('完整观看广告后获得奖励', 40, width);
  assert(size >= 12 && D.fontSizes.includes(size));
  const content = D.fitTextContent('完整观看广告后获得奖励', size, width);
  assert(D.textWidth(content, size) <= width);
}
console.log('七档实际绘制字号、12—40极值、可见居中及长文字溢出：通过');
