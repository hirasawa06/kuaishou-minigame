#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen-assets.py — 塔防小游戏离线资源生成器

快手小游戏只允许 WebGL 1.0 渲染，禁止 canvas 2D，因此中文无法用 fillText 绘制。
这里把文字离线烘焙成位图字形图集（按 2x 分辨率，运行时用纹理四边形缩放绘制），
同时生成单位/敌人/UI 图标精灵图与 yoola 平台素材。

输出：
  package/res/Image/font-48.png / font-28.png / font-18.png   (2x 位图)
  package/res/Image/sprites.png                               (2x 位图)
  package/gameplay/data/font-atlas.js
  package/gameplay/data/sprites.js
  package/yoola-assets/icon.png / share-image.png / loading-image.png
"""

import json
import math
import os
import re
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PKG = os.path.join(ROOT, "package")
IMG_DIR = os.path.join(PKG, "res", "Image")
DATA_DIR = os.path.join(PKG, "gameplay", "data")
YOOLA_DIR = os.path.join(PKG, "yoola-assets")

FONT_PATH = "/System/Library/Fonts/STHeiti Medium.ttc"
FONT_INDEX = 1  # Heiti SC

SUPERSAMPLE = 2  # 纹理按 2 倍烘焙

STRINGS = [
    "塔防小游戏",
    "波次基地能量",
    "第波剩余首领来袭",
    "坦克战士射手法师",
    "铁盾卫石像守卫剑士狂战士弓手连弩手火法师冰法师",
    "开始暂停继续重来点击",
    "将卡牌拖到战场放置",
    "左右滑动甩掉卡牌",
    "胜利失败再接再厉",
    "费用攻击生命",
    "下一波",
]
# 保留既有图集字形，避免资源重生成时旧文案或历史界面缺字。
EXTRA = " 0123456789/:.+-%x×()！？，。·ABCDEFGHIJKLMNOPQRSTUVWXYZ冲半径按移群落角钮锋驻魔狗"


def collect_js_chars():
    """从 gameplay 下所有 js 的字符串字面量里收集用字，避免界面缺字。
    只看引号内的内容，注释里的中文不算，控制图集体积。"""
    chars = set()
    pattern = re.compile(r"'([^'\\\n]*)'|\"([^\"\\\n]*)\"", re.S)
    for dirpath, _dirnames, filenames in os.walk(DATA_DIR_ROOT):
        for name in filenames:
            if not name.endswith(".js"):
                continue
            p = os.path.join(dirpath, name)
            if os.path.basename(p) in ("font-atlas.js", "sprites.js"):
                continue
            with open(p, encoding="utf-8") as f:
                src = f.read()
            src = re.sub(r"/\*.*?\*/", " ", src, flags=re.S)
            src = re.sub(r"(?m)^\s*//.*$", " ", src)
            for m in pattern.finditer(src):
                text = m.group(1) if m.group(1) is not None else m.group(2)
                for ch in text:
                    if ord(ch) > 127 and not ch.isspace():
                        chars.add(ch)
    return chars


DATA_DIR_ROOT = ""


def pick_width(size, count):
    """按字号与字形数量选图集宽度，保证高度 <= 2048（低端机纹理上限）。"""
    px = size * SUPERSAMPLE
    per_glyph = px + 8
    for w in (512, 1024, 2048):
        per_row = max(1, w // per_glyph)
        rows = (count + per_row - 1) // per_row
        if rows * (px + 16) + 32 <= 2048:
            return w
    return 2048

WHITE = (255, 255, 255, 255)


# ─────────────────────────────────────────────── font atlas
def charset():
    chars = set()
    for s in STRINGS:
        chars.update(s)
    chars.update(EXTRA)
    chars.update(collect_js_chars())
    chars.discard("\n")
    return sorted(chars, key=lambda c: (len(c), c))


def build_font(size, out_png, pad=3, width=None):
    px = size * SUPERSAMPLE
    font = ImageFont.truetype(FONT_PATH, px, index=FONT_INDEX)
    asc, desc = font.getmetrics()
    line_h = asc + desc
    chars = charset()
    if width is None:
        width = pick_width(size, len(chars))

    placed = {}
    x = y = 0
    row_h = 0
    for ch in chars:
        adv = int(math.ceil(font.getlength(ch)))
        w = max(adv, 1) + pad * 2
        h = line_h + pad * 2
        if x + w > width:
            x = 0
            y += row_h + 1
            row_h = 0
        placed[ch] = (x, y, w, h, adv)
        x += w + 1
        row_h = max(row_h, h)

    height = y + row_h + 2
    height = 1 << (height - 1).bit_length()

    img = Image.new("L", (width, height), 0)
    d = ImageDraw.Draw(img)
    for ch, (gx, gy, gw, gh, adv) in placed.items():
        d.text((gx + pad, gy + pad), ch, font=font, fill=255)

    glyphs = {}
    for ch, (gx, gy, gw, gh, adv) in placed.items():
        cell = img.crop((gx, gy, gx + gw, gy + gh))
        bb = cell.getbbox()
        if not bb:
            glyphs[ch] = {"x": 0, "y": 0, "w": 0, "h": 0,
                          "ox": 0, "oy": 0, "adv": adv / SUPERSAMPLE, "blank": 1}
            continue
        bx0, by0, bx1, by1 = bb
        glyphs[ch] = {
            "x": gx + bx0, "y": gy + by0,
            "w": bx1 - bx0, "h": by1 - by0,
            "ox": (bx0 - pad) / SUPERSAMPLE,
            "oy": (by0 - pad) / SUPERSAMPLE,
            "adv": adv / SUPERSAMPLE,
        }

    rgba = Image.new("RGBA", (width, height), (255, 255, 255, 0))
    rgba.putalpha(img)
    rgba.save(out_png)
    return {
        "src": "res/Image/" + os.path.basename(out_png),
        "size": size,
        "texW": width,
        "texH": height,
        "lineH": line_h / SUPERSAMPLE,
        "glyphs": glyphs,
    }


# ─────────────────────────────────────────────── icon helpers
S = 128          # 逻辑设计尺寸
SCALE = 2        # 精灵图按 2x 输出
OUT = S * SCALE
INSET = 0

COL = {
    "tank1": (91, 139, 208, 255),
    "tank2": (124, 146, 190, 255),
    "war1": (224, 122, 58, 255),
    "war2": (255, 154, 74, 255),
    "arch1": (70, 196, 122, 255),
    "arch2": (53, 168, 100, 255),
    "mage1": (216, 98, 60, 255),
    "mage2": (90, 182, 232, 255),
    "grunt": (111, 191, 111, 255),
    "runner": (232, 201, 90, 255),
    "brute": (176, 106, 90, 255),
    "boss": (208, 90, 138, 255),
    "heart": (255, 90, 106, 255),
    "bolt": (77, 225, 255, 255),
    "light": (230, 236, 255, 255),
}


def new_icon():
    img = Image.new("RGBA", (OUT, OUT), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def p(*xy):
    """逻辑坐标 -> 输出像素坐标"""
    return tuple(v * SCALE for v in xy)


def shade(c, f):
    return (max(0, min(255, int(c[0] * f))),
            max(0, min(255, int(c[1] * f))),
            max(0, min(255, int(c[2] * f))), c[3])


def icon_shield(base):
    img, d = new_icon()
    d.polygon(p(64, 12, 110, 30, 110, 62, 64, 118, 18, 62, 18, 30), fill=shade(base, 0.72))
    d.polygon(p(64, 22, 100, 36, 100, 62, 64, 106, 28, 62, 28, 36), fill=base)
    d.polygon(p(64, 40, 78, 46, 78, 68, 64, 88, 50, 68, 50, 46), fill=WHITE)
    return img


def icon_sword(base, double=False):
    img, d = new_icon()
    if double:
        for sx in (-1, 1):
            d.polygon(p(64 + sx * 6, 18, 64 + sx * 22, 30, 64 + sx * 22, 74,
                        64 + sx * 6, 86), fill=base)
            d.polygon(p(64 + sx * 6, 18, 64 + sx * 2, 26, 64 + sx * 20, 76,
                        64 + sx * 22, 74, 64 + sx * 22, 30), fill=shade(base, 1.25))
        d.rounded_rectangle(p(54, 84, 74, 112), 6 * SCALE, fill=(120, 90, 70, 255))
    else:
        d.polygon(p(64, 12, 78, 34, 74, 84, 64, 92, 54, 84, 50, 34), fill=base)
        d.polygon(p(64, 12, 72, 34, 68, 82, 64, 88), fill=shade(base, 1.3))
        d.rounded_rectangle(p(38, 86, 90, 98), 4 * SCALE, fill=(255, 210, 110, 255))
        d.rounded_rectangle(p(56, 98, 72, 116), 5 * SCALE, fill=(120, 90, 70, 255))
        d.ellipse(p(54, 112, 74, 120), fill=(255, 210, 110, 255))
    return img


def icon_bow(base, crossbow=False):
    img, d = new_icon()
    d.arc(p(24, 10, 112, 118), start=-70, end=70, fill=base, width=9 * SCALE)
    d.line(p(78, 14, 78, 112), fill=(245, 245, 245, 255), width=3 * SCALE)
    d.line(p(30, 64, 104, 64), fill=(236, 236, 236, 255), width=5 * SCALE)
    d.polygon(p(120, 64, 98, 53, 98, 75), fill=(255, 255, 255, 255))
    if crossbow:
        d.rounded_rectangle(p(44, 56, 92, 72), 4 * SCALE, fill=shade(base, 0.7))
        d.line(p(68, 46, 68, 82), fill=(255, 255, 255, 200), width=3 * SCALE)
    return img


def icon_orb(base, kind):
    img, d = new_icon()
    d.ellipse(p(24, 24, 104, 104), fill=shade(base, 0.6))
    d.ellipse(p(32, 32, 96, 96), fill=base)
    d.ellipse(p(42, 42, 74, 74), fill=(255, 255, 255, 120))
    if kind == "fire":
        d.polygon(p(64, 20, 80, 48, 72, 48, 82, 70, 64, 66, 52, 76,
                    46, 54, 58, 46, 52, 32), fill=(255, 214, 128, 235))
    else:
        for ang in (0, 60, 120):
            a = math.radians(ang)
            dx, dy = math.cos(a) * 26, math.sin(a) * 26
            d.line(p(64 - dx, 64 - dy, 64 + dx, 64 + dy),
                   fill=(232, 250, 255, 230), width=5 * SCALE)
    return img


def icon_grunt(base):
    img, d = new_icon()
    d.polygon(p(28, 46, 36, 12, 52, 40), fill=shade(base, 0.7))
    d.polygon(p(100, 46, 92, 12, 76, 40), fill=shade(base, 0.7))
    d.ellipse(p(24, 30, 104, 112), fill=shade(base, 0.8))
    d.ellipse(p(30, 36, 98, 106), fill=base)
    d.ellipse(p(43, 56, 61, 78), fill=WHITE)
    d.ellipse(p(67, 56, 85, 78), fill=WHITE)
    d.ellipse(p(49, 63, 57, 73), fill=(30, 30, 40, 255))
    d.ellipse(p(73, 63, 81, 73), fill=(30, 30, 40, 255))
    d.chord(p(52, 80, 78, 100), 0, 180, fill=(40, 30, 35, 255))
    return img


def icon_runner(base):
    img, d = new_icon()
    d.polygon(p(64, 10, 96, 52, 78, 62, 84, 108, 44, 108, 50, 62, 32, 52),
              fill=shade(base, 0.8))
    d.ellipse(p(44, 24, 84, 64), fill=base)
    d.ellipse(p(52, 36, 62, 48), fill=WHITE)
    d.ellipse(p(66, 36, 76, 48), fill=WHITE)
    d.ellipse(p(55, 39, 59, 46), fill=(30, 30, 40, 255))
    d.ellipse(p(69, 39, 73, 46), fill=(30, 30, 40, 255))
    for i, y in enumerate((40, 58, 76)):
        d.line(p(10, y, 26, y), fill=(255, 255, 255, 160 - i * 40), width=4 * SCALE)
    return img


def icon_brute(base):
    img, d = new_icon()
    d.rounded_rectangle(p(18, 34, 110, 116), 18 * SCALE, fill=shade(base, 0.75))
    d.rounded_rectangle(p(28, 44, 100, 108), 14 * SCALE, fill=base)
    d.rounded_rectangle(p(4, 48, 30, 98), 10 * SCALE, fill=shade(base, 0.62))
    d.rounded_rectangle(p(98, 48, 124, 98), 10 * SCALE, fill=shade(base, 0.62))
    d.polygon(p(30, 44, 40, 12, 54, 42), fill=(240, 232, 222, 255))
    d.polygon(p(98, 44, 88, 12, 74, 42), fill=(240, 232, 222, 255))
    d.rounded_rectangle(p(44, 62, 58, 72), 2 * SCALE, fill=WHITE)
    d.rounded_rectangle(p(70, 62, 84, 72), 2 * SCALE, fill=WHITE)
    d.rounded_rectangle(p(48, 90, 80, 100), 4 * SCALE, fill=(40, 30, 35, 255))
    return img


def icon_boss(base):
    img, d = new_icon()
    d.polygon(p(20, 40, 32, 10, 48, 34, 64, 4, 80, 34, 96, 10, 108, 40),
              fill=(255, 214, 90, 255))
    d.ellipse(p(16, 34, 112, 124), fill=shade(base, 0.8))
    d.ellipse(p(26, 42, 102, 114), fill=base)
    d.ellipse(p(36, 58, 58, 84), fill=(255, 90, 90, 255))
    d.ellipse(p(70, 58, 92, 84), fill=(255, 90, 90, 255))
    d.ellipse(p(43, 65, 51, 77), fill=WHITE)
    d.ellipse(p(77, 65, 85, 77), fill=WHITE)
    d.polygon(p(46, 94, 82, 94, 64, 114), fill=(30, 20, 30, 255))
    return img


def icon_heart(base):
    img, d = new_icon()
    d.ellipse(p(14, 20, 68, 74), fill=base)
    d.ellipse(p(60, 20, 114, 74), fill=base)
    d.polygon(p(18, 52, 110, 52, 64, 116), fill=base)
    d.ellipse(p(34, 32, 50, 48), fill=(255, 255, 255, 110))
    return img


def icon_bolt(base):
    img, d = new_icon()
    d.polygon(p(74, 8, 34, 70, 60, 70, 50, 120, 94, 52, 66, 52), fill=base)
    return img


def icon_pause(base):
    img, d = new_icon()
    d.rounded_rectangle(p(34, 30, 54, 98), 6 * SCALE, fill=base)
    d.rounded_rectangle(p(74, 30, 94, 98), 6 * SCALE, fill=base)
    return img


def icon_play(base):
    img, d = new_icon()
    d.polygon(p(38, 24, 104, 64, 38, 104), fill=base)
    return img


# ── 个人资料 / 设置 / 排行榜界面用图标 ──────────────────────────
def icon_close(base):
    img, d = new_icon()
    d.line(p(34, 34, 94, 94), fill=base, width=11 * SCALE)
    d.line(p(94, 34, 34, 94), fill=base, width=11 * SCALE)
    return img


def icon_back(base):
    img, d = new_icon()
    d.line(p(34, 64, 96, 64), fill=base, width=10 * SCALE)
    d.line(p(34, 64, 66, 34), fill=base, width=10 * SCALE)
    d.line(p(34, 64, 66, 94), fill=base, width=10 * SCALE)
    return img


def icon_chevron(base):
    img, d = new_icon()
    d.line(p(46, 34, 82, 64), fill=base, width=11 * SCALE)
    d.line(p(82, 64, 46, 94), fill=base, width=11 * SCALE)
    return img


def icon_check(base):
    img, d = new_icon()
    d.line(p(28, 66, 52, 92), fill=base, width=11 * SCALE)
    d.line(p(52, 92, 100, 36), fill=base, width=11 * SCALE)
    return img


def icon_music(base):
    img, d = new_icon()
    # 双联音符：一根符干 + 顶部横梁 + 两个符头
    d.line(p(52, 26, 52, 86), fill=base, width=9 * SCALE)
    d.line(p(96, 20, 96, 78), fill=base, width=9 * SCALE)
    d.polygon(p(52, 26, 96, 20, 96, 38, 52, 44), fill=base)
    d.ellipse(p(24, 74, 66, 104), fill=base)
    d.ellipse(p(68, 66, 110, 96), fill=base)
    return img


def icon_sound(base):
    img, d = new_icon()
    d.polygon(p(16, 48, 38, 48, 62, 22, 62, 106, 38, 80, 16, 80), fill=base)
    d.arc(p(56, 26, 104, 102), start=-55, end=55, fill=base, width=8 * SCALE)
    d.arc(p(50, 12, 122, 116), start=-52, end=52, fill=base, width=7 * SCALE)
    return img


def icon_share(base):
    img, d = new_icon()
    for cx, cy in ((86, 26), (86, 102), (30, 64)):
        d.ellipse(p(cx - 13, cy - 13, cx + 13, cy + 13), fill=base)
    d.line(p(38, 58, 78, 34), fill=base, width=7 * SCALE)
    d.line(p(38, 70, 78, 94), fill=base, width=7 * SCALE)
    return img


def icon_link(base):
    img, d = new_icon()
    d.rounded_rectangle(p(52, 56, 108, 96), 14 * SCALE, outline=base, width=8 * SCALE)
    d.rounded_rectangle(p(20, 32, 76, 72), 14 * SCALE, outline=base, width=8 * SCALE)
    d.line(p(44, 64, 84, 64), fill=base, width=8 * SCALE)
    return img


ICON_BUILDERS = {
    "unit-tank-1": lambda: icon_shield(COL["tank1"]),
    "unit-tank-2": lambda: icon_shield(COL["tank2"]),
    "unit-war-1": lambda: icon_sword(COL["war1"]),
    "unit-war-2": lambda: icon_sword(COL["war2"], double=True),
    "unit-arch-1": lambda: icon_bow(COL["arch1"]),
    "unit-arch-2": lambda: icon_bow(COL["arch2"], crossbow=True),
    "unit-mage-1": lambda: icon_orb(COL["mage1"], "fire"),
    "unit-mage-2": lambda: icon_orb(COL["mage2"], "ice"),
    "enemy-grunt": lambda: icon_grunt(COL["grunt"]),
    "enemy-runner": lambda: icon_runner(COL["runner"]),
    "enemy-brute": lambda: icon_brute(COL["brute"]),
    "enemy-boss": lambda: icon_boss(COL["boss"]),
    "ui-heart": lambda: icon_heart(COL["heart"]),
    "ui-bolt": lambda: icon_bolt(COL["bolt"]),
    "ui-pause": lambda: icon_pause(COL["light"]),
    "ui-play": lambda: icon_play(COL["light"]),
    # 界面图标统一烘焙成木棕色：纸面 / 奶油底上直接可读，按钮内也够清晰
    "ui-close": lambda: icon_close((107, 74, 44, 255)),
    "ui-back": lambda: icon_back((107, 74, 44, 255)),
    "ui-chevron": lambda: icon_chevron((160, 132, 104, 255)),
    "ui-check": lambda: icon_check((120, 66, 12, 255)),
    "ui-music": lambda: icon_music((107, 74, 44, 255)),
    "ui-sound": lambda: icon_sound((107, 74, 44, 255)),
    "ui-share": lambda: icon_share((107, 74, 44, 255)),
    "ui-link": lambda: icon_link((90, 50, 8, 255)),
}

ICON_CACHE = {}


def get_icon(name):
    if name not in ICON_CACHE:
        ICON_CACHE[name] = ICON_BUILDERS[name]()
    return ICON_CACHE[name]


def build_sprites(out_png):
    keys = list(ICON_BUILDERS.keys())
    cols = 4
    rows = (len(keys) + cols - 1) // cols
    cell = OUT + 8
    w = cols * cell
    h = 1 << (rows * cell - 1).bit_length()
    atlas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    table = {}
    for i, k in enumerate(keys):
        cx = (i % cols) * cell + 4
        cy = (i // cols) * cell + 4
        atlas.paste(get_icon(k), (cx, cy))
        table[k] = [cx, cy, OUT, OUT]
    atlas.save(out_png)
    return {"src": "res/Image/" + os.path.basename(out_png),
            "texW": w, "texH": h, "size": S, "icons": table}


# ─────────────────────────────────────────────── yoola assets
def gradient(size, top, bottom):
    w, h = size
    img = Image.new("RGB", (w, h), top)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        d.line([(0, y), (w, y)], fill=c)
    return img


def draw_center(d, cx, y, text, size, fill, shadow=None):
    f = ImageFont.truetype(FONT_PATH, size, index=FONT_INDEX)
    w = d.textlength(text, font=f)
    if shadow:
        d.text((cx - w / 2 + max(2, size // 22), y + max(2, size // 22)),
               text, font=f, fill=shadow)
    d.text((cx - w / 2, y), text, font=f, fill=fill)


def build_yoola():
    os.makedirs(YOOLA_DIR, exist_ok=True)

    icon = gradient((220, 220), (26, 34, 74), (12, 16, 38)).convert("RGBA")
    sh = get_icon("unit-tank-1").resize((128, 128), Image.LANCZOS)
    icon.alpha_composite(sh, (46, 36))
    d = ImageDraw.Draw(icon)
    draw_center(d, 110, 166, "塔防", 40, (255, 214, 110, 255))
    icon.convert("RGB").save(os.path.join(YOOLA_DIR, "icon.png"))

    share = gradient((510, 350), (30, 40, 92), (10, 14, 32)).convert("RGBA")
    for i, k in enumerate(["unit-tank-1", "unit-war-1", "unit-arch-1", "unit-mage-1"]):
        share.alpha_composite(get_icon(k).resize((76, 76), Image.LANCZOS),
                              (47 + i * 105, 196))
    d = ImageDraw.Draw(share)
    draw_center(d, 255, 56, "塔防小游戏", 56, (255, 255, 255, 255), (26, 52, 130, 255))
    draw_center(d, 255, 132, "拖卡布阵 · 守护基地", 26, (140, 200, 255, 255))
    share.convert("RGB").save(os.path.join(YOOLA_DIR, "share-image.png"))

    load = gradient((640, 1400), (18, 24, 58), (6, 8, 20)).convert("RGBA")
    load.alpha_composite(get_icon("enemy-boss").resize((240, 240), Image.LANCZOS),
                         (200, 400))
    d = ImageDraw.Draw(load)
    draw_center(d, 320, 720, "塔防小游戏", 68, (255, 255, 255, 255), (20, 40, 110, 255))
    draw_center(d, 320, 812, "拖动卡牌 · 守住基地", 30, (130, 190, 255, 255))
    draw_center(d, 320, 910, "加载中", 26, (120, 130, 170, 255))
    load.convert("RGB").save(os.path.join(YOOLA_DIR, "loading-image.png"))


# ─────────────────────────────────────────────── main
def main():
    global DATA_DIR_ROOT
    DATA_DIR_ROOT = os.path.join(PKG, "gameplay")
    os.makedirs(IMG_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)

    fonts = {}
    for size, name in ((48, "font-48.png"), (28, "font-28.png"), (18, "font-18.png")):
        fonts[size] = build_font(size, os.path.join(IMG_DIR, name))

    sprites = build_sprites(os.path.join(IMG_DIR, "sprites.png"))

    with open(os.path.join(DATA_DIR, "font-atlas.js"), "w", encoding="utf-8") as f:
        f.write("/* 由 tools/gen-assets.py 生成，请勿手改 */\n")
        f.write("(function () {\n  var A = window.AIGCUtils = window.AIGCUtils || {};\n")
        f.write("  A.FontAtlas = " + json.dumps(fonts, ensure_ascii=False,
                                             separators=(",", ":")) + ";\n})();\n")

    with open(os.path.join(DATA_DIR, "sprites.js"), "w", encoding="utf-8") as f:
        f.write("/* 由 tools/gen-assets.py 生成，请勿手改 */\n")
        f.write("(function () {\n  var A = window.AIGCUtils = window.AIGCUtils || {};\n")
        f.write("  A.SpriteAtlas = " + json.dumps(sprites, ensure_ascii=False,
                                               separators=(",", ":")) + ";\n})();\n")

    build_yoola()

    print(json.dumps({
        "glyphs": len(fonts[48]["glyphs"]),
        "fontSizes": list(fonts.keys()),
        "icons": len(sprites["icons"]),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
