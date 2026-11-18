#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""现状/待验证：复用正式角色美术生成个人资料头像，不调用生图。

输出：package/res/Image/avatars.png（3×3，792×792，真实 RGBA）
      package/gameplay/data/avatars.js（兼容原 id/name/color 元数据）

四个英雄取现有正面独立图，奶糖喵取收藏图集的一星正面格；
家具和首领取运行时 GameAtlas 对应待机/身份帧。首领保持游戏实际
使用的粉色王冠怪，不用未接入的钟表或不对应身份的职业图标。
固定 portrait 矩形只用于静态头像取景，不是动作归一化：不覆盖原稿、
不修改动作尺寸/脚底锚点、不按每帧裁边填格、不删除低 alpha 像素。
头像透明底框仍由 UI 绘制；图集框内留安全边，等比缩放并保留 alpha。
"""

import json
from pathlib import Path
import re

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PKG = ROOT / "package"
OUT_DIR = PKG / "res" / "Image"
DATA_DIR = PKG / "gameplay" / "data"

S = 128
SCALE = 2
DRAW_SIZE = S * SCALE
CELL = DRAW_SIZE + 8
GRID = 3
PAD = 12

# portrait 是源帧内固定的 [left, top, right, bottom] 像素取景。
# 只裁去下身以提高小尺寸头像的面部可读性，耳朵/头盔保留完整。
AVATARS = [
    {"id": "av-tank", "name": "柴不破", "color": "#f4be60",
     "src": "res/Image/shield-dog-front.png", "portrait": [45, 45, 425, 340]},
    {"id": "av-war", "name": "锤锤喵", "color": "#b7a4b4",
     "src": "res/Image/melee-cat-front.png", "portrait": [20, 10, 465, 365]},
    {"id": "av-arch", "name": "镭射喵", "color": "#eeb05d",
     "src": "res/Image/archer-cat-front.png", "portrait": [65, 55, 425, 370]},
    {"id": "av-mage", "name": "哈利边牧", "color": "#aa795d",
     "src": "res/Image/mage-dog-front.png", "portrait": [30, 10, 443, 335]},
    {"id": "av-healer", "name": "奶糖喵", "color": "#a8c9aa",
     "src": "res/Image/hero-levels.png", "frame": [800, 0, 200, 200],
     "portrait": [12, 5, 190, 155]},
    {"id": "av-lamp", "name": "台灯怪", "color": "#efb457",
     "sprite": "lamp-idle", "portrait": [10, 0, 110, 102]},
    {"id": "av-bedside", "name": "床头柜怪", "color": "#d4ad79",
     "sprite": "bedside-idle"},
    {"id": "av-sofa", "name": "沙发精英", "color": "#c58bbd",
     "sprite": "sofa-idle"},
    {"id": "av-boss", "name": "首领", "color": "#e05a8a",
     "sprite": "enemy-boss"},
]


def load_game_atlas():
    """读取生成数据而非硬编码格位，GameAtlas 重排后仍可重复生成。"""
    text = (DATA_DIR / "rigs.js").read_text(encoding="utf-8")
    match = re.search(r"A\.GameAtlas\s*=\s*(\{[^\n]+\});", text)
    if not match:
        raise ValueError("rigs.js 中找不到 GameAtlas 元数据")
    return json.loads(match.group(1))


def crop_rect(image, rect, label):
    left, top, right, bottom = rect
    if not (0 <= left < right <= image.width and 0 <= top < bottom <= image.height):
        raise ValueError("取景越出源帧: " + label)
    return image.crop((left, top, right, bottom))


def read_portrait(item, game_atlas):
    if "sprite" in item:
        name = item["sprite"]
        if name not in game_atlas["icons"]:
            raise ValueError("缺少正式角色帧: " + name)
        src = game_atlas["src"].split("?", 1)[0]
        frame = game_atlas["icons"][name]
    else:
        src = item["src"]
        frame = item.get("frame")
    with Image.open(PKG / src) as source:
        # 调色板 PNG 的 transparency 也转为真实 alpha，不依据黑底去背。
        image = source.convert("RGBA")
    if frame:
        x, y, w, h = frame
        image = crop_rect(image, [x, y, x + w, y + h], item["id"])
    if "portrait" in item:
        image = crop_rect(image, item["portrait"], item["id"])
    alpha = image.getchannel("A")
    if alpha.getbbox() is None or alpha.getextrema()[0] == 255:
        raise ValueError("源头像缺少真实透明像素: " + item["id"])
    return image


def build_sheet(out_png):
    if not 0 < len(AVATARS) <= GRID * GRID:
        raise ValueError("头像数超过 3×3 容量")
    game_atlas = load_game_atlas()
    atlas = Image.new("RGBA", (GRID * CELL, GRID * CELL), (0, 0, 0, 0))
    frames = {}
    for i, item in enumerate(AVATARS):
        portrait = read_portrait(item, game_atlas)
        limit = DRAW_SIZE - PAD * 2
        scale = min(limit / portrait.width, limit / portrait.height)
        size = (max(1, round(portrait.width * scale)),
                max(1, round(portrait.height * scale)))
        portrait = portrait.resize(size, Image.Resampling.LANCZOS)
        x, y = (i % GRID) * CELL + 4, (i // GRID) * CELL + 4
        # alpha_composite 保留原始半透明边缘；paste(img, mask=img) 会平方 alpha。
        atlas.alpha_composite(portrait, (x + (DRAW_SIZE - size[0]) // 2,
                                         y + (DRAW_SIZE - size[1]) // 2))
        frames[item["id"]] = [x, y, DRAW_SIZE, DRAW_SIZE]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    atlas.save(out_png, optimize=True)
    return {
        "src": "res/Image/avatars.png", "texW": atlas.width, "texH": atlas.height,
        "grid": GRID, "size": S, "frames": frames,
        "items": [{key: item[key] for key in ("id", "name", "color")} for item in AVATARS],
    }


def main():
    meta = build_sheet(OUT_DIR / "avatars.png")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with (DATA_DIR / "avatars.js").open("w", encoding="utf-8") as f:
        f.write("/* 由 tools/gen-profile-art.py 生成，请勿手改；复用正式角色/怪物美术 */\n")
        f.write("(function () {\n  var A = window.AIGCUtils = window.AIGCUtils || {};\n")
        f.write("  A.AvatarAtlas = " + json.dumps(meta, ensure_ascii=False,
                                               separators=(",", ":")) + ";\n})();\n")
    print("头像图集:", len(meta["items"]), "个，", meta["texW"], "x", meta["texH"])


if __name__ == "__main__":
    main()
