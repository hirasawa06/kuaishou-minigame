#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen-shiba-atlas.py — 战斗精灵图集（128 单元格，自动扩展至 1024x1152）

输入（tools/src/）：
  shiba-front.png   从角色设定图抠出的护盾柴犬正视图（RGBA）
输出：
  package/res/Image/game.png        128 单元格图集（2x 绘制后缩放）
  package/gameplay/data/rigs.js     分件坐标 + 高分辨率特效元数据

图集布局：8 列 × 9 行，单元格 128px（含 4px padding，有效区 120px）。
帧按注册顺序自动排格；运行时只能通过稳定帧名查找，不能依赖行列位置。
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
ROWS = 9
ATLAS_W = COLS * CELL
ATLAS_H = ROWS * CELL

# 原有图标（从 tools/gen-assets.py 生成的 sprites.png 继承）
LEGACY_ICONS = [
    "unit-tank-2", "unit-war-1", "unit-war-2", "unit-arch-1",
    "unit-arch-2", "unit-mage-1", "unit-mage-2",
    "enemy-grunt", "enemy-runner", "enemy-brute", "enemy-boss",
    "ui-heart", "ui-bolt", "ui-pause", "ui-play",
]

# 本脚本自绘的新图标（按四档敌人与金币重做，不依赖旧图集）
NEW_ICONS = [
    "enemy-small", "enemy-normal", "enemy-elite", "ui-coin",
    "ui-setting", "ui-rank", "ui-lock",
]

SPEC_DIR = os.path.join(SRC_DIR, "animation-specs")


def load_animation_spec(name):
    """读取动作规格；缺少关键字段时在生成阶段直接失败。"""
    path = os.path.join(SPEC_DIR, name + ".json")
    with open(path, encoding="utf-8") as f:
        spec = json.load(f)
    for key in ("id", "sourceDir", "frames", "states"):
        if key not in spec:
            raise ValueError("动作规格缺少字段: " + key)
    return spec


ARCHER_SPEC = load_animation_spec("arch")
ARCHER_CAT_DIR = os.path.join(SRC_DIR, ARCHER_SPEC["sourceDir"])
TANK_SPEC = load_animation_spec("tank")
TANK_DOG_DIR = os.path.join(SRC_DIR, TANK_SPEC["sourceDir"])
LAMP_SPEC = load_animation_spec("lamp")
LAMP_DIR = os.path.join(SRC_DIR, LAMP_SPEC["sourceDir"])
NORMAL_SPEC = load_animation_spec("normal")
NORMAL_DIR = os.path.join(SRC_DIR, NORMAL_SPEC["sourceDir"])
WAR_SPEC = load_animation_spec("war")
WAR_CAT_DIR = os.path.join(SRC_DIR, WAR_SPEC["sourceDir"])
MAGE_SPEC = load_animation_spec("mage")
MAGE_DOG_DIR = os.path.join(SRC_DIR, MAGE_SPEC["sourceDir"])
DEFEAT_SMOKE_DIR = os.path.join(SRC_DIR, "effects", "defeat-smoke")
DEFEAT_SMOKE = [
    os.path.join(DEFEAT_SMOKE_DIR, "vanish-smoke-01.png"),
    os.path.join(DEFEAT_SMOKE_DIR, "vanish-smoke-02.png"),
    os.path.join(DEFEAT_SMOKE_DIR, "vanish-smoke-03.png"),
]
MAGE_BISCUIT_VFX = os.path.join(SRC_DIR, "effects", "mage-biscuit", "mage-biscuit-vfx-v5.png")
MAGE_BISCUIT_TEXTURE = os.path.join(IMG_DIR, "mage-biscuit-vfx.png")
MAGE_VFX_CELL = 256


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


def fit_visible(img):
    """剔除透明画布噪点后等比收进一个图集单元格。"""
    # AI 图常在整张透明画布边缘遗留极淡像素；按可见阈值裁掉，
    # 否则 fit_cell 会把角色缩得过小。
    alpha = np.asarray(img)[:, :, 3]
    ys, xs = np.where(alpha >= 16)
    if len(xs) == 0:
        raise ValueError("射手猫背面动作源图为空")
    bbox = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    return fit_cell(img.crop(bbox), CELL - 2 * PAD)[0]


