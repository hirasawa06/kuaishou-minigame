import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../package/', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');
for (const native of [false, true]) {
  for (const fail of native ? [false, true] : [false]) {
    const pending = [], requests = [], loaded = new Set();
    const gl = new Proxy({}, { get: (_, key) => key === 'createTexture' ? () => ({}) : () => {} });
    const ctx = { console, setTimeout, AIGCUtils: { Render: { gl } },
      KwaiRender: { loadImage: options => {
        assert(fs.existsSync(new URL(options.src, root)), options.src + '存在');
        if (native && options.src.startsWith('subpackages/')) {
          assert(loaded.has(options.src.split('/')[1]), '必须先加载分包');
        }
        requests.push(options.src); options.onSuccess({ width: 64, height: 64 });
      } } };
    ctx.window = ctx;
    if (native) ctx.KwaiSubpackage = { load: options => pending.push(options) };
    vm.createContext(ctx);
    for (const file of ['gameplay/config.js', 'gameplay/hero-forms.js',
      ...fs.readdirSync(new URL('gameplay/data/', root)).filter(f => f.endsWith('.js')).map(f => 'gameplay/data/' + f),
      'kwaiStandard/loaders/subpackage-loader.js', 'gameplay/resource-packages.js', 'gameplay/assets.js']) {
      vm.runInContext(read(file), ctx);
    }
    let result;
    ctx.AIGCUtils.Assets.init(value => { result = value; });
    if (native) {
      assert.equal(result, undefined, '分包未完成时不能进入菜单');
      assert.equal(pending.length, 2, '每个分包仅加载一次');
      for (const options of pending) {
        if (fail) options.onFail(new Error('test subpackage failure'));
        else { loaded.add(options.name); options.onSuccess(); }
      }
      for (let i = 0; i < 6; i++) await Promise.resolve();
    }
    assert(result);
    assert.equal(result.ok, !fail);
    if (fail) assert(result.failed.every(x => x.reason === 'subpackage-load-failed'));
    assert(requests.includes('res/Image/outgame/level-covers/level-1.jpg'), '首关封面仍主包');
    assert(requests.includes('res/Image/outgame/avatars/avatars-home-r12.png'), '首页头像仍主包');
  }
}
console.log('真实资源清单、H5路径、分包等待/复用/失败与首屏保留检查通过');
