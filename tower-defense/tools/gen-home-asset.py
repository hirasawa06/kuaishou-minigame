#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen-home-asset.py — 生成首页渲染图 res/home-asset/home-bg.png

规范要求首页渲染图必须放在主包 res/home-asset/，用于首帧展示。这里生成
一张与游戏内背景同色系的竖屏图（640x1400 2x 版本），首帧绘制时铺满全屏。
"""

import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "package", "res", "home-asset")
W, H = 640, 1400


def gradient(size, top, bottom):
    w, h = size
    img = Image.new("RGB", (w, h), top)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        d.line([(0, y), (w, y)], fill=c)
    return img


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    img = gradient((W, H), (22, 34, 74), (7, 11, 22)).convert("RGBA")
    d = ImageDraw.Draw(img, "RGBA")
    # 战场区域的柔和光晕，和游戏内 field 区域呼应
    d.ellipse([-140, 260, W + 140, 1180], fill=(32, 48, 96, 90))
    d.ellipse([-60, 380, W + 60, 1060], fill=(24, 38, 80, 70))
    # 底部基地色带
    d.rectangle([0, H - 190, W, H - 170], fill=(46, 66, 110, 160))
    img.convert("RGB").save(os.path.join(OUT_DIR, "home-bg.png"))
    print("home-bg:", os.path.getsize(os.path.join(OUT_DIR, "home-bg.png")), "bytes")


if __name__ == "__main__":
    main()
