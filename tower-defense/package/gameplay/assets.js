/* gameplay/assets.js — 纹理加载与缓存（全部走 KwaiRender.loadImage） */
(function () {
  var A = window.AIGCUtils;

  var textures = {};   // key -> { tex, w, h }
  var pending = 0;
  var ready = false;
  var onReady = null;

  function imageToTexture(img, keyHint) {
    var gl = A.Render.gl;
    if (!gl) {
      console.error('Asset.Load', '纹理上传时 WebGL 上下文未就绪：' + keyHint);
      return null;
    }
    var tex = gl.createTexture();
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
  }

  function load(key, src) {
    pending++;
    KwaiRender.loadImage({
      src: src,
      onSuccess: function (img) {
        var t = imageToTexture(img, key);
        if (!t) { pending--; check(); return; }
        textures[key] = t;
        pending--;
        check();
      },
      onFail: function (err) {
        console.error('Asset.Load', src + ' 加载失败 ' + (err && err.message));
        pending--;
        check();
      },
    });
  }

  function check() {
    if (pending <= 0 && !ready) {
      ready = true;
      if (onReady) onReady();
    }
  }

  function init(cb) {
    onReady = cb;
    // 字体图集
    var atlas = A.FontAtlas;
    for (var size in atlas) {
      if (atlas.hasOwnProperty(size)) load('font-' + size, atlas[size].src);
    }
    // 战斗图集（单位、特效、继承图标都在这张里）
    if (A.GameAtlas && A.GameAtlas.src) load('game', A.GameAtlas.src);
    load('home-bg', 'res/home-asset/home-bg.png');
    if (pending === 0) check();
  }

  function tex(key) { return textures[key] ? textures[key].tex : null; }

  function entry(key) { return textures[key] || null; }

  function sprite(name) {
    var s = A.GameAtlas && A.GameAtlas.icons[name];
    var t = textures.game;
    if (s && t) {
      return { tex: t.tex, texW: t.w, texH: t.h, x: s[0], y: s[1], w: s[2], h: s[3] };
    }
    var s2 = A.SpriteAtlas.icons[name];
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
  };

  A.Render.fontTex = function (size) { return tex('font-' + size); };
})();
