/* 现状：碰撞求解与避障寻路；保持原战斗规则。 */
(function () {
  var A = window.AIGCUtils;
  var C = A.Config;
  var S = A.State;
  var L = A.Layout;
  var attackReach = A.BattleTargeting.attackReach;

  // ---- 碰撞求解与避障寻路 ----
  function resolveBodyCollisions() {
    var actors = [];
    var i;
    for (i = 0; i < S.units.length; i++) {
      if (!S.units[i].dead) actors.push({ actor: S.units[i], kind: 'unit' });
    }
    for (i = 0; i < S.enemies.length; i++) {
      if (!S.enemies[i].dead) actors.push({ actor: S.enemies[i], kind: 'enemy' });
    }

    // ── 按纵向占地分桶；移动后立即更新，保留原有配对顺序与连锁退让 ──
    var cell = 1, rows = Object.create(null);
    for (i = 0; i < actors.length; i++)
      cell = Math.max(cell, actors[i].actor.def.radius * 2 + C.ACTOR_BODY_GAP + 0.5);
    function updateRow(index) {
      var body = actors[index], row = Math.floor(body.actor.y / cell);
      if (body.row === row) return;
      if (body.row !== undefined) {
        var old = rows[body.row];
        old.splice(old.indexOf(index), 1);
      }
      body.row = row;
      (rows[row] || (rows[row] = [])).push(index);
    }
    function candidates(index, after) {
      var found = [], row = actors[index].row;
      for (var offset = -1; offset <= 1; offset++) {
        var list = rows[row + offset] || [];
        for (var k = 0; k < list.length; k++)
          if (list[k] > after) found.push(list[k]);
      }
      return found.sort(function (a, b) { return a - b; });
    }
    for (i = 0; i < actors.length; i++) updateRow(i);
    // 多轮清开同一帧的连锁挤压；没有重叠时立即退出，密集阵位才会用满上限。
    for (var pass = 0; pass < 24; pass++) {
      var adjusted = false;
      for (i = 0; i < actors.length; i++) {
        var nearby = candidates(i, i);
        for (var next = 0; next < nearby.length; next++) {
          var j = nearby[next], aa = actors[i].actor, bb = actors[j].actor;
          var reach = aa.def.radius + bb.def.radius + C.ACTOR_BODY_GAP + 0.5;
          if (Math.abs(aa.x - bb.x) >= reach || Math.abs(aa.y - bb.y) >= reach) continue;
          if (!separateBodies(actors[i], actors[j])) continue;
          adjusted = true;
          updateRow(i); updateRow(j);
          nearby = candidates(i, j);
          next = -1;
        }
      }
      if (!adjusted) break;
    }
  }

  function separateBodies(a, b) {
    var aa = a.actor;
    var bb = b.actor;
    var minDistance = aa.def.radius + bb.def.radius + C.ACTOR_BODY_GAP;
    // 求解后额外留出半个逻辑像素，避免多组连锁挤压在浮点误差下留下细缝重叠。
    var targetDistance = minDistance + 0.5;
    var dx = bb.x - aa.x;
    var dy = bb.y - aa.y;
    var distance2 = dx * dx + dy * dy;
    if (distance2 >= targetDistance * targetDistance) return false;
    var dist = Math.sqrt(distance2);

    // 完全重合时使用 uid 生成稳定方向，不能用随机数，否则画面会抖动。
    if (dist < 0.001) {
      var angle = ((aa.uid * 37 + bb.uid * 53) % 360) * Math.PI / 180;
      dx = Math.cos(angle);
      dy = Math.sin(angle);
      dist = 1;
    }
    var nx = dx / dist;
    var ny = dy / dist;
    var overlap = targetDistance - dist;
    var moveA = bodyMoveWeight(a, b);
    var moveB = bodyMoveWeight(b, a);
    var total = moveA + moveB;
    if (total <= 0) return false;

    // 只有一方可移动（怪物撞固定宠物、战士撞固定宠物）时，优先为移动方
    // 寻找能完整落在场地内的接触点，避免被边界夹住后仍然重叠。
    if ((moveA === 0) !== (moveB === 0)) {
      var movable = moveA > 0 ? a : b;
      var fixed = moveA > 0 ? b : a;
      // ── 保留接触方向：北侧怪物各自退让，避免反复聚拢到同一点 ──
      var queueNorth = movable.kind === 'enemy' && fixed.kind === 'unit';
      var direction = moveA > 0 ? Math.atan2(-ny, -nx) : Math.atan2(ny, nx);
      if (queueNorth && movable.actor.y >= fixed.actor.y) direction = -Math.PI / 2;
      return placeOutsideBody(movable, fixed, targetDistance, direction, queueNorth);
    }

    aa.x -= nx * overlap * moveA / total;
    aa.y -= ny * overlap * moveA / total;
    bb.x += nx * overlap * moveB / total;
    bb.y += ny * overlap * moveB / total;
    clampBody(a);
    clampBody(b);
    return true;
  }

  function placeOutsideBody(movable, fixed, targetDistance, startAngle, keepFirstFit) {
    var mover = movable.actor;
    var anchor = fixed.actor;
    var oldX = mover.x;
    var oldY = mover.y;
    var best = null;
    // 从原本的退让方向开始，左右逐步寻找；这样正常情况下不会横跳。
    for (var i = 0; i < 16; i++) {
      var step = i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 ? 1 : -1);
      var angle = startAngle + step * Math.PI / 12;
      mover.x = anchor.x + Math.cos(angle) * targetDistance;
      mover.y = anchor.y + Math.sin(angle) * targetDistance;
      clampBody(movable);
      if (Math.sqrt(S.dist2(mover.x, mover.y, anchor.x, anchor.y)) + 0.02 < targetDistance) continue;
      var cost = S.dist2(oldX, oldY, mover.x, mover.y);
      if (keepFirstFit) {
        best = { x: mover.x, y: mover.y, cost: cost };
        break;
      }
      if (!best || cost < best.cost) best = { x: mover.x, y: mover.y, cost: cost };
    }
    if (best) {
      mover.x = best.x;
      mover.y = best.y;
      return true;
    } else {
      mover.x = oldX;
      mover.y = oldY;
      return false;
    }
  }

  function bodyMoveWeight(body, other) {
    // 固定宠物保留部署阵位；战士与怪物接触时由战士退让，不能把攻击变成推怪。
    // 只改变敌人/战士这一对：怪物之间、怪物撞固定盾位仍沿用原来的分离规则。
    if (body.kind === 'unit') return body.actor.def.cls === 'warrior' ? 1 : 0;
    if (other.kind === 'unit' && other.actor.def.cls === 'warrior') return 0;
    return 1;
  }

  function clampBody(body) {
    var u = L.ui;
    var actor = body.actor;
    var r = actor.def.radius;
    actor.x = S.clamp(actor.x, u.field.x + r, u.field.x + u.field.w - r);
    if (body.kind === 'unit') {
      actor.y = S.clamp(actor.y, u.placeTop, u.placeBottom);
    } else if (actor.y > u.baseStopY) {
      actor.y = u.baseStopY;
    }
  }

  function returnRoute(unit, target, reachOverride) {
    var goalX = target ? target.x : unit.homeX;
    var goalY = target ? target.y : unit.homeY;
    var reach = reachOverride !== undefined ? reachOverride :
      target ? Math.max(0, attackReach(unit, target) - C.ATTACK_CHASE_INSET) : 0;
    var distance = Math.sqrt(S.dist2(unit.x, unit.y, goalX, goalY)) || 1;
    var directX = target ? goalX + (unit.x - goalX) / distance * reach : goalX;
    var directY = target ? goalY + (unit.y - goalY) / distance * reach : goalY;
    var ui = L.ui, radius = unit.def.radius, grid = 16;
    var left = ui.field.x + radius, right = ui.field.x + ui.field.w - radius;
    var top = ui.placeTop, bottom = ui.placeBottom;
    var cols = Math.ceil((right - left) / grid) + 1;
    var rows = Math.ceil((bottom - top) / grid) + 1;
    var obstacles = S.units.filter(function (other) { return other !== unit && !other.dead; });
    function clear(ax, ay, bx, by) {
      var dx = bx - ax, dy = by - ay, length2 = dx * dx + dy * dy;
      for (var i = 0; i < obstacles.length; i++) {
        var other = obstacles[i];
        var t = length2 ? S.clamp(((other.x - ax) * dx + (other.y - ay) * dy) / length2, 0, 1) : 0;
        var clearance = radius + other.def.radius + C.ACTOR_BODY_GAP + 1;
        if (S.dist2(ax + t * dx, ay + t * dy, other.x, other.y) < clearance * clearance) {
          // 已贴住队友的起点允许向外脱离，不能因安全余量把自己锁死。
          if (t === 0 && S.dist2(bx, by, other.x, other.y) > S.dist2(ax, ay, other.x, other.y)) continue;
          return false;
        }
      }
      return true;
    }
    if (clear(unit.x, unit.y, directX, directY)) return [{ x: directX, y: directY }];
    var points = [];
    function point(index) {
      if (!points[index]) points[index] = { x: Math.min(right, left + (index % cols) * grid),
        y: Math.min(bottom, top + Math.floor(index / cols) * grid) };
      return points[index];
    }
    var queue = [], parent = {}, end = -1;
    // ── 起点只检查附近网格；保留原行列顺序及距离判定 ──
    var startCol = Math.max(0, Math.floor((unit.x - left) / grid) - 2);
    var endCol = Math.min(cols - 1, Math.ceil((unit.x - left) / grid) + 2);
    var startRow = Math.max(0, Math.floor((unit.y - top) / grid) - 2);
    var endRow = Math.min(rows - 1, Math.ceil((unit.y - top) / grid) + 2);
    for (var row = startRow; row <= endRow; row++) for (var col = startCol; col <= endCol; col++) {
      var index = row * cols + col;
      var p = point(index);
      if (S.dist2(unit.x, unit.y, p.x, p.y) <= grid * grid * 2 && clear(unit.x, unit.y, p.x, p.y)) {
        queue.push(index); parent[index] = -1;
      }
    }
    for (var q = 0; q < queue.length; q++) {
      var current = queue[q], at = point(current);
      if (target ? S.dist2(at.x, at.y, goalX, goalY) <= reach * reach :
          S.dist2(at.x, at.y, goalX, goalY) <= grid * grid * 2 &&
          clear(at.x, at.y, goalX, goalY)) { end = current; break; }
      for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        var nx = current % cols + ox, ny = Math.floor(current / cols) + oy;
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        var next = ny * cols + nx;
        if (parent[next] !== undefined) continue;
        var destination = point(next);
        if (!clear(at.x, at.y, destination.x, destination.y)) continue;
        parent[next] = current; queue.push(next);
      }
    }
    if (end < 0) return [];
    var route = target ? [] : [{ x: goalX, y: goalY }];
    while (end >= 0) { route.unshift(point(end)); end = parent[end]; }
    return route;
  }

  A.BattleSpatial = {
    resolveBodyCollisions: resolveBodyCollisions,
    separateBodies: separateBodies,
    placeOutsideBody: placeOutsideBody,
    bodyMoveWeight: bodyMoveWeight,
    clampBody: clampBody,
    returnRoute: returnRoute,
  };
})();
