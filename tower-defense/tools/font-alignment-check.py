"""校验混排中线并使用实际运行字形生成对照样张。"""
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / "package/gameplay/data/font-atlas.js").read_text()
atlas = json.loads(source.split("A.FontAtlas = ", 1)[1].split(";", 1)[0])


def center(glyph):
    return glyph["oy"] + glyph["h"] / 4


def render(canvas, text, x, y, size, before=False):
    font = atlas[str(size)]
    for char in text:
        glyph = font["glyphs"][char]
        if glyph["w"]:
            page = font["pages"][glyph.get("page", 0)]
            sheet = Image.open(ROOT / "package" / page["src"]).convert("RGBA")
            box = (glyph["x"], glyph["y"], glyph["x"] + glyph["w"], glyph["y"] + glyph["h"])
            image = sheet.crop(box)
            image = image.resize((round(glyph["w"] / 2), round(glyph["h"] / 2)))
            alpha = image.getchannel("A")
            ink = Image.new("RGBA", image.size, "#73482a")
            ink.putalpha(alpha)
            # --- 旧版数字中线误差，由原字体实际度量复现 ---
            old_offset = {18: 2, 28: 4, 48: 6}[size] if before and ord(char) < 128 else 0
            canvas.paste(ink, (round(x + glyph["ox"]), round(y + glyph["oy"] + old_offset)), ink)
        x += glyph["adv"]


for size, font in atlas.items():
    digit_center = sum(center(font["glyphs"][c]) for c in "0123456789") / 10
    delta = abs(digit_center - center(font["glyphs"]["国"]))
    assert delta <= 0.75, (size, delta)
    assert all(p["texW"] <= 2048 and p["texH"] <= 2048 for p in font["pages"])
    print(size, "字号中线误差", round(delta, 2), "px")

canvas = Image.new("RGB", (1000, 330), "#fff0de")
draw = ImageDraw.Draw(canvas)
for row, (text, size) in enumerate([("版本 1.0.0", 18), ("金币 30", 28), ("刷新 2  扩建 +1 15", 28)]):
    y = 28 + row * 100
    render(canvas, text, 35, y, size, True)
    render(canvas, text, 530, y, size)
draw.text((35, 8), "Before", fill="#8c5a33")
draw.text((530, 8), "After", fill="#8c5a33")
canvas.save(ROOT / "tools/src/font-alignment-review.png")
