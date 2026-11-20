import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read = file => fs.readFileSync(new URL('../package/gameplay/' + file + '.js', import.meta.url), 'utf8');
for (const [w, h] of [[414, 896], [360, 780], [320, 568]]) {
  const context = { AIGCUtils: { Layout: { w, h, safeTop: 0, usableH: h } } };
  context.window = context;
  vm.createContext(context);
  for (const file of ['config', 'layout', 'state']) vm.runInContext(read(file), context);
  const A = context.AIGCUtils, S = A.State, L = A.Layout;
  const ui = L.calc(), r = ui.speedBtn;
  assert.equal(r.w, 40 * ui.battleScale);
  assert.equal(r.h, r.w);
  assert.equal(r.x, ui.wavePlate.x);
  assert(Math.abs(r.y - (ui.wavePlate.y + ui.wavePlate.h) - 8 * ui.battleScale) < 1e-8);
  assert(r.y + r.h <= ui.contentBottom);
  const game = read('game');
  vm.runInContext('var A = window.AIGCUtils; var S = A.State; ' +
    game.slice(game.indexOf('  function toggleSpeed()'), game.indexOf('  function openBossLab()')),
    context);
  A.Game = { toggleSpeed: context.toggleSpeed };
  A.ProfileUI = { isOpen: () => false };
  vm.runInContext(read('input'), context);
  const listeners = {};
  A.Input.bind({ getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
    addEventListener: (name, handler) => { listeners[name] = handler; } });
  S.phase = 'playing';
  const event = { clientX: r.x + r.w / 2, clientY: r.y + r.h / 2 };
  for (const expected of [2, 1]) {
    listeners.mousedown(event); listeners.mouseup(event);
    assert.equal(S.battleSpeed, expected);
  }
  S.phase = 'paused'; context.toggleSpeed();
  assert.equal(S.battleSpeed, 1);
}
console.log('speed button size / position / actual click 1x–2x / pause guard: ok');
