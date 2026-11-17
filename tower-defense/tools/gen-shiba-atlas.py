#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen-shiba-atlas.py — 战斗精灵图集（128px 单元格，1024px 宽）
输出：
  package/res/Image/game.png        128px 单元格图集（2x 绘制后缩放）
  package/gameplay/data/rigs.js     图集坐标 + 高分辨率特效元数据

图集布局：8 列 × 8 行，单元格 128px（含 4px padding，有效区 120px）。
帧按注册顺序自动排格；运行时只能通过稳定帧名查找，不能依赖行列位置。
"""

import json
import math
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PKG = os.path.join(ROOT, "package")
IMG_DIR = os.path.join(PKG, "res", "Image")
DATA_DIR = os.path.join(PKG, "gameplay", "data")
SRC_DIR = os.path.join(ROOT, "tools", "src")

CELL = 128
PAD = 4
COLS = 8
ROWS = 8
ATLAS_W = COLS * CELL
ATLAS_H = ROWS * CELL
ATLAS_VERSION = 16

# 原有图标（从 tools/gen-assets.py 生成的 sprites.png 继承）
LEGACY_ICON_BOXES = {
    "enemy-boss": [796, 532, 256, 256],
    "ui-heart": [4, 796, 256, 256],
    "ui-pause": [532, 796, 256, 256],
    "ui-play": [796, 796, 256, 256],
}

# 本脚本自绘的新图标（按四档敌人与金币重做，不依赖旧图集）
NEW_ICONS = [
    "enemy-small", "enemy-normal", "enemy-elite", "ui-coin",
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
NORMAL_BEDSIDE_DIR = os.path.join(SRC_DIR, NORMAL_SPEC["sourceDir"])
WAR_SPEC = load_animation_spec("war")
WAR_CAT_DIR = os.path.join(SRC_DIR, WAR_SPEC["sourceDir"])
MAGE_SPEC = load_animation_spec("mage")
MAGE_DOG_DIR = os.path.join(SRC_DIR, MAGE_SPEC["sourceDir"])
HEALER_SPEC = load_animation_spec("healer")
HEALER_CAT_DIR = os.path.join(SRC_DIR, HEALER_SPEC["sourceDir"])
ELITE_SPEC = load_animation_spec("elite")
ELITE_SOFA_DIR = os.path.join(SRC_DIR, ELITE_SPEC["sourceDir"])
DEFEAT_SMOKE_DIR = os.path.join(SRC_DIR, "effects", "defeat-smoke")
DEFEAT_SMOKE = [
    os.path.join(DEFEAT_SMOKE_DIR, "vanish-smoke-01.png"),
    os.path.join(DEFEAT_SMOKE_DIR, "vanish-smoke-02.png"),
]
DEFEAT_SMOKE_SIZES = [CELL - 2 * PAD, CELL - 2 * PAD]
MAGE_FLIGHT_GIF = os.path.join(SRC_DIR, "effects", "mage-biscuit-flight", "mage-biscuit-flight-v1.gif")
MAGE_FLIGHT_TEXTURE = os.path.join(IMG_DIR, "mage-biscuit-flight.png")
MAGE_FLIGHT_CELL = 128
MAGE_FLIGHT_COLS = 4
MAGE_IMPACT_STRIP = os.path.join(SRC_DIR, "effects", "mage-biscuit-impact", "mage-biscuit-impact-v2.png")
MAGE_IMPACT_TEXTURE = os.path.join(IMG_DIR, "mage-biscuit-impact.png")
MAGE_IMPACT_CELL = 160
MAGE_IMPACT_COLS = 4
MAGE_IMPACT_FRAME = (96, 128)
MAGE_IMPACT_PAD = 16
MAGE_IMPACT_LEFT_EDGE_FADE = 26
MAGE_IMPACT_RIGHT_EDGE_FADE = 14
MAGE_IMPACT_ANCHOR = (80, 108)
MAGE_IMPACT_DRAW_SIZE = 150


# ─────────────────────────────────────────── 图像归一化
def fit_cell(img, size, anchor_bottom=True):
    """等比缩放到 size 内，返回 (图像, 左上偏移)"""
    r = min(size / img.width, size / img.height)
    nw, nh = max(1, int(round(img.width * r))), max(1, int(round(img.height * r)))
    im = img.resize((nw, nh), Image.LANCZOS)
    ox = (size - nw) // 2
    oy = size - nh if anchor_bottom else (size - nh) // 2
    return im, ox, oy


def fit_visible(img, size=CELL - 2 * PAD):
    """剔除透明画布噪点后等比收进一个图集单元格。"""
    # AI 图常在整张透明画布边缘遗留极淡像素；按可见阈值裁掉，
    # 否则 fit_cell 会把角色缩得过小。
    alpha = np.asarray(img)[:, :, 3]
    ys, xs = np.where(alpha >= 16)
    if len(xs) == 0:
        raise ValueError("射手猫背面动作源图为空")
    bbox = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    return fit_cell(img.crop(bbox), size)[0]


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


def tank_frame(name):
    """柴不破的背面待机、受击与仰面倒地帧。"""
    frame = TANK_SPEC["frames"][name]
    if "columns" in frame:
        return spec_sheet_frame(TANK_SPEC, TANK_DOG_DIR, name)
    return fit_visible(Image.open(os.path.join(TANK_DOG_DIR, frame["file"])).convert("RGBA"))


def lamp_frame(name):
    """台灯小怪动作表：统一从 3×2 透明精灵表取帧。"""
    return spec_sheet_frame(LAMP_SPEC, LAMP_DIR, name)


def normal_bedside_frame(name):
    """床头柜普通怪：读取已归一化的独立透明动作帧。"""
    frame = NORMAL_SPEC["frames"][name]
    img = Image.open(os.path.join(NORMAL_BEDSIDE_DIR, frame["file"])).convert("RGBA")
    rgba = np.asarray(img).copy()
    rgba[rgba[:, :, 3] < 128] = (0, 0, 0, 0)
    return fit_visible(Image.fromarray(rgba, "RGBA"))


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


def healer_frame(name):
    """奶糖喵背面三格动作表：移除透明边缘残点，统一以脚底为锚。"""
    frame = HEALER_SPEC["frames"][name]
    sheet = Image.open(os.path.join(HEALER_CAT_DIR, frame["file"])).convert("RGBA")
    width, height = sheet.size
    col = frame["index"] % frame["columns"]
    x0, x1 = col * width // frame["columns"], (col + 1) * width // frame["columns"]
    rgba = np.asarray(sheet.crop((x0, 0, x1, height))).copy()
    # 原图透明背景边缘有不足 80 alpha 的残点；不参与裁切，避免角色被缩小。
    # 新治疗帧的低透明像素属于法杖光晕，按动作规格保留。
    if frame.get("preserveAlpha", False):
        # 不按 alpha 阈值裁掉光晕，完整缩放后增加透明安全区。
        content = fit_cell(Image.fromarray(rgba), CELL - 2 * PAD - 12)[0]
        padded = Image.new("RGBA", (content.width + 12, content.height + 12))
        padded.alpha_composite(content, (6, 6))
        return padded
    rgba[rgba[:, :, 3] < 80] = (0, 0, 0, 0)
    return fit_visible(Image.fromarray(rgba, "RGBA"))


def elite_sofa_frame(name):
    """沙发精英的整体姿势：动作条或独立透明倒地源统一落入图集。"""
    frame = ELITE_SPEC["frames"][name]
    sheet = Image.open(os.path.join(ELITE_SOFA_DIR, frame["file"])).convert("RGBA")
    if "columns" not in frame:
        return fit_visible(sheet, 96)
    width, height = sheet.size
    col = frame["index"] % frame["columns"]
    x0, x1 = col * width // frame["columns"], (col + 1) * width // frame["columns"]
    # 精英帧收紧为 96px 有效边长以满足主包限制；Rig 用同倍数补回战场体量。
    return fit_visible(sheet.crop((x0, 0, x1, height)), 96)


def defeat_smoke(index):
    """通用两帧死亡烟雾：统一画布已含体积时序，装格时不得裁切放大。"""
    source = Image.open(DEFEAT_SMOKE[index]).convert("RGBA")
    return fit_cell(source, DEFEAT_SMOKE_SIZES[index])[0]


def make_glow(size=96):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = size / 2
    for i in range(size // 2, 0, -1):
        t = i / (size / 2)
        alpha = int(255 * (1 - t) ** 2.2)
        d.ellipse((c - i, c - i, c + i, c + i), fill=(255, 255, 255, alpha))
    return img


def mage_flight_texture():
    """把用户确认的 GIF 拆为共享锚点的透明 PNG 帧表，运行时逐格播放。"""
    source = Image.open(MAGE_FLIGHT_GIF)
    frames = []
    for index in range(source.n_frames):
        source.seek(index)
        frames.append(source.convert("RGBA").copy())
    alpha = np.maximum.reduce([np.asarray(frame)[:, :, 3] for frame in frames])
    ys, xs = np.where(alpha >= 16)
    if len(xs) == 0:
        raise ValueError("法师飞行 GIF 没有可见内容")
    # 所有帧共用同一个裁切与缩放，避免飞行时因逐帧裁切产生跳动。
    bbox = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    crop_w, crop_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    scale = min((MAGE_FLIGHT_CELL - 16) / crop_w, (MAGE_FLIGHT_CELL - 16) / crop_h)
    cols = MAGE_FLIGHT_COLS
    rows = math.ceil(len(frames) / cols)
    sheet = Image.new("RGBA", (cols * MAGE_FLIGHT_CELL, rows * MAGE_FLIGHT_CELL), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        crop = frame.crop(bbox)
        size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
        crop = crop.resize(size, Image.LANCZOS)
        col, row = index % cols, index // cols
        x = col * MAGE_FLIGHT_CELL + (MAGE_FLIGHT_CELL - crop.width) // 2
        y = row * MAGE_FLIGHT_CELL + (MAGE_FLIGHT_CELL - crop.height) // 2
        sheet.alpha_composite(crop, (x, y))
    sheet.save(MAGE_FLIGHT_TEXTURE, optimize=True, compress_level=9)
    return {
        "src": "res/Image/mage-biscuit-flight.png?v=1",
        "texW": sheet.width,
        "texH": sheet.height,
        "cell": MAGE_FLIGHT_CELL,
        "cols": cols,
        "frames": len(frames),
        "frameMs": source.info.get("duration", 80),
    }


def fade_frame_edges(frame, left=MAGE_IMPACT_LEFT_EDGE_FADE, right=MAGE_IMPACT_RIGHT_EDGE_FADE):
    """把横向拼接图的硬边融为透明，避免烟尘在帧边界被截成直线。"""
    mask = Image.new("L", frame.size, 255)
    draw = ImageDraw.Draw(mask)
    for offset in range(left):
        alpha = int(255 * offset / left)
        draw.line((offset, 0, offset, frame.height), fill=alpha)
    for offset in range(right):
        alpha = int(255 * offset / right)
        draw.line((frame.width - 1 - offset, 0, frame.width - 1 - offset, frame.height), fill=alpha)
    frame.putalpha(ImageChops.multiply(frame.getchannel("A"), mask))
    return frame


def mage_impact_texture():
    """切分四段落地序列，保留安全边并以同一落地点对齐所有帧。"""
    source = Image.open(MAGE_IMPACT_STRIP).convert("RGBA")
    cols = MAGE_IMPACT_COLS
    if source.width % cols:
        raise ValueError("法师落地序列宽度必须能被四段整除")
    panel_w = source.width // cols
    sheet = Image.new("RGBA", (cols * MAGE_IMPACT_CELL, MAGE_IMPACT_CELL), (0, 0, 0, 0))
    # ── 拼接源安全区 ─────────────────────────────────────────────
    # 源图并非四张独立 PNG，烟尘和外发光压在横向分格边缘。
    # 先在内容区将硬边渐隐，再放进带透明边距的公共画布；不可逐帧追踪重心。
    for index in range(cols):
        panel = source.crop((index * panel_w, 0, (index + 1) * panel_w, source.height))
        frame = panel.resize(MAGE_IMPACT_FRAME, Image.LANCZOS)
        frame = fade_frame_edges(frame)
        x = index * MAGE_IMPACT_CELL + (MAGE_IMPACT_CELL - frame.width) // 2
        sheet.alpha_composite(frame, (x, MAGE_IMPACT_PAD))
    sheet.save(MAGE_IMPACT_TEXTURE, optimize=True, compress_level=9)
    return {
        "src": "res/Image/mage-biscuit-impact.png?v=10",
        "texW": sheet.width,
        "texH": sheet.height,
        "cell": MAGE_IMPACT_CELL,
        "cols": cols,
        "frames": cols,
        "timeline": [0, 0.08, 0.28, 0.44],
        "duration": 0.60,
        "anchor": list(MAGE_IMPACT_ANCHOR),
        "drawSize": MAGE_IMPACT_DRAW_SIZE,
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


NEW_BUILDERS = {
    "enemy-small": lambda: icon_enemy("small"),
    "enemy-normal": lambda: icon_enemy("normal"),
    "enemy-elite": lambda: icon_enemy("elite"),
    "ui-coin": icon_coin,
}


def build():
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

    def cell(name, img):
        """自动分配格位，统一居中放置。"""
        if name in table:
            raise ValueError("图集帧重复: " + name)
        col, row = next_cell()
        dx = (CELL - 2 * PAD - img.width) // 2 + PAD
        dy = (CELL - 2 * PAD - img.height) // 2 + PAD
        atlas.alpha_composite(img, (col * CELL + dx, row * CELL + dy))
        table[name] = [col * CELL + PAD, row * CELL + PAD, CELL - 2 * PAD, CELL - 2 * PAD]

    cell("fx-glow", make_glow())
    cell("fx-slash", make_slash())
    cell("fx-smoke", defeat_smoke(0))
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

    # 柴不破：背面待机、受击与晕倒均为完整姿势帧。
    cell(TANK_SPEC["frames"]["idle"]["icon"], tank_frame("idle"))
    cell(TANK_SPEC["frames"]["hurt"]["icon"], tank_frame("hurt"))
    cell(TANK_SPEC["frames"]["defeat"]["icon"], tank_frame("defeat"))

    # 台灯小怪：待机、跳步、灯罩蓄力 / 撞击、受击、侧翻倒地。
    for frame_name, frame in LAMP_SPEC["frames"].items():
        cell(frame["icon"], lamp_frame(frame_name))

    # 床头柜普通怪：待机、缩小跳步、双拳蓄力 / 撞击与仰倒。
    for frame_name, frame in NORMAL_SPEC["frames"].items():
        cell(frame["icon"], normal_bedside_frame(frame_name))

    # 近战猫：正背朝向分别提供待机、走步、挥锤、受击和倒地姿势。
    for frame_name, frame in WAR_SPEC["frames"].items():
        cell(frame["icon"], war_frame(frame_name))

    # 哈利边牧：固定背面，蓄能、释放与收势由同一法术攻击时间线驱动。
    for frame_name, frame in MAGE_SPEC["frames"].items():
        cell(frame["icon"], mage_frame(frame_name))

    # 奶糖喵：固定背面，动作表依次为待机、治疗与受击。
    for frame_name, frame in HEALER_SPEC["frames"].items():
        cell(frame["icon"], healer_frame(frame_name))

    # 沙发精英：以整体姿势帧表达蓄力、震击与回弹，不混用旧红色沙发素材。
    for frame_name, frame in ELITE_SPEC["frames"].items():
        cell(frame["icon"], elite_sofa_frame(frame_name))

    # 继承旧图标
    legacy_src = os.path.join(SRC_DIR, "sprites-legacy.png")
    old = Image.open(legacy_src).convert("RGBA") if os.path.exists(legacy_src) else None
    if old is not None:
        for name, box in LEGACY_ICON_BOXES.items():
            im = old.crop((box[0], box[1], box[0] + box[2], box[1] + box[3]))
            im = im.resize((CELL - 2 * PAD, CELL - 2 * PAD), Image.LANCZOS)
            cell(name, im)

    # WebGL 上传时还原 RGBA；索引图集为主包留出新增角色余量。
    atlas.quantize(colors=256, method=Image.Quantize.FASTOCTREE).save(
        os.path.join(IMG_DIR, "game.png"), optimize=True, compress_level=9
    )

    data = {
        # 图集替换后必须使 H5 和真机重新取纹理，避免沿用同名旧缓存。
        "src": f"res/Image/game.png?v={ATLAS_VERSION}",
        "texW": ATLAS_W,
        "texH": ATLAS_H,
        "cell": CELL,
        "pad": PAD,
        "icons": table,
        "anchors": {},
        "cellFull": [CELL - 2 * PAD, CELL - 2 * PAD],
    }
    return data


def write_rigs(atlas_data, mage_flight, mage_impact):
    src = os.path.join(DATA_DIR, "rigs.js")
    with open(src, "w", encoding="utf-8") as f:
        f.write("/* 由 tools/gen-shiba-atlas.py 生成，请勿手改 */\n")
        f.write("(function () {\n  var A = window.AIGCUtils = window.AIGCUtils || {};\n")
        f.write("  A.GameAtlas = " + json.dumps(atlas_data, ensure_ascii=False,
                                            separators=(",", ":")) + ";\n")
        f.write("  A.MageFlight = " + json.dumps(mage_flight, ensure_ascii=False,
                                                    separators=(",", ":")) + ";\n")
        f.write("  A.MageImpact = " + json.dumps(mage_impact, ensure_ascii=False,
                                                    separators=(",", ":")) + ";\n")
        f.write("})();\n")
    return src


def write_character_animations():
    """把离线动作规格中运行时需要的字段导出给 Rig 定义。"""
    runtime = {}
    for spec in (ARCHER_SPEC, TANK_SPEC, LAMP_SPEC, NORMAL_SPEC, WAR_SPEC, MAGE_SPEC, HEALER_SPEC, ELITE_SPEC):
        runtime[spec["id"]] = {
            "frames": {name: frame["icon"] for name, frame in spec["frames"].items()},
            "states": spec["states"],
            "frameTransforms": spec.get("frameTransforms", {}),
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
    mage_flight = mage_flight_texture()
    mage_impact = mage_impact_texture()
    rigs_path = write_rigs(data, mage_flight, mage_impact)
    spec_path = write_character_animations()
    print(json.dumps({"atlas": data["src"], "cells": len(data["icons"]), "mageFlight": mage_flight["src"], "mageImpact": mage_impact["src"],
                      "rigs": os.path.relpath(rigs_path, ROOT),
                      "animations": os.path.relpath(spec_path, ROOT)}, ensure_ascii=False))
