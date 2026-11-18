/* gameplay/assets.js — 纹理加载与缓存（全部走 KwaiRender.loadImage） */
(function () {
  var A = window.AIGCUtils;

  var textures = {};   // key -> { tex, w, h }
  var pending = 0;
  var total = 0;
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
    // 包内素材按实际文件名进入平台CDN映射；查询参数会使映射和本地文件查找失配。
    src = src.split('?')[0].split('#')[0];
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
    total = 0;
    failed.length = 0;
    var manifest = [];
    // 字体图集
    var atlas = A.FontAtlas;
    for (var size in atlas) {
      if (!atlas.hasOwnProperty(size)) continue;
      var pages = atlas[size].pages || [atlas[size]];
      for (var page = 0; page < pages.length; page++) {
        manifest.push(['font-' + size + (page ? '-' + page : ''), pages[page].src]);
      }
    }
    // 战斗图集（单位、常规特效、继承图标都在这张里）
    if (A.GameAtlas && A.GameAtlas.src) manifest.push(['game', A.GameAtlas.src]);
    // 法师飞行与落地均使用离线生成的透明 PNG 帧表，运行时无需解码 GIF。
    if (A.MageFlight && A.MageFlight.src) manifest.push(['mage-flight', A.MageFlight.src]);
    if (A.MageImpact && A.MageImpact.src) manifest.push(['mage-impact', A.MageImpact.src]);
    // 治疗特效分层素材。
    manifest.push(['heal-aura', 'res/Image/heal-aura.png']);
    manifest.push(['heal-cross', 'res/Image/heal-cross.png']);
    // 个人资料：9 只猫狗头像图集（首页 / 名片 / 排行榜共用）
    manifest.push(['avatars', 'res/Image/avatars.png']);
    // 界面图标图集：关闭 / 返回 / 箭头 / 勾选 / 分享 / 链接等
    if (A.SpriteAtlas && A.SpriteAtlas.src) manifest.push(['sprites', A.SpriteAtlas.src]);
    if (A.HeroForms) {
      manifest.push(['hero-levels', A.HeroForms.src]);
      manifest.push(['hero-levels-back', A.HeroForms.backSrc]);
    }
    manifest.push(['home-background-clean', 'res/Image/home-background-clean-v2.jpg']);
    manifest.push(['home-level-card-no-banner', 'res/Image/home-level-card-no-banner-v1.png']);
    manifest.push(['home-level-frame-overlay', 'res/Image/home-level-frame-overlay-v1.png']);
    manifest.push(['home-level-arrows', 'res/Image/home-level-arrows-v1.png']);
    manifest.push(['home-level-arrows-disabled', 'res/Image/home-level-arrows-disabled-v1.png']);
    manifest.push(['home-level-nameplate', 'res/Image/home-level-nameplate-v1.png']);
    manifest.push(['home-level-lock', 'res/Image/home-level-lock-v1.png']);
    manifest.push(['home-menu-icons', 'res/Image/home-menu-icons-v1.png']);
    manifest.push(['home-start-paw', 'res/Image/home-start-paw-v1.png']);
    manifest.push(['in-game-background', 'res/Image/in-game-background-topdown.jpg']);
    manifest.push(['guardian-photo', 'res/Image/guardian-photo-v1.png']);

    manifest.push(['shield-dog-front', 'res/Image/shield-dog-front.png']);
    manifest.push(['archer-cat-front', 'res/Image/archer-cat-front.png']);
    manifest.push(['melee-cat-poses', 'res/Image/melee-cat-poses.png']);
    manifest.push(['mage-dog-poses', 'res/Image/mage-dog-poses.png']);
    manifest.push(['archer-cat-hurt', 'res/Image/archer-cat-hurt.png']);
    manifest.push(['melee-cat-front', 'res/Image/melee-cat-front.png']);
    manifest.push(['melee-cat-back', 'res/Image/melee-cat-back.png']);
    manifest.push(['mage-dog-front', 'res/Image/mage-dog-front.png']);
    manifest.push(['mage-dog-back', 'res/Image/mage-dog-back.png']);
    manifest.push(['battle-fx-atlas', 'res/Image/battle-fx-atlas.png']);
    manifest.push(['hud-panel', 'res/Image/hud-panel.png']);
    manifest.push(['shop-tray', 'res/Image/shop-tray.png']);
    manifest.push(['shop-button', 'res/Image/shop-button.png']);

    total = manifest.length;
    pending = total;
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
    progress: function () {
      var settled = Math.max(0, total - pending);
      return { loaded: Math.max(0, settled - failed.length), total: total,
        ratio: total ? settled / total : 0, failed: failed.length };
    },
    failures: function () { return failed.slice(); },
  };

  A.Render.fontTex = function (size) { return tex('font-' + size); };
})();
