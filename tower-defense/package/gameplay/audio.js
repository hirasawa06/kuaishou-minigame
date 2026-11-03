/* gameplay/audio.js — 音效播放（走 KwaiMedia.Audio，资源缺失时静默降级） */
(function () {
  var A = window.AIGCUtils;

  var enabled = true;
  var inited = false;
  var lastPlay = {};
  var warmed = {};
  var VOLUME = 0.7;

  var SFX = {
    place: 'res/Audio/place.mp3',
    discard: 'res/Audio/discard.mp3',
    start: 'res/Audio/start.mp3',
    wave: 'res/Audio/wave.mp3',
    arrow: 'res/Audio/arrow.mp3',
    magic: 'res/Audio/magic.mp3',
    hit: 'res/Audio/hit.mp3',
    base: 'res/Audio/base.mp3',
    boss: 'res/Audio/boss.mp3',
    win: 'res/Audio/win.mp3',
    lose: 'res/Audio/lose.mp3',
  };

  // 不同音效的节流间隔（毫秒），避免连弩/群攻刷屏
  var THROTTLE = {
    arrow: 80, magic: 120, hit: 70, base: 260, place: 90, discard: 90, wave: 800, boss: 800,
  };

  function media() {
    return window.KwaiMedia && KwaiMedia.Audio ? KwaiMedia.Audio : null;
  }

  function safe(fn) {
    try {
      fn();
    } catch (e) {
      // 浏览器/快手的音频限制（自动播放、格式不支持）不应打断游戏
      enabled = false;
    }
  }

  // 预热：先把每个音效以 0 音量播一次，让容器提前解码并进入实例池，
  // 真正播放时不会因为首次加载失败抛出异常。
  function warmup() {
    var m = media();
    if (!m) return;
    safe(function () { m.setSfxVolume(0); });
    var keys = Object.keys(SFX);
    for (var i = 0; i < keys.length; i++) {
      (function (k) {
        safe(function () { m.playSfx(SFX[k]); });
        warmed[k] = true;
      })(keys[i]);
    }
    setTimeout(function () {
      safe(function () { m.setSfxVolume(VOLUME); });
    }, 400);
  }

  // 预热必须发生在用户首次交互之后，否则浏览器会因自动播放策略抛 NotAllowedError
  function init() {
    if (inited) return;
    inited = true;
    armFirstGesture();
  }

  var gestureHooked = false;
  var gestureSeen = false;
  function armFirstGesture() {
    if (gestureHooked) return;
    gestureHooked = true;
    var c = window.canvas;
    if (!c || !c.addEventListener) { warmup(); return; }
    var once = function () {
      gestureSeen = true;
      c.removeEventListener('touchstart', once);
      c.removeEventListener('mousedown', once);
      warmed = {};
      warmup();
    };
    c.addEventListener('touchstart', once);
    c.addEventListener('mousedown', once);
  }

  function play(name) {
    if (!enabled || !inited) return;
    // 用户还没交互过：浏览器会拒绝自动播放，直接跳过，避免刷出 NotAllowedError
    if (!gestureSeen) return;
    var src = SFX[name];
    if (!src) return;
    var now = A._now();
    var gap = THROTTLE[name] || 60;
    if (lastPlay[name] && now - lastPlay[name] < gap) return;
    lastPlay[name] = now;
    var m = media();
    if (!m) return;
    safe(function () { m.playSfx(src); });
  }

  A.GameAudio = {
    init: init,
    play: play,
    setEnabled: function (v) { enabled = !!v; },
    setVolume: function (v) {
      VOLUME = v;
      var m = media();
      if (m) safe(function () { m.setSfxVolume(v); });
    },
  };
})();
