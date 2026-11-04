/* gameplay/audio.js — 背景音乐与音效（走 KwaiMedia.Audio，资源缺失时静默降级）
 *
 * 音乐 / 音效是两个独立开关，即时生效并写入本地存档（见 gameplay/profile.js）：
 *   - 音乐：循环播放 res/Audio/bgm.mp3，关闭时暂停并从开头停住
 *   - 音效：技能、点击、胜负提示音；关闭时直接拦截，不再创建播放实例
 */
(function () {
  var A = window.AIGCUtils;

  var musicOn = true;
  var sfxOn = true;
  var enabled = true;        // 音频环境可用（播放异常会置 false）
  var inited = false;
  var lastPlay = {};
  var warmed = {};
  var VOLUME = 0.7;
  var MUSIC_VOLUME = 0.32;
  var BGM = 'res/Audio/bgm.mp3';

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
      if (sfxOn) safe(function () { m.setSfxVolume(VOLUME); });
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
    if (!c || !c.addEventListener) { gestureSeen = true; warmup(); startMusic(); return; }
    var once = function () {
      if (gestureSeen) return;
      gestureSeen = true;
      c.removeEventListener('touchstart', once);
      c.removeEventListener('mousedown', once);
      warmed = {};
      warmup();
      startMusic();
    };
    c.addEventListener('touchstart', once);
    c.addEventListener('mousedown', once);
  }

  function startMusic() {
    if (!musicOn || !gestureSeen) return;
    var m = media();
    if (!m) return;
    safe(function () { m.setBgmVolume(MUSIC_VOLUME); });
    safe(function () { m.playBgm(BGM); });
  }

  function pauseMusic() {
    var m = media();
    if (!m) return;
    safe(function () { m.pauseBgm(); });
  }

  function play(name) {
    if (!enabled || !inited || !sfxOn) return;
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

  function setMusic(on) {
    musicOn = !!on;
    if (!musicOn) pauseMusic();
    else startMusic();
  }

  function setSfx(on) {
    sfxOn = !!on;
    var m = media();
    if (m) safe(function () { m.setSfxEnabled(sfxOn); });
    if (!sfxOn) return;
    // 重新打开时恢复音量，并补一次交互确认，保证后续音效可播
    safe(function () { m && m.setSfxVolume(VOLUME); });
  }

  // 读取存档后同步开关（不触发播放，等首次交互）
  function applySettings(opts) {
    opts = opts || {};
    if (typeof opts.music === 'boolean') musicOn = opts.music;
    if (typeof opts.sfx === 'boolean') sfxOn = opts.sfx;
    if (!sfxOn) {
      var m = media();
      if (m) safe(function () { m.setSfxEnabled(false); });
    }
  }

  A.GameAudio = {
    init: init,
    play: play,
    setEnabled: function (v) { enabled = !!v; },
    setMusic: setMusic,
    setSfx: setSfx,
    applySettings: applySettings,
    isMusicOn: function () { return musicOn; },
    isSfxOn: function () { return sfxOn; },
    startMusic: startMusic,
    setVolume: function (v) {
      VOLUME = v;
      var m = media();
      if (m) safe(function () { m.setSfxVolume(v); });
    },
  };
})();
