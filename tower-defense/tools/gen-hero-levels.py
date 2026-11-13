#!/usr/bin/env python3
"""现状/待验证：生成并打包英雄收藏预览；不生成或修改战斗动作。
Run --generate once for Sunburst i2i; run without arguments to repack existing sources.
Only writes tools/src/hero-levels and package/res/Image/hero-levels.png.
"""
import argparse
import base64
import json
import re
import subprocess
import sys
import urllib.request
from datetime import datetime
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tools/src/hero-levels'
SKILL = Path('/Users/wangyuzhe06/.myflicker/internal/skills/designai-generate-image')
CHARS = ROOT / 'tools/src/characters'
REFERENCES = [
    CHARS / '情绪版/宠物情绪版.png',
    CHARS / '角色/柴不破/柴不破三视图-60度-已确认-v1.png',
    CHARS / '角色/近战猫/近战猫三视图参考-v1.png',
    CHARS / '角色/射手猫/射手猫.png',
    CHARS / '角色/法师狗/法师狗.png',
]
IDS = ['tank', 'war', 'arch', 'mage', 'healer']
PROMPT = '''IMPORTANT: output genuinely transparent RGBA PNG with an alpha channel. Do NOT paint a checkerboard simulation of transparency. No gray/white checker squares, no tiled grid of any kind; completely empty transparent pixels between sprites. Genuine alpha transparency is required, not any solid backdrop. Create ONE game character upgrade sprite sheet, editing ONLY the four specifically supplied character identities. Image 1 is the mandatory pet moodboard for soft rounded warm toy-like 3D materials and lighting (ignore its text). Images 2 through 5 are respectively the exact Shiba shield dog, gray tabby hammer cat, gray tabby laser cat, brown-and-white border collie mage structural references. Keep the existing reference outfit as LEVEL 2, do NOT reproduce level 2 on this sheet. Create exactly EIGHT isolated full-body character sprites in a regular FOUR COLUMNS by TWO ROWS sheet. Column order: shield Shiba dog, hammer tabby cat, laser tabby cat, border collie mage. TOP ROW all LEVEL 1 beginner outfits; BOTTOM ROW all LEVEL 3 elite outfits. These are collection/upgrade panel portraits, front facing, slightly elevated camera, not battle action frames. Keep precisely the same breeds, rounded one-head-body proportions, ear shape, fur colors, face markings, eye colors, weapon category and weapon hand from each structural reference. Shiba orange and cream fur, blue shield/cape with white paw motif; hammer cat gray tabby white muzzle, yellow bandana, brown belt, cream/pink paw hammer; laser cat gray tabby white muzzle and belly, cream/orange helmet, orange cape, small orange laser pistol; mage brown/white border collie, white forehead blaze, orange/gold cape, biscuit-jar staff. LEVEL 1 must have distinctly simpler beginner equipment: Shiba simple smaller blue paw shield and short blue scarf, hammer cat small soft paw mallet and plain yellow neckerchief without belt pouches, laser cat simple open cream helmet and short orange scarf with compact starter pistol, mage small single biscuit jar staff and simple orange shoulder scarf. LEVEL 3 must have visibly new structural equipment, not mere recolor: Shiba reinforced deep blue silver-rimmed paw shield plus layered blue shoulder guards and gold bone clasp; hammer cat larger double-ended padded paw hammer and layered yellow shoulder cape plus upgraded brown utility belt; laser cat upgraded cream/orange helmet with two rounded protective side fins and a longer reinforced orange laser pistol plus layered short cape; mage larger twin-biscuit jar staff with gold support frame and layered orange/gold hoodless shoulder cape. No crowns obscuring ears, no species changes, no realistic hard metal, no huge size changes, no holograms or ground rings. Preserve warm blue/yellow/orange identity colors exactly. Each sprite centered in its own equal cell with generous transparent gutters, consistent foot baseline and subject size. True transparent PNG background, no floor, no cast shadows, no backdrop, no grid lines, no text, no labels, no watermark. All eight full bodies and weapons must be complete and uncropped; exactly one hero per cell, not three views. Do not include any healer: it has no approved character reference. Do not copy any reference sheet labels or moodboard layouts.'''


