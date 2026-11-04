/* gameplay/game.js — 主循环装配：初始化 → 更新 → 绘制 */
(function () {
  var A = window.AIGCUtils;
  var C = A.Config;
  var S = A.State;
  var L = A.Layout;
  var Scene = A.Scene;
  var Hud = A.Hud;

  var booted = false;
  var glReady = false;
  var lastNow = 0;
  var acc = 0;
  var rafOn = false;

  var STEP = 1 / 60;

  function boot() {
    if (booted) return;
    booted = true;
    var canvas = window.canvas;
    if (!canvas) {
      console.error('Game.Boot', '未找到主画布 window.canvas');
      return;
    }
    L.calc();
    if (!A.Render.init(canvas)) {
      S.phase = 'error';
      return;
    }
    glReady = true;
    syncViewport();
    A.Input.bind(canvas);
    S.phase = 'loading';
    // 先把存档里的音乐/音效开关同步给音频模块，再挂首次交互
    if (A.Profile && A.GameAudio) {
      A.GameAudio.applySettings({ music: A.Profile.data.music, sfx: A.Profile.data.sfx });
    }
    A.GameAudio && A.GameAudio.init();
    A.Assets.init(applyAssetResult);
  }

  function applyAssetResult(assetResult) {
    L.ui.ready = false;
    L.calc();
    if (!assetResult || !assetResult.ok) {
      S.assetErrors = assetResult && assetResult.failed ? assetResult.failed : [];
      S.phase = 'error';
      return false;
    }
    // 资源就绪时若已经开局（极端情况），不要覆盖当前阶段
    if (S.phase === 'loading') S.phase = 'menu';
    return true;
  }

  function syncViewport() {
    var canvas = window.canvas;
    if (!canvas || !A.Render.gl) return;
    var gl = A.Render.gl;
    if (gl.viewport) gl.viewport(0, 0, canvas.width, canvas.height);
    A.Render.setRes(L.w || C.designW, L.h || C.designH);
  }

  function refreshLayout() {
    var u = L.ui;
    if (u.ready && u.w === L.w && u.h === L.h && u.sourceSafeTop === (L.safeTop || 0)) return;
    u.ready = false;
    L.calc();
    // 商店固定 4 格，布局变化时无需重排；保留钩子给后续滚动型卡池
    syncViewport();
  }

  function start() {
    L.ui.ready = false;
    L.calc();
    S.reset();
    syncViewport();
    S.toastMsg('布阵准备', 1.2);
    A.GameAudio && A.GameAudio.play('start');
  }

  function togglePause() {
    if (S.phase === 'playing') {
      S.phase = 'paused';
      S.dragging = null;
    } else if (S.phase === 'paused') {
      S.phase = 'playing';
    }
  }

  function update(dt) {
    if (S.inspectT > 0) S.inspectT -= dt;
    A.Battle.update(dt);
  }

  function drawBackdrop() {
    var w = L.w || C.designW;
    var h = L.h || C.designH;
    A.Render.beginFrame([0.027, 0.043, 0.075]);
    // 静态背景
    A.Render.draw.vGradient(0, 0, w, h, A.Render.color('#16224a'), A.Render.color('#070b16'), 20);
  }

  function drawBattle() {
    var D = A.Render.draw;
    Scene.drawBackground();
    Scene.drawBase();

    var i;
    Scene.drawSpawnHint();
    for (i = 0; i < S.units.length; i++) Scene.drawUnit(S.units[i]);
    for (i = 0; i < S.enemies.length; i++) Scene.drawEnemy(S.enemies[i]);
    Scene.drawProjectiles();
    Scene.drawEffects();
    Scene.drawFloats();

    if (S.shake > 0.05) {
      var f = L.ui.field;
      D.roundRect(f.x, f.y, f.w, f.h, 16, A.Render.color('#ff5a6e', S.shake * 0.14));
    }
  }

  // 菜单态：只画静态战场做背景，不画 HUD / 卡槽
  function drawBattleIdle() {
    Scene.drawBackground();
    Scene.drawBase();
  }

  function render() {
    try {
      renderInner();
    } catch (e) {
      // 绘制异常只记录一次，避免每帧刷屏；后续帧继续尝试，便于定位
      if (!render.__logged) {
        render.__logged = true;
        console.error('Game.Render', e && e.stack ? e.stack : e);
      }
    }
  }

  function renderInner() {
    drawBackdrop();
    if (S.phase === 'loading' || S.phase === 'error') {
      Hud.drawLoading();
      if (A.SafeAreaDebug) A.SafeAreaDebug.draw();
      A.Render.endFrame();
      return;
    }

    if (S.phase === 'menu') {
      drawBattleIdle();
      Hud.drawMenu();
      if (A.ProfileUI) A.ProfileUI.draw();
      if (A.SafeAreaDebug) A.SafeAreaDebug.draw();
      A.Render.endFrame();
      return;
    }

    drawBattle();
    // 战斗中打开排行榜等页面时，仍然显示 HUD，但页面盖在最上层
    Hud.drawHud();
    Hud.drawTray();
    Hud.drawDragGhost();
    Hud.drawInspect();
    Hud.drawToast();

    if (S.phase === 'paused') Hud.drawPaused();
    else if (S.phase === 'win') Hud.drawResult(true);
    else if (S.phase === 'lose') Hud.drawResult(false);

    if (A.SafeAreaDebug) A.SafeAreaDebug.draw();
    A.Render.endFrame();
  }

  function loop() {
    if (!rafOn) return;
    var now = A._now();
    if (!lastNow) lastNow = now;
    var dt = (now - lastNow) / 1000;
    lastNow = now;
    if (!(dt >= 0)) dt = 0;
    if (dt > 0.1) dt = 0.1;
    acc += dt;
    var guard = 0;
    while (acc >= STEP && guard < 5) {
      update(STEP);
      acc -= STEP;
      guard++;
    }
    if (guard >= 5) acc = 0;
    render();
    requestAnimationFrame(loop);
  }

  function startLoop() {
    if (rafOn) return;
    rafOn = true;
    lastNow = 0;
    requestAnimationFrame(loop);
  }

  A.Game = {
    boot: boot,
    start: start,
    togglePause: togglePause,
    update: update,
    render: render,
    loop: loop,
    syncViewport: syncViewport,
    applyAssetResult: applyAssetResult,
    isBooted: function () { return booted; },
    isGlReady: function () { return glReady; },
  };

  // 由 kwaiStandard/main.js 的 draw()（占位绘制替换点）每帧调用
  A.GameLoop = {
    frame: function () {
      if (!booted) boot();
      if (!glReady) {
        if (S.phase === 'loading') Hud.drawLoading();
        A.Render.endFrame();
        return;
      }
      refreshLayout();
      var now = A._now();
      if (!lastNow) lastNow = now;
      var dt = (now - lastNow) / 1000;
      lastNow = now;
      if (!(dt >= 0)) dt = 0;
      if (dt > 0.1) dt = 0.1;
      acc += dt;
      var guard = 0;
      while (acc >= STEP && guard < 5) {
        update(STEP);
        acc -= STEP;
        guard++;
      }
      if (guard >= 5) acc = 0;
      syncViewport();
      render();
    },
  };
})();
