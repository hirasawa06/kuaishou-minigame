#!/usr/bin/env python3
"""现状/待验证：独立升级背面待机图。原动作与前面收藏图集不变。
Generate two i2i jobs, inspect sources, then --pack for standard chroma alpha packing.
"""
from pathlib import Path
from datetime import datetime
import argparse, json, re, subprocess, urllib.request, base64
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import cv2
from PIL import Image
import importlib.util

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
SKILL=Path('/Users/wangyuzhe06/.myflicker/internal/skills/designai-generate-image')
CHAR=ROOT/'tools/src/characters'
IDS=['tank','war','arch','mage','healer']

def existing():
    text=(ROOT/'package/gameplay/data/rigs.js').read_text()
    meta=json.loads(re.search(r'A\.GameAtlas\s*=\s*(\{.*\});',text).group(1))
    image=Image.open(ROOT/'package'/meta['src'].split('?')[0])
    cuts=[]
    for key in ['tank-back-idle','war-back-idle','arch-back-idle','mage-back-idle']:
        x,y,w,h=meta['icons'][key]
        cuts.append(image.crop((x,y,x+w,y+h)).convert('RGBA'))
    return cuts

def generate(kind):
    stamp=datetime.now().strftime('%Y%m%d-%H%M%S')
    ref=HERE/'existing-back-idle-reference.png'
    board=Image.new('RGBA',(800,200))
    for i,cut in enumerate(existing()):
        cut=cut.resize((180,180),Image.Resampling.LANCZOS)
        board.alpha_composite(cut,(i*200+10,10))
    # Shared reference is deterministic original existing art, not generated upgrade art.
    if not ref.exists(): board.save(ref)
    mood=CHAR/'情绪版/宠物情绪版.png'
    if kind=='four':
        refs=[mood,HERE/'hero-lv1-lv3-20261111-211128-alpha.png',ref,
              CHAR/'角色/柴不破/柴不破三视图-60度-已确认-v1.png',
              CHAR/'角色/近战猫/近战猫三视图参考-v1.png',
              CHAR/'角色/射手猫/射手猫.png',CHAR/'角色/法师狗/法师狗.png']
        prompt='''Create an upgraded BACK VIEW IDLE sprite sheet. Image1 mandatory pet toy3D moodboard; Image2 exact approved NEW Lv1/Lv3 equipment identities (front collection sheet); Image3 original battle BACK IDLE silhouettes in order tank/war/arch/mage; remaining images exact structural identity references. Output FOUR COLUMNS TWO ROWS exactly EIGHT full-body BACK-FACING sprites. Columns: orange Shiba shield dog, gray tabby hammer cat, helmet gray tabby laser cat, brown white border collie mage. Top row Lv1, bottom row Lv3. ALL characters face NORTH, backs toward camera in SOUTH; absolutely NO eyes, nose, mouth, face, cheek, front muzzle, chest clasp visible. Camera is 60 degrees DOWN FROM HORIZONTAL for Shiba dog only; exactly 70 degrees DOWN FROM HORIZONTAL for all three other heroes. Strong overhead rear view: large visible top surfaces of heads and shoulders, foreshortened vertical body, visible floor-facing feet behind rounded bodies, not eye-level rear view and not 3/4 sideways. Follow Image3 rear body and tail arrangement, but apply Image2 level-specific equipment faithfully. Shiba Lv1 simple blue scarf and small paw shield, Lv3 layered blue shoulder armor/cape and large reinforced shield; shield remains held on character LEFT (viewer LEFT in rear view), visible outside left silhouette, not on back. Hammer cat Lv1 small single paw hammer/yellow scarf/no belt pouch, Lv3 large double-headed paw hammer/layered yellow shoulder cape/brown belt pouch, hammer held RIGHT viewer RIGHT. Laser cat Lv1 simple cream orange open helmet/short cape/compact pistol, Lv3 enlarged rounded helmet side panels/layered orange cape/long reinforced laser pistol held RIGHT viewer RIGHT. Mage Lv1 single biscuit jar staff/simple orange shoulder scarf, Lv3 twin biscuit jar framed staff/layered gold orange cape/utility belt, staff held RIGHT viewer RIGHT. No attacks, no magic effects, no floor shadows, no halos. Rear shoulder capes conceal chest clasps; rear view should not display front paw shield emblem through character. Keep same species, exact fur colors, ears and tail from identity references, same head-body proportions as existing rear sprites. All complete bodies and tools inside each equal cell with generous 35 pixel gutters, no clipping or overlap, one consistent foot baseline, no labels/text/grid/watermark. Uniform pure chroma-key GREEN RGB0,255,0 background everywhere, no gradient/checkerboard/shadows; NO green on characters, no green reflections. Do not draw any healer. Strictly BACK VIEW with steep prescribed overhead camera, never collection frontal portraits.'''
    else:
        refs=[mood,HERE/'healer-three-levels-20261111-221014-alpha.png',ref]
        prompt='''Image1 is mandatory soft warm rounded toy3D pet style. Image2 is the now established NEW healer kitten identity and three equipment levels, front row is identity reference; its older rear row camera is TOO SHALLOW and MUST NOT be copied. Image3 shows existing battle rear silhouettes for camera comparison only, not healer identity. Create exactly THREE full-body BACK FACING IDLE portraits in ONE HORIZONTAL ROW, Lv1,Lv2,Lv3 left to right. Cream white round kitten with mint cape/medical bag and paw-tip HEALING staff, no attack weapon. All face NORTH, camera is SOUTH looking NORTH, EXACTLY70 DEGREE DOWNWARD ANGLE FROM HORIZONTAL (20deg from straight vertical). Strongly overhead almost top-down rear perspective: crown of head occupies broad visible area, top of both ears visible, back and shoulders strongly foreshortened, upper surfaces of bag/paws/staff cap visible, tail below rear cape; avoid eye-level full-length straight rear view. Absolutely NO eyes, face, muzzle, nose, chest, front clasp visible. Reference2 front designs must be faithfully turned around: Lv1 plain mint scarf/small simple medical bag/short white mint paw wand; Lv2 cream-edged short mint shoulder cape/structured medical bag/normal paw wand; Lv3 layered cream mint cape/upgraded bag with TWO mint potion bottles/large gold framed emerald white paw healing staff with green ribbon leaves. Bag hangs character LEFT viewer LEFT, staff in RIGHT viewer RIGHT. No attacks, beams, spells, floor shadows or aura rings. Preserve cream fur, green equipment and rounded body volume without flattening art. All three full bodies, tail, bags, bottles, staff complete with generous margins each equal cell, same scale and foot baseline; no text or grid. Perfectly uniform pure MAGENTA RGB255,0,255 background including tool-body gaps, no gradients or checkerboard, no magenta on characters/reflections. This is a rigorous battle overhead BACK IDLE design, not frontal collection art; rear row of reference2 is NOT acceptable camera, increase overhead angle dramatically.'''
    log=HERE/(kind+'-back-sunburst-'+stamp+'.log')
    cmd=['uv','run',str(SKILL/'scripts/generate_with_fallback.py'),'--mode','i2i','--prompt',prompt,
         '--images',*map(str,refs),'--gpt-model','GPT-Image-2.5-Sunburst','--ratio','16:9','-n','1','--task-dir',str(HERE/'tasks')]
    with log.open('x') as stream: result=subprocess.run(cmd,stdout=stream,stderr=subprocess.STDOUT)
    if result.returncode:
        print(log.read_text(),flush=True); raise RuntimeError('Generation failed '+str(log))
    urlfile=next(Path(line.split('=',1)[1]) for line in log.read_text().splitlines() if line.startswith('url_file='))
    url=urlfile.read_text().strip()
    target=HERE/(kind+'-back-'+stamp+'.png')
    if url.startswith('data:'): target.write_bytes(base64.b64decode(url.split(',',1)[1]))
    else:
        with urllib.request.urlopen(url,timeout=90) as response: target.write_bytes(response.read())
    Image.open(target).verify()
    (HERE/(kind+'-back-source.json')).write_text(json.dumps({'source':target.name,'model':'GPT-Image-2.5-Sunburst','references':[str(p.relative_to(ROOT)) for p in refs],'status':'pending visual camera/alpha inspection'},ensure_ascii=False,indent=2)+'\n')
    print(kind+' source='+str(target),flush=True)

