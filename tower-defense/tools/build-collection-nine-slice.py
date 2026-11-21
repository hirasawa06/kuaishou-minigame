"""从仓库既有相册图派生九宫格底图与透明装订环，不引入外部素材。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

root = Path(__file__).resolve().parent.parent
folder = root / 'package/subpackages/collection-art/res/Image/outgame/collection'
source = Image.open(root / 'tools/src/collection/book-nine-slice/collection-book.jpg').convert('RGB')
base = source.copy()
centers = [249, 514, 801, 1130, 1428]
mask = Image.new('L', (68, 64))
outline = [(0, 11), (20, 11), (40, 16), (52, 23), (60, 32),
           (63, 42), (58, 54), (49, 60), (37, 59), (28, 48), (20, 40), (0, 37)]
ImageDraw.Draw(mask).polygon(outline, fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(0.8))
ring = source.crop((0, centers[0] - 32, 68, centers[0] + 32)).convert('RGBA')
ring.putalpha(mask)
ring.save(folder / 'collection-book-ring-v2.png', optimize=True)
for center in centers:
    patch = Image.new('RGB', (68, 64))
    for y in range(64):
        t = y / 63
        for x in range(68):
            a = source.getpixel((x, center - 44))
            b = source.getpixel((x, center + 44))
            patch.putpixel((x, y), tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3)))
    base.paste(patch, (0, center - 32), mask)
base.save(folder / 'collection-book-base-v2.jpg', quality=90, optimize=True)
