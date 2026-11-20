#!/usr/bin/env python3
"""将用户提供的战斗 UI 切图复制到规范化运行目录。"""
from pathlib import Path
from shutil import copy2
import argparse
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
MAP = {
    "tools/src/ui/battle/tray-source.png": "package/res/Image/ui/components/battle/tray-v1.png",
    "tools/src/ui/battle/refresh-source.png": "package/res/Image/ui/components/battle/refresh-v1.png",
    "tools/src/ui/battle/expand-source.png": "package/res/Image/ui/components/battle/expand-v1.png",
    "tools/src/ui/battle/paw-token-source.png": "package/res/Image/ui/icons/battle/paw-token-v1.png",
    "tools/src/ui/battle/lock-closed-source.png": "package/res/Image/ui/icons/battle/lock-closed-v1.png",
    "tools/src/ui/battle/lock-open-source.png": "package/res/Image/ui/icons/battle/lock-open-v1.png",
    "tools/src/characters/battle-shop/tank-source.png": "package/res/Image/ingame/characters/battle-shop/tank-v2.png",
    "tools/src/characters/battle-shop/war-source.png": "package/res/Image/ingame/characters/battle-shop/war-v2.png",
    "tools/src/characters/battle-shop/mage-source.png": "package/res/Image/ingame/characters/battle-shop/mage-v2.png",
    "tools/src/characters/battle-shop/arch-source.png": "package/res/Image/ingame/characters/battle-shop/arch-v2.png",
    "tools/src/characters/battle-shop/healer-source.png": "package/res/Image/ingame/characters/battle-shop/healer-v2.png",
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--white-bone", type=Path)
    parser.add_argument("--character-dir", type=Path)
    args = parser.parse_args()
    # ── 可重新导入原始339px附件，避免归档源已被旧流程压缩 ──
    filenames = {"tank": "柴不破正面.png", "war": "锤锤喵正面.png",
                 "mage": "哈利汪正面.png", "arch": "镭射喵正面.png",
                 "healer": "奶糖喵正面.png"}
    if args.character_dir:
        for hero, filename in filenames.items():
            copy2(args.character_dir / filename,
                  ROOT / f"tools/src/characters/battle-shop/{hero}-source.png")
    for source, output in MAP.items():
        destination = ROOT / output
        destination.parent.mkdir(parents=True, exist_ok=True)
        copy2(ROOT / source, destination)
        if "characters/battle-shop/" in output:
            with Image.open(destination) as original:
                portrait = original.convert("RGBA")
            # ── 保留339px源图清晰度，不再先缩到113px后放大取景 ──
            portrait.thumbnail((339, 339), Image.Resampling.LANCZOS)
            portrait.save(destination, optimize=True)
    if args.white_bone:
        source = ROOT / "tools/src/ui/battle/white-bone-source.png"
        copy2(args.white_bone, source)
    else:
        source = ROOT / "tools/src/ui/battle/white-bone-source.png"
    destination = ROOT / "package/res/Image/ui/icons/battle/white-bone-v1.png"
    copy2(source, destination)
    # ── 四角星使用透明小图，按高分辨率绘制后缩小抗锯齿 ──
    star = Image.new("RGBA", (128, 128))
    ImageDraw.Draw(star).polygon([(64, 4), (82, 46), (124, 64), (82, 82),
                                 (64, 124), (46, 82), (4, 64), (46, 46)], fill="#fff5cc")
    star.resize((32, 32), Image.Resampling.LANCZOS).save(
        ROOT / "package/res/Image/ui/icons/battle/star-v1.png")


if __name__ == "__main__":
    main()
