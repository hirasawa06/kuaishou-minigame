"""现状：从用户 part2 素材包构建战斗地图与守卫物，原图归档可重建。"""
from pathlib import Path
from shutil import copy2
import argparse
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MAPS = {"grass": "草地", "carpet": "地毯", "wood": "木地板",
        "dining": "餐厅", "corridor": "走廊"}
VERSIONS = {"food": 2, "toy": 2}
PROPS = {"bed": "窝", "food": "粮", "toy": "玩具", "photo": "合照"}


def build(group, names, source_dir):
    archive = ROOT / "tools/src/ingame" / group
    output = ROOT / "package/subpackages/battle-art/res/Image/ingame" / group
    archive.mkdir(parents=True, exist_ok=True)
    output.mkdir(parents=True, exist_ok=True)
    for key, name in names.items():
        source = archive / (key + ".png")
        if source_dir:
            copy2(source_dir / (name + ".png"), source)
        with Image.open(source) as image:
            if group == "maps":
                image.convert("RGB").save(output / (key + "-v1.jpg"), quality=92)
            else:
                image.convert("RGBA").save(output / (key + "-v" + str(VERSIONS.get(key, 1)) + ".png"), optimize=True)
        print(key, image.size)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path)
    parser.add_argument("--group", choices=("guardians", "maps", "all"),
                        default="guardians", help="默认仅构建守卫，地图需显式选择")
    args = parser.parse_args()
    groups = {"maps": MAPS, "guardians": PROPS}
    selected = groups if args.group == "all" else {args.group: groups[args.group]}
    for group, names in selected.items():
        build(group, names, args.source_dir)


if __name__ == "__main__":
    main()
