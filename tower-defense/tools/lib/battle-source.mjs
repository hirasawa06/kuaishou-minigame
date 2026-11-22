// 现状：按快手入口顺序读取战斗模块，供 VM 回归注入内部函数。
import fs from 'node:fs';
const root = new URL('../../package/', import.meta.url);
export function readBattleSource() {
  const entry = fs.readFileSync(new URL('game.js', root), 'utf8');
  const files = [...entry.matchAll(/require\("\.\/(gameplay\/play\/battle(?:\/[^"]+)?\.js)"\)/g)];
  return files.map(match => fs.readFileSync(new URL(match[1], root), 'utf8')).join('\n');
}