def archer_back_frame(name):
    """按动作规格从 2x2 背面动作源图取一格。"""
    frame = ARCHER_SPEC["frames"][name]
    if "index" not in frame:
        raise ValueError("动作规格缺少 sheet index: " + name)
    sheet = Image.open(os.path.join(ARCHER_CAT_DIR, frame["file"])).convert("RGBA")
    w, h = sheet.size
    col, row = frame["index"] % 2, frame["index"] // 2
    x0, x1 = col * w // 2, (col + 1) * w // 2
    y0, y1 = row * h // 2, (row + 1) * h // 2
    return fit_visible(sheet.crop((x0, y0, x1, y1)))


def archer_frame(name):
    """读取动作规格中定义的一张完整姿势帧。"""
    frame = ARCHER_SPEC["frames"][name]
    return fit_visible(Image.open(os.path.join(ARCHER_CAT_DIR, frame["file"])).convert("RGBA"))


def archer_back_defeat():
    """用户确认的仰面晕倒姿势：脸朝镜头，头在战场南侧。"""
    return archer_frame("defeat")


def spec_sheet_frame(spec, source_dir, name):
    """按规格从规则网格精灵表取帧；角色动作与独立特效共用此规则。"""
    frame = spec["frames"][name]
    columns = frame.get("columns")
    if not columns:
        raise ValueError("动作规格缺少 sheet columns: " + name)
    rows = frame.get("rows", 1)
    sheet = Image.open(os.path.join(source_dir, frame["file"])).convert("RGBA")
    width, height = sheet.size
    index = frame["index"]
    if index < 0 or index >= columns * rows:
        raise ValueError("动作规格 sheet index 越界: " + name)
    col = index % columns
    row = index // columns
    x0, x1 = col * width // columns, (col + 1) * width // columns
    y0, y1 = row * height // rows, (row + 1) * height // rows
    return fit_visible(sheet.crop((x0, y0, x1, y1)))


def normal_cabinet_frame(name):
    """普通柜怪动作源含生图留下的极低 alpha 彩点；和 fit_visible 的阈值保持一致清除。"""
    img = spec_sheet_frame(NORMAL_SPEC, NORMAL_DIR, name)
    rgba = np.asarray(img).copy()
    rgba[rgba[:, :, 3] < 16] = 0
    return Image.fromarray(rgba, "RGBA")


def tank_frame(name):
    """柴不破的背面待机、受击与仰面倒地帧。"""
    frame = TANK_SPEC["frames"][name]
    if "columns" in frame:
        return spec_sheet_frame(TANK_SPEC, TANK_DOG_DIR, name)
    return fit_visible(Image.open(os.path.join(TANK_DOG_DIR, frame["file"])).convert("RGBA"))


def lamp_frame(name):
    """台灯小怪动作表：统一从 3×2 透明精灵表取帧。"""
    return spec_sheet_frame(LAMP_SPEC, LAMP_DIR, name)


def war_frame(name):
    """近战猫动作表：正背两套动作共用 4×3 透明精灵表。"""
    return spec_sheet_frame(WAR_SPEC, WAR_CAT_DIR, name)


