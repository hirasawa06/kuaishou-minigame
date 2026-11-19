"""生成字体对照样张，供桌面目视检查；不进入游戏包。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
image = Image.new("RGB", (1000, 300), "#f6e6ca")
draw = ImageDraw.Draw(image)
for row, filename in enumerate(["ZCOOLKuaiLe-Regular.ttf", "AlimamaFangYuanTiVF.ttf"]):
    font = ImageFont.truetype(str(ROOT / "tools/fonts" / filename), 45)
    if row == 1:
        font.set_variation_by_axes([700, 100])
    draw.text((30, 20 + row * 145), "英雄收藏  锤锤喵  柴不破", font=font, fill="#74451f")
    draw.text((30, 80 + row * 145), "镭射喵  哈利汪  奶糖喵", font=font, fill="#74451f")
image.save(ROOT / "tools/src/font-comparison.png")
