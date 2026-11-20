import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read = file => fs.readFileSync(new URL('../package/' + file, import.meta.url), 'utf8');
function boot(stored) {
  let saved = stored;
  const context = { AIGCUtils: {}, localStorage: {
    getItem: () => saved ? JSON.stringify(saved) : null,
    setItem: (_, value) => { saved = JSON.parse(value); },
  } };
  context.window = context;
  vm.createContext(context);
  for (const file of ['config', 'profile']) vm.runInContext(read('gameplay/' + file + '.js'), context);
  return { context, profile: context.AIGCUtils.Profile, saved: () => saved };
}
const fresh = boot();
assert.equal(fresh.profile.data.avatarIndex, 3);
const old = boot({ ...fresh.saved(), avatarIndex: 0 });
assert(old.profile.availableAvatarIndices().includes(old.profile.data.avatarIndex));
assert.equal(old.saved().avatarIndex, old.profile.data.avatarIndex);
const before = old.profile.data.avatarIndex;
old.profile.setAvatar(0);
assert.equal(old.profile.data.avatarIndex, before, '未获得头像不可写入存档');
old.profile.setAvatar(3);
assert.equal(old.profile.data.avatarIndex, 3);

const source = read('gameplay/ui.js');
const sortFunction = source.slice(source.indexOf('  function collectionHeroes()'), source.indexOf('  // --- 收藏册立绘'));
const C = fresh.context.AIGCUtils.Config;
const context = { C, P: { data: { heroAcquiredAt: { tank: 300, mage: 200, healer: 400 } } }, heroUnlocked: () => true };
vm.createContext(context);
vm.runInContext(sortFunction, context);
const original = Array.from(C.HEROES);
for (let i = 0; i < original.length; i++) {
  C.HEROES = original.slice(i).concat(original.slice(0, i));
  const expected = C.HEROES.filter(h => h.id === 'war' || h.id === 'arch').map(h => h.id).concat(['mage', 'tank', 'healer']);
  assert.deepEqual(Array.from(context.collectionHeroes(), h => h.id), expected);
}

const html = read('index.html');
const preview = html.slice(html.indexOf('// 本地新宠展示预览'), html.lastIndexOf('</script>'));
const state = { phase: 'menu', currentLevel: 1 };
const previewContext = { location: { hostname: 'localhost', search: '?preview=new-pet' }, URLSearchParams,
  window: { AIGCUtils: { Game: { isBooted: () => true }, State: state, Profile: fresh.profile } },
  setInterval: callback => { previewContext.tick = callback; return 1; }, clearInterval: () => {} };
const snapshot = JSON.stringify(fresh.profile.data);
vm.runInNewContext(preview, previewContext);
previewContext.tick();
assert.equal(state.phase, 'win');
assert.equal(JSON.stringify(fresh.profile.data), snapshot, '预览不改个人资料');
fresh.profile.save();
assert.equal(JSON.stringify(fresh.saved()), snapshot, '预览后保存不污染存档');
console.log('avatar migration / unavailable selection / mixed collection order / preview persistence: ok');
