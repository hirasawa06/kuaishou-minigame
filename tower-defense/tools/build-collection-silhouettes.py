#!/usr/bin/env python3
"""生成收藏册锁定态角色剪影运行图；源图不覆盖。"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tools/src/collection/silhouettes"
OUTPUT = ROOT / "package/res/Image/outgame/collection/silhouettes"
ITEMS = ("tank", "war", "mage", "arch", "healer")
SIZE = 512
COLOR = (0xB6, 0xB6, 0xB6)


def build(hero_id):
    source = SOURCE / f"{hero_id}-source.png"
    with Image.open(source) as raw:
        image = raw.convert("RGBA")
    if image.getchannel("A").getbbox() is None:
        raise ValueError(f"{source} 缺少可见的透明剪影主体")
    image.thumbnail((SIZE, SIZE), Image.Resampling.LANCZOS)
    alpha = image.getchannel("A")
    image = Image.new("RGBA", image.size, COLOR)
    image.putalpha(alpha)
    output = Image.new("RGBA", (SIZE, SIZE))
    output.alpha_composite(image, ((SIZE - image.width) // 2, (SIZE - image.height) // 2))
    output.save(OUTPUT / f"{hero_id}-silhouette-b6.png", optimize=True)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for hero_id in ITEMS:
        build(hero_id)


if __name__ == "__main__":
    main()
