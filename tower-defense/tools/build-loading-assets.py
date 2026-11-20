"""加载页素材构建：保留用户原图比例，生成参考图的黄色放射背景。"""
from pathlib import Path
import argparse
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]


def build(source):
    output = ROOT / "package/res/Image/ui/loading"
    output.mkdir(parents=True, exist_ok=True)
    for filename, name, size in [("image 30.png", "logo-v1.png", (640, 220)),
                                 ("image 67.png", "biscuit-v1.png", (256, 256))]:
        with Image.open(source / filename) as original:
            image = original.convert("RGBA")
            image = image.crop(image.getchannel("A").getbbox())
            image.thumbnail(size, Image.Resampling.LANCZOS)
            image.save(output / name, optimize=True)
    background = Image.new("RGB", (780, 1690), "#ffd000")
    draw = ImageDraw.Draw(background)
    # ── 参考图上方的放射色块，背景可以延伸至屏幕安全区 ──
    for points in [[(390, 380), (0, 100), (0, 250)],
                   [(390, 380), (0, 0), (0, 100)],
                   [(390, 380), (595, 0), (780, 0)],
                   [(390, 380), (780, 140), (780, 210)]]:
        draw.polygon(points, fill="#ffc000")
    background.save(output / "background-v1.png", optimize=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    build(parser.parse_args().source)
