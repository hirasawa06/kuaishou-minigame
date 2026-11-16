#!/usr/bin/env python3
"""现状：标准 GrabCut 去背景后处理，保留原始 AI 设计，不重画/变色。
Uses first Sunburst source; saves a new alpha source and contrasting inspection board.
Requires local numpy, opencv-python, Pillow. Does not download models or art.
"""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
SOURCE = HERE / 'hero-lv1-lv3-20261111-205416.png'
TARGET = HERE / 'hero-lv1-lv3-20261111-205416-alpha.png'


def segment(rgb):
    # The fake checkerboard is neutral gray/white; the toy fur has warm/cool chroma.
    # Chroma creates only a conservative initial silhouette, not the final alpha mask.
    chroma = np.ptp(rgb.astype(np.int16), axis=2)
    seed = (chroma > 13).astype(np.uint8)
    seed = cv2.morphologyEx(seed, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(seed)
    keep = np.zeros_like(seed)
    for idx in range(1, count):
        if stats[idx, cv2.CC_STAT_AREA] > 500:
            keep[labels == idx] = 1
    # Fill interior holes: white eyes, cream fur and silver equipment are real subject.
    contours, _ = cv2.findContours(keep, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    initial = np.zeros_like(seed)
    cv2.drawContours(initial, contours, -1, 1, cv2.FILLED)
    inner = cv2.erode(initial, np.ones((9, 9), np.uint8))
    outer = cv2.dilate(initial, np.ones((15, 15), np.uint8))
    mask = np.full(seed.shape, cv2.GC_BGD, np.uint8)
    mask[outer != 0] = cv2.GC_PR_BGD
    mask[initial != 0] = cv2.GC_PR_FGD
    mask[inner != 0] = cv2.GC_FGD
    mask[:2, :] = mask[-2:, :] = cv2.GC_BGD
    mask[:, :2] = mask[:, -2:] = cv2.GC_BGD
    cv2.grabCut(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), mask, None,
                np.zeros((1, 65)), np.zeros((1, 65)), 6, cv2.GC_INIT_WITH_MASK)
    foreground = np.isin(mask, [cv2.GC_FGD, cv2.GC_PR_FGD]).astype(np.uint8)
    # Keep the main continuous character/weapon component, remove isolated checker crumbs.
    count, labels, stats, _ = cv2.connectedComponentsWithStats(foreground)
    if count < 2:
        raise RuntimeError('No character segmented')
    main = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    foreground = (labels == main).astype(np.uint8)
    # Subpixel antialiasing only at the segmentation boundary; opaque interiors untouched.
    alpha = cv2.GaussianBlur(foreground.astype(np.float32), (3, 3), 0.5)
    alpha[alpha < 0.08] = 0
    alpha[alpha > 0.92] = 1
    rgba = np.dstack([rgb, np.round(alpha * 255).astype(np.uint8)])
    rgba[rgba[:, :, 3] == 0, :3] = 0
    return Image.fromarray(rgba, 'RGBA')


def main():
    image = Image.open(SOURCE).convert('RGB')
    w, h = image.size
    sheet = Image.new('RGBA', image.size)
    report = []
    for row, level in enumerate([1, 3]):
        for col, hero in enumerate(['tank', 'war', 'arch', 'mage']):
            box = (col*w//4, row*h//2, (col+1)*w//4, (row+1)*h//2)
            cut = segment(np.array(image.crop(box)))
            cut.save(HERE / (hero + '-lv' + str(level) + '-alpha-full.png'))
            sheet.alpha_composite(cut, (box[0], box[1]))
            report.append({'hero': hero, 'level': level, 'bounds': cut.getchannel('A').getbbox(),
                           'opaque_pixels': int(np.count_nonzero(np.array(cut)[:,:,3] == 255))})
    sheet.save(TARGET, optimize=True)
    # Dark background makes neutral checker remnants readily visible at actual source resolution.
    inspection = Image.new('RGBA', sheet.size, '#273448')
    inspection.alpha_composite(sheet)
    inspection.convert('RGB').save(HERE / 'alpha-inspection-dark.png')
    (HERE / 'segmentation-report.json').write_text(json.dumps(report, indent=2) + '\n')
    latest = json.loads((HERE / 'latest-source.json').read_text())
    latest.update(source=TARGET.name, raw_source=SOURCE.name, postprocessing='OpenCV GrabCut boundary segmentation; no recoloring')
    (HERE / 'latest-source.json').write_text(json.dumps(latest, ensure_ascii=False, indent=2) + '\n')
    print('alpha_source=' + str(TARGET))


if __name__ == '__main__':
    main()
