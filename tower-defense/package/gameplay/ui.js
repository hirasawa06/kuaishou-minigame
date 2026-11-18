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
    stack: [],          // 'settings' / 'stamina' / 'profile' / 'avatars' / 'nickname' / 'invite' / 'collection' / 'heroDetail'
    draftNickname: '',
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

  function paper(rect, radius, title, headH) {
    // 柔和投影 + 纸面
    D.roundRect(rect.x + 2, rect.y + 5, rect.w, rect.h, radius, col('#7a5533', 0.18));
    D.roundRect(rect.x, rect.y, rect.w, rect.h, radius, col(COLOR.paper, 0.985));
    D.strokeRect(rect.x, rect.y, rect.w, rect.h, 1, col('#f3e3cd'));
    if (!title) return;
    // 木棕标题栏：仅盖住上半部分，底边与纸面同色形成圆角包裹
    var hh = headH;
    D.roundRect(rect.x, rect.y, rect.w, hh, radius, col(COLOR.brown));
    D.rect(rect.x, rect.y + hh - radius, rect.w, radius, col(COLOR.brown));
    D.text(title, rect.x + rect.w / 2, rect.y + (hh - 28) / 2, 28, col(COLOR.white), 1);
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
    D.roundRect(rect.x, rect.y, rect.w, rect.h, 14, col(COLOR.paper, 0.96));
    D.strokeRect(rect.x, rect.y, rect.w, rect.h, 1, col('#e7d3b8'));
    icon('ui-back', rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w * 0.5);
  }

  function primaryButton(rect, label, size) {
    D.roundRect(rect.x, rect.y - 1, rect.w, rect.h + 3, rect.h / 2, col(COLOR.accentEdge, 0.34));
    D.roundRect(rect.x, rect.y, rect.w, rect.h, rect.h / 2, col(COLOR.accent));
    D.roundRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h * 0.44, rect.h / 2,
      col(COLOR.accentTop, 0.92));
    D.strokeRect(rect.x, rect.y, rect.w, rect.h, 1.5, col(COLOR.accentEdge, 0.8));
    D.text(label, rect.x + rect.w / 2, rect.y + (rect.h - (size || 26)) / 2 + 1,
      size || 26, col(COLOR.accentText), 1);
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

  function toggleRow(rect, label, sub, on) {
    D.roundRect(rect.x, rect.y, rect.w, rect.h, 14, col('#dba36b'));
    D.roundRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4, 12,
      col('#fff2df'));
    var pad = 14;
    var sw = switchRects(rect);
    var t = sw.track;
    var textW = t.x - rect.x - pad - 8;
    fittedText(label, rect.x + pad, rect.y + 6, 28, textW, COLOR.brownDeep, 0);
    if (sub) {
      fittedText(sub, rect.x + pad, rect.y + (rect.h < 60 ? 35 : 39), 18,
        textW, COLOR.textDim, 0);
    }
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
    var width = D.textWidth(value, A.FontAtlas[String(size)]);
    D.text(value, x, y, size, col(color), align,
      width > maxW ? maxW / width : 1);
  }

  // 头像：外圈奶油底 + 选中时橙色描边与右下角勾选
  function avatarFrame(rect, index, selected) {
    var r = Math.min(rect.w, rect.h);
    D.roundRect(rect.x, rect.y, rect.w, rect.h, Math.round(r * 0.3), col(COLOR.paperDim));
    if (selected) {
      D.roundRect(rect.x - 2, rect.y - 2, rect.w + 4, rect.h + 4, Math.round(r * 0.3) + 2,
        col('#f8c66a'));
      D.roundRect(rect.x, rect.y, rect.w, rect.h, Math.round(r * 0.3), col('#fff6e2'));
      D.strokeRect(rect.x, rect.y, rect.w, rect.h, 2, col(COLOR.accent));
    } else {
      D.strokeRect(rect.x, rect.y, rect.w, rect.h, 1, col('#e9d8c0'));
    }
    drawAvatar(index, rect.x + rect.w / 2, rect.y + rect.h / 2, r * 0.82);
    if (selected) {
      var cs = Math.max(14, r * 0.24);
      var cx = rect.x + rect.w - cs / 2 - 3;
      var cy = rect.y + rect.h - cs / 2 - 3;
      D.circle(cx, cy, cs / 2, col(COLOR.accent));
      D.ring(cx, cy, cs / 2 - 0.8, 1.2, col('#fff6e2'));
      icon('ui-check', cx, cy, cs * 0.66);
    }
  }

  function drawAvatar(index, cx, cy, size) {
    var atlas = A.AvatarAtlas;
    var tex = A.Assets.entry('avatars');
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
    D.creamPanel(g.sheet, 1, 22);
    D.roundRect(g.sheet.x + 7, g.sheet.y + 7,
      g.sheet.w - 14, g.head - 11, 17, col('#f5d29f'));
    fittedText('设置', g.sheet.x + g.sheet.w / 2,
      g.sheet.y + (g.compact ? 19 : 27), g.compact ? 28 : 48,
      g.sheet.w - 90, COLOR.brownDeep, 1);
    closeButton(g.close);

    toggleRow(g.musicRow, '音乐', '跟随游戏播放背景音乐', P.data.music);
    toggleRow(g.sfxRow, '音效', '技能、点击与胜利提示音', P.data.sfx);

    D.roundRect(g.shareBtn.x, g.shareBtn.y, g.shareBtn.w, g.shareBtn.h,
      g.shareBtn.h / 2, col('#a96e44'));
    D.roundRect(g.shareBtn.x + 2, g.shareBtn.y + 2,
      g.shareBtn.w - 4, g.shareBtn.h - 4, (g.shareBtn.h - 4) / 2,
      col('#fff0d9'));
    icon('ui-share', g.shareBtn.x + 25, g.shareBtn.y + g.shareBtn.h / 2, 20, 0.85);
    fittedText('分享给好友', g.shareBtn.x + g.shareBtn.w / 2,
      g.shareBtn.y + (g.shareBtn.h - 28) / 2, 28,
      g.shareBtn.w - 88, COLOR.brownDeep, 1);
    icon('ui-chevron', g.shareBtn.x + g.shareBtn.w - 22,
      g.shareBtn.y + g.shareBtn.h / 2, 17);

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
  function drawProfile() {
    var u = L.ui;
    var g = u.profile;
    dimBackground();
    paper(g.card, 26, '我的名片', g.head);
    closeButton(g.close);

    // 头像（可点击，等同「选择头像」）
    var av = g.avatar;
    D.roundRect(av.x - 4, av.y - 4, av.w + 8, av.h + 8, 22, col('#f8c66a'));
    D.roundRect(av.x - 1, av.y - 1, av.w + 2, av.h + 2, 18, col('#fff6e2'));
    drawAvatar(P.data.avatarIndex, av.x + av.w / 2, av.y + av.h / 2, av.w * 0.82);

    D.text(P.data.nickname, g.card.x + g.card.w / 2, g.nameY, 28, col(COLOR.brownDeep), 1);
    D.text(ID_PREFIX + P.data.id + ' · 中国', g.card.x + g.card.w / 2,
      g.idY, 18, col(COLOR.textDim), 1);

    ghostRow(g.avatarBtn, '选择头像', { chevron: true, size: 28 });
    ghostRow(g.nickBtn, '修改昵称', { chevron: true, size: 28 });
  }

  // ── 选择头像 ────────────────────────────────────────────────
  function drawAvatarPick() {
    var u = L.ui;
    var g = u.avatarPick;
    dimBackground();
    paper(g.sheet, 26, '选择头像', g.head);
    closeButton(g.close);
    D.text('选一位伙伴，陪你守护小家', g.sheet.x + g.sheet.w / 2, g.subY, 18,
      col(COLOR.textDim), 1);

    for (var i = 0; i < P.AVATARS.length; i++) {
      var rect = g.rect(i);
      avatarFrame(rect, i, i === UI.draftAvatar);
    }

    var item = P.AVATARS[UI.draftAvatar] || P.AVATARS[0];
    D.text('当前：' + item.name, g.sheet.x + g.sheet.w / 2, g.currentY, 18,
      col(COLOR.textDim), 1);
    primaryButton(g.save, '保存头像', 28);
  }

  // ── 修改昵称 ────────────────────────────────────────────────
  function nickCount(str) {
    var n = 0;
    for (var i = 0; i < str.length; i++) n++;
    return n;
  }

  function drawNickname() {
    var u = L.ui;
    var g = u.nickname;
    dimBackground();
    paper(g.sheet, 26, '修改昵称', g.head);
    closeButton(g.close);

    D.text('给自己取个响亮的名字吧', g.sheet.x + 24, g.labelY, 18, col(COLOR.brownDeep), 0);

    var f = g.field;
    D.roundRect(f.x, f.y, f.w, f.h, 12, col('#fffdf7'));
    D.strokeRect(f.x, f.y, f.w, f.h, 2, col('#e2c9a4'));
    var text = UI.draftNickname || '';
    var maxTextW = f.w - 70;
    var tw = D.textWidth(text, A.FontAtlas['28']);
    var shown = text;
    // 超宽时截掉开头，保留用户正在输入的尾部
    while (shown.length > 1 && tw > maxTextW) {
      shown = shown.slice(1);
      tw = D.textWidth(shown, A.FontAtlas['28']);
    }
    if (!shown) {
      D.text('输入昵称', f.x + 14, f.y + (f.h - 28) / 2, 28, col('#c8b6a0'), 0);
    } else {
      D.text(shown, f.x + 14, f.y + (f.h - 28) / 2, 28, col(COLOR.text), 0);
    }
    var count = nickCount(text);
    D.text(count + '/' + P.NICK_MAX, f.x + f.w - 12, f.y + f.h - 26, 18,
      col(count > P.NICK_MAX ? '#d2603a' : COLOR.textDim), 2);

    var hint = '2 到 8 个字符，支持中文、字母和数字';
    D.text(hint, f.x + 2, g.hintY + 6, 18, col(COLOR.textDim), 0);

    primaryButton(g.save, '保存昵称', 28);
  }

  // ── 邀请好友 ────────────────────────────────────────────────
  function drawInvite() {
    var u = L.ui;
    var g = u.invite;
    dimBackground();
    paper(g.sheet, 26, '一起守护小家', g.head);
    closeButton(g.close);

    var b = g.body;
    D.roundRect(b.x, b.y, b.w, b.h, 20, col('#fbe7bd'));
    var av = Math.round(Math.min(b.h * 0.5, b.w * 0.26));
    var cy = b.y + b.h / 2;
    drawAvatar(0, b.x + b.w / 2 - av * 0.52, cy, av);
    drawAvatar(4, b.x + b.w / 2 + av * 0.52, cy, av);

    D.text('萌宠集结，一起出击！', g.sheet.x + g.sheet.w / 2, g.titleY, 28,
      col(COLOR.brownDeep), 1);
    D.text('来和我挑战客厅防线', g.sheet.x + g.sheet.w / 2, g.subY + 6, 18,
      col('#9d7c58'), 1);

    primaryButton(g.copy, '复制邀请口令', 28);
    icon('ui-link', g.copy.x + 26, g.copy.y + g.copy.h / 2, 22);

    D.text('把这份冒险分享给好朋友', g.sheet.x + g.sheet.w / 2, g.noteY, 18,
      col('#b39c82'), 1);
    D.text('也可通过系统分享面板发送', g.sheet.x + g.sheet.w / 2, g.noteY + 22, 18,
      col('#c0ad95'), 1);
  }

  // ── 英雄收藏：各星级沿用同一静态立绘 ──
  function heroForm(def, level, cx, cy, size) {
    if (A.HeroForms && A.HeroForms.draw) A.HeroForms.draw(def.id, 2, cx, cy, size);
    else icon(def.icon, cx, cy, size);
  }
  function heroUnlocked(id) {
    return S.isHeroUnlocked ? S.isHeroUnlocked(id) :
      (P.data.completedLevel + 1 >= ({ war: 1, arch: 1, tank: 2, mage: 2, healer: 3 }[id] || 1));
  }
  function drawCollection(detail) {
    var u = L.ui, g = u.collection;
    D.vGradient(0, 0, u.w, u.h, col(COLOR.pageTop), col(COLOR.pageBottom), 18);
    backButton(g.back);
    if (detail) {
      var def = S.heroById(UI.collectionHero);
      if (!def || !heroUnlocked(def.id)) { back(); return; }
      D.text(def.name, u.safeLeft + (u.safeRight - u.safeLeft) / 2, g.detailNameY, 28, col(COLOR.brownDeep), 1);
      for (var lv = 1; lv <= 3; lv++) {
        var r = g.forms(lv - 1);
        var starDef = S.heroAtStar(def.id, lv);
        var edge = lv === 3 ? '#e8b84c' : lv === 2 ? '#88b9dc' : '#e9d8c0';
        D.roundRect(r.x, r.y, r.w, r.h, 16, col(COLOR.paper));
        D.strokeRect(r.x, r.y, r.w, r.h, lv > 1 ? 2 : 1, col(edge));
        var formSize = Math.min(r.w - 8, Math.max(24, r.h - 202));
        heroForm(def, 2, r.x + r.w / 2, r.y + 10 + formSize / 2, formSize);
        var textY = r.y + 18 + formSize;
        var attributes = [
          lv + '星',
          '生命 ' + Math.round(starDef.hp),
          def.cls === 'healer' ? '回血 ' + Math.round(starDef.heal) : '攻击 ' + Math.round(starDef.atk),
          def.cls === 'tank' ? '攻速 --' : (def.cls === 'healer' ? '治疗间隔 ' : '攻击间隔 ') + Math.round(starDef.interval * 1000) + '毫秒',
          (def.cls === 'healer' ? '治疗距离 ' : '攻击距离 ') + Math.round(starDef.range),
          '嘲讽范围 ' + Math.round(starDef.taunt || 0),
          '群攻范围 ' + Math.round(starDef.splash || 0),
          starDef.cost + ' 金币'
        ];
        for (var ai = 0; ai < attributes.length; ai++) {
          fittedText(attributes[ai], r.x + r.w / 2, textY + ai * 22, 18, r.w - 10,
            ai === 0 ? edge : COLOR.text, 1);
        }
      }
      return;
    }
    D.text('英雄收藏', u.safeLeft + (u.safeRight - u.safeLeft) / 2, g.titleY, 28, col(COLOR.brownDeep), 1);
    for (var i = 0; i < C.HEROES.length; i++) {
      var h = C.HEROES[i], cell = g.rect(i), unlocked = heroUnlocked(h.id);
      D.roundRect(cell.x, cell.y, cell.w, cell.h, 16, col(unlocked ? COLOR.paper : '#e2d8ca'));
      if (!unlocked) {
        D.text('?', cell.x + cell.w / 2, cell.y + cell.h * 0.2, 48, col(COLOR.textDim), 1);
        var unlockLevel = h.unlockLevel || ({ war: 1, arch: 1, tank: 2, mage: 2, healer: 3 }[h.id] || 1);
        D.text('第 ' + unlockLevel + ' 关解锁', cell.x + cell.w / 2, cell.y + cell.h - 28, 18, col(COLOR.textDim), 1);
      } else {
        heroForm(h, 1, cell.x + cell.w / 2, cell.y + cell.h * 0.39, Math.min(80, cell.h * 0.62));
        D.text(h.name, cell.x + cell.w / 2, cell.y + cell.h - 28, 18, col(COLOR.brownDeep), 1);
      }
    }
  }

  // ── 栈管理 ──────────────────────────────────────────────────
  function top() {
    return UI.stack.length ? UI.stack[UI.stack.length - 1] : null;
  }

  function open(name) {
    if (['settings', 'stamina', 'profile', 'avatars', 'nickname', 'invite', 'collection', 'heroDetail'].indexOf(name) === -1) return;
    if (UI.stack.indexOf(name) === -1) UI.stack.push(name);
    prepare(name);
  }

  function prepare(name) {
    if (name === 'avatars') UI.draftAvatar = P.data.avatarIndex;
    else if (name === 'nickname') UI.draftNickname = P.data.nickname;
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

  // 键盘输入统一经平台适配层：快手系统键盘，H5 预览静默降级。
  function openKeyboard() {
    if (!window.KwaiDevice || !KwaiDevice.openTextInput) return;
    KwaiDevice.openTextInput({
      defaultValue: UI.draftNickname,
      maxLength: P.NICK_MAX,
      multiple: false,
      confirmHold: false,
      confirmType: 'done',
      onInput: function (value) {
        UI.draftNickname = P.cleanNickname(value);
      },
      onConfirm: function (value) {
        UI.draftNickname = P.cleanNickname(value);
        saveNickname();
      },
    });
  }

  function saveNickname() {
    var res = P.setNickname(UI.draftNickname);
    if (!res.ok) {
      if (res.reason === 'short') toast('昵称至少 2 个字符', 1.4);
      else toast('请输入昵称', 1.2);
      return false;
    }
    UI.draftNickname = res.value;
    toast('昵称已保存', 1.1);
    back();
    return true;
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
        for (var hi = 0; hi < C.HEROES.length; hi++) {
          if (pointIn(u.collection.rect(hi), x, y, 0) && heroUnlocked(C.HEROES[hi].id)) {
            UI.collectionHero = C.HEROES[hi].id; play('click'); open('heroDetail'); return true;
          }
        }
      }
      return true;
    }
    // 为关闭、返回、分享、保存等此前无声音的按钮补齐统一点击反馈。
    var controls = [];
    if (name === 'settings') controls = [u.settings.close, u.settings.musicRow, u.settings.sfxRow, u.settings.shareBtn];
    else if (name === 'profile') controls = [u.profile.close, u.profile.avatar, u.profile.avatarBtn, u.profile.nickBtn];
    else if (name === 'avatars') {
      controls = [u.avatarPick.close, u.avatarPick.save];
      for (var ai = 0; ai < P.AVATARS.length; ai++) controls.push(u.avatarPick.rect(ai));
    } else if (name === 'nickname') controls = [u.nickname.close, u.nickname.field, u.nickname.save];
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

    if (name === 'profile') {
      var p = u.profile;
      if (pointIn(p.close, x, y, 6)) { closeAll(); return true; }
      if (pointIn(p.avatar, x, y, 6) || pointIn(p.avatarBtn, x, y, 4)) {
        open('avatars');
        return true;
      }
      if (pointIn(p.nickBtn, x, y, 4)) { open('nickname'); return true; }
      if (pointIn(p.card, x, y, 0)) return true;
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

    if (name === 'nickname') {
      var n = u.nickname;
      if (pointIn(n.close, x, y, 6)) { back(); return true; }
      if (pointIn(n.field, x, y, 4)) { openKeyboard(); return true; }
      if (pointIn(n.save, x, y, 4)) { saveNickname(); return true; }
      if (pointIn(n.sheet, x, y, 0)) return true;
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
    else if (name === 'profile') drawProfile();
    else if (name === 'avatars') drawAvatarPick();
    else if (name === 'nickname') drawNickname();
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
    shareInvite: shareInvite,
    copyInviteLink: copyInviteLink,
  };
})();
