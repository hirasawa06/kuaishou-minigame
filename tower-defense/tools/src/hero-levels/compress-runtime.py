#!/usr/bin/env python3
"""现状：仅量化两个 hero runtime PNG，完整 RGBA 母版永远保留在 tools。
Re-run after rebuilding atlases; indexed PNG retains per-palette alpha (tRNS).
No game/browser tests, no modifications to any other runtime resources.
"""
from pathlib import Path
from datetime import datetime
import hashlib
import json
from PIL import Image, features

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
NAMES = ['hero-levels', 'hero-levels-back']


def main():
    records = []
    for name in NAMES:
        runtime = ROOT / 'package/res/Image' / (name + '.png')
        raw = runtime.read_bytes()
        image = Image.open(runtime)
        original = image.convert('RGBA')
        if image.size != (1000, 600):
            raise RuntimeError('Unexpected atlas dimensions: ' + name)
        # Repeated compression always starts from a full RGBA source, never quantizes
        # a previously indexed palette again. A rebuild supplies new RGBA automatically.
        canonical = HERE / (name + '-runtime-fullRGBA.png')
        if image.mode == 'P':
            if not canonical.exists():
                raise RuntimeError('Indexed runtime missing its fullRGBA source')
            original = Image.open(canonical).convert('RGBA')
        else:
            if canonical.exists() and canonical.read_bytes() != raw:
                previous = HERE / (name + '-runtime-fullRGBA-' + hashlib.sha256(canonical.read_bytes()).hexdigest()[:12] + '.png')
                if not previous.exists():
                    previous.write_bytes(canonical.read_bytes())
            canonical.write_bytes(raw)
        method = Image.Quantize.LIBIMAGEQUANT if features.check_feature('libimagequant') else Image.Quantize.FASTOCTREE
        indexed = original.quantize(colors=256, method=method, dither=Image.Dither.NONE)
        indexed.save(runtime, optimize=True, compress_level=9, dpi=(72, 72))
        decoded = Image.open(runtime).convert('RGBA')
        if decoded.size != original.size or decoded.getchannel('A').getextrema()[0] != 0:
            raise RuntimeError('Invalid dimensions or lost alpha: ' + name)
        # Fully transparent canvas must stay invisible; RGB there is immaterial.
        before_alpha = original.getchannel('A')
        after_alpha = decoded.getchannel('A')
        bad = sum(1 for a, b in zip(before_alpha.getdata(), after_alpha.getdata()) if a == 0 and b != 0)
        if bad:
            raise RuntimeError('Opaque pixels introduced on empty canvas: ' + name)
        if runtime.stat().st_size > 220000:
            raise RuntimeError('Compression exceeds 220KB target: ' + name)
        record = {'name': name, 'source': canonical.name, 'source_bytes': canonical.stat().st_size,
                  'runtime_bytes': runtime.stat().st_size, 'size': list(decoded.size), 'palette_colors': 256,
                  'method': method.name, 'alpha_extrema': list(after_alpha.getextrema()),
                  'new_opaque_background_pixels': bad}
        records.append(record)
        print(json.dumps(record), flush=True)
    (HERE / 'runtime-compression.json').write_text(json.dumps({'status': 'asset processing only; pending visual acceptance',
        'time': datetime.now().isoformat(timespec='seconds'), 'atlases': records}, ensure_ascii=False, indent=2) + '\n')
    package = ROOT / 'package'
    files = [p for p in package.rglob('*') if p.is_file()]
    total = sum(p.stat().st_size for p in files)
    print('local_package_bytes=' + str(total) + ' MiB=' + format(total / 1048576, '.4f') +
          ' below_6MiB=' + str(total < 6 * 1048576), flush=True)


if __name__ == '__main__':
    main()
