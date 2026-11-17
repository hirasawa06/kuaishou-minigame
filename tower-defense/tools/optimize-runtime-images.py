#!/usr/bin/env python3
"""压缩运行图片，保留包外原始素材及逐文件报告。"""
from pathlib import Path
from PIL import Image
import json, shutil
ROOT=Path(__file__).resolve().parents[1]
PKG=ROOT/'package'
BACKUP=ROOT/'design/package-size-originals'

def main():
    BACKUP.mkdir(parents=True,exist_ok=True)
    report=[]
    for folder in ['res/Image','res/Menu']:
        for path in sorted((PKG/folder).glob('*.png')):
            if path.name.startswith('font-') or path.name in ['enemy-furniture-atlas.png','lamp-small.png']: continue;
            rel=path.relative_to(PKG)
            original=BACKUP/rel
            original.parent.mkdir(parents=True,exist_ok=True)
            if not original.exists(): shutil.copy2(path,original)
            before=path.stat().st_size
            image=Image.open(original)
            if path.name in ['home-background-clean-v2.png','in-game-background-topdown.png']:
                target=path.with_suffix('.jpg')
                image.convert('RGB').save(target,'JPEG',quality=72,optimize=True,progressive=True)
                path.unlink()
            else:
                target=path
                rgba=image.convert('RGBA')
                # 不改纹理坐标与尺寸：先量化压缩，优先保持所有源图采样合同。
                if path.name == 'home-level-card-no-banner-v1.png':
                    alpha = rgba.getchannel('A')
                    rgb = rgba.convert('RGB').quantize(colors=128,method=Image.Quantize.MEDIANCUT,
                        dither=Image.Dither.FLOYDSTEINBERG).convert('RGBA')
                    rgb.putalpha(alpha)
                    rgb.save(target,optimize=True)
                else:
                    rgba.quantize(colors=256,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE).save(target,optimize=True)
            report.append({'source':str(rel),'output':str(target.relative_to(PKG)),'size':image.size,'before':before,'after':target.stat().st_size})
    (BACKUP/'compression-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('Image bytes before:',sum(r['before'] for r in report),'after:',sum(r['after'] for r in report))

if __name__=='__main__': main()
