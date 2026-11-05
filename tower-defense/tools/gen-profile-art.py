#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen-profile-art.py — 个人资料（头像）与设置/名片/排行榜界面用到的图标

输出：
  package/res/Menu/avatars.png        3x3 头像图集（9 只猫狗，2x 输出）
  package/gameplay/data/avatars.js    头像图集元数据（尺寸、格子、名称、配色）

头像本身不画圆角底：底框由 UI 按“选中/未选中”状态实时绘制，
这样同一张头像可以在首页、名片、选择头像弹窗和排行榜里复用。
"""

import json
import math
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PKG = os.path.join(ROOT, "package")
OUT_DIR = os.path.join(PKG, "res", "Menu")
DATA_DIR = os.path.join(PKG, "gameplay", "data")

S = 128          # 逻辑尺寸
SCALE = 2        # 2x 输出，与其它图集一致
CELL = S * SCALE + 8
GRID = 3

# id, 名字, 物种, 主色, 深色, 浅色
AVATARS = [
    ("av-cat-orange", "暖阳小橘", "cat", (245, 168, 74), (214, 126, 44), (255, 226, 186)),
    ("av-bear-cream", "奶油团子", "bear", (232, 196, 150), (196, 152, 106), (255, 240, 214)),
    ("av-rabbit-pink", "桃气兔兔", "rabbit", (240, 176, 176), (205, 130, 132), (255, 226, 228)),
    ("av-cat-gray", "青灰小满", "cat", (158, 172, 186), (116, 130, 146), (226, 234, 242)),
    ("av-dog-brown", "可可豆豆", "dog", (176, 128, 96), (134, 92, 66), (238, 208, 184)),
    ("av-fox-red", "赤焰阿福", "fox", (232, 134, 84), (196, 100, 56), (255, 214, 178)),
    ("av-cat-blue", "蓝莓团子", "cat", (140, 168, 214), (102, 128, 176), (222, 234, 252)),
    ("av-dog-yellow", "勇敢小橘", "dog", (244, 190, 96), (206, 148, 58), (255, 232, 186)),
    ("av-cat-green", "抹茶布丁", "cat", (150, 196, 142), (108, 156, 102), (222, 240, 214)),
]

EYE = (58, 42, 36, 255)
NOSE = (92, 60, 52, 255)
MOUTH = (70, 46, 40, 255)


def p(*xy):
    return tuple(v * SCALE for v in xy)


def shade(c, f):
    return (max(0, min(255, int(c[0] * f))),
            max(0, min(255, int(c[1] * f))),
            max(0, min(255, int(c[2] * f))), 255)


def rgba(c, a=255):
    return (c[0], c[1], c[2], a)


def draw_face(img, d, kind, main, dark, light, size):
    """在 size×size（输出像素）区域内画一张居中的正面兽脸，坐标按 128 逻辑稿。"""
    k = size / (S * SCALE)

    def box(x0, y0, x1, y1):
        return (x0 * SCALE * k, y0 * SCALE * k, x1 * SCALE * k, y1 * SCALE * k)

    def rrect(x0, y0, x1, y1, r, fill):
        d.rounded_rectangle(box(x0, y0, x1, y1), r * SCALE * k, fill=fill)

    def ell(x0, y0, x1, y1, fill):
        d.ellipse(box(x0, y0, x1, y1), fill=fill)

    def poly(points, fill):
        d.polygon([((x * SCALE * k), (y * SCALE * k)) for x, y in points], fill=fill)

    base = rgba(main)
    deep = rgba(dark)
    pale = rgba(light)

    if kind == "rabbit":
        # 长耳朵
        rrect(36, 6, 58, 62, 11, deep)
        rrect(39, 9, 55, 58, 9, rgba((250, 206, 206)))
        rrect(70, 6, 92, 62, 11, deep)
        rrect(73, 9, 89, 58, 9, rgba((250, 206, 206)))
    elif kind == "cat":
        # 尖耳
        poly([(20, 52), (28, 12), (54, 40)], deep)
        poly([(108, 52), (100, 12), (74, 40)], deep)
        poly([(26, 46), (32, 22), (48, 40)], rgba((250, 200, 196)))
        poly([(102, 46), (96, 22), (80, 40)], rgba((250, 200, 196)))
    else:
        # 圆耳（狗 / 熊 / 狐狸的短耳）
        ell(12, 22, 46, 62, deep)
        ell(82, 22, 116, 62, deep)
        ell(18, 30, 40, 56, rgba((246, 220, 200)))

    # 脸
    ell(16, 24, 112, 118, deep)
    ell(20, 27, 108, 114, base)
    # 口鼻浅色区
    ell(40, 68, 88, 110, pale)

    if kind == "fox":
        # 白色脸颊：收在脸的椭圆内，避免尖角戳出轮廓
        poly([(26, 84), (46, 76), (40, 100), (28, 96)], pale)
        poly([(102, 84), (82, 76), (88, 100), (100, 96)], pale)

    # 眼睛
    ell(38, 54, 56, 76, rgba((255, 255, 255)))
    ell(72, 54, 90, 76, rgba((255, 255, 255)))
    ell(44, 60, 52, 72, EYE)
    ell(78, 60, 86, 72, EYE)
    ell(46, 61, 49, 65, rgba((255, 255, 255, 205)))
    ell(80, 61, 83, 65, rgba((255, 255, 255, 205)))

    # 鼻子与嘴
    ell(57, 80, 71, 90, NOSE)
    d.arc(box(47, 88, 62, 100), 0, 150, fill=MOUTH, width=int(3 * SCALE * k))
    d.arc(box(66, 88, 81, 100), 30, 180, fill=MOUTH, width=int(3 * SCALE * k))

    # 腮红
    ell(28, 84, 42, 94, rgba((246, 150, 140), 90))
    ell(86, 84, 100, 94, rgba((246, 150, 140), 90))


def build_sheet(out_png):
    w = GRID * CELL
    h = GRID * CELL
    atlas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    frames = {}
    for i, (aid, name, kind, main, dark, light) in enumerate(AVATARS):
        col = i % GRID
        row = i // GRID
        cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
        draw_face(cell, ImageDraw.Draw(cell), kind, main, dark, light, S * SCALE)
        x = col * CELL + 4
        y = row * CELL + 4
        atlas.paste(cell, (x, y), cell)
        frames[aid] = [x, y, S * SCALE, S * SCALE]
    os.makedirs(OUT_DIR, exist_ok=True)
    atlas.save(out_png)
    return {
        "src": "res/Menu/avatars.png",
        "texW": w,
        "texH": h,
        "grid": GRID,
        "size": S,
        "frames": frames,
        "items": [
            {"id": aid, "name": name, "color": "#%02x%02x%02x" % main}
            for aid, name, _kind, main, _dark, _light in AVATARS
        ],
    }


def main():
    meta = build_sheet(os.path.join(OUT_DIR, "avatars.png"))
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(os.path.join(DATA_DIR, "avatars.js"), "w", encoding="utf-8") as f:
        f.write("/* 由 tools/gen-profile-art.py 生成，请勿手改 */\n")
        f.write("(function () {\n  var A = window.AIGCUtils = window.AIGCUtils || {};\n")
        f.write("  A.AvatarAtlas = " + json.dumps(meta, ensure_ascii=False,
                                              separators=(",", ":")) + ";\n})();\n")
    print("头像图集:", len(meta["frames"]), "个，", meta["texW"], "x", meta["texH"])


if __name__ == "__main__":
    main()
