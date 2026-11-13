#!/usr/bin/env python3
"""从WAV母版生成低响度攻击/治疗，避免反复转码与累计衰减。"""
from pathlib import Path
import subprocess
ROOT = Path(__file__).resolve().parents[1]
GAINS = {'arrow': 0.25, 'magic': 0.25, 'hit': 0.25, 'enemy-hit': 0.25, 'heal': 0.25, 'base': 0.5}
for key, gain in GAINS.items():
    for version in (1, 2, 3):
        source = ROOT / 'tools/src/audio-user' / (key + '-v' + str(version) + '.wav')
        output = ROOT / 'package/res/Audio' / (key + '-quiet' + ('' if version == 1 else '-v' + str(version)) + '.mp3')
        subprocess.run(['ffmpeg','-y','-v','error','-i',str(source),'-map_metadata','-1','-ar','44100','-ac','1','-af','volume=' + str(gain),'-c:a','libmp3lame','-b:a','64k',str(output)],check=True)
print('Attack/heal gain: 0.25; base gain: 0.5; 18 variants.')