def mage_frame(name):
    """哈利边牧动作表：仅背面六帧，统一从 3×2 透明精灵表取帧。"""
    frame = MAGE_SPEC["frames"][name]
    sheet = Image.open(os.path.join(MAGE_DOG_DIR, frame["file"])).convert("RGBA")
    width, height = sheet.size
    index = frame["index"]
    col = index % frame["columns"]
    row = index // frame["columns"]
    img = sheet.crop((col * width // frame["columns"], row * height // frame["rows"],
                      (col + 1) * width // frame["columns"], (row + 1) * height // frame["rows"]))
    # 生成图边缘的低透明白雾在缩图后会变成碎屑；清掉它而不影响主体与法术高光。
    rgba = np.asarray(img).copy()
    rgba[rgba[:, :, 3] < 80] = (0, 0, 0, 0)
    return fit_visible(Image.fromarray(rgba, "RGBA"))


def defeat_smoke(index):
    """通用三帧死亡烟雾：爆开、扩散、残雾。"""
    return fit_visible(Image.open(DEFEAT_SMOKE[index]).convert("RGBA"))


def make_glow(size=96):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = size / 2
    for i in range(size // 2, 0, -1):
        t = i / (size / 2)
        alpha = int(255 * (1 - t) ** 2.2)
        d.ellipse((c - i, c - i, c + i, c + i), fill=(255, 255, 255, alpha))
    return img


def mage_biscuit_texture():
    """导出双格特效：飞弹保留，落地格只保留饼干本体与实体碎块。"""
    sheet = Image.open(MAGE_BISCUIT_VFX).convert("RGBA")
    split = int(round(sheet.width * 0.36))
    out = Image.new("RGBA", (MAGE_VFX_CELL * 2, MAGE_VFX_CELL), (0, 0, 0, 0))

    def pack(src, x):
        rgba = np.asarray(src)
        ys, xs = np.where(rgba[:, :, 3] >= 16)
        if len(xs) == 0:
            raise ValueError("法师饼干特效帧为空")
        crop = src.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        scale = min((MAGE_VFX_CELL - 32) / crop.width, (MAGE_VFX_CELL - 32) / crop.height)
        size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
        crop = crop.resize(size, Image.LANCZOS)
        out.alpha_composite(crop, (x + (MAGE_VFX_CELL - crop.width) // 2,
                                  (MAGE_VFX_CELL - crop.height) // 2))

    pack(sheet.crop((0, 0, split, sheet.height)), 0)
    pack(sheet.crop((split, 0, sheet.width, sheet.height)), MAGE_VFX_CELL)
    out.save(MAGE_BISCUIT_TEXTURE)
    return {
        "src": "res/Image/mage-biscuit-vfx.png?v=5",
        "texW": MAGE_VFX_CELL * 2,
        "texH": MAGE_VFX_CELL,
        "effects": {
            "flight": [0, 0, MAGE_VFX_CELL, MAGE_VFX_CELL],
            "impact": [MAGE_VFX_CELL, 0, MAGE_VFX_CELL, MAGE_VFX_CELL],
        },
    }


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


# ─────────────────────────────────────────── 新图标（2x 绘制）
def _new(size=120):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def icon_enemy(tier):
    """四档敌人：体型与花纹逐级升级，颜色对应 config 里的色板。"""
    img, d = _new()
    base, accent = {
        "small": ((143, 208, 106), (96, 160, 70)),
        "normal": ((217, 160, 90), (166, 112, 60)),
        "elite": ((168, 111, 224), (114, 66, 168)),
        "boss": ((224, 78, 110), (150, 38, 70)),
    }[tier]
    cx, cy = 60, 66
    r = {"small": 26, "normal": 33, "elite": 40, "boss": 47}[tier]

    # 影子
    d.ellipse((cx - r * 0.8, cy + r * 0.75, cx + r * 0.8, cy + r * 0.98),
              fill=(0, 0, 0, 40))
    # 角（精英 / 首领）
    if tier in ("elite", "boss"):
        for sx in (-1, 1):
            d.polygon([(cx + sx * r * 0.55, cy - r * 0.62),
                       (cx + sx * r * 0.82, cy - r * 1.28),
                       (cx + sx * r * 0.18, cy - r * 0.86)], fill=accent)
    # 身体
    d.ellipse((cx - r, cy - r * 0.92, cx + r, cy + r * 0.96), fill=base)
    d.ellipse((cx - r * 0.78, cy - r * 0.70, cx + r * 0.10, cy + r * 0.20),
              fill=(255, 255, 255, 46))
    # 眼睛：越高级越凶
    eyeY = cy - r * 0.02
    ew = r * 0.20
    for sx in (-1, 1):
        d.ellipse((cx + sx * r * 0.38 - ew, eyeY - ew * 1.05,
                   cx + sx * r * 0.38 + ew, eyeY + ew * 1.05),
                  fill=(255, 255, 255, 255))
        d.ellipse((cx + sx * r * 0.38 - ew * 0.45, eyeY - ew * 0.6,
                   cx + sx * r * 0.38 + ew * 0.45, eyeY + ew * 0.7),
                  fill=(38, 28, 36, 255))
    if tier in ("elite", "boss"):
        # 眉毛压在眼睛上沿之外，避免盖住眼白变成“半张脸”
        for sx in (-1, 1):
            d.line([(cx + sx * r * 0.60, eyeY - r * 0.34),
                    (cx + sx * r * 0.22, eyeY - r * 0.22)],
                   fill=(48, 30, 34, 255), width=4)
    # 嘴
    mouthY = cy + r * 0.42
    if tier == "boss":
        d.polygon([(cx - r * 0.34, mouthY), (cx + r * 0.34, mouthY),
                   (cx, mouthY + r * 0.34)], fill=(40, 24, 30, 255))
        # 王冠
        d.polygon([(cx - r * 0.66, cy - r * 0.92), (cx - r * 0.42, cy - r * 1.30),
                   (cx - r * 0.12, cy - r * 1.02), (cx + r * 0.18, cy - r * 1.34),
                   (cx + r * 0.46, cy - r * 1.02), (cx + r * 0.68, cy - r * 0.92)],
                  fill=(255, 214, 90, 255))
    else:
        d.arc((cx - r * 0.30, mouthY - r * 0.18, cx + r * 0.30, mouthY + r * 0.26),
              10, 170, fill=(48, 30, 34, 255), width=5)
    return img


def icon_coin():
    img, d = _new()
    cx, cy, r = 60, 60, 42
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(214, 150, 40, 255))
    d.ellipse((cx - r + 5, cy - r + 5, cx + r - 5, cy + r - 5), fill=(255, 205, 90, 255))
    d.ellipse((cx - r + 13, cy - r + 11, cx + r - 20, cy + 6), fill=(255, 238, 170, 255))
    # 爪印
    d.ellipse((cx - 13, cy - 4, cx + 13, cy + 20), fill=(196, 128, 30, 255))
    for ox, oy in ((-22, -20), (-8, -30), (8, -30), (22, -20)):
        d.ellipse((cx + ox - 8, cy + oy - 8, cx + ox + 8, cy + oy + 8),
                  fill=(196, 128, 30, 255))
    return img


def icon_setting():
    img, d = _new()
    cx, cy = 60, 60
    for i in range(8):
        a = i * math.pi / 4
        x1 = cx + math.cos(a) * 34
        y1 = cy + math.sin(a) * 34
        x2 = cx + math.cos(a) * 50
        y2 = cy + math.sin(a) * 50
        d.line([(x1, y1), (x2, y2)], fill=(122, 86, 56, 255), width=16)
    d.ellipse((cx - 38, cy - 38, cx + 38, cy + 38), fill=(122, 86, 56, 255))
    d.ellipse((cx - 26, cy - 26, cx + 26, cy + 26), fill=(247, 236, 220, 255))
    return img


def icon_rank():
    img, d = _new()
    # 奖杯
    d.polygon([(30, 26), (90, 26), (84, 66), (36, 66)], fill=(240, 180, 64, 255))
    d.ellipse((18, 26, 46, 52), outline=(240, 180, 64, 255), width=7)
    d.ellipse((74, 26, 102, 52), outline=(240, 180, 64, 255), width=7)
    d.rectangle((54, 64, 66, 84), fill=(214, 150, 48, 255))
    d.rounded_rectangle((38, 84, 82, 96), 6, fill=(214, 150, 48, 255))
    # 爪印
    d.ellipse((52, 38, 68, 54), fill=(255, 245, 214, 255))
    return img


def icon_lock():
    img, d = _new()
    d.arc((34, 18, 86, 74), 180, 360, fill=(190, 196, 210, 255), width=10)
    d.rounded_rectangle((26, 52, 94, 104), 12, fill=(214, 220, 232, 255))
    d.ellipse((54, 68, 66, 80), fill=(120, 130, 150, 255))
    d.rectangle((57, 76, 63, 92), fill=(120, 130, 150, 255))
    return img


NEW_BUILDERS = {
    "enemy-small": lambda: icon_enemy("small"),
    "enemy-normal": lambda: icon_enemy("normal"),
    "enemy-elite": lambda: icon_enemy("elite"),
    "ui-coin": icon_coin,
    "ui-setting": icon_setting,
    "ui-rank": icon_rank,
    "ui-lock": icon_lock,
}


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
    used_cells = set()

    def next_cell():
        if len(used_cells) >= COLS * ROWS:
            raise ValueError("战斗图集已满，请扩容 ROWS 或删除未使用帧")
        for row in range(ROWS):
            for col in range(COLS):
                if (col, row) not in used_cells:
                    used_cells.add((col, row))
                    return col, row
        raise ValueError("战斗图集没有可用格位")

    def cell(name, img, ox=None, oy=None):
        """落格。ox/oy 是相对整个正视图的绝对坐标（含 PAD 与居中偏移），
        这里换算成图集内的绝对位置；格位自动分配并检测容量。"""
        if name in table:
            raise ValueError("图集帧重复: " + name)
        col, row = next_cell()
        dx = (CELL - 2 * PAD - img.width) // 2 + PAD
        dy = (CELL - 2 * PAD - img.height) // 2 + PAD
        if ox is not None:
            dx = int(round(ox))
            dy = int(round(oy))
        atlas.alpha_composite(img, (col * CELL + dx, row * CELL + dy))
        table[name] = [col * CELL + PAD, row * CELL + PAD, CELL - 2 * PAD, CELL - 2 * PAD]

    # 整只（卡牌 / 拖拽残影 / 兼容）
    cell("unit-tank-1", full_s)
    cell("unit-tank-1-body", body_s, body_ox, body_oy)
    cell("unit-tank-1-shield", shield_s, shield_ox, shield_oy)
    cell("fx-glow", make_glow())
    cell("fx-slash", make_slash())
    cell("fx-smoke", defeat_smoke(0))
    cell("fx-ring", make_glow())
    cell("fx-smoke-2", defeat_smoke(1))
    for name in NEW_ICONS:
        cell(name, NEW_BUILDERS[name]())

    # 射手猫背面：待机、瞄准、左右开火、后坐、仰面晕倒。飞行光弹仍由运行时负责。
    cell(ARCHER_SPEC["frames"]["idle"]["icon"], archer_back_frame("idle"))
    cell(ARCHER_SPEC["frames"]["aim"]["icon"], archer_back_frame("aim"))
    cell(ARCHER_SPEC["frames"]["recoil"]["icon"], archer_back_frame("recoil"))
    cell(ARCHER_SPEC["frames"]["fireLeft"]["icon"], archer_frame("fireLeft"))
    cell(ARCHER_SPEC["frames"]["fireRight"]["icon"], archer_frame("fireRight"))
    cell(ARCHER_SPEC["frames"]["defeat"]["icon"], archer_back_defeat())
    cell("fx-smoke-3", defeat_smoke(2))

    # 柴不破：背面待机、受击与晕倒均为完整姿势帧。
    cell(TANK_SPEC["frames"]["idle"]["icon"], tank_frame("idle"))
    cell(TANK_SPEC["frames"]["hurt"]["icon"], tank_frame("hurt"))
    cell(TANK_SPEC["frames"]["defeat"]["icon"], tank_frame("defeat"))

    # 台灯小怪：待机、跳步、灯罩蓄力 / 撞击、受击、侧翻倒地。
    for frame_name, frame in LAMP_SPEC["frames"].items():
        cell(frame["icon"], lamp_frame(frame_name))

    # 普通柜怪：待机、迈步、整体后仰蓄力与柜体前探撞击。
    for frame_name, frame in NORMAL_SPEC["frames"].items():
        cell(frame["icon"], normal_cabinet_frame(frame_name))

    # 近战猫：正背朝向分别提供待机、走步、挥锤、受击和倒地姿势。
    for frame_name, frame in WAR_SPEC["frames"].items():
        cell(frame["icon"], war_frame(frame_name))

    # 哈利边牧：固定背面，蓄能、释放与收势由同一法术攻击时间线驱动。
    for frame_name, frame in MAGE_SPEC["frames"].items():
        cell(frame["icon"], mage_frame(frame_name))

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
        for name in LEGACY_ICONS:
            box = legacy_meta["icons"].get(name)
            if not box:
                continue
            im = old.crop((box[0], box[1], box[0] + box[2], box[1] + box[3]))
            im = im.resize((CELL - 2 * PAD, CELL - 2 * PAD), Image.LANCZOS)
            cell(name, im)

    # 图集扩容后仍需满足快手主包 6 MiB 门槛。游戏内角色最大显示尺寸远小于图集单元，
    # 统一为 256 色并关闭抖动，既避免肉眼可见的噪点，也把主包留在平台限制以内。
    atlas.quantize(
        colors=256,
        method=Image.Quantize.FASTOCTREE,
        dither=Image.Dither.NONE,
    ).save(os.path.join(IMG_DIR, "game.png"), optimize=True, compress_level=9)

    anchor_json = {}
    for name, ox, oy, w_, h_ in (
        ("unit-tank-1-body", body_ox, body_oy, body_s.width, body_s.height),
        ("unit-tank-1-shield", shield_ox, shield_oy, shield_s.width, shield_s.height),
    ):
        anchor_json[name] = [round(ox, 1), round(oy, 1)]

    data = {
        "src": "res/Image/game.png?v=6",
        "texW": ATLAS_W,
        "texH": ATLAS_H,
        "cell": CELL,
        "pad": PAD,
        "icons": table,
        "anchors": anchor_json,
        "cellFull": [CELL - 2 * PAD, CELL - 2 * PAD],
    }
    return data


def write_rigs(atlas_data, mage_vfx):
    src = os.path.join(DATA_DIR, "rigs.js")
    with open(src, "w", encoding="utf-8") as f:
        f.write("/* 由 tools/gen-shiba-atlas.py 生成，请勿手改 */\n")
        f.write("(function () {\n  var A = window.AIGCUtils = window.AIGCUtils || {};\n")
        f.write("  A.GameAtlas = " + json.dumps(atlas_data, ensure_ascii=False,
                                            separators=(",", ":")) + ";\n")
        f.write("  A.MageVfx = " + json.dumps(mage_vfx, ensure_ascii=False,
                                                 separators=(",", ":")) + ";\n")
        f.write("})();\n")
    return src


def write_character_animations():
    """把离线动作规格中运行时需要的字段导出给 Rig 定义。"""
    runtime = {}
    for spec in (ARCHER_SPEC, TANK_SPEC, LAMP_SPEC, NORMAL_SPEC, WAR_SPEC, MAGE_SPEC):
        runtime[spec["id"]] = {
            "frames": {name: frame["icon"] for name, frame in spec["frames"].items()},
            "states": spec["states"],
        }
    src = os.path.join(DATA_DIR, "character-animations.js")
    with open(src, "w", encoding="utf-8") as f:
        f.write("/* 由 tools/gen-shiba-atlas.py 生成，请勿手改 */\n")
        f.write("(function () {\n  var A = window.AIGCUtils = window.AIGCUtils || {};\n")
        f.write("  A.CharacterAnimations = " + json.dumps(runtime, ensure_ascii=False,
                                                          separators=(",", ":")) + ";\n")
        f.write("})();\n")
    return src


if __name__ == "__main__":
    os.makedirs(IMG_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)
    data = build()
    mage_vfx = mage_biscuit_texture()
    rigs_path = write_rigs(data, mage_vfx)
    spec_path = write_character_animations()
    print(json.dumps({"atlas": data["src"], "cells": len(data["icons"]), "mageVfx": mage_vfx["src"],
                      "rigs": os.path.relpath(rigs_path, ROOT),
                      "animations": os.path.relpath(spec_path, ROOT)}, ensure_ascii=False))