def chroma(source,magenta):
    rgb=np.array(Image.open(source).convert('RGB')).astype(np.float32)
    excess=np.minimum(rgb[:,:,0],rgb[:,:,2])-rgb[:,:,1] if magenta else rgb[:,:,1]-np.maximum(rgb[:,:,0],rgb[:,:,2])
    alpha=1-np.clip((excess-8)/170,0,1)
    alpha[alpha<.035]=0; alpha[alpha>.965]=1
    partial=(alpha>0)&(alpha<1)
    for c in range(3):
        backing=(255 if c!=1 else 0) if magenta else (255 if c==1 else 0)
        restored=(rgb[:,:,c]-(1-alpha)*backing)/np.maximum(alpha,.02)
        rgb[:,:,c][partial]=np.clip(restored[partial],0,255)
    rgba=np.dstack([np.round(rgb).astype(np.uint8),np.round(alpha*255).astype(np.uint8)])
    rgba[rgba[:,:,3]==0,:3]=0
    return Image.fromarray(rgba)

def pack():
    spec=importlib.util.spec_from_file_location('hero_pack',ROOT/'tools/gen-hero-levels.py')
    module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    atlas=Image.new('RGBA',(1000,600))
    for kind in ['four','healer']:
        meta=json.loads((HERE/(kind+'-back-source.json')).read_text())
        sheet=chroma(HERE/meta['source'],kind=='healer')
        target=HERE/(Path(meta['source']).stem+'-alpha.png'); sheet.save(target,optimize=True)
        dark=Image.new('RGBA',sheet.size,'#273448'); dark.alpha_composite(sheet)
        dark.convert('RGB').save(HERE/(kind+'-back-inspection-dark.png'))
        w,h=sheet.size
        # Isolate complete connected heroes before normalization: AI gutters may cross
        # nominal grid boundaries. Never clip a pistol/staff or leak neighbor pixels.
        rgba=np.array(sheet)
        count,labels,stats,centers=cv2.connectedComponentsWithStats((rgba[:,:,3]>16).astype(np.uint8))
        total=8 if kind=='four' else 3
        components=sorted(range(1,count),key=lambda i:stats[i,cv2.CC_STAT_AREA],reverse=True)[:total]
        if len(components)!=total: raise RuntimeError('Incomplete rear sheet')
        if kind=='four':
            components.sort(key=lambda i:centers[i,1])
            components=sorted(components[:4],key=lambda i:centers[i,0])+sorted(components[4:],key=lambda i:centers[i,0])
        else: components.sort(key=lambda i:centers[i,0])
        for idx,component in enumerate(components):
            row,col=divmod(idx,4 if kind=='four' else 3)
            x,y,cw,ch,_=stats[component]
            x0,y0,x1,y1=max(0,x-3),max(0,y-3),min(w,x+cw+3),min(h,y+ch+3)
            isolated=rgba[y0:y1,x0:x1].copy()
            selected=cv2.dilate((labels[y0:y1,x0:x1]==component).astype(np.uint8),np.ones((3,3),np.uint8))
            isolated[selected==0]=0
            cut=Image.fromarray(isolated)
            hero,level=(IDS[col],[1,3][row]) if kind=='four' else ('healer',col+1)
            cut.save(HERE/(hero+'-lv'+str(level)+'-battle-back-full.png'))
            cell=module.fit(cut)
            atlas.alpha_composite(cell,(IDS.index(hero)*200,(level-1)*200))
        meta['alpha_source']=target.name
        (HERE/(kind+'-back-source.json')).write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
    for col,cut in enumerate(existing()): atlas.alpha_composite(module.fit(cut),(col*200,200))
    out=ROOT/'package/res/Image/hero-levels-back.png'; atlas.save(out,optimize=True,dpi=(72,72))
    print('back atlas='+str(out),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument('--pack',action='store_true'); args=parser.parse_args()
    if args.pack: pack()
    else:
        with ThreadPoolExecutor(max_workers=2) as pool: list(pool.map(generate,['four','healer']))
