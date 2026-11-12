#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen-menu-art.py — 首页（进入游戏前）美术
生成 cozy 客厅背景，风格对齐参考图：暖奶油底、木质家具、柔和阳光。

输出：
  package/res/Menu/menu-bg.png     首页全屏背景（不参与命中判定）
"""

import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PKG = os.path.join(ROOT, "package")
OUT_DIR = os.path.join(PKG, "res", "Menu")
SRC_DIR = os.path.join(ROOT, "tools", "src")

W, H = 828, 1792          # 2x 设计稿，414x896 逻辑
CARD_W, CARD_H = 680, 760


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(len(a)))


def vgrad(size, top, bottom):
    w, h = size
    img = Image.new("RGB", size, top)
    d = ImageDraw.Draw(img)
    for y in range(h):
        d.line([(0, y), (w, y)], fill=lerp(top, bottom, y / max(1, h - 1)))
    return img


def soft_shadow(img, box, radius, alpha=70, blur=18):
    """在目标图上叠加一块柔和投影"""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse(box, fill=(90, 60, 40, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    img.alpha_composite(layer)


def rounded(d, box, r, fill, outline=None, width=2):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


# ─────────────────────────────────────────────── 背景
def build_bg(path):
    random.seed(7)
    img = vgrad((W, H), (255, 246, 233), (243, 222, 198)).convert("RGBA")
    d = ImageDraw.Draw(img)

    # 后墙与护墙板
    d.rectangle((0, 0, W, int(H * 0.62)), fill=(250, 236, 220, 255))
    d.rectangle((0, int(H * 0.62), W, H), fill=(228, 197, 166, 255))
    d.rectangle((0, int(H * 0.62) - 10, W, int(H * 0.62) + 6), fill=(214, 180, 148, 255))

    # 木地板
    floor_top = int(H * 0.62)
    for i in range(18):
        y = floor_top + (H - floor_top) * i / 18
        d.line([(0, y), (W, y)], fill=(206, 172, 140, 255), width=3)
    # 地板局部亮光
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((int(W * 0.18), floor_top, int(W * 0.92), H), fill=(255, 246, 220, 70))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(80)))

    # 窗外：天蓝 + 云 + 日光
    wx0, wy0, wx1, wy1 = int(W * 0.34), int(H * 0.16), int(W * 0.98), int(H * 0.52)
    d.rectangle((wx0 - 14, wy0 - 14, wx1 + 14, wy1 + 14), fill=(242, 224, 200, 255))
    d.rectangle((wx0, wy0, wx1, wy1), fill=(176, 216, 240, 255))
    sky = vgrad((wx1 - wx0, wy1 - wy0), (196, 228, 246), (222, 240, 248)).convert("RGBA")
    img.paste(sky, (wx0, wy0))
    d = ImageDraw.Draw(img)
    for cx, cy, r in ((0.62, 0.28, 54), (0.72, 0.34, 42), (0.55, 0.36, 34)):
        px = wx0 + (wx1 - wx0) * cx
        py = wy0 + (wy1 - wy0) * cy
        d.ellipse((px - r, py - r * 0.7, px + r, py + r * 0.7), fill=(255, 255, 255, 255))
    # 窗框
    fx = wx0 + (wx1 - wx0) * 0.5
    d.rectangle((fx - 6, wy0, fx + 6, wy1), fill=(250, 244, 232, 255))
    d.rectangle((wx0, (wy0 + wy1) / 2 - 6, wx1, (wy0 + wy1) / 2 + 6), fill=(250, 244, 232, 255))

    # 窗边绿植
    stem = (96, 138, 84, 255)
    for i in range(8):
        ang = -0.9 + i * 0.22
        x0 = wx0 - 10
        y0 = wy0 - 10
        x1 = x0 + math.cos(ang) * 150
        y1 = y0 + math.sin(ang) * 120 + 30
        d.line([(x0, y0), (x1, y1)], fill=stem, width=6)
        d.ellipse((x1 - 26, y1 - 16, x1 + 26, y1 + 16), fill=lerp((110, 160, 96, 255), (150, 196, 130, 255), i / 8))

    # 左侧沙发
    sx0, sy0, sx1, sy1 = -40, int(H * 0.33), int(W * 0.34), int(H * 0.55)
    soft_shadow(img, (sx0, sy1 - 40, sx1, sy1 + 40), 60, 90, 24)
    d.rounded_rectangle((sx0, sy0, sx1, sy1), radius=48, fill=(232, 140, 128, 255))
    d.rounded_rectangle((sx0 + 24, sy0 + 18, sx1 - 24, sy0 + 120), radius=40, fill=(242, 160, 146, 255))
    d.rounded_rectangle((sx0 + 16, sy0 + 120, sx1 - 16, sy1 - 20), radius=36, fill=(236, 148, 134, 255))
    # 抱枕
    d.rounded_rectangle((sx0 + 52, sy0 + 96, sx0 + 190, sy0 + 216), radius=28, fill=(250, 226, 190, 255))
    d.rounded_rectangle((sx0 + 176, sy0 + 110, sx0 + 286, sy0 + 214), radius=26, fill=(255, 244, 226, 255))

    # 右侧柜子
    kx0, ky0, kx1, ky1 = int(W * 0.66), int(H * 0.28), W + 30, int(H * 0.47)
    d.rounded_rectangle((kx0, ky0, kx1, ky1), radius=18, fill=(206, 150, 100, 255))
    d.rounded_rectangle((kx0 + 16, ky0 + 16, kx1 - 16, ky1 - 16), radius=14, fill=(222, 168, 118, 255))
    d.rounded_rectangle((kx0 + 34, ky0 + 34, kx1 - 34, ky0 + 150), radius=12, fill=(198, 142, 94, 255))

    # 落地灯
    lx = int(W * 0.60)
    d.line([(lx, int(H * 0.30)), (lx, int(H * 0.55))], fill=(150, 120, 96, 255), width=10)
    d.polygon([(lx - 90, int(H * 0.30)), (lx + 90, int(H * 0.30)),
               (lx + 56, int(H * 0.22)), (lx - 56, int(H * 0.22))], fill=(255, 226, 170, 255))
    lamp = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lamp)
    ld.ellipse((lx - 170, int(H * 0.24), lx + 170, int(H * 0.42)), fill=(255, 216, 140, 60))
    img.alpha_composite(lamp.filter(ImageFilter.GaussianBlur(46)))

    # 地毯
    rx0, ry0, rx1, ry1 = int(W * 0.08), int(H * 0.70), int(W * 0.94), int(H * 0.86)
    soft_shadow(img, (rx0, ry0, rx1, ry1), 80, 60, 26)
    d.ellipse((rx0, ry0, rx1, ry1), fill=(250, 236, 218, 255))
    d.ellipse((rx0 + 26, ry0 + 20, rx1 - 26, ry1 - 20), fill=(255, 248, 236, 255))
    # 猫爪印
    cx, cy = (rx0 + rx1) / 2, (ry0 + ry1) / 2
    d.ellipse((cx - 46, cy - 18, cx + 46, cy + 62), fill=(246, 196, 210, 255))
    for i, (ox, oy) in enumerate(((-64, -66), (-22, -84), (24, -84), (66, -62))):
        d.ellipse((cx + ox - 20, cy + oy - 20, cx + ox + 20, cy + oy + 20),
                  fill=(246, 196, 210, 255))

    # 前景：毛线球
    bx, by = int(W * 0.14), int(H * 0.895)
    d.ellipse((bx - 54, by - 54, bx + 54, by + 54), fill=(240, 168, 72, 255))
    for k in range(5):
        d.arc((bx - 54 + k * 6, by - 54 + k * 6, bx + 54 - k * 6, by + 54 - k * 6),
              200 + k * 20, 340 + k * 20, fill=(214, 140, 54, 255), width=4)

    # 右下角小边几
    tx, ty = int(W * 0.80), int(H * 0.80)
    d.rounded_rectangle((tx, ty, tx + 190, ty + 26), radius=12, fill=(214, 162, 112, 255))
    for lx2 in (tx + 18, tx + 160):
        d.rectangle((lx2, ty + 26, lx2 + 14, ty + 190), fill=(198, 146, 98, 255))

    # 整体暖光
    warm = Image.new("RGBA", (W, H), (255, 214, 160, 26))
    img.alpha_composite(warm)
    img.convert("RGB").save(path, quality=92)
    return path


# ─────────────────────────────────────────────── 章节卡
def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    bg = build_bg(os.path.join(OUT_DIR, "menu-bg.png"))
    print({"bg": os.path.relpath(bg, PKG)})


if __name__ == "__main__":
    main()