def generate(chroma_background=False):
    OUT.mkdir(parents=True, exist_ok=True)
    for ref in REFERENCES:
        if not ref.is_file():
            raise SystemExit('Missing required i2i reference: ' + str(ref))
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    log = OUT / ('sunburst-' + stamp + '.log')
    prompt = PROMPT
    refs = REFERENCES
    if chroma_background:
        refs = [OUT / 'hero-lv1-lv3-20261111-205416.png', *REFERENCES]
        prompt = '''Image 1 is the exact completed eight-character upgrade sheet to edit. Keep ALL eight characters and their distinct beginner TOP ROW and elite BOTTOM ROW equipment unchanged: same poses, colors, toy materials, fur markings, ears, facial expressions, white/silver areas, small single paw hammer vs large double-ended paw hammer, small single biscuit staff vs twin biscuit staff, layered blue shoulder armor, enlarged laser helmet side panels and gun. Image 2 is the required pet style moodboard; images 3-6 are their approved structural references. ONLY replace the entire fake gray-white checkerboard background with completely uniform flat chroma-key GREEN RGB 0,255,0 (#00FF00), with no texture, gradients, shadows, lighting or checkerboard anywhere. The background must include spaces between the feet, gaps between weapons and bodies, and ear gaps. Foreground must contain NO green color and no green spill/reflection. Keep blue shield and cape, yellow paw hammer cat scarf, orange/cream laser cat helmet and brown/white orange-caped border collie exactly. Output FOUR equal columns by TWO equal rows, exactly eight complete full-body isolated sprites, column order shield Shiba dog, hammer tabby cat, laser tabby cat, border collie mage; top row Lv1, bottom row Lv3. Generous green margins around every character and weapon, all eight fit entirely inside their individual cells with at least 20 pixels padding. Slightly shrink all subjects uniformly if needed to prevent the mage staff from touching the right border. No text or labels. This is foreground-preserving background replacement, NOT a new design, not recoloring characters, not a transparent-background request. Green is deliberate for later professional alpha keying.'''
    cmd = ['uv', 'run', str(SKILL / 'scripts/generate_with_fallback.py'),
           '--mode', 'i2i', '--prompt', prompt, '--images', *map(str, refs),
           '--gpt-model', 'GPT-Image-2.5-Sunburst', '--ratio', '16:9', '-n', '1',
           '--task-dir', str(OUT / 'tasks')]
    with log.open('x') as stream:
        result = subprocess.run(cmd, stdout=stream, stderr=subprocess.STDOUT)
    print('generation_log=' + str(log), flush=True)
    if result.returncode:
        print(log.read_text(), flush=True)
        raise SystemExit(result.returncode)  # no agent-layer retry or automatic downgrade
    lines = log.read_text().splitlines()
    urlfile = next(Path(line.split('=', 1)[1]) for line in lines if line.startswith('url_file='))
    url = urlfile.read_text().strip()
    target = OUT / ('hero-lv1-lv3-' + stamp + '.png')
    if url.startswith('data:'):
        target.write_bytes(base64.b64decode(url.split(',', 1)[1]))
    else:
        # Download only our newly generated output, never restricted or unrelated source art.
        with urllib.request.urlopen(url, timeout=90) as response:
            target.write_bytes(response.read())
    Image.open(target).verify()
    print('generated_source=' + str(target), flush=True)
    (OUT / 'latest-source.json').write_text(json.dumps({'source': target.name,
        'model': 'GPT-Image-2.5-Sunburst', 'references': [str(p.relative_to(ROOT)) for p in refs]},
        ensure_ascii=False, indent=2) + '\n')


