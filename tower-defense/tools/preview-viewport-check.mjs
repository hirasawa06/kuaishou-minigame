import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html = fs.readFileSync(new URL('../package/index.html', import.meta.url), 'utf8');
const script = html.match(/<script>\s*(window.canvas[\s\S]*?)<\/script>/)[1];
function preview(search) {
  const attrs = {}, classes = new Set(), events = {};
  const root = { setAttribute: (k, v) => attrs[k] = v,
    classList: { add: k => classes.add(k), toggle: k => !classes.has(k) } };
  const context = { URLSearchParams, document: { documentElement: root, getElementById: () => ({}) },
    location: { search }, innerWidth: 390, innerHeight: 844,
    addEventListener: (name, fn) => events[name] = fn };
  context.window = context;
  vm.createContext(context); vm.runInContext(script, context);
  return { attrs, classes, events, context };
}
const responsive = preview('');
assert.equal(responsive.attrs['data-debug-w'], '390');
assert.equal(responsive.attrs['data-debug-h'], '844');
responsive.context.innerWidth = 360; responsive.context.innerHeight = 740;
responsive.events.resize();
assert.equal(responsive.attrs['data-debug-w'], '360');
assert.equal(responsive.attrs['data-debug-h'], '740');
const fixed = preview('?preview=fixed');
assert.equal(fixed.attrs['data-debug-w'], '414');
assert.equal(fixed.attrs['data-debug-h'], '896');
assert.ok(preview('?src=yoolaPlatform').classes.has('yoola-platform'));
console.log('preview viewport resize / fixed / Yoola: ok');
