"""制作工具：将用户确认的收藏锁导出为透明运行图，并保留制作源。"""
import argparse
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tools/src/ui/icons/collection-lock.png"
OUTPUT = ROOT / "package/res/Image/ui/icons/collection-lock-v1.png"


def build(source):
    # ── 保留原图；按透明主体裁边，确保显示尺寸不受留白影响 ──
    with Image.open(source) as original:
        image = original.convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    if not bounds:
        raise ValueError("锁图标没有可见主体")
    SOURCE.parent.mkdir(parents=True, exist_ok=True)
    image.save(SOURCE)
    icon = image.crop(bounds)
    icon.thumbnail((256, 256), Image.Resampling.LANCZOS)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    icon.save(OUTPUT, optimize=True)
    print(f"收藏锁：{icon.width}×{icon.height}，{OUTPUT.stat().st_size}字节")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE)
    build(parser.parse_args().source)
