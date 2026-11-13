#!/usr/bin/env python3
"""导入用户音频包，只解码 WAV，不执行压缩包中的脚本。"""
import argparse, hashlib, json, random, re, subprocess, tempfile, zipfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'package/res/Audio'
SOURCE = ROOT / 'tools/src/audio-user'

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('archive')
    parser.add_argument('--seed', type=int, default=20261110)
    args = parser.parse_args()
    rng = random.Random(args.seed)
    groups = {}
    with zipfile.ZipFile(args.archive) as archive:
        for entry in archive.infolist():
            name = entry.filename
            if not entry.flag_bits & 2048:
                try: name = name.encode('cp437').decode('utf8')
                except (UnicodeError, UnicodeEncodeError): pass
            if '__MACOSX' in name or '/_raw/' in name: continue
            match = re.search(r'/\d+_([a-z-]+)_v([123])\.wav$', name)
            if not match: continue
            key, version = match.groups()
            groups.setdefault(key, []).append((int(version), archive.read(entry)))
    expected = {'bgm-home','bgm','ui-click','place','discard','start','select','expand','speed','sell','wave','arrow','magic','hit','heal','enemy-hit','base','enemy-death','boss','win','lose'}
    if set(groups) != expected: raise ValueError('Audio groups mismatch: ' + repr(set(groups) ^ expected))
    SOURCE.mkdir(parents=True, exist_ok=True)
    records = []
    with tempfile.TemporaryDirectory(prefix='cat-audio-') as tmp:
        for key, variants in sorted(groups.items()):
            variants.sort()
            music = key in ('bgm','bgm-home')
            selected = rng.choice(variants)[0] if music else None
            for version, data in variants:
                source = SOURCE / (key + '-v' + str(version) + '.wav')
                source.write_bytes(data)
                if music and version != selected: continue
                filename = key + ('' if music or version == 1 else '-v' + str(version)) + '.mp3'
                target = OUT / filename
                subprocess.run(['ffmpeg','-y','-v','error','-i',str(source),'-map_metadata','-1','-ar','44100','-ac','2' if music else '1','-af','alimiter=limit=0.89:level=false','-c:a','libmp3lame','-b:a','80k' if music else '64k',str(target)],check=True)
                records.append({'key':key,'version':version,'file':filename,'bytes':target.stat().st_size,'source_sha256':hashlib.sha256(data).hexdigest()})
    report = {'source':str(Path(args.archive).resolve()),'seed':args.seed,'music_policy':'one randomly selected version per scene at import; all source variants retained outside package','sfx_policy':'all three versions available for runtime random selection','files':records}
    (SOURCE / 'import-manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__ == '__main__': main()
