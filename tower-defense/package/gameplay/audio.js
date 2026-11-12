/* gameplay/audio.js — 猫猫卡通声景：分场景配乐、独立交互音效与节流 */
(function () {
  var A = window.AIGCUtils;
  var musicOn = true;
  var sfxOn = true;
  var enabled = true;
  var inited = false;
  var gestureSeen = false;
  var lastPlay = {};
  var VOLUME = 0.30;
  var MUSIC_VOLUME = 0.38;
  var scene = 'home';
  var playingScene = null;
  var duckUntil = 0;
  var lastVolume = -1;
  var fade = null;
  var bossMusic = false;
  var MUSIC = { home: 'res/Audio/bgm-home.mp3', battle: 'res/Audio/bgm.mp3', boss: 'res/Audio/bgm-boss.mp3' };
  var SFX = {
    place: 'res/Audio/place.mp3', discard: 'res/Audio/discard.mp3',
    start: 'res/Audio/start.mp3', wave: 'res/Audio/wave.mp3',
    arrow: 'res/Audio/arrow-quiet.mp3', magic: 'res/Audio/magic-quiet.mp3',
    hit: 'res/Audio/hit-quiet.mp3', base: 'res/Audio/base-quiet.mp3',
    boss: 'res/Audio/boss.mp3', win: 'res/Audio/win.mp3', lose: 'res/Audio/lose-v5.mp3',
    click: 'res/Audio/ui-click.mp3', heal: 'res/Audio/heal-quiet.mp3',
    sell: 'res/Audio/sell.mp3', speed: 'res/Audio/speed.mp3',
    select: 'res/Audio/select.mp3', expand: 'res/Audio/expand.mp3',
    enemyHit: 'res/Audio/enemy-hit-quiet.mp3', enemyDeath: 'res/Audio/enemy-death.mp3'
  };
  var lastVariant = {};
  var audioSeed = Date.now() | 0 || 1;
  function audioRandom() {
    audioSeed ^= audioSeed << 13;
    audioSeed ^= audioSeed >>> 17;
    audioSeed ^= audioSeed << 5;
    return (audioSeed >>> 0) / 4294967296;
  }
  var VERSIONS = { click: [1], place: [3], sell: [2], magic: [2], arrow: [3],
    hit: [3], enemyHit: [2, 3], base: [2], boss: [1], win: [1], lose: [1] };
  function randomSfx(name) {
    var choices = VERSIONS[name] || [1, 2, 3];
    var previous = lastVariant[name];
    var candidates = choices.filter(function (v) { return choices.length === 1 || v !== previous; });
    var version = candidates[Math.floor(audioRandom() * candidates.length)];
    lastVariant[name] = version;
    return version === 1 ? SFX[name] : SFX[name].replace('.mp3', '-v' + version + '.mp3');
  }
  var THROTTLE = {
    arrow: 110, magic: 180, hit: 120, base: 350, place: 90, discard: 120,
    wave: 800, boss: 1000, heal: 240, sell: 120, speed: 150,
    select: 120, click: 80, expand: 160, enemyHit: 200, enemyDeath: 180
  };

  function media() { return window.KwaiMedia && KwaiMedia.Audio ? KwaiMedia.Audio : null; }
  function safe(fn) {
    try { fn(); } catch (e) {
      // 某个声音失败不能永久关闭整套音频；下次用户交互可重试。
      if (!safe.logged) { console.warn('Game.Audio', e && e.message); safe.logged = true; }
    }
  }
  function init() {
    if (inited) return;
    inited = true;
    var c = window.canvas;
    if (!c || !c.addEventListener) return;
    var once = function () {
      if (gestureSeen) return;
      gestureSeen = true;
      c.removeEventListener('touchstart', once);
      c.removeEventListener('mousedown', once);
      var m = media();
      if (m) safe(function () { m.setSfxEnabled(sfxOn); m.setSfxVolume(VOLUME); });
      startMusic();
    };
    c.addEventListener('touchstart', once);
    c.addEventListener('mousedown', once);
  }
  function musicVolume() {
    var m = media();
    var gain = fade ? (fade.stage === 'out' ? 1 - fade.progress : fade.progress) : 1;
    var volume = MUSIC_VOLUME * (A._now() < duckUntil ? 0.45 : 1) * gain;
    if (!m || lastVolume === volume) return;
    lastVolume = volume;
    safe(function () { m.setBgmVolume(volume); });
  }
  function startMusic() {
    if (!musicOn || !gestureSeen || !enabled) return;
    var m = media();
    if (!m) return;
    musicVolume();
    safe(function () { m.playBgm(MUSIC[scene]); });
    playingScene = scene;
  }
  function pauseMusic() {
    var m = media();
    if (m) safe(function () { m.pauseBgm(); });
  }
  function syncPhase(phase) {
    if (phase === 'menu' || (A.State && A.State.time === 0)) {
      bossMusic = false;
      if (A.State && A.State.time === 0) fade = null;
    }
    if (A.State && A.State.enemies.some(function (enemy) { return !enemy.dead && enemy.def.tier === 'boss'; })) bossMusic = true;
    var next = phase === 'menu' || phase === 'loading' || phase === 'error' ? 'home' : bossMusic ? 'boss' : 'battle';
    scene = next;
    if (phase === 'win' || phase === 'lose') {
      fade = null;
      if (playingScene !== 'result') { pauseMusic(); playingScene = 'result'; }
    } else if (gestureSeen && musicOn && enabled) {
      if (playingScene !== scene && (!fade || fade.target !== scene)) {
        if (scene === 'boss' && playingScene === 'battle') fade = { target: scene, stage: 'out', start: A._now(), progress: 0 };
        else { fade = null; startMusic(); }
      }
      if (fade) {
        fade.progress = Math.min(1, Math.max(0, (A._now() - fade.start) / 850));
        if (fade.progress >= 1) {
          if (fade.stage === 'out') {
            fade = { target: scene, stage: 'in', start: A._now(), progress: 0 };
            startMusic();
          } else fade = null;
        }
      }
    }
    musicVolume();
  }
  function play(name) {
    // 按钮统一界面点击V1；角色部署、出售和战斗事件仍保留对应音效。
    if (name === 'start' || name === 'discard' || name === 'speed' || name === 'select' || name === 'expand') name = 'click';
    if (!enabled || !inited || !sfxOn || !gestureSeen || !SFX[name]) return;
    var now = A._now();
    if (lastPlay[name] !== undefined && now - lastPlay[name] < (THROTTLE[name] || 80)) return;
    lastPlay[name] = now;
    var m = media();
    if (!m) return;
    if (name === 'wave' || name === 'boss') { duckUntil = now + 700; musicVolume(); }
    if (name === 'win' || name === 'lose') { pauseMusic(); playingScene = 'result'; }
    var src = randomSfx(name);
    safe(function () { m.playSfx(src); });
  }
  function setMusic(on) {
    musicOn = !!on;
    if (!musicOn) pauseMusic();
    else if (!A.State || (A.State.phase !== 'win' && A.State.phase !== 'lose')) startMusic();
  }
  function setSfx(on) {
    sfxOn = !!on;
    var m = media();
    if (m) safe(function () { m.setSfxEnabled(sfxOn); m.setSfxVolume(VOLUME); });
  }
  function applySettings(opts) {
    opts = opts || {};
    if (typeof opts.music === 'boolean') musicOn = opts.music;
    if (typeof opts.sfx === 'boolean') sfxOn = opts.sfx;
    setSfx(sfxOn);
  }
  A.GameAudio = {
    init: init, play: play, syncPhase: syncPhase,
    setEnabled: function (v) { enabled = !!v; if (!enabled) pauseMusic(); else startMusic(); },
    setMusic: setMusic, setSfx: setSfx, applySettings: applySettings,
    isMusicOn: function () { return musicOn; }, isSfxOn: function () { return sfxOn; },
    startMusic: startMusic,
    setVolume: function (v) {
      VOLUME = Math.max(0, Math.min(1, v));
      var m = media();
      if (m) safe(function () { m.setSfxVolume(VOLUME); });
    }
  };
})();
