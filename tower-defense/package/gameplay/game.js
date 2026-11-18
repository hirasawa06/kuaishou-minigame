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
  var BOSS_LAB_ACTIONS = ['idle', 'move', 'atk', 'aoe', 'hurt', 'die'];

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
    if (S.phase === 'loading') {
      // 仅冷启动时根据本地通关记录定位；局内返回首页仍保留玩家所选关卡。
      var completed = A.Profile && A.Profile.data ? A.Profile.data.completedLevel : 0;
      S.selectedLevel = S.clamp((completed | 0) + 1, 1, C.LEVELS.length);
      if (window.__bossLabPreview) openBossLab();
      else S.phase = 'menu';
    }
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
    if (S.adBusy || (A.Rewards && A.Rewards.isBusy())) return false;
    var level = S.clamp(S.selectedLevel | 0, 1, C.LEVELS.length);
    if (A.Profile && !A.Profile.isLevelUnlocked(level)) {
      S.toastMsg('请先通过第 ' + (level - 1) + ' 关', 1.4);
      return false;
    }
    if (A.Profile && !A.Profile.consumeStamina()) {
      S.menuStartDelay = 0;
      S.toastMsg('体力不足，请稍后再试', 1.8);
      return false;
    }
    S.currentLevel = level;
    S.levelHpScale = C.LEVELS[level - 1].hpScale;
    S.levelAtkScale = C.LEVELS[level - 1].atkScale;
    A.Input.cancel();
    L.ui.ready = false;
    L.calc();
    if (A.ProfileUI) A.ProfileUI.close();
    S.reset();
    if (A.Tutorial) A.Tutorial.begin();
    A.GameAudio && A.GameAudio.syncPhase(S.phase);
    syncViewport();
    S.toastMsg('守护主人与猫狗的合照', 1.8);
    A.GameAudio && A.GameAudio.play('start');
    return true;
  }

  function nextLevel() {
    if (S.phase !== 'win' || S.currentLevel >= C.LEVELS.length) return false;
    var next = S.currentLevel + 1;
    if (!A.Profile.isLevelUnlocked(next)) return false;
    S.selectedLevel = next;
    return start();
  }

  function toggleSpeed() {
    if (S.phase !== 'playing') return;
    S.battleSpeed = S.battleSpeed === 2 ? 1 : 2;
    A.GameAudio && A.GameAudio.play('speed');
  }

  function openBossLab() {
    A.Input.cancel();
    if (A.Tutorial) A.Tutorial.stop();
    var def = C.ENEMIES.boss;
    S.bossLab = {
      action: 'idle', impactT: -1,
      entity: { def: def, rigId: 'boss', anim: 'idle', animT: 0, hitFlash: 0 },
    };
    S.phase = 'bossLab';
    A.GameAudio && A.GameAudio.play('click');
  }

  function selectBossLabAction(action) {
    if (S.phase !== 'bossLab' || BOSS_LAB_ACTIONS.indexOf(action) < 0) return false;
    var preview = S.bossLab;
    preview.action = action;
    preview.entity.anim = action;
    preview.entity.animT = 0;
    preview.impactT = -1;
    A.GameAudio && A.GameAudio.play('click');
    return true;
  }

  function closeBossLab() {
    if (S.phase !== 'bossLab') return false;
    S.bossLab = null;
    S.phase = 'menu';
    A.GameAudio && A.GameAudio.syncPhase(S.phase);
    A.GameAudio && A.GameAudio.play('click');
    return true;
  }

  function updateBossLab(dt) {
    var preview = S.bossLab;
    var rig = A.Rigs && A.Rigs.boss;
    var state = preview && rig && rig.states[preview.action];
    if (!state) return;
    var entity = preview.entity;
    var before = entity.animT;
    entity.animT += dt;
    if (preview.impactT >= 0) preview.impactT += dt;
    if (preview.action === 'aoe' && before < state.hit && entity.animT >= state.hit) {
      preview.impactT = entity.animT - state.hit;
    }
    if (state.loop && state.dur > 0) entity.animT %= state.dur;
    else if (entity.animT >= state.dur && preview.action !== 'die') entity.animT = 0;
    else if (entity.animT >= state.dur) entity.animT = state.dur;
  }

  function selectLevel(delta, releaseOffset) {
    if (S.phase !== 'menu' || S.menuStartDelay > 0 || S.menuSlide) return false;
    var target = S.clamp(S.selectedLevel + delta, 1, C.LEVELS.length);
    var cardW = L.ui.menu && L.ui.menu.card ? L.ui.menu.card.w : 300;
    var offset = releaseOffset || 0;
    if (target === S.selectedLevel && Math.abs(offset) < 1) return false;
    S.menuSlide = {
      from: S.selectedLevel, to: target, offset: offset,
      end: target === S.selectedLevel ? 0 : (delta > 0 ? -cardW : cardW),
      elapsed: 0, duration: target === S.selectedLevel ? 0.18 : 0.22,
    };
    S.menuFeedback = null;
    return true;
  }

  function togglePause() {
    if (A.Tutorial && !A.Tutorial.allow('pause')) return;
    A.Input.cancel();
    if (S.phase === 'playing') {
      S.phase = 'paused';
      S.dragging = null;
      A.GameAudio && A.GameAudio.play('click');
    } else if (S.phase === 'paused') {
      S.phase = 'playing';
      A.GameAudio && A.GameAudio.play('click');
    }
  }

  // 由「重新开始」调用：保留当前布局，重置对局数据
  function restart() {
    if (S.adBusy || (A.Rewards && A.Rewards.isBusy())) return false;
    S.selectedLevel = S.currentLevel;
    return start();
  }

  // 返回主页：清空本局临时状态，回到首页；未结束的一局不计入存档
  function goMenu() {
    if (A.Rewards) A.Rewards.cancel();
    if (A.Tutorial) A.Tutorial.stop();
    A.Input.cancel();
    S.menuStartDelay = 0;
    // 先离开战斗，再关闭设置等局内页面。
    S.phase = 'menu';
    if (A.ProfileUI) A.ProfileUI.close();
    A.GameAudio && A.GameAudio.syncPhase(S.phase);
    A.GameAudio && A.GameAudio.play('click');
    S.dragging = null;
    S.shopPressed = null;
    S.shopFeedback = null;
    S.drag = null;
    S.inspect = null;
    S.inspectT = 0;
    S.toast = null;
    S.shake = 0;
    S.hitstop = 0;
    S.units.length = 0;
    S.enemies.length = 0;
    S.projectiles.length = 0;
    S.effects.length = 0;
    S.floats.length = 0;
    S.spawnQueue.length = 0;
    S.ranking = null;
  }

  // 战斗内打开设置：先暂停，避免打开面板时敌人继续推进
  function openSettings() {
    A.Input.cancel();
    if (S.phase === 'playing') {
      S.phase = 'paused';
      S.dragging = null;
    }
    if (A.ProfileUI) A.ProfileUI.open('settings');
  }

  function update(dt) {
    // 战斗与教程各自计时；首页、暂停和结算也必须让临时提示到期。
    var tutorialActive = A.Tutorial && A.Tutorial.isActive();
    if (S.phase !== 'playing' && !tutorialActive && S.toast) {
      S.toast.life = Math.max(0, S.toast.life - dt);
      if (S.toast.life <= 0) S.toast = null;
    }
    if (S.adBusy) {
      A.GameAudio && A.GameAudio.syncPhase(S.phase);
      return; // 视频期间不倒计时开新局、不推进波次/教程；失败阶段保持 lose。
    }
    if (S.menuFeedback && S.menuFeedback.life > 0) S.menuFeedback.life -= dt;
    if (S.menuSlide) {
      S.menuSlide.elapsed += dt;
      if (S.menuSlide.elapsed >= S.menuSlide.duration) {
        if (S.selectedLevel !== S.menuSlide.to) A.GameAudio && A.GameAudio.play('select');
        S.selectedLevel = S.menuSlide.to;
        S.menuSlide = null;
      }
    }
    if (S.shopFeedback && S.shopFeedback.life > 0) S.shopFeedback.life -= dt;
    if (S.phase === 'menu' && S.menuStartDelay > 0) {
      S.menuStartDelay -= dt;
      if (S.menuStartDelay <= 0) { S.menuStartDelay = 0; start(); }
    }
    // 首次引导只更新提示/UI/音乐，不调用 Battle，波次与攻击保持冻结。
    if (S.phase === 'bossLab') updateBossLab(dt);
    else if (A.Tutorial && A.Tutorial.isActive()) A.Tutorial.update(dt);
    else {
      // 2× 使用两个固定步长推进，避免加大 dt 漏过命中帧或碰撞。
      var steps = S.phase === 'playing' && S.battleSpeed === 2 ? 2 : 1;
      for (var si = 0; si < steps; si++) {
        A.Battle.update(dt);
        if (S.phase !== 'playing') break;
      }
    }
    A.GameAudio && A.GameAudio.syncPhase(S.phase);
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
    Scene.drawFieldGuides();

    var i;
    Scene.drawSpawnHint();
    Scene.drawGroundEffects();
    // 所有角色共用一个南北景深序列：北侧先画，南侧后画，因此南侧角色
    // 会自然遮住北侧角色，不再由“宠物总在前 / 怪物总在前”决定层级。
    var actors = [];
    for (i = 0; i < S.units.length; i++) actors.push({ actor: S.units[i], isEnemy: false });
    for (i = 0; i < S.enemies.length; i++) actors.push({ actor: S.enemies[i], isEnemy: true });
    actors.sort(function (a, b) {
      var depth = Scene.actorDepthY(a.actor, a.isEnemy) - Scene.actorDepthY(b.actor, b.isEnemy);
      if (Math.abs(depth) > 0.001) return depth;
      // 同一落点保持稳定、可复现的顺序，避免每帧交替闪烁。
      return a.actor.uid - b.actor.uid;
    });
    for (i = 0; i < actors.length; i++) {
      if (actors[i].isEnemy) Scene.drawEnemy(actors[i].actor);
      else Scene.drawUnit(actors[i].actor);
    }
    // 守护物位于战场前景，命中和血量反馈覆盖到合照本体。
    Scene.drawBase();
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

    if (S.phase === 'bossLab') {
      Scene.drawBossLab();
      Hud.drawBossLab();
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

    // 战斗内设置面板叠在暂停层之上
    if (A.ProfileUI) A.ProfileUI.draw();
    if (A.Tutorial) A.Tutorial.draw();

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
    nextLevel: nextLevel,
    toggleSpeed: toggleSpeed,
    openBossLab: openBossLab,
    closeBossLab: closeBossLab,
    selectBossLabAction: selectBossLabAction,
    selectLevel: selectLevel,
    start: start,
    restart: restart,
    goMenu: goMenu,
    openSettings: openSettings,
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
