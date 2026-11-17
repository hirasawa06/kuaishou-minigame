"""把用户提供的透明治疗素材生成运行时 PNG，保留原色与透明度。"""
import base64
import io
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
cast_source = ROOT / 'tools/src/effects/healer/cast-frame.base64'
cast_image = Image.open(io.BytesIO(base64.b64decode(cast_source.read_text()))).convert('RGBA')
cast_image.save(ROOT / 'tools/src/characters/角色/奶糖喵/奶糖喵治疗动作-v2.png', optimize=True)
sources = json.loads((ROOT / 'tools/src/effects/healer/source.json').read_text())
for name, encoded in sources.items():
    image = Image.open(io.BytesIO(base64.b64decode(encoded))).convert('RGBA')
    image.thumbnail((256, 256), Image.Resampling.LANCZOS)
    image.save(ROOT / f'package/res/Image/heal-{name}.png', optimize=True)
