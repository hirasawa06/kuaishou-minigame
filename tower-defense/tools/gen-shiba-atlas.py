#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen-shiba-atlas.py — 战斗精灵图集（128 单元格，2048x1024 内装得下）

输入（tools/src/）：
  shiba-front.png   从角色设定图抠出的护盾柴犬正视图（RGBA）
输出：
  package/res/Image/game.png        128 单元格图集（2x 绘制后缩放）
  package/gameplay/data/rigs.js     分件坐标 + 几何特效元数据

图集布局：8 列 × 4 行，单元格 128px（含 4px padding，有效区 120px）。
  row0: unit-tank-1 / unit-tank-1-body / unit-tank-1-shield
  row1: fx-glow / fx-slash / fx-smoke
  row2-3: 原 sprites.png 中的图标（缩小后塞入，保证卡牌/HUD 仍有图）
"""

import json
import math
import os

from PIL import Image, ImageDraw, ImageFilter
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PKG = os.path.join(ROOT, "package")
IMG_DIR = os.path.join(PKG, "res", "Image")
DATA_DIR = os.path.join(PKG, "gameplay", "data")
SRC_DIR = os.path.join(ROOT, "tools", "src")

CELL = 128
PAD = 4
COLS = 8
ROWS = 4
ATLAS_W = COLS * CELL
ATLAS_H = ROWS * CELL

# 原有图标（从 tools/gen-assets.py 生成的 sprites.png 继承），排进 row2/3
LEGACY_ICONS = [
    "unit-tank-2", "unit-war-1", "unit-war-2", "unit-arch-1",
    "unit-arch-2", "unit-mage-1", "unit-mage-2",
    "enemy-grunt", "enemy-runner", "enemy-brute", "enemy-boss",
    "ui-heart", "ui-bolt", "ui-pause", "ui-play",
]


# ─────────────────────────────────────────── 柴犬分件
def split_shiba():
    """把正视图拆成「身体」和「盾牌」两件。

    盾牌是右半区的大块蓝色 + 外圈银色包边，从最大蓝色连通域向外膨胀得到；
    身体上被盾牌遮住的区域用邻域颜色向内扩散填充，避免分件旋转时露出空洞。
    """
    from collections import deque

    src = Image.open(os.path.join(SRC_DIR, "shiba-front.png")).convert("RGBA")
    a = np.asarray(src).astype(np.int16)
    h, w, _ = a.shape
    r, g, b, al = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]

    blue = (al > 40) & (b > 110) & (b - r > 40) & (b - g > 15)
    xs_grid = np.arange(w)[None, :]
    seed = blue & (xs_grid > w * 0.5)

    # 最大蓝色连通域
    seen = np.zeros((h, w), bool)
    best = []
    for y in range(h):
        for x in range(w):
            if not seed[y, x] or seen[y, x]:
                continue
            q = deque([(x, y)])
            seen[y, x] = True
            comp = []
            while q:
                cx, cy = q.popleft()
                comp.append((cx, cy))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < w and 0 <= ny < h and seed[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((nx, ny))
            if len(comp) > len(best):
                best = comp

    mask = np.zeros((h, w), bool)
    for x, y in best:
        mask[y, x] = True

    # 膨胀吃进银色包边（灰度金属色，且与蓝色块邻接）
    metal = (al > 40) & (np.abs(r - g) < 26) & (np.abs(g - b) < 30) & (r > 70)
    for _ in range(18):
        grown = mask.copy()
        grown[1:, :] |= mask[:-1, :]
        grown[:-1, :] |= mask[1:, :]
        grown[:, 1:] |= mask[:, :-1]
        grown[:, :-1] |= mask[:, 1:]
        mask = mask | (grown & metal)

    rgba = np.asarray(src).copy()
    shield_arr = np.zeros_like(rgba)
    shield_arr[mask] = rgba[mask]
    shield_full = Image.fromarray(shield_arr, "RGBA")
    sh_bbox = shield_full.getbbox()
    shield = shield_full.crop(sh_bbox)

    # 身体：把盾牌区域挖掉，再从洞的边界向内做扩散填充。
    # 逐行插值在宽洞上会留横条，这里每次用四邻域均值松弛，迭代到填满。
    body_arr = rgba.astype(np.float32)
    hole = mask.copy()
    body_arr[hole, 3] = 0
    known = ~hole
    for _ in range(400):
        if not hole.any():
            break
        acc = np.zeros_like(body_arr)
        cnt = np.zeros((h, w), np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            shifted = np.roll(np.roll(body_arr, dy, axis=0), dx, axis=1)
            valid = np.roll(np.roll(known, dy, axis=0), dx, axis=1)
            acc += shifted * valid[:, :, None]
            cnt += valid
        ready = hole & (cnt > 0)
        if not ready.any():
            break
        body_arr[ready] = acc[ready] / cnt[ready][:, None]
        body_arr[ready, 3] = 255
        known = known | ready
        hole = hole & ~ready
    # 洞内保持透明，不填色：盾牌原位时完全覆盖，外摆时缺口只有盾牌大小；
    # 填腹部色会在盾牌外扩处溢出一块奶油色斑（盾牌轮廓比身体宽）。
    body = Image.fromarray(body_arr.astype(np.uint8), "RGBA")
    # 去掉原图烘焙的奶油色地板投影：底部 10 行里接近背景色的像素置透明
    ba = np.asarray(body).copy()
    tail_y = max(0, h - 10)
    tail = ba[tail_y:]
    near_bg = (tail[:, :, 0] > 232) & (tail[:, :, 1] > 205) & (tail[:, :, 2] > 190)
    near_bg &= (tail[:, :, 2] > tail[:, :, 0] - 26)
    tail[near_bg] = (0, 0, 0, 0)
    body = Image.fromarray(ba, "RGBA")
    body_bbox = body.getbbox()
    body = body.crop(body_bbox)

    return body, shield, (sh_bbox, body_bbox, src.size)


def fit_cell(img, size, anchor_bottom=True):
    """等比缩放到 size 内，返回 (图像, 左上偏移)"""
    r = min(size / img.width, size / img.height)
    nw, nh = max(1, int(round(img.width * r))), max(1, int(round(img.height * r)))
    im = img.resize((nw, nh), Image.LANCZOS)
    ox = (size - nw) // 2
    oy = size - nh if anchor_bottom else (size - nh) // 2
    return im, ox, oy


def make_glow(size=96):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = size / 2
    for i in range(size // 2, 0, -1):
        t = i / (size / 2)
        alpha = int(255 * (1 - t) ** 2.2)
        d.ellipse((c - i, c - i, c + i, c + i), fill=(255, 255, 255, alpha))
    return img


def make_slash(w=120, h=72):
    """月牙刀光：一条由粗到细、由亮到透明的弧形条带。

    直接画弧线会在两端和内侧糊成一坨，这里沿弧采样点手绘四边形，
    宽度按参数收敛，得到真正的“刀锋”形状。
    """
    img = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(img)
    cx, cy = w * 0.5, h * 1.12
    R = h * 0.86
    a0, a1 = math.radians(214), math.radians(326)
    steps = 30
    outer, inner = [], []
    for i in range(steps + 1):
        t = i / steps
        a = a0 + (a1 - a0) * t
        # 两端收尖、中段最宽
        thick = (math.sin(math.pi * t) ** 1.1) * (h * 0.13) + 0.5
        ca, sa = math.cos(a), math.sin(a)
        outer.append((cx + ca * (R + thick * 0.5), cy + sa * (R + thick * 0.5)))
        inner.append((cx + ca * (R - thick * 0.5), cy + sa * (R - thick * 0.5)))
    d.polygon(outer + inner[::-1], fill=225)
    img = img.filter(ImageFilter.GaussianBlur(0.8))
    out = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    out.putalpha(img)
    return out


def make_smoke(size=96):
    """柔边不规则团块：死亡烟尘 / 落地尘土"""
    img = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(img)
    cx = cy = size / 2
    for k in range(9):
        ang = k / 9 * math.tau
        rr = size * 0.17 + (k % 3) * 3
        ox = math.cos(ang) * size * 0.13
        oy = math.sin(ang) * size * 0.13
        d.ellipse((cx + ox - rr, cy + oy - rr, cx + ox + rr, cy + oy + rr), fill=150)
    d.ellipse((cx - size * 0.24, cy - size * 0.24, cx + size * 0.24, cy + size * 0.24), fill=200)
    img = img.filter(ImageFilter.GaussianBlur(size * 0.08))
    out = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    out.putalpha(img)
    return out


def build():
    body, shield, meta = split_shiba()
    sh_bbox, body_bbox, src_size = meta

    # 统一缩放到同一比例，保证分件拼回去能对齐
    full = Image.open(os.path.join(SRC_DIR, "shiba-front.png")).convert("RGBA")
    scale = 120 / max(full.width, full.height)

    def place(img, bbox):
        nw = max(1, int(round(img.width * scale)))
        nh = max(1, int(round(img.height * scale)))
        return img.resize((nw, nh), Image.LANCZOS), bbox

    body_s, _ = place(body, body_bbox)
    shield_s, _ = place(shield, sh_bbox)
    full_s, _ = place(full, None)

    # 分件在单元格内的落点：以整张正视图为共同参照，
    # 各自按原 bbox 偏移摆放，拼回去才能严丝合缝（各自居中会整体错位）
    base_x = (CELL - 2 * PAD - full_s.width) // 2 + PAD
    base_y = (CELL - 2 * PAD - full_s.height) // 2 + PAD
    body_ox = base_x + body_bbox[0] * scale
    body_oy = base_y + body_bbox[1] * scale
    shield_ox = base_x + sh_bbox[0] * scale
    shield_oy = base_y + sh_bbox[1] * scale

    atlas = Image.new("RGBA", (ATLAS_W, ATLAS_H), (0, 0, 0, 0))
    table = {}
    rigs = {}

    def cell(name, img, col, row, ox=None, oy=None):
        """落格。ox/oy 是相对整个正视图的绝对坐标（含 PAD 与居中偏移），
        这里换算成图集内的绝对位置；不给时格内居中。"""
        dx = (CELL - 2 * PAD - img.width) // 2 + PAD
        dy = (CELL - 2 * PAD - img.height) // 2 + PAD
        if ox is not None:
            dx = int(round(ox))
            dy = int(round(oy))
        atlas.alpha_composite(img, (col * CELL + dx, row * CELL + dy))
        table[name] = [col * CELL + PAD, row * CELL + PAD, CELL - 2 * PAD, CELL - 2 * PAD]

    # 整只（卡牌 / 拖拽残影 / 兼容）
    cell("unit-tank-1", full_s, 0, 0)
    cell("unit-tank-1-body", body_s, 1, 0, body_ox, body_oy)
    cell("unit-tank-1-shield", shield_s, 2, 0, shield_ox, shield_oy)
    cell("fx-glow", make_glow(), 3, 0)
    cell("fx-slash", make_slash(), 4, 0)
    cell("fx-smoke", make_smoke(), 5, 0)
    cell("fx-ring", make_glow(), 6, 0)

    # 继承旧图标
    legacy_src = os.path.join(SRC_DIR, "sprites-legacy.png")
    legacy_meta = {}
    meta_path = os.path.join(DATA_DIR, "sprites.js")
    if os.path.exists(legacy_src) and os.path.exists(meta_path):
        txt = open(meta_path, encoding="utf-8").read()
        key = "A.SpriteAtlas = "
        if key in txt:
            legacy_meta = json.loads(txt.split(key, 1)[1].split(";\n", 1)[0])
    old = Image.open(legacy_src).convert("RGBA") if os.path.exists(legacy_src) else None
    if old is not None and legacy_meta.get("icons"):
        for i, name in enumerate(LEGACY_ICONS):
            box = legacy_meta["icons"].get(name)
            if not box:
                continue
            im = old.crop((box[0], box[1], box[0] + box[2], box[1] + box[3]))
            im = im.resize((CELL - 2 * PAD, CELL - 2 * PAD), Image.LANCZOS)
            col = i % COLS
            row = 2 + i // COLS
            cell(name, im, col, row)

    atlas.save(os.path.join(IMG_DIR, "game.png"))

    anchor_json = {}
    for name, ox, oy, w_, h_ in (
        ("unit-tank-1-body", body_ox, body_oy, body_s.width, body_s.height),
        ("unit-tank-1-shield", shield_ox, shield_oy, shield_s.width, shield_s.height),
    ):
        anchor_json[name] = [round(ox, 1), round(oy, 1)]

    data = {
        "src": "res/Image/game.png",
        "texW": ATLAS_W,
        "texH": ATLAS_H,
        "cell": CELL,
        "pad": PAD,
        "icons": table,
        "anchors": anchor_json,
        "cellFull": [CELL - 2 * PAD, CELL - 2 * PAD],
    }
    return data


def write_rigs(atlas_data):
    src = os.path.join(DATA_DIR, "rigs.js")
    with open(src, "w", encoding="utf-8") as f:
        f.write("/* 由 tools/gen-shiba-atlas.py 生成，请勿手改 */\n")
        f.write("(function () {\n  var A = window.AIGCUtils = window.AIGCUtils || {};\n")
        f.write("  A.GameAtlas = " + json.dumps(atlas_data, ensure_ascii=False,
                                            separators=(",", ":")) + ";\n")
        f.write("})();\n")
    return src


if __name__ == "__main__":
    os.makedirs(IMG_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)
    data = build()
    p = write_rigs(data)
    print(json.dumps({"atlas": data["src"], "cells": len(data["icons"]),
                      "rigs": os.path.relpath(p, ROOT)}, ensure_ascii=False))
