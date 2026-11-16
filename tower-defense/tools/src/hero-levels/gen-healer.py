#!/usr/bin/env python3
"""新设计/待用户验收：奶糖喵三级正面收藏与60度背面静态母版。
Style-only references do not assert an existing healer identity. No attack animation.
"""
from pathlib import Path
from datetime import datetime
import json
import subprocess
import urllib.request
import base64
import argparse
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SKILL = Path('/Users/wangyuzhe06/.myflicker/internal/skills/designai-generate-image')
REFS = [ROOT/'tools/src/characters/情绪版/宠物情绪版.png',
        ROOT/'tools/src/characters/角色/法师狗/法师狗.png',
        ROOT/'tools/src/characters/角色/射手猫/射手猫.png']
PROMPT = '''Design a NEW healer cat identity called milk-candy cat for this pet-versus-furniture game. There is NO preexisting healer identity to copy. Image 1 is the mandatory warm rounded plush toy 3D style moodboard. Images 2 and 3 are ONLY references for rendering materials, proportions, and front/back character sheet composition, NOT healer identity: do not copy their dog breed, tabby markings, orange clothes, helmet, gun, biscuit jar or weapons. The new healer is a cream-white round kitten with pale mint-green short shoulder scarf/cape and gentle emerald eyes, pink inner ears, short cream fluffy tail, one-head-to-one-body adorable proportions and friendly closed-mouth smile. Core recognizable tools: a cute mint medical bag with a white paw-plus emblem, and a soft rounded mint/emerald paw-tipped HEALING WAND. Never a hammer, gun, blade or attack weapon. All levels retain the same cream fur, face, ears and eye color. LEVEL 1 left column: plain small mint scarf, small simple mint medical satchel, short simple rounded paw-tipped healing wand. LEVEL 2 center: short mint shoulder cape with paw clasp, structured mint medical shoulder bag with pockets and white paw-plus emblem, normal mint paw healing wand with rounded handle. LEVEL 3 right: layered cream-and-mint shoulder cape with gold paw clasp, upgraded medical utility pouch with two small mint potion pockets, a larger reinforced emerald/mint healing staff with three-dimensional white paw tip and rounded gold frame. The equipment changes must be structural, not just recolor. No hats obscuring ears, no red crosses, no literal text, no floor halos, no cast shadows, no spell beams, no attack poses. Create ONE SINGLE sprite sheet THREE COLUMNS by TWO ROWS, exactly SIX complete full-body sprites: TOP ROW front-facing collection portraits Lv1, Lv2, Lv3 left to right; BOTTOM ROW corresponding back-facing Lv1, Lv2, Lv3 with camera fixed south looking north at a 60-degree downward viewing angle (strong overhead but with visible rear body volume and feet), for static battle appearance reference only. Each column is the SAME level design, front and rear must have the same bag/wand/cape construction. Hold wand in character right paw, shoulder bag hanging at character left hip. Show complete body, ears, paws, tail, bags and staffs uncropped with at least 40 pixels clear margin in each equal cell, consistent size and foot baseline. Flat perfectly uniform pure MAGENTA RGB 255,0,255 (#FF00FF) background EVERYWHERE between subjects and in all body/tool gaps. Magenta background is deliberate for later alpha keying: no transparent or checkerboard simulation, no gradients or texture, no shadow, no magenta anywhere on characters and no magenta lighting/reflections. Preserve pale mint/emerald healer equipment and cream-white fur. No writing, labels, watermark or grid lines. Only the new cream-white healer kitten, never the four existing heroes.'''


def generate():
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    log = HERE/('healer-sunburst-'+stamp+'.log')
    command = ['uv','run',str(SKILL/'scripts/generate_with_fallback.py'),'--mode','i2i',
               '--prompt',PROMPT,'--images',*map(str,REFS),'--gpt-model','GPT-Image-2.5-Sunburst',
               '--ratio','16:9','-n','1','--task-dir',str(HERE/'tasks')]
    with log.open('x') as stream:
        result = subprocess.run(command,stdout=stream,stderr=subprocess.STDOUT)
    print('log='+str(log),flush=True)
    if result.returncode:
        print(log.read_text(),flush=True)
        raise SystemExit(result.returncode)
    urlfile = next(Path(line.split('=',1)[1]) for line in log.read_text().splitlines() if line.startswith('url_file='))
    url = urlfile.read_text().strip()
    target = HERE/('healer-three-levels-'+stamp+'.png')
    if url.startswith('data:'):
        target.write_bytes(base64.b64decode(url.split(',',1)[1]))
    else:
        with urllib.request.urlopen(url,timeout=90) as response:
            target.write_bytes(response.read())
    Image.open(target).verify()
    (HERE/'healer-source.json').write_text(json.dumps({'source':target.name,
        'model':'GPT-Image-2.5-Sunburst','status':'new original healer design; pending user art acceptance',
        'identity_reference':None,'style_only_references':[str(p.relative_to(ROOT)) for p in REFS],
        'layout':'3 columns Lv1/Lv2/Lv3; 2 rows front/back 70 degrees'},ensure_ascii=False,indent=2)+'\n')
    print('source='+str(target),flush=True)


def key():
    meta = json.loads((HERE/'healer-source.json').read_text())
    source = HERE/meta['source']
    image = Image.open(source).convert('RGB')
    rgb = np.array(image).astype(np.float32)
    excess = np.minimum(rgb[:,:,0],rgb[:,:,2])-rgb[:,:,1]
    alpha = 1-np.clip((excess-10)/170,0,1)
    alpha[alpha<0.035]=0
    alpha[alpha>0.965]=1
    partial = (alpha>0)&(alpha<1)
    for channel in range(3):
        backing = 0 if channel==1 else 255
        restored = (rgb[:,:,channel]-(1-alpha)*backing)/np.maximum(alpha,0.02)
        rgb[:,:,channel][partial]=np.clip(restored[partial],0,255)
    rgba = np.dstack([np.round(rgb).astype(np.uint8),np.round(alpha*255).astype(np.uint8)])
    rgba[rgba[:,:,3]==0,:3]=0
    sheet = Image.fromarray(rgba)
    target = HERE/(source.stem+'-alpha.png')
    sheet.save(target,optimize=True)
    w,h=sheet.size
    for row, view in enumerate(['front','back']):
        for col in range(3):
            cut=sheet.crop((col*w//3,row*h//2,(col+1)*w//3,(row+1)*h//2))
            if not cut.getchannel('A').getbbox():
                raise RuntimeError('Empty healer cell')
            cut.save(HERE/('healer-lv'+str(col+1)+'-'+view+'-alpha-full.png'))
    for name,color in [('dark','#273448'),('light','#f5efdf')]:
        board=Image.new('RGBA',sheet.size,color)
        board.alpha_composite(sheet)
        board.convert('RGB').save(HERE/('healer-inspection-'+name+'.png'))
    meta.update(alpha_source=target.name,postprocessing='standard magenta chroma key; partial edge despill only; no recoloring')
    (HERE/'healer-source.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
    print('alpha='+str(target),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--key',action='store_true')
    args=parser.parse_args()
    if args.key: key()
    else: generate()
