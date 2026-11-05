/* gameplay/ui.js — 设置 / 我的名片 / 选择头像 / 修改昵称 / 地区排行榜 / 邀请好友
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
    stack: [],          // 'settings' / 'profile' / 'avatars' / 'nickname' / 'rank' / 'regions' / 'invite'
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
    var w = Math.round(Math.min(62, rect.h * 1.24));
    var h = Math.round(Math.min(34, rect.h * 0.66));
    return {
      track: { x: rect.x + rect.w - w - 12, y: rect.y + (rect.h - h) / 2, w: w, h: h },
      w: w, h: h,
    };
  }

  function toggleRow(rect, label, sub, on) {
    D.roundRect(rect.x, rect.y, rect.w, rect.h, 14, col(COLOR.row));
    D.strokeRect(rect.x, rect.y, rect.w, rect.h, 1, col(COLOR.rowEdge));
    var pad = 14;
    D.text(label, rect.x + pad, rect.y + Math.max(6, rect.h * 0.2), 28, col(COLOR.brownDeep), 0);
    if (sub) {
      D.text(sub, rect.x + pad, rect.y + Math.max(30, rect.h * 0.56), 18,
        col(COLOR.textDim), 0);
    }
    var sw = switchRects(rect);
    var t = sw.track;
    D.roundRect(t.x, t.y, t.w, t.h, t.h / 2, col(on ? COLOR.green : COLOR.off));
    D.strokeRect(t.x, t.y, t.w, t.h, 1, col(on ? COLOR.greenEdge : '#dccdb6'));
    var knobD = t.h - 6;
    var kx = on ? t.x + t.w - knobD - 3 : t.x + 3;
    D.circle(kx + knobD / 2, t.y + t.h / 2, knobD / 2, col(COLOR.greenKnob));
    D.circle(kx + knobD / 2, t.y + t.h / 2 - 1, knobD / 2 - 2.5, col('#ffffff', on ? 0.5 : 0.7));
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
    paper(g.sheet, 26, '设置', g.head);
    closeButton(g.close);

    toggleRow(g.musicRow, '音乐', '跟随游戏播放背景音乐', P.data.music);
    toggleRow(g.sfxRow, '音效', '技能、点击与胜利提示音', P.data.sfx);

    ghostRow(g.shareBtn, '分享给好友', { chevron: true, size: 28 });
    icon('ui-share', g.shareBtn.x + 26, g.shareBtn.y + g.shareBtn.h / 2, 22, 0.85);

    D.text('版本号 ' + VERSION, g.sheet.x + g.sheet.w / 2, g.versionY, 18,
      col(COLOR.textDim), 1);
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
    D.text(ID_PREFIX + P.data.id + ' · ' + P.regionDef().name, g.card.x + g.card.w / 2,
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

  // ── 地区排行榜 ──────────────────────────────────────────────
  function drawRank() {
    var u = L.ui;
    var g = u.rank;
    var rk = S.ranking || P.buildRanking();

    // 全屏奶油渐变，不使用首页背景，让数字更清楚
    D.vGradient(0, 0, u.w, u.h, col(COLOR.pageTop), col(COLOR.pageBottom), 18);
    backButton(g.back);
    D.text('地区排行榜', g.titleX, g.titleY + 4, 28, col(COLOR.brownDeep), 0);
    D.text('看看伙伴们的闯关进度', g.titleX, g.subY, 18, col(COLOR.textDim), 0);

    // 地区切换 pill + 虚拟榜单标记
    D.roundRect(g.bar.x, g.bar.y, g.bar.w, g.bar.h, g.bar.h / 2, col(COLOR.paper));
    D.strokeRect(g.bar.x, g.bar.y, g.bar.w, g.bar.h, 1.2, col(COLOR.rowEdge));
    D.text(rk.region.name + ' · ' + rk.town, g.bar.x + 16, g.bar.y + (g.bar.h - 28) / 2,
      28, col(COLOR.brownDeep), 0);
    icon('ui-chevron', g.bar.x + g.bar.w - 20, g.bar.y + g.bar.h / 2, g.bar.h * 0.4);
    D.roundRect(g.badge.x, g.badge.y, g.badge.w, g.badge.h, g.badge.h / 2,
      col('#efe0c8', 0.9));
    D.text('虚拟榜单', g.badge.x + g.badge.w / 2, g.badge.y + (g.badge.h - 18) / 2,
      18, col(COLOR.textDim), 1);

    drawPodium(g, rk);
    drawRankRows(g, rk);

    D.text('虚拟地区与示例玩家，不代表真实排名', g.x + g.w / 2, g.footY, 18,
      col('#b3a08a'), 1);
  }

  function drawPodium(g, rk) {
    var top = rk.list.slice(0, 3);
    var cy = g.podiumY;
    var ch = g.podiumH;
    D.roundRect(g.x, cy, g.w, ch, 18, col(COLOR.paper, 0.92));
    D.strokeRect(g.x, cy, g.w, ch, 1, col('#f1e1cb'));
    if (!top.length) return;

    // 顺序：2 / 1 / 3，中间的第一名略高
    var order = [1, 0, 2];
    var slotW = g.w / 3;
    var labelH = 22;
    for (var k = 0; k < order.length; k++) {
      var idx = order[k];
      var item = top[idx];
      if (!item) continue;
      var first = idx === 0;
      var cx = g.x + slotW * (k + 0.5);
      var avSize = first ? ch * 0.34 : ch * 0.28;
      var avCy = cy + (first ? 18 : 26) + avSize / 2;
      if (first) {
        D.roundRect(cx - slotW * 0.36, cy + 8, slotW * 0.72, ch - 16, 14, col('#fdf0d8'));
      }
      D.circle(cx, avCy, avSize * 0.54, col(first ? '#f6d79a' : '#f2e5d2'));
      drawAvatar(item.avatar, cx, avCy, avSize);
      // 名次徽章挂在头像左上角
      var bs = first ? 24 : 20;
      var bx = cx - avSize * 0.5;
      var by = avCy - avSize * 0.42;
      D.circle(bx, by, bs / 2, col(first ? '#e9b34c' : '#c9b49b'));
      D.text(String(item.rank), bx, by - bs * 0.32, 18, col('#ffffff'), 1);

      var nameY = cy + ch - labelH * 2 - 12;
      D.text(item.name, cx, nameY, 18, col(COLOR.brownDeep), 1);
      D.text(String(item.wave) + ' 关', cx, nameY + labelH, 18, col(COLOR.textDim), 1);
    }
  }

  function drawRankRows(g, rk) {
    var start = 3;
    var rows = Math.min(g.visibleRows, rk.list.length - start);
    for (var i = 0; i < rows; i++) {
      var item = rk.list[start + i];
      var rect = g.rowRect(i);
      D.roundRect(rect.x, rect.y, rect.w, rect.h, rect.h / 2, col(COLOR.paper));
      D.strokeRect(rect.x, rect.y, rect.w, rect.h, 1, col('#f2e5d3'));
      var num = String(item.rank);
      D.text(num.length < 2 ? '0' + num : num, rect.x + 18,
        rect.y + (rect.h - 28) / 2, 28, col('#b79a7a'), 0);
      drawAvatar(item.avatar, rect.x + 62, rect.y + rect.h / 2, rect.h * 0.62);
      D.text(item.name, rect.x + 88, rect.y + (rect.h - 28) / 2, 28,
        col(COLOR.brownDeep), 0);
      D.text(String(item.wave) + ' 关', rect.x + rect.w - 18,
        rect.y + (rect.h - 28) / 2, 28, col(COLOR.text), 2);
    }

    // 我的名次：固定贴底，未通关显示「尚未上榜」
    var m = g.mine;
    var onBoard = rk.onBoard;
    D.roundRect(m.x, m.y, m.w, m.h, m.h / 2,
      col(onBoard ? '#fbe7bd' : '#f5ead9'));
    D.strokeRect(m.x, m.y, m.w, m.h, 1.4,
      col(onBoard ? '#f0be62' : '#e6d3bb'));

    // 单行排布：名次 → 头像 → 昵称 → 状态；副标题与状态分两侧收尾，
    // 不叠加两层文字，窄屏也不会挤出卡片。
    var cy = m.y + m.h / 2;
    var rankLabel = onBoard ? String(rk.myRank) : '--';
    D.text(rankLabel, m.x + 16, cy - 14, 28, col(onBoard ? '#b97512' : '#b3a08a'), 0);

    var avCx = m.x + 66;
    drawAvatar(P.data.avatarIndex, avCx, cy, m.h * 0.54);

    var nameX = avCx + 26;
    D.text(P.data.nickname, nameX, cy - 14, 28, col(COLOR.brownDeep), 0);
    D.text('我的排名', nameX, cy + 16, 18, col(COLOR.textDim), 0);

    if (!onBoard) {
      D.text('尚未上榜', m.x + m.w - 16, cy - 20, 28, col('#b3a08a'), 2);
    } else {
      D.text('第 ' + rk.mineWave + ' 关', m.x + m.w - 16, cy - 20, 28,
        col(COLOR.brownDeep), 2);
    }
  }

  // ── 选择地区 ────────────────────────────────────────────────
  function drawRegionPick() {
    var u = L.ui;
    var g = u.regionPick;
    dimBackground();
    paper(g.sheet, 26, '选择地区', g.head);
    closeButton(g.close);
    D.text('选择一个想加入的虚拟小镇', g.sheet.x + g.sheet.w / 2, g.subY, 18,
      col(COLOR.textDim), 1);

    var region = P.regionDef();
    var towns = region.towns || [];
    for (var i = 0; i < g.rows.length; i++) {
      var rect = g.rows[i];
      var current = P.data.town === i;
      D.roundRect(rect.x, rect.y, rect.w, rect.h, 12, col(COLOR.row));
      D.strokeRect(rect.x, rect.y, rect.w, rect.h, current ? 1.6 : 1,
        col(current ? '#f0be62' : COLOR.rowEdge));
      D.text(towns[i] || '', rect.x + 16, rect.y + (rect.h - 28) / 2, 28,
        col(COLOR.brownDeep), 0);
      if (current) {
        D.text('当前地区', rect.x + rect.w - 30, rect.y + (rect.h - 18) / 2, 18,
          col(COLOR.textDim), 2);
        icon('ui-check', rect.x + rect.w - 16, rect.y + rect.h / 2, 14);
      } else {
        icon('ui-chevron', rect.x + rect.w - 18, rect.y + rect.h / 2, rect.h * 0.36);
      }
    }

    D.text(P.regionDef().name + ' · 不获取定位，不对应真实地理位置',
      g.sheet.x + g.sheet.w / 2, g.noteY, 18, col('#b8a691'), 1);
    D.text('切换后立即查看该地区榜单', g.sheet.x + g.sheet.w / 2, g.noteY + 24, 18,
      col('#b8a691'), 1);
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

    primaryButton(g.copy, '复制邀请链接', 28);
    icon('ui-link', g.copy.x + 26, g.copy.y + g.copy.h / 2, 22);

    D.text('把这份冒险分享给好朋友', g.sheet.x + g.sheet.w / 2, g.noteY, 18,
      col('#b39c82'), 1);
    D.text('也可通过系统分享面板发送', g.sheet.x + g.sheet.w / 2, g.noteY + 22, 18,
      col('#c0ad95'), 1);
  }

  // ── 栈管理 ──────────────────────────────────────────────────
  function top() {
    return UI.stack.length ? UI.stack[UI.stack.length - 1] : null;
  }

  function open(name) {
    if (!name) return;
    if (name === 'rank') UI.stack = ['rank'];
    else if (UI.stack.indexOf(name) === -1) UI.stack.push(name);
    prepare(name);
  }

  function prepare(name) {
    if (name === 'avatars') UI.draftAvatar = P.data.avatarIndex;
    else if (name === 'nickname') UI.draftNickname = P.data.nickname;
    else if (name === 'rank') S.ranking = P.buildRanking();
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
    return 'https://kuaishou.com/minigame/td?from=invite&id=' + P.data.id;
  }

  function documentReady() {
    return typeof document !== 'undefined' && document && document.body;
  }

  function copyTextFallback(text, done, fail) {
    if (!documentReady()) { fail(); return; }
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) done(); else fail();
    } catch (e) {
      fail();
    }
  }

  function copyInviteLink() {
    var link = linkOf();
    var done = function () {
      toast('邀请链接已复制', 1.2);
      play('start');
    };
    var fail = function () {
      // 剪贴板不可用时降级为系统分享，仍给用户可用的出口
      shareInvite(true);
    };
    if (typeof ks !== 'undefined' && ks.setClipboardData) {
      ks.setClipboardData({
        data: link,
        success: done,
        fail: fail,
      });
      return;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard &&
          navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(done, fail);
        return;
      }
    } catch (e) {
      // 非安全上下文时 clipboard 不可用，继续走 execCommand 降级
    }
    copyTextFallback(link, done, fail);
  }

  function shareInvite(fallbackToCopy) {
    if (typeof KwaiRepost !== 'undefined') {
      KwaiRepost.shareAppMessage({
        query: { from: 'invite', id: P.data.id },
        onSuccess: function () { toast('分享成功', 1.2); },
        onCancel: function () { toast('已取消分享', 1.0); },
        onFail: function () {
          if (fallbackToCopy) { copyFallback(); }
          else toast('分享失败，可试试复制链接', 1.6);
        },
      });
      return;
    }
    if (fallbackToCopy) { copyFallback(); return; }
    toast('当前环境不支持分享', 1.2);
  }

  function copyFallback() {
    copyTextFallback(linkOf(), function () {
      toast('邀请链接已复制', 1.4);
    }, function () {
      toast('复制失败，请再试一次', 1.4);
    });
  }

  function play(name) {
    if (A.GameAudio) A.GameAudio.play(name);
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

  // 键盘输入：快手走系统键盘，浏览器用隐藏 input
  var keyHandler = null;
  function openKeyboard() {
    if (typeof ks !== 'undefined' && KwaiDevice && KwaiDevice.showKeyboard) {
      KwaiDevice.showKeyboard({
        defaultValue: UI.draftNickname,
        maxLength: P.NICK_MAX,
        multiple: false,
        confirmHold: false,
        confirmType: 'done',
      });
      if (!keyHandler) {
        keyHandler = function (res) {
          UI.draftNickname = P.cleanNickname(res && res.value);
        };
        KwaiDevice.onKeyboardInput(keyHandler);
        KwaiDevice.onKeyboardConfirm(function (res) {
          if (res && res.value !== undefined) UI.draftNickname = P.cleanNickname(res.value);
          saveNickname();
        });
      }
      return;
    }
    // H5：创建一个不可见的输入框承接系统键盘
    if (!documentReady()) return;
    var input = document.getElementById('td-nick-input');
    if (!input) {
      input = document.createElement('input');
      input.id = 'td-nick-input';
      input.type = 'text';
      input.maxLength = P.NICK_MAX;
      input.autocomplete = 'off';
      input.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;';
      input.addEventListener('input', function () {
        UI.draftNickname = P.cleanNickname(input.value);
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { input.blur(); saveNickname(); }
      });
      document.body.appendChild(input);
    }
    input.value = UI.draftNickname;
    input.focus();
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
    play('place');
    back();
    return true;
  }

  // 每帧交互入口：命中则消费并返回 true
  function handleTap(x, y) {
    var name = top();
    if (!name) return false;
    var u = L.ui;

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
          play('place');
          return true;
        }
      }
      if (pointIn(a.save, x, y, 4)) {
        P.setAvatar(UI.draftAvatar);
        toast('头像已保存', 1.1);
        play('place');
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
      if (pointIn(n.field, x, y, 4)) { play('hit'); openKeyboard(); return true; }
      if (pointIn(n.save, x, y, 4)) { saveNickname(); return true; }
      if (pointIn(n.sheet, x, y, 0)) return true;
      back();
      return true;
    }

    if (name === 'rank') {
      var r = u.rank;
      if (pointIn(r.back, x, y, 6)) { closeAll(); return true; }
      if (pointIn(r.bar, x, y, 4)) { open('regions'); return true; }
      if (pointIn(r.mine, x, y, 2)) { open('regions'); return true; }
      return true;
    }

    if (name === 'regions') {
      var rg = u.regionPick;
      if (pointIn(rg.close, x, y, 6)) { back(); return true; }
      var towns = (P.regionDef().towns || []);
      for (var k = 0; k < towns.length; k++) {
        if (pointIn(rg.rows[k], x, y, 3)) {
          if (P.data.town === k) { back(); return true; }
          P.setTown(k);
          S.ranking = P.buildRanking();
          toast('已切换到 ' + towns[k], 1.2);
          play('start');
          back();
          return true;
        }
      }
      if (pointIn(rg.sheet, x, y, 0)) return true;
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
    else if (name === 'profile') drawProfile();
    else if (name === 'avatars') drawAvatarPick();
    else if (name === 'nickname') drawNickname();
    else if (name === 'rank') drawRank();
    else if (name === 'regions') drawRegionPick();
    else if (name === 'invite') drawInvite();
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