def fit(img):
    img = img.convert('RGBA')
    box = img.getchannel('A').getbbox()
    if box is None:
        return Image.new('RGBA', (200, 200))
    img = img.crop(box)
    img.thumbnail((176, 176), Image.Resampling.LANCZOS)
    cell = Image.new('RGBA', (200, 200))
    cell.alpha_composite(img, ((200 - img.width) // 2, 188 - img.height))
    return cell


def pack_healer_only():
    # Preserve all four existing hero columns byte-for-byte at decoded pixel level.
    destination = ROOT / 'package/res/Image/hero-levels.png'
    atlas = Image.open(destination).convert('RGBA')
    if atlas.size != (1000, 600):
        raise SystemExit('Unexpected atlas dimensions')
    status = json.loads((OUT / 'availability.json').read_text())
    for level in [1, 2, 3]:
        source = OUT / ('healer-lv' + str(level) + '-front-alpha-full.png')
        original = Image.open(source).convert('RGBA')
        if original.getchannel('A').getextrema()[0] == 255:
            raise SystemExit('Healer source lacks alpha')
        cell = fit(original)
        cell.save(OUT / ('healer-lv' + str(level) + '.png'))
        atlas.paste(cell, (800, (level - 1) * 200))
        status['healer'][str(level)] = True
    atlas.save(destination, optimize=True, dpi=(72, 72))
    (OUT / 'availability.json').write_text(json.dumps(status, indent=2) + '\n')
    print('atlas=' + str(destination) + ' RGBA 1000x600; all healer levels populated')


def pack(existing_only=False):
    OUT.mkdir(parents=True, exist_ok=True)
    atlas = Image.new('RGBA', (1000, 600))
    status = {hero: {'1': False, '2': hero != 'healer', '3': False} for hero in IDS}
    latest = OUT / 'latest-source.json'
    if latest.exists() and not existing_only:
        sheet = Image.open(OUT / json.loads(latest.read_text())['source']).convert('RGBA')
        # Accept only real alpha sources, including authorized standard keying postprocessing.
        if sheet.getchannel('A').getextrema()[0] == 255:
            raise SystemExit('Source is opaque. Inspect and perform authorized background keying before packing.')
        w, h = sheet.size
        for row, level in enumerate([1, 3]):
            for col, hero in enumerate(IDS[:4]):
                crop = sheet.crop((round(col*w/4), round(row*h/2), round((col+1)*w/4), round((row+1)*h/2)))
                cell = fit(crop)
                cell.save(OUT / (hero + '-lv' + str(level) + '.png'))
                atlas.alpha_composite(cell, (col*200, (level-1)*200))
                status[hero][str(level)] = True
    # Level 2 is copied verbatim from existing independent game resources, never re-generated.
    data = (ROOT / 'package/gameplay/data/rigs.js').read_text()
    match = re.search(r'A\.GameAtlas\s*=\s*(\{.*\});', data)
    if not match:
        raise SystemExit('Cannot parse existing GameAtlas')
    meta = json.loads(match.group(1))
    game = Image.open(ROOT / 'package' / meta['src'].split('?', 1)[0])
    keys = ['unit-tank-1', 'war-front-idle', 'arch-back-idle', 'mage-back-idle']
    for col, key in enumerate(keys):
        x, y, w, h = meta['icons'][key]
        cell = fit(game.crop((x, y, x+w, y+h)))
        cell.save(OUT / (IDS[col] + '-lv2.png'))
        atlas.alpha_composite(cell, (col*200, 200))
    healer_files = [OUT / ('healer-lv' + str(level) + '-front-alpha-full.png') for level in [1, 2, 3]]
    if all(source.exists() for source in healer_files):
        for level, source in enumerate(healer_files, 1):
            original = Image.open(source).convert('RGBA')
            if original.getchannel('A').getextrema()[0] == 255:
                raise SystemExit('Healer source lacks alpha')
            cell = fit(original)
            cell.save(OUT / ('healer-lv' + str(level) + '.png'))
            atlas.alpha_composite(cell, (800, (level - 1) * 200))
            status['healer'][str(level)] = True
    destination = ROOT / 'package/res/Image/hero-levels.png'
    atlas.save(destination, optimize=True, dpi=(72, 72))
    (OUT / 'availability.json').write_text(json.dumps(status, indent=2) + '\n')
    print('atlas=' + str(destination) + ' RGBA 1000x600; healer availability=' + str(status['healer']), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--generate', action='store_true')
    parser.add_argument('--chroma-background', action='store_true', help='i2i preserve eight designs with uniform green key background')
    parser.add_argument('--healer-only', action='store_true', help='Populate healer column without changing existing four hero columns')
    parser.add_argument('--pack', action='store_true')
    parser.add_argument('--existing-only', action='store_true', help='Pack only original Lv2; leave missing AI levels transparent')
    args = parser.parse_args()
    if args.generate:
        generate(chroma_background=args.chroma_background)  # inspect output before packing
    elif args.healer_only:
        pack_healer_only()
    else:
        pack(existing_only=args.existing_only)
