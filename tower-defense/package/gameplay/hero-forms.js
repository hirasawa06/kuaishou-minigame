/* gameplay/hero-forms.js — 现状/待验证：三级收藏/升级预览，攻击动作不变。
 * Preferred loading: Assets manifest ['hero-levels', A.HeroForms.src].
 * Optional init(cb) loads the same local texture through KwaiMedia.Image.load.
 * Never replaces a combat Rig. Missing level art visibly uses existing art + placeholder marker.
 */
(function () {
  var A = window.AIGCUtils;
  var IDS = ['tank', 'war', 'arch', 'mage', 'healer'];
  var SRC = 'res/Image/hero-levels.png';
  var BACK_SRC = 'res/Image/hero-levels-back.png';
  var COLS = 5, ROWS = 3, CELL = 200;
  // Back atlas is independent: never use collection front portraits in battle.
  var BACK_AVAILABLE = true;
  // Four existing identities plus original healer design (healer art pending user acceptance).
  var AVAILABLE = {
    tank: [true, true, true], war: [true, true, true],
    arch: [true, true, true], mage: [true, true, true],
    healer: [true, true, true]
  };
  var EXISTING = {
    tank: 'unit-tank-1', war: 'war-front-idle', arch: 'arch-back-idle',
    mage: 'mage-back-idle', healer: 'ui-heart'
  };
  var privateEntry = null, loading = false, error = null, callbacks = [];

  function levelOf(value) {
    value = Number(value);
    if (!isFinite(value)) return 1;
    return Math.max(1, Math.min(3, Math.floor(value)));
  }

  function column(id) {
    for (var i = 0; i < IDS.length; i++) if (IDS[i] === id) return i;
    return -1;
  }

  function texture() {
    var entry = A.Assets && A.Assets.entry('hero-levels');
    return entry || privateEntry;
  }

  function status(id, level) {
    level = levelOf(level);
    var col = column(id);
    var available = col >= 0 && AVAILABLE[id][level - 1];
    var entry = texture();
    var validTexture = entry && entry.w === COLS * CELL && entry.h === ROWS * CELL;
    return {
      id: id, level: level, available: !!available,
      ready: !!(available && validTexture), placeholder: !available || !validTexture,
      reason: col < 0 ? 'unknown-hero' :
        !available ? 'level-art-not-generated' : !validTexture ? 'texture-not-ready' : null,
      frame: col < 0 ? null : [col * CELL, (level - 1) * CELL, CELL, CELL]
    };
  }

  function finish(failure) {
    loading = false;
    error = failure || null;
    var queue = callbacks.slice();
    callbacks.length = 0;
    var result = { ok: !error && !!texture(), error: error, src: SRC };
    for (var i = 0; i < queue.length; i++) queue[i](result);
  }

  function init(cb) {
    if (cb) callbacks.push(cb);
    if (texture()) { finish(null); return; }
    if (loading) return;
    if (!A.Render || !A.Render.gl || !A.Render.textureFromSource) {
      finish('render-not-ready');
      return;
    }
    if (typeof KwaiMedia === 'undefined' || !KwaiMedia.Image || !KwaiMedia.Image.load) {
      finish('media-image-loader-unavailable');
      return;
    }
    loading = true;
    try {
      KwaiMedia.Image.load(SRC).then(function (image) {
        try {
          if (image.width !== COLS * CELL || image.height !== ROWS * CELL) {
            throw new Error('invalid-atlas-size');
          }
          var tex;
          try {
            tex = A.Render.textureFromSource(image);
          } finally {
            // Upload changes GL binding even when it throws.
            if (A.Render.invalidateTexture) A.Render.invalidateTexture();
          }
          if (!tex) throw new Error('texture-upload-failed');
          privateEntry = { tex: tex, w: image.width, h: image.height };
          finish(null);
        } catch (e) {
          console.error('HeroForms.Load', e && e.message);
          finish(e && e.message ? e.message : 'texture-upload-failed');
        }
      }, function (e) {
        console.error('HeroForms.Load', e && e.message);
        finish(e && e.message ? e.message : 'image-load-failed');
      });
    } catch (e) {
      finish(e && e.message ? e.message : 'image-load-failed');
    }
  }

  function placeholder(id, cx, cy, size, alpha) {
    var D = A.Render.draw;
    var sprite = A.Assets && A.Assets.sprite(EXISTING[id]);
    if (sprite) {
      D.texture(sprite.tex, sprite.texW, sprite.texH, sprite.x, sprite.y, sprite.w, sprite.h,
        cx - size / 2, cy - size / 2, size, size, { r: 1, g: 1, b: 1, a: alpha });
    } else {
      D.roundRect(cx - size * 0.3, cy - size * 0.3, size * 0.6, size * 0.6,
        size * 0.12, D.color('#55515c', alpha));
    }
    // Dedicated medical sign stays a placeholder, never pretends to be a cat character.
    if (id === 'healer') {
      var m = size * 0.28, mx = cx + size * 0.23, my = cy + size * 0.20;
      D.roundRect(mx - m / 2, my - m / 2, m, m, m * 0.15, D.color('#153c2c', alpha));
      D.rect(mx - m * 0.12, my - m * 0.34, m * 0.24, m * 0.68, D.color('#6ff0a8', alpha));
      D.rect(mx - m * 0.34, my - m * 0.12, m * 0.68, m * 0.24, D.color('#6ff0a8', alpha));
    }
    // Amber dashed frame visibly distinguishes temporary art without introducing font glyphs.
    var edge = size * 0.46, dash = size * 0.12, line = Math.max(1, size * 0.018);
    var color = D.color('#e7b45b', alpha * 0.85);
    for (var i = 0; i < 4; i++) {
      var offset = -edge + i * edge * 0.53;
      D.rect(cx + offset, cy - edge, dash, line, color);
      D.rect(cx + offset, cy + edge - line, dash, line, color);
      D.rect(cx - edge, cy + offset, line, dash, color);
      D.rect(cx + edge - line, cy + offset, line, dash, color);
    }
  }

  // Returns true only when the exact requested level's real portrait has been drawn.
  // False still draws an explicit fallback; the caller should show an art-pending label.
  function draw(id, level, cx, cy, size, alpha) {
    if (column(id) < 0 || !(size > 0)) return false;
    alpha = alpha === undefined ? 1 : Math.max(0, Math.min(1, alpha));
    level = 2; // 三个星级共用原等级2立绘，不再改变装备形象。
    var info = status(id, level), entry = texture(), D = A.Render.draw;
    if (info.available && entry && entry.w === COLS * CELL && entry.h === ROWS * CELL) {
      var f = info.frame;
      D.texture(entry.tex, entry.w, entry.h, f[0], f[1], f[2], f[3],
        cx - size / 2, cy - size / 2, size, size, { r: 1, g: 1, b: 1, a: alpha });
      return true;
    }
    placeholder(id, cx, cy, size, alpha);
    return false;
  }

  function drawBattleIdle(id, level, cx, cy, size, alpha) {
    var col = column(id);
    if (col < 0 || !(size > 0)) return false;
    var entry = A.Assets && A.Assets.entry('hero-levels-back');
    if (!BACK_AVAILABLE || !entry || entry.w !== COLS * CELL || entry.h !== ROWS * CELL) {
      // Draw nothing: caller retains original rear Rig, never silently falls back to a front face.
      return false;
    }
    level = levelOf(level);
    alpha = alpha === undefined ? 1 : Math.max(0, Math.min(1, alpha));
    A.Render.draw.texture(entry.tex, entry.w, entry.h, col * CELL, (level - 1) * CELL, CELL, CELL,
      cx - size / 2, cy - size / 2, size, size, { r: 1, g: 1, b: 1, a: alpha });
    return true;
  }

  A.HeroForms = {
    backSrc: BACK_SRC, backKey: 'hero-levels-back', drawBattleIdle: drawBattleIdle,
    battleIdleReady: function () {
      var entry = A.Assets && A.Assets.entry('hero-levels-back');
      return !!(BACK_AVAILABLE && entry && entry.w === COLS * CELL && entry.h === ROWS * CELL);
    },
    src: SRC, key: 'hero-levels', texW: COLS * CELL, texH: ROWS * CELL,
    cellSize: CELL, columns: COLS, rows: ROWS, ids: IDS.slice(),
    init: init, draw: draw, status: status, levelOf: levelOf,
    isReady: function () { return !!texture(); },
    error: function () { return error; }
  };
})();
