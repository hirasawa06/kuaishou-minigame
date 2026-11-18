"""冰箱砸地特效：保留透明光晕，三帧共用冰裂圆心与缩放。"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'tools/src/vfx/冰箱Boss/冰箱Boss砸地-用户确认-v6.png'
OUT = ROOT / 'package/res/Image/boss-ground-impact.png'


def normalize(path):
    image = Image.open(path).convert('RGBA')
    if image.size != (4344, 1214):
        raise ValueError('用户确认原图应为4344×1214，不能套用其他版本')
    sheet = Image.new('RGBA', (768, 256))
    # 三幅构图尺寸不同，按冰裂圆心对齐，不逐帧裁边填满。
    for index, (left, right, center) in enumerate([
        (0, 1250, 700), (1250, 2900, 2120), (2900, 4344, 3590)
    ]):
        tile = Image.new('RGBA', (1880, 1880))
        tile.alpha_composite(image.crop((left, 0, right, 1214)),
                             (940 + left - center, 940 - 615))
        sheet.alpha_composite(tile.resize((240, 240), Image.Resampling.LANCZOS),
                              (index * 256 + 8, 8))
    SOURCE.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(SOURCE)
    return sheet


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path)
    args = parser.parse_args()
    sheet = normalize(args.source) if args.source else Image.open(SOURCE).convert('RGBA')
    if sheet.size != (768, 256):
        raise ValueError('归一化源帧表尺寸错误')
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT)
    meta = {'status': '已实现/视觉待验', 'source': SOURCE.name,
            'original': '用户2026-11-17提供的三阶段透明PNG',
            'centers': [[700, 615], [2120, 615], [3590, 615]],
            'cell': 256, 'timeline': [0, 0.10, 0.30], 'duration': 0.70,
            'anchor': [128, 128], 'drawSize': 260}
    if args.source:
        meta['originalSha256'] = hashlib.sha256(args.source.read_bytes()).hexdigest()
    elif (SOURCE.parent / '砸地特效来源.json').exists():
        previous = json.loads((SOURCE.parent / '砸地特效来源.json').read_text())
        meta['originalSha256'] = previous.get('originalSha256')
    (SOURCE.parent / '砸地特效来源.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n')
    print(OUT)


if __name__ == '__main__':
    main()
