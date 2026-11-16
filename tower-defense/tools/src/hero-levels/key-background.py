#!/usr/bin/env python3
"""现状：对授权 Sunburst 统一绿幕素材标准去背景；不修改装备/毛色设计。
Run with --source path. Saves new alpha source, individual full-size cuts and inspection board.
Original generated images are never overwritten. Dependencies: numpy, Pillow, OpenCV.
"""
import argparse
import json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
IDS = ['tank', 'war', 'arch', 'mage']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    args = parser.parse_args()
    source = args.source.resolve()
    image = Image.open(source).convert('RGB')
    rgb = np.array(image).astype(np.float32)
    excess = rgb[:,:,1] - np.maximum(rgb[:,:,0], rgb[:,:,2])
    # Chroma matte: subject has no green; keep white/cream/silver and yellow intact.
    alpha = 1 - np.clip((excess - 8) / 170, 0, 1)
    alpha[alpha < 0.035] = 0
    alpha[alpha > 0.965] = 1
    # Remove green-screen contribution in partially covered edge pixels.
    partial = (alpha > 0) & (alpha < 1)
    for channel in range(3):
        backing = 255 if channel == 1 else 0
        restored = (rgb[:,:,channel] - (1-alpha)*backing) / np.maximum(alpha, 0.02)
        rgb[:,:,channel][partial] = np.clip(restored[partial], 0, 255)
    rgba = np.dstack([np.round(rgb).astype(np.uint8), np.round(alpha*255).astype(np.uint8)])
    rgba[rgba[:,:,3] == 0, :3] = 0
    raw_sheet = Image.fromarray(rgba)
    raw_sheet.save(HERE / (source.stem + '-alpha-original-layout.png'), optimize=True)
    # AI spacing is not perfectly grid aligned: isolate entire connected heroes before
    # normalizing cells, so left-extending tails/capes and right-extending weapons survive.
    count, labels, stats, centers = cv2.connectedComponentsWithStats((rgba[:,:,3] > 16).astype(np.uint8))
    components = sorted(range(1, count), key=lambda i: stats[i, cv2.CC_STAT_AREA], reverse=True)[:8]
    if len(components) != 8:
        raise RuntimeError('Expected eight complete isolated heroes')
    components.sort(key=lambda i: centers[i, 1])
    ordered = sorted(components[:4], key=lambda i: centers[i, 0]) + sorted(components[4:], key=lambda i: centers[i, 0])
    sheet = Image.new('RGBA', image.size)
    target = HERE / (source.stem + '-alpha.png')
    report = []
    w, h = sheet.size
    for idx, component in enumerate(ordered):
        row, col = divmod(idx, 4)
        level, hero = [1, 3][row], IDS[col]
        x, y, cw, ch, _ = stats[component]
        pad = 3
        x0, y0, x1, y1 = max(0,x-pad), max(0,y-pad), min(w,x+cw+pad), min(h,y+ch+pad)
        isolated = rgba[y0:y1,x0:x1].copy()
        local_labels = labels[y0:y1,x0:x1]
        expanded = cv2.dilate((local_labels == component).astype(np.uint8), np.ones((3,3),np.uint8))
        isolated[expanded == 0] = 0
        cut = Image.fromarray(isolated)
        cut.save(HERE / (hero + '-lv' + str(level) + '-alpha-full.png'))
        bounds = [int(x0),int(y0),int(x1),int(y1)]
        normalized = cut.copy()
        normalized.thumbnail((w//4-32,h//2-32), Image.Resampling.LANCZOS)
        sheet.alpha_composite(normalized, (col*w//4+(w//4-normalized.width)//2,
                                          row*h//2+h//2-20-normalized.height))
        report.append({'id':hero,'level':level,'source_alpha_bounds':bounds})
    sheet.save(target, optimize=True)
    board = Image.new('RGBA', sheet.size, '#273448')
    board.alpha_composite(sheet)
    board.convert('RGB').save(HERE / 'alpha-inspection-dark.png')
    light = Image.new('RGBA', sheet.size, '#f5efdf')
    light.alpha_composite(sheet)
    light.convert('RGB').save(HERE / 'alpha-inspection-light.png')
    meta = json.loads((HERE / 'latest-source.json').read_text())
    meta.update(source=target.name, raw_source=source.name,
                postprocessing='chroma-key alpha matte and edge green-spill removal; no design recoloring')
    (HERE / 'latest-source.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2)+'\n')
    (HERE / 'chroma-report.json').write_text(json.dumps(report, indent=2)+'\n')
    print('alpha_source=' + str(target))


if __name__ == '__main__':
    main()
