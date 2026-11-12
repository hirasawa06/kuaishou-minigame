/* gameplay/assets.js — 纹理加载与缓存（全部走 KwaiRender.loadImage） */
(function () {
  var A = window.AIGCUtils;

  var textures = {};   // key -> { tex, w, h }
  var pending = 0;
  var ready = false;
  var onReady = null;
  var failed = [];

  function imageToTexture(img, keyHint) {
    var gl = A.Render.gl;
    if (!gl) {
      console.error('Asset.Load', '纹理上传时 WebGL 上下文未就绪：' + keyHint);
      return null;
    }
    try {
      var tex = gl.createTexture();
      if (!tex) return null;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      // 上传过程改了纹理绑定，通知渲染器失效缓存
      if (A.Render.invalidateTexture) A.Render.invalidateTexture();
      return { tex: tex, w: img.width, h: img.height };
    } catch (e) {
      console.error('Asset.Texture', keyHint + ' 上传失败 ' + (e && e.message));
      return null;
    }
  }

  // 首次失败多为启动瞬间并发请求的偶发错误（H5 预览与真机都可能出现），
  // 自动重试一次再判定失败，避免整局停在错误页。
  var RETRY_DELAY = 160;

  function load(key, src, attempt) {
    attempt = attempt || 1;
    KwaiRender.loadImage({
      src: src,
      onSuccess: function (img) {
        var t = imageToTexture(img, key);
        if (!t) {
          failed.push({ key: key, src: src, reason: 'texture-upload' });
          pending--;
          check();
          return;
        }
        textures[key] = t;
        pending--;
        check();
      },
      onFail: function (err) {
        if (attempt < 2) {
          setTimeout(function () { load(key, src, attempt + 1); }, RETRY_DELAY);
          return;
        }
        console.error('Asset.Load', src + ' 加载失败 ' + (err && err.message));
        failed.push({ key: key, src: src, reason: err && err.message ? err.message : 'load-failed' });
        pending--;
        check();
      },
    });
  }

  function check() {
    if (pending <= 0 && !ready) {
      ready = true;
      if (onReady) onReady({ ok: failed.length === 0, failed: failed.slice() });
    }
  }

  function init(cb) {
    onReady = cb;
    ready = false;
    pending = 0;
    failed.length = 0;
    var manifest = [];
    // 字体图集
    var atlas = A.FontAtlas;
    for (var size in atlas) {
      if (atlas.hasOwnProperty(size)) manifest.push(['font-' + size, atlas[size].src]);
    }
    // 战斗图集（单位、常规特效、继承图标都在这张里）
    if (A.GameAtlas && A.GameAtlas.src) manifest.push(['game', A.GameAtlas.src]);
    // 法师落地贴图只保留饼干与碎块，紫色能量由运行时粒子生成。
    if (A.MageVfx && A.MageVfx.src) manifest.push(['mage-vfx', A.MageVfx.src]);
    manifest.push(['home-bg', 'res/home-asset/home-bg.png']);
    // 首页美术（进入游戏前的客厅场景与章节卡）
    manifest.push(['menu-bg', 'res/Menu/menu-bg.png']);
    manifest.push(['menu-card', 'res/Menu/menu-card.png']);
    // 个人资料：9 只猫狗头像图集（首页 / 名片 / 排行榜共用）
    manifest.push(['avatars', 'res/Menu/avatars.png']);
    // 界面图标图集：关闭 / 返回 / 箭头 / 勾选 / 分享 / 链接等
    if (A.SpriteAtlas && A.SpriteAtlas.src) manifest.push(['sprites', A.SpriteAtlas.src]);
    manifest.push(['hero-levels', A.HeroForms.src]);
    manifest.push(['hero-levels-back', A.HeroForms.backSrc]);
    manifest.push(['figma-home', 'res/Image/figma-home.jpg']);
    manifest.push(['home-start-button', 'res/Image/home-start-button.png']);
    manifest.push(['home-avatar-button', 'res/Image/home-avatar-button.png']);
    manifest.push(['home-settings-button', 'res/Image/home-settings-button.png']);
    manifest.push(['home-rank-button', 'res/Image/home-rank-button.png']);
    manifest.push(['home-stamina-button', 'res/Image/home-stamina-button.png']);
    pending = manifest.length;
    for (var i = 0; i < manifest.length; i++) load(manifest[i][0], manifest[i][1]);
    if (pending === 0) check();
  }

  function tex(key) { return textures[key] ? textures[key].tex : null; }

  function entry(key) { return textures[key] || null; }

  // 图标优先查战斗图集（战斗单位/敌人），没有的再回退到界面图标图集。
  // 设置、名片、排行榜这类界面图标只存在于 sprites.png，两套图集都要能取到。
  function sprite(name) {
    var s = A.GameAtlas && A.GameAtlas.icons[name];
    var t = textures.game;
    if (s && t) {
      return { tex: t.tex, texW: t.w, texH: t.h, x: s[0], y: s[1], w: s[2], h: s[3] };
    }
    var s2 = A.SpriteAtlas && A.SpriteAtlas.icons[name];
    var t2 = textures.sprites;
    if (!s2 || !t2) return null;
    return { tex: t2.tex, texW: t2.w, texH: t2.h, x: s2[0], y: s2[1], w: s2[2], h: s2[3] };
  }

  function atlasIcon(name) {
    var s = A.GameAtlas && A.GameAtlas.icons[name];
    if (!s) return null;
    return { x: s[0], y: s[1], w: s[2], h: s[3] };
  }

  A.Assets = {
    init: init,
    tex: tex,
    entry: entry,
    sprite: sprite,
    isReady: function () { return ready; },
    failures: function () { return failed.slice(); },
  };

  A.Render.fontTex = function (size) { return tex('font-' + size); };
})();
