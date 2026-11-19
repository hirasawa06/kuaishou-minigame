#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""头像图集生成器。首次用 --import-dir 导入用户图片，之后直接运行重建。"""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "tools/src/avatars"
MENU = ROOT / "package/res/Image/outgame/avatars"
DATA = ROOT / "package/gameplay/data"
SIZE = 256
CELL = SIZE + 8

# --- 固定九宫格顺序：旧 ID 与索引保留，兼容已保存的选择 ---
# 原图编号、旧 ID、名称、方形裁切范围（左、上、右、下）
AVATARS = [
    (5, "av-cat-orange", "哈利边牧", (260, 280, 820, 840)),
    (6, "av-bear-cream", "柴不破", (260, 250, 860, 850)),
    (7, "av-rabbit-pink", "锤锤喵", (390, 250, 940, 800)),
    (8, "av-cat-gray", "镭射喵", (200, 220, 800, 820)),
    (9, "av-dog-brown", "奶糖喵", (210, 240, 810, 840)),
    (16, "av-fox-red", "台灯小怪", (220, 150, 870, 800)),
    (18, "av-cat-blue", "床头柜怪", (240, 450, 870, 1080)),
    (20, "av-dog-yellow", "冰箱Boss", (180, 280, 850, 950)),
    (21, "av-cat-green", "沙发精英", (210, 230, 930, 950)),
]


def source_path(index, aid):
    group = "allies" if index < 5 else "enemies"
    return SOURCE / group / (aid + ".png")


def import_source(directory):
    records = []
    for index, (number, aid, name, crop) in enumerate(AVATARS):
        original = directory / ("image " + str(number) + ".png")
        with Image.open(original) as image:
            portrait = image.convert("RGB").crop(crop)
            portrait = portrait.resize((512, 512), Image.Resampling.LANCZOS)
        target = source_path(index, aid)
        target.parent.mkdir(parents=True, exist_ok=True)
        portrait.save(target)
        records.append({"id": aid, "name": name, "source": original.name,
                        "sha256": hashlib.sha256(original.read_bytes()).hexdigest(),
                        "crop": crop, "derived": str(target.relative_to(SOURCE))})
    (SOURCE / "sources.json").write_text(json.dumps({"origin": "用户提供，2026-11-18",
        "status": "决定：按附件顺序替换九宫格头像", "items": records},
        ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def rounded_portrait(path, radius):
    with Image.open(path) as source:
        image = source.convert("RGBA").resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), radius=radius, fill=255)
    image.putalpha(mask)
    return image


def build_sheet(radius=32, filename="avatars-fill.png"):
    atlas = Image.new("RGBA", (CELL * 3, CELL * 3))
    frames, items = {}, []
    for index, (_, aid, name, _) in enumerate(AVATARS):
        image = rounded_portrait(source_path(index, aid), radius)
        x, y = (index % 3) * CELL + 4, (index // 3) * CELL + 4
        atlas.paste(image, (x, y))
        frames[aid] = [x, y, SIZE, SIZE]
        items.append({"id": aid, "name": name, "color": "#e5b688"})
    MENU.mkdir(parents=True, exist_ok=True)
    atlas.quantize(colors=256, method=Image.Quantize.FASTOCTREE).save(
        MENU / filename, optimize=True)
    (ROOT / "package/res/Menu/avatars.png").unlink(missing_ok=True)
    return {"src": "res/Image/outgame/avatars/" + filename, "texW": CELL * 3, "texH": CELL * 3,
            "grid": 3, "size": 128, "frames": frames, "items": items}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--import-dir", type=Path)
    args = parser.parse_args()
    if args.import_dir:
        import_source(args.import_dir)
    meta = build_sheet()
    # --- 首页图片标准边长66，12设计像素圆角独立制作 ---
    home = build_sheet(SIZE * 12 / 66, "avatars-home-r12.png")
    DATA.mkdir(parents=True, exist_ok=True)
    body = json.dumps(meta, ensure_ascii=False, separators=(",", ":"))
    home_body = json.dumps(home, ensure_ascii=False, separators=(",", ":"))
    (DATA / "avatars.js").write_text("/* 由 tools/gen-profile-art.py 生成，请勿手改 */\n"
        "(function () {\n  var A = window.AIGCUtils = window.AIGCUtils || {};\n"
        "  A.AvatarAtlas = " + body + ";\n"
        "  A.HomeAvatarAtlas = " + home_body + ";\n})();\n", encoding="utf-8")
    print("头像图集：9 个，792 x 792")


if __name__ == "__main__":
    main()
