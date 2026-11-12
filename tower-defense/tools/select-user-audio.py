#!/usr/bin/env python3
"""用户选版：保留源WAV；生成沮丧小调失败乐句。不会覆盖其他用户音效。"""
from pathlib import Path
import subprocess, wave
import numpy as np
ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'tools/src/audio-user'
OUT = ROOT / 'package/res/Audio'

def encode(source, output, music=False):
    subprocess.run(['ffmpeg','-y','-v','error','-i',str(source),'-map_metadata','-1','-ar','44100','-ac','2' if music else '1','-af','alimiter=limit=0.89:level=false','-c:a','libmp3lame','-b:a','48k' if music else '64k',str(output)],check=True)

def main():
    # 常规战斗完整播放V1，Boss出现才转V2；不是按音频中点强行切断。
    for key, version, output in [('bgm-home',1,'bgm-home'),('bgm',1,'bgm'),('bgm',2,'bgm-boss')]:
        encode(SRC / (key + '-v' + str(version) + '.wav'), OUT / (output + '.mp3'),True)
    rate=44100
    song=np.zeros(int(rate*3.2),dtype=np.float64)
    # A小调：E-C-B-A，节奏逐渐放缓，最后低音落下，无鼓励式上扬。
    for start,midi,amp,duration in [(0,76,.24,.7),(.42,72,.23,.8),(.94,71,.21,.95),(1.6,69,.23,1.45),(1.63,57,.11,1.4)]:
        t=np.arange(int(rate*duration))/rate
        f=440*2**((midi-69)/12)
        env=(1-np.exp(-t/0.015))*np.exp(-t*3.2)*np.minimum(1,(duration-t)/.10)
        note=(np.sin(2*np.pi*f*t)+.22*np.sin(2*np.pi*f*2.005*t)*np.exp(-t*5)+.06*np.sin(2*np.pi*f*3*t))*env*amp
        offset=int(start*rate)
        song[offset:offset+len(note)]+=note
        for delay,gain in [(.085,.14),(.17,.07)]:
            j=offset+int(delay*rate); n=min(len(note),len(song)-j)
            song[j:j+n]+=note[:n]*gain
    # 低声部A小调衬底，柔软下沉、保留失落感，不用滑稽失败号角。
    t=np.arange(int(rate*3.0))/rate
    chord=sum(np.sin(2*np.pi*f*t) for f in [220,261.6256,329.6276])/3
    song[:len(t)]+=chord*.10*(1-np.exp(-t/0.09))*np.exp(-t*1.5)*np.minimum(1,(3.0-t)/.15)
    song[-4410:]*=np.linspace(1,0,4410)
    path=SRC/'lose-regenerated-v5.wav'
    with wave.open(str(path),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate)
        w.writeframes((np.clip(song,-.85,.85)*32767).astype('<i2').tobytes())
    encode(path,OUT/'lose.mp3')
    encode(path,OUT/'lose-v5.mp3')
    print('Selected home V1 / battle V1 / boss battle V2; regenerated dejected lose V5 (3.2s).')

if __name__=='__main__': main()
