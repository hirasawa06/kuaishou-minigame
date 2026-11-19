/* gameplay/ui.js — 设置 / 我的名片 / 选择头像 / 修改昵称 / 邀请好友
 *
 * 这些界面统一使用奶油底色 + 木棕标题栏，叠在首页之上。
 * 所有命中矩形都来自 layout.js，绘制与点击共用同一份几何。
 */
(function () {
  var A = window.AIGCUtils;
  var C = A.Config;
  var S = A.State;
  var P = A.Profile;
  var L = A.Layout;
  var D = A.Render.draw;
  var icon = A.Scene.icon;

  var UI = {
    stack: [],          // 'settings' / 'stamina' / 'avatars' / 'invite' / 'collection' / 'heroDetail'
    draftAvatar: 0,
  };

  var COLOR = {
    page: '#f0e2cd',
    pageTop: '#f6ebda',
    pageBottom: '#e6d3b8',
    paper: '#fffdf8',
    paperDim: '#fbf1e2',
    row: '#fdf4e6',
    rowEdge: '#efdcc4',
    brown: '#8c5a33',
    brownDeep: '#73482a',
    brownLight: '#a9754a',
    text: '#5b4126',
    textDim: '#a08a70',
    accent: '#f0a02a',
    accentTop: '#ffc257',
    accentEdge: '#cf7f16',
    accentText: '#5a3208',
    green: '#79c95c',
    greenEdge: '#5ea844',
    greenKnob: '#ffffff',
    off: '#e7dcc9',
    offKnob: '#fffdf8',
    white: '#ffffff',
    mask: '#3c2818',
  };

  var AVATAR_COLOR = [];
  (function () {
    var items = (A.AvatarAtlas && A.AvatarAtlas.items) || [];
    for (var i = 0; i < items.length; i++) AVATAR_COLOR.push(items[i].color || '#f5a84a');
  })();

  var VERSION = 'v1.0.0';
  // 字形图集只有 18 / 28 / 48 三档，中号文字统一落到 28，避免缺字
  var FONT_MID = 28;
  var ID_PREFIX = 'ID ';

  function col(hex, a) { return D.color(hex, a); }

  // ── 通用绘制 ────────────────────────────────────────────────
  function dimBackground() {
    var u = L.ui;
    D.rect(0, 0, u.w, u.h, col(COLOR.mask, 0.34));
  }

  function paper(rect, radius, title, headH, borderless) {
    // 柔和投影 + 纸面
    D.roundRect(rect.x + 2, rect.y + 5, rect.w, rect.h, radius, col('#7a5533', 0.18));
    D.roundRect(rect.x, rect.y, rect.w, rect.h, radius, col(COLOR.paper, 0.985));
    if (!borderless) D.strokeRect(rect.x, rect.y, rect.w, rect.h, 1, col('#f3e3cd'));
    if (!title) return;
    // 木棕标题栏：仅盖住上半部分，底边与纸面同色形成圆角包裹
    var hh = headH;
    D.roundRect(rect.x, rect.y, rect.w, hh, radius, col(COLOR.brown));
    D.rect(rect.x, rect.y + hh - radius, rect.w, radius, col(COLOR.brown));
    D.centeredText(title, rect.x + rect.w / 2, rect.y + hh / 2, 32, col(COLOR.white));
  }

  function closeButton(rect) {
    var cx = rect.x + rect.w / 2;
    var cy = rect.y + rect.h / 2;
    var r = rect.w / 2;
    D.circle(cx, cy, r + 2, col('#7a5533', 0.12));
    D.circle(cx, cy, r, col(COLOR.paper));
    D.ring(cx, cy, r - 1, 1.2, col('#e7d3b8'));
    A.Scene.icon('ui-close', cx, cy, r * 1.5);
  }

  function backButton(rect) {
    icon('ui-back', rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w * 0.6);
  }

  function primaryButton(rect, label, size, borderless) {
    size = D.fontSize(size || 24);
    D.roundRect(rect.x, rect.y - 1, rect.w, rect.h + 3, rect.h / 2, col(COLOR.accentEdge, 0.34));
    D.roundRect(rect.x, rect.y, rect.w, rect.h, rect.h / 2, col(COLOR.accent));
    D.roundRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h * 0.44, rect.h / 2,
      col(COLOR.accentTop, 0.92));
    if (!borderless) D.strokeRect(rect.x, rect.y, rect.w, rect.h, 1.5, col(COLOR.accentEdge, 0.8));
    D.centeredText(label, rect.x + rect.w / 2, rect.y + rect.h / 2,
      size, col(COLOR.accentText));
  }

  function ghostRow(rect, label, opts) {
    opts = opts || {};
    D.roundRect(rect.x, rect.y, rect.w, rect.h, rect.h / 2, col(COLOR.paperDim));
    D.strokeRect(rect.x, rect.y, rect.w, rect.h, 1.2, col(COLOR.rowEdge));
    D.text(label, rect.x + rect.w / 2, rect.y + (rect.h - 28) / 2 + 2, opts.size || 28,
      opts.color || col(COLOR.text), 1);
    if (opts.chevron !== false) {
      icon('ui-chevron', rect.x + rect.w - 18, rect.y + rect.h / 2, rect.h * 0.4);
    }
  }

  function switchRects(rect) {
    var w = Math.round(Math.min(62, rect.h * 0.95));
    var h = Math.round(Math.min(32, rect.h * 0.48));
    return {
      track: { x: rect.x + rect.w - w - 12, y: rect.y + (rect.h - h) / 2, w: w, h: h },
      w: w, h: h,
    };
  }

  function toggleRow(rect, label, on) {
    D.roundRect(rect.x, rect.y, rect.w, rect.h, 14, col('#e5c5a0'));
    D.roundRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2, 13,
      col('#fff7eb'), col('#f9e8cd'));
    var pad = 14;
    var sw = switchRects(rect);
    var t = sw.track;
    var textW = t.x - rect.x - pad - 8;
    fittedText(label, rect.x + pad, rect.y + (rect.h - 28) / 2,
      28, textW, COLOR.brownDeep, 0);
    D.roundRect(t.x, t.y, t.w, t.h, t.h / 2,
      col(on ? COLOR.greenEdge : '#c6b39d'));
    D.roundRect(t.x + 2, t.y + 2, t.w - 4, t.h - 4, (t.h - 4) / 2,
      col(on ? COLOR.green : COLOR.off));
    var knobD = t.h - 6;
    var kx = on ? t.x + t.w - knobD - 3 : t.x + 3;
    D.circle(kx + knobD / 2, t.y + t.h / 2, knobD / 2, col(COLOR.greenKnob));
    D.circle(kx + knobD / 2, t.y + t.h / 2 - 1, knobD / 2 - 2.5, col('#ffffff', on ? 0.5 : 0.7));
  }

  function fittedText(value, x, y, size, maxW, color, align) {
    D.fittedText(value, x, y, size, maxW, col(color), align);
  }

  // 头像铺满格子，选中外圈沿用素材的1/8圆角比例
  function avatarFrame(rect, index, selected) {
    var r = Math.min(rect.w, rect.h);
    if (selected) {
      D.roundRect(rect.x - 2, rect.y - 2, rect.w + 4, rect.h + 4, r / 8 + 2,
        col('#f8c66a'));
    }
    drawAvatar(index, rect.x + rect.w / 2, rect.y + rect.h / 2, r);
  }

  function drawAvatar(index, cx, cy, size, home) {
    var atlas = home ? A.HomeAvatarAtlas : A.AvatarAtlas;
    var tex = A.Assets.entry(home ? 'avatars-home' : 'avatars');
    if (!atlas || !tex) {
      D.circle(cx, cy, size / 2, col(AVATAR_COLOR[index] || '#f5a84a'));
      return;
    }
    var items = atlas.items || [];
    var id = items[index] ? items[index].id : items[0].id;
    var f = atlas.frames[id];
    if (!f) return;
    D.texture(tex.tex, tex.w, tex.h, f[0], f[1], f[2], f[3],
      cx - size / 2, cy - size / 2, size, size);
  }

  // ── 设置 ────────────────────────────────────────────────────
  function drawSettings() {
    var u = L.ui;
    var g = u.settings;
    dimBackground();
    profilePaper(g.sheet, g.head, '设置');
    whiteClose(g.close);

    toggleRow(g.musicRow, '音乐', P.data.music);
    toggleRow(g.sfxRow, '音效', P.data.sfx);

    profileRow(g.shareBtn, '分享给好友', true);
    icon('ui-share', g.shareBtn.x + 25, g.shareBtn.y + g.shareBtn.h / 2,
      g.shareBtn.h * 0.4);

    fittedText('版本 ' + VERSION, g.sheet.x + g.sheet.w / 2, g.versionY,
      18, g.sheet.w - 36, COLOR.textDim, 1);
  }

  // ── 体力：仅展示 Profile 快照，不在 UI 改动恢复或奖励计算 ──
  function drawStamina() {
    var g = L.ui.stamina;
    var snapshot = P.getStaminaSnapshot();
    var full = snapshot.value >= snapshot.max;
    var busy = S.adBusy || (A.Rewards && A.Rewards.isBusy());
    var seconds = Math.max(0, Math.ceil(snapshot.nextRecoveryMs / 1000));
    var cx = g.sheet.x + g.sheet.w / 2;
    dimBackground();
    D.creamPanel(g.sheet, 1, 22);
    D.roundRect(g.sheet.x + 7, g.sheet.y + 7, g.sheet.w - 14,
      g.head - 11, 17, col('#f5d29f'));
    fittedText('体力', cx, g.sheet.y + (g.head - 28) / 2,
      28, g.sheet.w - 96, COLOR.brownDeep, 1);
    closeButton(g.close);
    fittedText('当前体力 ' + snapshot.value + '/' + snapshot.max,
      cx, g.valueY, 28, g.sheet.w - 36, COLOR.brownDeep, 1);
    fittedText(full ? '体力已满' : '恢复倒计时 ' + Math.floor(seconds / 60) + ':' +
      ('0' + seconds % 60).slice(-2) + ' +1', cx, g.timerY,
      18, g.sheet.w - 36, COLOR.textDim, 1);
    var enabled = !full && !busy;
    D.roundRect(g.ad.x, g.ad.y, g.ad.w, g.ad.h, g.ad.h / 2,
      col(enabled ? COLOR.accentEdge : '#bca58b'));
    D.roundRect(g.ad.x + 2, g.ad.y + 2, g.ad.w - 4, g.ad.h - 4,
      (g.ad.h - 4) / 2, col(enabled ? COLOR.accentTop : '#e7dcc9'));
    fittedText(busy ? '广告加载中' : full ? '体力已满' : '看广告 +10体力',
      cx, g.ad.y + 10, 28, g.ad.w - 24,
      enabled ? COLOR.accentText : COLOR.textDim, 1);
    fittedText(S.toast ? S.toast.text : '完整观看广告后获得奖励', cx, g.noteY, 18,
      g.sheet.w - 36, S.toast ? COLOR.brownDeep : COLOR.textDim, 1);
  }

  // ── 我的名片 ────────────────────────────────────────────────
  function whiteClose(rect) {
    var cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    var width = rect.w * 0.5, thickness = 3;
    for (var arm = -1; arm <= 1; arm += 2) {
      A.Render.push(cx - width / 2, cy - thickness / 2, width, thickness, col('#ffffff'),
        { mode: 0, hw: width / 2, hh: thickness / 2, r: thickness / 2,
          rot: arm * Math.PI / 4 });
    }
  }

  // --- 纸面内侧压边：阴影限制在圆角内部，向中心逐层淡出 ---
  function profileInset(x, y, w, h) {
    D.roundRect(x, y, w, h, 26, col('#e9c6a1'), col('#dcb48d'));
    D.roundRect(x + 1, y + 1, w - 2, h - 2, 25, col('#f5dfc7'), col('#eccba8'));
    D.roundRect(x + 3, y + 2, w - 6, h - 5, 24, col('#fbeedd'), col('#f4ddc2'));
    D.roundRect(x + 6, y + 4, w - 12, h - 10, 22, col('#fffaf3'), col('#fff0de'));
  }

  function profilePaper(rect, head, title) {
    var r = rect, bodyY = r.y + head - 4;
    for (var i = 3; i > 0; i--) {
      D.roundRect(r.x - i, r.y + 3 + i * 2, r.w + i * 2, r.h, 28 + i,
        col('#714325', 0.045));
    }
    D.roundRect(r.x, r.y, r.w, r.h, 28, col('#ce996d'), col('#825130'));
    // --- 顶部内沿六级羽化，避免亮边直接切到深棕色 ---
    for (var edge = 1; edge <= 6; edge++) {
      D.roundRect(r.x + Math.min(edge, 2), r.y + edge, r.w - Math.min(edge, 2) * 2,
        r.h - edge, 28 - Math.min(edge, 2),
        A.Render.mix(col('#ce996d'), col('#ac7149'), edge / 6), col('#825130'));
    }
    profileInset(r.x, bodyY, r.w, r.y + r.h - bodyY);
    D.text(title, r.x + r.w / 2, r.y + (head - 28) / 2, 28, col(COLOR.white), 1);
  }

  function profileRow(rect, label, chevron) {
    var radius = rect.h / 2;
    D.roundRect(rect.x - 1, rect.y + 5, rect.w + 2, rect.h, radius + 1, col('#a86e38', 0.09));
    D.roundRect(rect.x, rect.y + 3, rect.w, rect.h, radius, col('#b57c43', 0.19));
    D.roundRect(rect.x, rect.y + 1, rect.w, rect.h, radius, col('#d6ad7d'));
    D.roundRect(rect.x, rect.y, rect.w, rect.h - 1, radius, col('#f9e8cd'), col('#f8dfba'));
    D.text(label, rect.x + rect.w / 2, rect.y + (rect.h - 28) / 2 + 2,
      28, col(COLOR.brownDeep), 1);
    if (chevron) icon('ui-chevron', rect.x + rect.w - 18, rect.y + rect.h / 2, rect.h * 0.4);
  }

  // ── 选择头像 ────────────────────────────────────────────────
  function drawAvatarPick() {
    var u = L.ui;
    var g = u.avatarPick;
    dimBackground();
    profilePaper(g.sheet, g.head, '选择头像');
    whiteClose(g.close);

    for (var i = 0; i < P.AVATARS.length; i++) {
      var rect = g.rect(i);
      avatarFrame(rect, i, i === UI.draftAvatar);
    }

    profileRow(g.save, '确认选择');
  }

  // ── 邀请好友 ────────────────────────────────────────────────
  function drawInvite() {
    var u = L.ui;
    var g = u.invite;
    dimBackground();
    profilePaper(g.sheet, g.head, '一起守护小家');
    whiteClose(g.close);

    var b = g.body;
    D.roundRect(b.x, b.y, b.w, b.h, 20, col('#f9e8cd'), col('#f8dfba'));
    var av = Math.round(Math.min(b.h * 0.5, b.w * 0.26));
    var cy = b.y + b.h / 2;
    drawAvatar(0, b.x + b.w / 2 - av * 0.52, cy, av);
    drawAvatar(4, b.x + b.w / 2 + av * 0.52, cy, av);

    D.text('萌宠集结，一起出击！', g.sheet.x + g.sheet.w / 2, g.titleY, 28,
      col(COLOR.brownDeep), 1);

    profileRow(g.copy, '复制邀请口令');

  }

  // ── 萌宠收藏：各星级沿用同一静态立绘 ──
  function heroForm(def, level, cx, cy, size) {
    if (A.HeroForms && A.HeroForms.draw) A.HeroForms.draw(def.id, 2, cx, cy, size);
    else icon(def.icon, cx, cy, size);
  }
  function heroUnlocked(id) {
    return S.isHeroUnlocked ? S.isHeroUnlocked(id) :
      (P.data.completedLevel + 1 >= ({ war: 1, arch: 1, tank: 2, mage: 2, healer: 3 }[id] || 1));
  }
  // --- 展示与点击共用排序：已解锁优先，组内沿用配置顺序 ---
  function collectionHeroes() {
    return C.HEROES.filter(function (hero) { return heroUnlocked(hero.id); }).concat(
      C.HEROES.filter(function (hero) { return !heroUnlocked(hero.id); }));
  }
  // --- 收藏册立绘、剪影与徽章共用一张静态图集 ---
  function collectionArt(column, row, cx, cy, size) {
    var entry = A.Assets.entry('collection-art');
    if (!entry) return;
    D.texture(entry.tex, entry.w, entry.h, column * 256, row * 256, 256, 256,
      cx - size / 2, cy - size / 2, size, size);
  }
  // ── 收藏锁独立图片，按主体比例居中，不拉伸 ─────────────
  function collectionLock(cx, cy, size) {
    var entry = A.Assets.entry('collection-lock');
    if (!entry) return;
    var ratio = size / Math.max(entry.w, entry.h);
    var w = entry.w * ratio, h = entry.h * ratio;
    D.texture(entry.tex, entry.w, entry.h, 0, 0, entry.w, entry.h,
      cx - w / 2, cy - h / 2, w, h);
  }
  function collectionSilhouette(entry, cx, cy, maxW, maxH) {
    if (!entry) return;
    var ratio = Math.min(maxW / entry.w, maxH / entry.h);
    var w = entry.w * ratio, h = entry.h * ratio;
    D.texture(entry.tex, entry.w, entry.h, 0, 0, entry.w, entry.h,
      cx - w / 2, cy - h / 2, w, h);
  }
  function collectionCard(hero, cell) {
    var unlocked = heroUnlocked(hero.id), cx = cell.x + cell.w / 2;
    var scene = A.Assets.entry('collection-scene-' + hero.id);
    var silhouette = A.Assets.entry('collection-silhouette-' + hero.id);
    if (unlocked ? scene : silhouette) {
      // ┌─ 263:161：场景图只负责角色；卡框、波浪和标题均由代码绘制 ─┐
      var radius = cell.w * (45.636 / 329.521);
      var frameInset = cell.w * (10.4424 / 329.521);
      var photoRadius = cell.w * ((48.7324 - 10.4424) / 329.521);
      // Figma: 0 0 4.641 rgba(46,37,16,.48)，用两层软边逼近其中心阴影。
      // --- 收藏卡轻投影：三层低不透明度、向下偏移，近似柔和羽化而非硬描边 ---
      D.roundRect(cell.x - 4.0, cell.y - 1.2, cell.w + 8.0, cell.h + 8.0, radius + 4.0, col('#6a431b', 0.012));
      D.roundRect(cell.x - 2.4, cell.y + 0.2, cell.w + 4.8, cell.h + 4.8, radius + 2.4, col('#6a431b', 0.022));
      D.roundRect(cell.x - 1.0, cell.y + 1.4, cell.w + 2.0, cell.h + 2.0, radius + 1.0, col('#6a431b', 0.032));
      // Union 的照片槽从四边各缩进 10.442px；这是 Figma 卡框可见的米金边。
      var panelTop = unlocked ? col('#fff7da') : col('#eeebe5');
      var panelBottom = unlocked ? col('#ffd59e') : col('#d8cfc2');
      var borderColor = unlocked ? col('#874600') : col('#c4c4c4');
      D.roundRect(cell.x, cell.y, cell.w, cell.h, radius, panelTop, panelBottom);
      if (unlocked) {
        D.roundTexture(scene.tex, cell.x + frameInset, cell.y + frameInset,
          cell.w - frameInset * 2, cell.h - frameInset * 2, photoRadius);
      } else {
        // --- 锁定态：角色剪影替代场景立绘，底框与波浪仍复用同一张卡结构 ---
        D.roundRect(cell.x + frameInset, cell.y + frameInset,
          cell.w - frameInset * 2, cell.h - frameInset * 2,
          photoRadius, col('#dad7d2'), col('#cbc6bf'));
        collectionSilhouette(silhouette, cx, cell.y + cell.h * 0.39,
          (cell.w - frameInset * 2) * 0.9, cell.h * 0.62);
      }

      D.wavePanel(cell.x, cell.y, cell.w, cell.h, radius,
        panelTop, panelBottom);
      if (!unlocked) {
        collectionLock(cx, cell.y + cell.h * 0.43, cell.w * 0.22);
      }
      // --- 所有内容绘制完成后再描边，消除圆角边缘的覆盖误差 ---
      D.figmaCardBorder(cell.x, cell.y, cell.w, cell.h, radius, borderColor);
      var caption = unlocked ? hero.name : '第 ' + hero.unlockLevel + ' 关解锁';
      fittedText(caption, cx, cell.y + cell.h * (414.22 / 502.404), cell.w * (41.77 / 329.521),
        cell.w * 0.84, unlocked ? '#591f00' : '#665d52', 1);
      return;
    }
    var radius = Math.min(22, cell.w * 0.13);
    D.roundRect(cell.x, cell.y, cell.w, cell.h, radius, col(unlocked ? '#655740' : '#b79e83'));
    D.roundRect(cell.x + 0.8, cell.y + 0.8, cell.w - 1.6, cell.h - 1.6, radius - 0.8, col(unlocked ? '#ebcfa5' : '#dfccb4'));
    var size = Math.min(cell.w * 0.95, cell.h * 0.69);
    var column = ['tank', 'war', 'arch', 'mage', 'healer'].indexOf(hero.id);
    collectionArt(column, unlocked ? 0 : 1, cx, cell.y + cell.h * 0.40, size);
    if (!unlocked) collectionLock(cx, cell.y + cell.h * 0.43, size * 0.34);
    var label = unlocked ? hero.name : '第 ' + hero.unlockLevel + ' 关解锁';
    fittedText(label, cx, cell.y + cell.h * 0.80, unlocked ? 28 : 18, cell.w - 20, unlocked ? '#19140e' : COLOR.brownDeep, 1);
  }
  function drawCollection(detail) {
    var u = L.ui, g = u.collection;
    var book = A.Assets.entry('collection-book');
    if (book) D.texture(book.tex, book.w, book.h, 0, 0, book.w, book.h, 0, 0, u.w, u.h);
    backButton(g.back);
    if (detail) {
      var def = S.heroById(UI.collectionHero);
      if (!def || !heroUnlocked(def.id)) { back(); return; }
      D.text(def.name, u.safeLeft + (u.safeRight - u.safeLeft) / 2, g.detailNameY, 28, col(COLOR.brownDeep), 1);
      drawCollectionDetail(def, g);
      return;
    }
    var collected = C.HEROES.filter(function (hero) { return heroUnlocked(hero.id); }).length;
    fittedText('萌宠收藏', u.w / 2, g.titleY, 28, g.back.x > 0 ? u.w * 0.43 : 180, COLOR.brownDeep, 1);
    D.text(collected + '/' + C.HEROES.length, g.countX, g.titleY + 6, 18, col(COLOR.brownDeep), 2);
    var heroes = collectionHeroes();
    for (var i = 0; i < heroes.length; i++) {
      collectionCard(heroes[i], g.rect(i));
    }
  }

  // ── 栈管理 ──────────────────────────────────────────────────

  function drawCollectionDetail(def, g) {
    var image = g.detailImage, panel = g.detailPanel;
    var scene = A.Assets.entry('collection-scene-' + def.id);
    if (scene) drawDetailPortrait(scene, image);
    else heroForm(def, 2, image.x + image.w / 2, image.y + image.h / 2, image.w);
    D.roundRect(panel.x, panel.y, panel.w, panel.h, 24, col('#fff7df'));
    var forms = [1, 2, 3].map(function (star) { return S.heroAtStar(def.id, star); });
    var rows = [
      ['生命', function (f) { return Math.round(f.hp); }],
      [def.cls === 'healer' ? '回血' : '攻击', function (f) { return Math.round(def.cls === 'healer' ? f.heal : f.atk); }],
      [def.cls === 'healer' ? '治疗间隔' : '攻击间隔', function (f) { return def.cls === 'tank' ? '--' : Math.round(f.interval * 1000); }],
      [def.cls === 'healer' ? '治疗距离' : '攻击距离', function (f) { return Math.round(f.range); }],
      ['嘲讽范围', function (f) { return Math.round(f.taunt || 0); }],
      ['群攻范围', function (f) { return Math.round(f.splash || 0); }],
      ['消耗饼干', function (f) { return f.cost; }]
    ];
    var pad = 18, top = panel.y + 16;
    var font = (panel.h - 36) / 8 < 24 ? 12 : 16;
    var rowH = (panel.h - 16 - 20 - D.textLineH(font)) / 7;
    fittedText('1星 / 2星 / 3星', panel.x + panel.w - pad, top,
      font, panel.w - pad * 2, '#a77b55', 2);
    for (var i = 0; i < rows.length; i++) {
      var y = top + (i + 1) * rowH;
      var value = forms.map(rows[i][1]).join('/');
      if (i === 2 && def.cls !== 'tank') value += '毫秒';
      fittedText(rows[i][0], panel.x + pad, y, font, panel.w * 0.32, COLOR.brownDeep, 0);
      fittedText(value, panel.x + panel.w - pad, y, font,
        panel.w * 0.58, COLOR.brownDeep, 2);
    }
  }

  function drawDetailPortrait(scene, image) {
    var scale = Math.max(image.w / scene.w, image.h / scene.h);
    var w = scene.w * scale, h = scene.h * scale;
    D.roundRect(image.x, image.y, image.w, image.h, 28, col(COLOR.brownDeep));
    A.Render.setClipRect({ x: image.x + 3, y: image.y + 3,
      w: image.w - 6, h: image.h - 6 }, 25);
    D.texture(scene.tex, scene.w, scene.h, 0, 0, scene.w, scene.h,
      image.x + (image.w - w) / 2, image.y + (image.h - h) / 2, w, h);
    A.Render.setClipRect(null);
  }

  function top() {
    return UI.stack.length ? UI.stack[UI.stack.length - 1] : null;
  }

  function open(name) {
    if (['settings', 'stamina', 'avatars', 'invite', 'collection', 'heroDetail'].indexOf(name) === -1) return;
    if (UI.stack.indexOf(name) === -1) UI.stack.push(name);
    prepare(name);
  }

  function prepare(name) {
    if (name === 'avatars') UI.draftAvatar = P.data.avatarIndex;
  }

  function back() {
    if (UI.stack.length) UI.stack.pop();
  }

  function closeAll() {
    UI.stack.length = 0;
  }

  function isOpen() {
    return UI.stack.length > 0;
  }

  // 返回需要重新打开的栈（用于设置 → 邀请 → 关闭时回到设置）
  function replaceTop(name) {
    if (!UI.stack.length) return;
    UI.stack[UI.stack.length - 1] = name;
    prepare(name);
  }

  // ── 命中与交互 ──────────────────────────────────────────────
  function pointIn(rect, x, y, pad) {
    pad = pad || 0;
    return rect && x >= rect.x - pad && x <= rect.x + rect.w + pad &&
      y >= rect.y - pad && y <= rect.y + rect.h + pad;
  }

  function toast(text, life) {
    S.toastMsg(text, life || 1.2);
  }

  function linkOf() {
    if (!window.KwaiRepost || !KwaiRepost.buildQuery) return '';
    var query = KwaiRepost.buildQuery({ from: 'invite', id: P.data.id });
    return query ? 'TD?' + query : 'TD';
  }

  function copyInviteLink() {
    var link = linkOf();
    var done = function () {
      toast('邀请口令已复制', 1.2);
    };
    var fail = function () {
      // 剪贴板不可用时降级为系统分享，仍给用户可用的出口
      shareInvite(true);
    };
    if (!link || !window.KwaiDevice || !KwaiDevice.copyText) { fail(); return; }
    KwaiDevice.copyText(link, done, fail);
  }

  function shareInvite(fallbackToCopy) {
    if (typeof KwaiRepost !== 'undefined') {
      KwaiRepost.shareAppMessage({
        query: { from: 'invite', id: P.data.id },
        onSuccess: function () { toast('分享成功', 1.2); },
        onCancel: function () { toast('已取消分享', 1.0); },
        onFail: function () {
          if (fallbackToCopy) { copyFallback(); }
          else toast('分享失败，可试试复制口令', 1.6);
        },
      });
      return;
    }
    if (fallbackToCopy) { copyFallback(); return; }
    toast('当前环境不支持分享', 1.2);
  }

  function copyFallback() {
    var link = linkOf();
    if (!link || !window.KwaiDevice || !KwaiDevice.copyText) {
      toast('复制失败，请再试一次', 1.4);
      return;
    }
    KwaiDevice.copyText(link, function () {
      toast('邀请口令已复制', 1.4);
    }, function () {
      toast('复制失败，请再试一次', 1.4);
    });
  }

  function play(name) {
    if (A.GameAudio) A.GameAudio.play('click');
  }

  function setMusic(on) {
    P.setMusic(on);
    if (A.GameAudio) A.GameAudio.setMusic(on);
    if (on) play('start');
  }

  function setSfx(on) {
    P.setSfx(on);
    if (A.GameAudio) A.GameAudio.setSfx(on);
    if (on) play('start');
  }

  // 每帧交互入口：命中则消费并返回 true
  function handleTap(x, y) {
    var name = top();
    if (!name) return false;
    var u = L.ui;
    if (!pointIn(u.interactiveRect, x, y, 0)) return true;
    if (name === 'stamina') {
      var st = u.stamina;
      if (pointIn(st.close, x, y, 0) || !pointIn(st.sheet, x, y, 0)) {
        play('click');
        if (UI.stack.length > 1) back(); else closeAll();
        return true;
      }
      if (pointIn(st.ad, x, y, 0)) {
        if (S.adBusy || (A.Rewards && A.Rewards.isBusy())) return true;
        var snapshot = P.getStaminaSnapshot();
        if (snapshot.value >= snapshot.max) { toast('体力已满', 1.4); return true; }
        play('click');
        if (A.Rewards && A.Rewards.watchStamina) A.Rewards.watchStamina();
        else toast('当前环境不支持广告', 1.4);
      }
      return true;
    }
    if (name === 'collection' || name === 'heroDetail') {
      if (pointIn(u.collection.back, x, y, 0)) { play('click'); back(); return true; }
      if (name === 'collection') {
        var heroes = collectionHeroes();
        for (var hi = 0; hi < heroes.length; hi++) {
          if (pointIn(u.collection.rect(hi), x, y, 0) && heroUnlocked(heroes[hi].id)) {
            UI.collectionHero = heroes[hi].id; play('click'); open('heroDetail'); return true;
          }
        }
      }
      return true;
    }
    // 为关闭、返回、分享、保存等此前无声音的按钮补齐统一点击反馈。
    var controls = [];
    if (name === 'settings') controls = [u.settings.close, u.settings.musicRow, u.settings.sfxRow, u.settings.shareBtn];
    else if (name === 'avatars') {
      controls = [u.avatarPick.close, u.avatarPick.save];
      for (var ai = 0; ai < P.AVATARS.length; ai++) controls.push(u.avatarPick.rect(ai));
    }
    else if (name === 'invite') controls = [u.invite.close, u.invite.copy];
    for (var ci = 0; ci < controls.length; ci++) {
      if (pointIn(controls[ci], x, y, 0)) { play('click'); break; }
    }

    if (name === 'settings') {
      var g = u.settings;
      if (pointIn(g.close, x, y, 6)) { closeAll(); return true; }
      if (pointIn(g.musicRow, x, y, 4)) { setMusic(!P.data.music); return true; }
      if (pointIn(g.sfxRow, x, y, 4)) { setSfx(!P.data.sfx); return true; }
      if (pointIn(g.shareBtn, x, y, 4)) { open('invite'); return true; }
      // 点在纸上但不命中控件：吞掉点击，避免穿透到首页
      if (pointIn(g.sheet, x, y, 0)) return true;
      closeAll();
      return true;
    }

    if (name === 'avatars') {
      var a = u.avatarPick;
      if (pointIn(a.close, x, y, 6)) { back(); return true; }
      for (var i = 0; i < P.AVATARS.length; i++) {
        if (pointIn(a.rect(i), x, y, 3)) {
          UI.draftAvatar = i;
          return true;
        }
      }
      if (pointIn(a.save, x, y, 4)) {
        P.setAvatar(UI.draftAvatar);
        toast('头像已保存', 1.1);
        back();
        return true;
      }
      if (pointIn(a.sheet, x, y, 0)) return true;
      back();
      return true;
    }

    if (name === 'invite') {
      var iv = u.invite;
      if (pointIn(iv.close, x, y, 6)) {
        // 从设置进来时关闭弹窗回到设置页，否则回到首页
        if (UI.stack.length > 1) back(); else closeAll();
        return true;
      }
      if (pointIn(iv.copy, x, y, 4)) { copyInviteLink(); return true; }
      if (pointIn(iv.sheet, x, y, 0)) return true;
      if (UI.stack.length > 1) back(); else closeAll();
      return true;
    }
    return false;
  }

  // 绘制入口：由 game.js 在首页或战斗界面之上调用
  function draw() {
    if (!UI.stack.length) return;
    var name = top();
    if (name === 'settings') drawSettings();
    else if (name === 'stamina') drawStamina();
    else if (name === 'avatars') drawAvatarPick();
    else if (name === 'invite') drawInvite();
    else if (name === 'collection') drawCollection(false);
    else if (name === 'heroDetail') drawCollection(true);
  }

  A.ProfileUI = {
    open: open,
    back: back,
    close: closeAll,
    isOpen: isOpen,
    top: top,
    handleTap: handleTap,
    draw: draw,
    avatar: drawAvatar,
    dialogPaper: profilePaper,
    dialogButton: profileRow,
    shareInvite: shareInvite,
    copyInviteLink: copyInviteLink,
  };
})();
