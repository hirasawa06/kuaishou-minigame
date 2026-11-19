"""决定：收藏册静态素材，复用已有英雄立绘，不修改战斗动作。"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "package/res/Image"
SOURCE = ROOT / "tools/src/collection"
HEROES = [
    # --- id、附件、正面所在列、主体顶部和脚底（原图高度比例） ---
    ("tank", "柴不破三视图.png", 0, 0.080, 0.860),
    ("war", "锤锤喵三视图.png", 0, 0.225, 0.900),
    ("arch", "镭射喵三视图.png", 0, 0.195, 0.838),
    ("mage", "哈利边牧三视图.png", 0, 0.075, 0.910),
    ("healer", "奶糖猫三视图.png", 2, 0.165, 0.855),
]


def import_heroes(directory):
    records = []
    SOURCE.mkdir(parents=True, exist_ok=True)
    for hero_id, filename, column, top, feet in HEROES:
        path = Path(directory) / filename
        with Image.open(path) as image:
            image.save(SOURCE / (hero_id + "-views.png"))
            width, height = image.size
            right = 0.40 if hero_id == 'mage' else (column + 1) / 3
            crop = (round(width * column / 3), 0, round(width * right), height)
            image.crop(crop).save(SOURCE / (hero_id + "-front.png"))
        records.append({"id": hero_id, "source": filename, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                        "crop": crop, "bodyTop": round(top * height), "feetY": round(feet * height),
                        "basis": "正面耳/头顶至脚底，不含武器光晕；人工标定，叠图复核"})
    (SOURCE / "front-sources.json").write_text(json.dumps({"status": "决定：用户2026-11-18提供，收藏页静态使用",
        "targetBodyHeight": 176, "targetFeetY": 216, "items": records}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def front_portrait(record):
    with Image.open(SOURCE / (record["id"] + "-front.png")) as source:
        portrait = source.convert("RGBA")
    bounds = portrait.getchannel("A").getbbox()
    scale = 176 / (record["feetY"] - record["bodyTop"])
    image = portrait.crop(bounds)
    image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (256, 256))
    x = (256 - image.width) // 2
    y = round(216 + (bounds[1] - record["feetY"]) * scale)
    if x < 4 or y < 4 or x + image.width > 252 or y + image.height > 252:
        raise ValueError(record["id"] + "：完整立绘超出安全边，需重新标定")
    canvas.paste(image, (x, y))
    return canvas


def build(background):
    # --- 用户背景按竖屏比例缩放，运行版本使用不透明 JPG ---
    with Image.open(background) as source:
        image = source.convert("RGB")
        archive = ROOT / "tools/src/collection"
        archive.mkdir(parents=True, exist_ok=True)
        image.save(archive / "book-background.png")
        image.thumbnail((900, 1800), Image.Resampling.LANCZOS)
        image.save(OUT / "collection-book.jpg", quality=92, subsampling=0)
    atlas = Image.new("RGBA", (1280, 768))
    records = json.loads((SOURCE / "front-sources.json").read_text(encoding="utf-8"))["items"]
    review = Image.new("RGBA", (1280, 320), "#ebcfa5")
    for column, record in enumerate(records):
        portrait = front_portrait(record)
        atlas.paste(portrait, (column * 256, 0))
        review.alpha_composite(portrait, (column * 256, 24))
        silhouette = Image.new("RGBA", portrait.size, "#b7a08a")
        silhouette.putalpha(portrait.getchannel("A"))
        atlas.paste(silhouette, (column * 256, 256))
    ImageDraw.Draw(review).line((0, 240, 1280, 240), fill="#b35d39", width=1)
    review.save(SOURCE / "front-size-review.png")
    # --- 锁头保留在第三行，已解锁卡片不再显示星章 ---
    draw = ImageDraw.Draw(atlas)
    draw.rounded_rectangle((576, 554, 704, 696), radius=58, outline="#fff0ce", width=24)
    draw.rounded_rectangle((560, 618, 720, 739), radius=28, fill="#fff0ce", outline="#cfad81", width=4)
    draw.ellipse((626, 650, 654, 678), fill="#96704c")
    draw.rounded_rectangle((634, 665, 646, 700), radius=5, fill="#96704c")
    atlas.quantize(colors=256, method=Image.Quantize.FASTOCTREE).save(OUT / "collection-art.png", optimize=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--background", required=True)
    parser.add_argument("--import-directory")
    args = parser.parse_args()
    if args.import_directory:
        import_heroes(args.import_directory)
    build(args.background)
