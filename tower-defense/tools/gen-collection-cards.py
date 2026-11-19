"""决定：用户场景立绘制作金色收藏卡；原图按角色归档，战斗素材不变。"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "package/res/Image/outgame/collection/scenes-figma-263-161-hd"
CHARACTERS = ROOT / "tools/src/characters/角色"
ITEMS = [("tank", "柴不破", "柴不破"), ("war", "锤锤喵", "近战猫"),
         ("mage", "哈利边牧", "法师狗"), ("arch", "镭射喵", "射手猫"),
         ("healer", "奶糖喵", "奶糖喵")]
SCALE = 2
W, H = 330 * SCALE, 502 * SCALE
PHOTO_HEIGHT = round(H * 1.005)
PHOTO_X_ANCHOR = 0.82


def photo_layer(image):
    # ┌─ Figma 参考图：整张场景图按高度缩放，横向向左偏移保留右侧武器 ─┐
    height = PHOTO_HEIGHT
    width = round(image.width * height / image.height)
    photo = image.convert("RGBA").resize((width, height), Image.Resampling.LANCZOS)
    layer = Image.new("RGBA", (W, H))
    layer.alpha_composite(photo, (round((W - width) * PHOTO_X_ANCHOR), -1))
    return layer


def scene(image):
    # ┌─ 运行时只保存角色场景；容器由 WebGL 代码绘制，不再烘焙整卡 ─┐
    return photo_layer(image).convert("RGB")


def build(directory):
    OUT.mkdir(parents=True, exist_ok=True)
    review = Image.new("RGB", (W * 5, H), "#f3e4ca")
    font = ImageFont.truetype(str(ROOT / "tools/fonts/AlimamaFangYuanTiVF.ttf"), 42 * SCALE)
    font.set_variation_by_axes([700, 100])
    records = []
    for index, (hero_id, name, folder) in enumerate(ITEMS):
        archive = CHARACTERS / folder / "收藏立绘"
        archive.mkdir(parents=True, exist_ok=True)
        source_path = Path(directory) / (name + ".png") if directory else archive / (name + "-场景立绘.png")
        with Image.open(source_path) as source:
            source.load()
            if directory:
                source.save(archive / (name + "-场景立绘.png"))
            output = scene(source)
        output.save(OUT / (hero_id + ".jpg"), quality=93, subsampling=0, optimize=True)
        output.save(archive / (name + "-收藏卡底图.png"))
        ImageDraw.Draw(output).text((W / 2, H * 0.88), name, anchor="mm", font=font, fill="#592600")
        review.paste(output, (index * W, 0))
        records.append({"id": hero_id, "name": name, "source": str(source_path),
                        "figmaNode": "263:161",
                        "sha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
                        "archive": str(archive.relative_to(ROOT)),
                        "runtime": "res/Image/outgame/collection/scenes-figma-263-161-hd/" + hero_id + ".jpg"})
    source_dir = ROOT / "tools/src/collection"
    review.save(source_dir / "scene-cards-review.jpg", quality=95)
    (source_dir / "scene-card-sources.json").write_text(json.dumps({"status": "决定：用户2026-11-18提供，仅收藏卡",
        "size": [W, H], "cropNormalized": [0.04, 0.09, 0.98, 0.87], "items": records}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--import-directory")
    build(parser.parse_args().import_directory)
