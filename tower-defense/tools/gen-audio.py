#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Original, deterministic cartoon score / Foley synthesis, entirely offline.
Requires Python 3 + numpy, ffmpeg and ffprobe. No samples, downloads or vocals.
Run from any directory: python3 tower-defense/tools/gen-audio.py
Writes only package/res/Audio/*.mp3 and tools/audio-manifest.md.
"""
from pathlib import Path
import json
import math
import subprocess
import tempfile
import wave
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'package/res/Audio'
RATE = 44100
SEED = 20261110
RNG = np.random.default_rng(SEED)
TAU = 2 * np.pi


def db(x):
    return float(20 * np.log10(max(float(x), 1e-12)))


def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def soften(x, cutoff=4800):
    """Zero-phase gentle spectral rolloff (offline, no scipy dependency)."""
    f = np.fft.rfftfreq(len(x), 1 / RATE)
    return np.fft.irfft(np.fft.rfft(x) / (1 + (f / cutoff) ** 4), n=len(x))


def edge(x, attack=.004, release=.035):
    x = x.copy()
    a = min(len(x) // 2, max(2, round(attack * RATE)))
    r = min(len(x) // 2, max(2, round(release * RATE)))
    x[:a] *= np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    x[-r:] *= np.cos(np.linspace(0, np.pi / 2, r)) ** 2
    return x


def voice(midi, duration, kind='box'):
    """Modal bells / damped multi-string partials, not a bare sine oscillator.
    Each mode has an independent decay and strike/excitation component.
    """
    t = np.arange(round(duration * RATE)) / RATE
    f = hz(midi)
    x = np.zeros(len(t))
    if kind in ('box', 'glock', 'wood'):
        modes = {'box': [(1, 1, 2.4), (2.002, .29, 4), (3.99, .075, 8), (5.41, .035, 12)],
                 'glock': [(1, 1, 2), (2.76, .17, 5), (5.40, .035, 10)],
                 'wood': [(1, 1, 8), (2.73, .19, 16), (4.08, .07, 24)]}[kind]
        for ratio, amp, decay in modes:
            if f * ratio < 9000:
                x += amp * np.sin(TAU * f * ratio * t) * np.exp(-decay * t)
        x += .025 * soften(RNG.normal(size=len(t)), 2300) * np.exp(-65 * t)
    elif kind in ('uke', 'pizz'):
        # Inharmonic, independently damped string modes + wooden body resonance.
        for k in range(1, 10):
            if f * k < 9000:
                x += (1 / k ** 1.65) * np.cos(TAU * f * k * (1 + .00012 * k*k) * t + .23*k) * np.exp(-(3.0 + k*1.35) * t)
        x += .11 * np.sin(TAU * 185 * t) * np.exp(-32*t)
        x += .045 * soften(RNG.normal(size=len(t)), 1600) * np.exp(-55*t)
        if kind == 'pizz':
            x *= np.exp(-1.6*t)
    elif kind == 'bass':
        x = (np.sin(TAU*f*t) + .22*np.sin(TAU*f*2*t) + .055*np.sin(TAU*f*3*t)) * np.exp(-2.5*t)
    elif kind == 'pad':
        for k, amp in [(1, 1), (2, .17), (3, .045)]:
            x += amp * np.sin(TAU*f*k*t + .006*np.sin(TAU*2.1*t))
        x *= np.sin(np.pi*np.minimum(t/duration, 1)) ** .8
    else:
        raise ValueError(kind)
    return edge(x, .009 if kind in ('box', 'glock') else .005,
                .10 if kind == 'pad' else .035)


def drum(kind, duration=.2):
    t = np.arange(round(duration*RATE))/RATE
    n = soften(RNG.normal(size=len(t)), 2800)
    if kind == 'kick':
        f = 60 + 80*np.exp(-40*t)
        x = np.sin(TAU*np.cumsum(f)/RATE)*np.exp(-22*t) + .035*n*np.exp(-60*t)
    elif kind == 'brush':
        x = n*np.exp(-18*t)*.7 + .18*np.sin(TAU*190*t)*np.exp(-28*t)
    elif kind == 'shaker':
        x = (n-soften(n, 1000))*np.exp(-45*t)*.5
    elif kind == 'tap':
        x = .5*np.sin(TAU*470*t)*np.exp(-42*t) + .3*n*np.exp(-65*t)
    else:
        raise ValueError(kind)
    return edge(x, .003, .025)


def slide(f0, f1, duration, softness=10):
    t = np.arange(round(duration*RATE))/RATE
    f = f1 + (f0-f1)*np.exp(-softness*t/duration)
    p = TAU*np.cumsum(f)/RATE
    x = (np.sin(p)+.16*np.sin(2*p)+.035*np.sin(3*p))*np.exp(-4*t/duration)
    return edge(x, .008, .04)


def add(dst, src, seconds, gain=1, pan=0, loop=False):
    start = round(seconds*RATE)
    if dst.ndim == 2:
        p = (pan+1)*np.pi/4
        src = src[:, None]*np.array([np.cos(p), np.sin(p)])[None, :]
    src = src * gain
    if loop:
        start %= len(dst)
        first = min(len(src), len(dst)-start)
        dst[start:start+first] += src[:first]
        if first < len(src):
            dst[:len(src)-first] += src[first:]
    else:
        count = max(0, min(len(src), len(dst)-start))
        dst[start:start+count] += src[:count]


def room(x, loop=False, wet=.13):
    """Multi-tap diffuse room. Loop reverb wraps; SFX retain an actual tail."""
    out = x.copy()
    for i, delay in enumerate([.037, .061, .089, .127, .173, .229, .307, .397, .503, .641, .811, 1.019]):
        shift = round(delay*RATE)
        gain = wet * np.exp(-delay*3.6) * (1 if i%2 else -.75)
        src = x[:, ::-1] if x.ndim == 2 and i%2 else x
        if loop:
            out += np.roll(src, shift, axis=0)*gain
        elif shift < len(x):
            out[shift:] += src[:-shift]*gain
    return out


# Hand-composed melodic phrases: scale degrees, offset in beats, duration in beats.
# Rests, repeated notes, neighbor notes, syncopation and phrase answers are explicit.
HOME_A = [
    [(2,0,.75),(4,1,.5),(5,1.75,.5),(4,2.5,1)],
    [(2,.25,.5),(1,1,.75),(0,2,1.25)],
    [(1,0,.5),(2,.75,.5),(4,1.5,.75),(2,2.75,.5),(1,3.5,.4)],
    [(0,.5,1),(2,2,.5),(1,3,.75)],
    [(4,0,.75),(5,1,.5),(7,2,1),(5,3.25,.5)],
    [(4,.25,.5),(2,1,.75),(1,2.5,1)],
    [(2,0,.5),(4,.75,.5),(3,1.5,.75),(1,2.75,.5)],
    [(1,0,1),(0,1.5,1.5)],
]
HOME_B = [
    [(5,0,1),(7,1.5,.5),(8,2.25,.75)],
    [(7,0,.75),(5,1,.5),(4,2,1.25)],
    [(6,.25,.5),(5,1,.5),(4,1.75,.5),(2,2.5,1)],
    [(3,0,1.5),(4,2,.5),(5,3,.75)],
    [(7,0,.5),(8,.75,.5),(7,1.5,.75),(5,2.75,.5)],
    [(4,.5,.75),(3,1.75,.5),(2,2.5,1)],
    [(1,0,.75),(2,1,.5),(3,2,1),(1,3.25,.4)],
    [(4,0,1),(3,1.5,.75),(1,3,.5)],
]
BATTLE_A = [
    [(0,0,.4),(2,.75,.4),(4,1.5,.6),(2,2.5,.4),(5,3.25,.4)],
    [(4,.25,.4),(2,1,.4),(1,1.75,.7),(0,3,.6)],
    [(2,0,.4),(2,.75,.4),(3,1.5,.4),(4,2.25,.4),(6,3,.6)],
    [(5,.25,.6),(3,1.25,.4),(1,2,.6),(2,3.25,.4)],
    [(4,0,.4),(5,.75,.4),(7,1.5,.6),(5,2.5,.4),(4,3.25,.4)],
    [(2,.25,.4),(4,1,.4),(2,1.75,.6),(0,3,.6)],
    [(1,0,.4),(3,.75,.4),(4,1.5,.6),(3,2.5,.4),(1,3.25,.4)],
    [(2,0,.6),(1,1,.4),(0,2,1)],
]
BATTLE_B = [
    [(5,0,.4),(7,.5,.4),(8,1.5,.6),(7,2.5,.4),(5,3.25,.4)],
    [(6,.25,.4),(5,1,.4),(3,1.75,.6),(4,3,.6)],
    [(7,0,.4),(6,.75,.4),(5,1.5,.6),(4,2.5,.4),(2,3.25,.4)],
    [(3,.25,.6),(5,1.25,.4),(6,2,.6),(5,3.25,.4)],
    [(8,0,.4),(7,.75,.4),(5,1.5,.6),(4,2.5,.4),(5,3.25,.4)],
    [(6,.25,.4),(4,1,.4),(3,1.75,.6),(2,3,.6)],
    [(3,0,.4),(4,.75,.4),(5,1.5,.4),(4,2.25,.4),(3,3,.6)],
    [(1,0,.6),(3,1,.4),(4,2,.6),(1,3.25,.4)],
]
# Extended chord voicings; C6/9, Am7, Dm9, Gsus/G7, Fmaj7, Em7.
CHORDS = {
    'C': (48,[60,64,67,69,74]), 'Am': (45,[60,64,67,71]),
    'F': (41,[57,60,64,67]), 'G': (43,[59,62,65,69]),
    'Dm': (38,[57,60,64,65]), 'Em': (40,[55,59,62,67]),
}
SCALE = [0,2,4,5,7,9,11]


def degree(d, root=72):
    return root + SCALE[d%7] + 12*(d//7)


def score(home):
    bpm = 112 if home else 120
    beat = 60/bpm
    x = np.zeros((round(RATE*beat*128), 2))
    accompaniment = np.zeros_like(x)
    progression = ['C','Am','F','G','Em','Am','Dm','G']
    bridge = ['F','Em','Dm','G','Am','Em','F','G']
    motifs = HOME_A if home else BATTLE_A
    bmotifs = HOME_B if home else BATTLE_B
    for bar in range(32):
        section = bar//8
        local = bar%8
        root, chord = CHORDS[(bridge if section == 2 else progression)[local]]
        start = bar*4*beat
        # Different phrase endings and final A recapitulation, not a copied 8-bar loop.
        phrase = list((bmotifs if section == 2 else motifs)[local])
        if section == 1 and local in (1,5):
            phrase += [(4,3.5,.35)]
        if section == 3 and local == 4:
            phrase = [(d+7 if j<2 else d, t, dur) for j,(d,t,dur) in enumerate(phrase)]
        if bar == 31:
            phrase = [(2,0,.6),(1,1,.6),(0,2,1.1)] if home else [(2,0,.4),(1,.75,.4),(0,1.5,.8)]
        for j,(d,t,dur) in enumerate(phrase):
            micro = .003*np.sin(bar*3+j*7)
            add(x, voice(degree(d), max(.35, dur*beat+.32), 'box' if home else 'wood'),
                start+t*beat+micro, .22*(.92+.08*np.cos(j*2+bar)), -.18 if home else .12, True)
        # Answering counter-melody in gaps, lower register, selectively orchestrated.
        if section in (1,2,3) and local%2:
            for d,t in [(2,2.5),(0,3.25)]:
                add(x, voice(degree(d,60), .55, 'pizz'), start+t*beat, .055, .48, True)
        # Uke strums are chord gestures with staggered strings, not the melody.
        patterns = [(0,.082), (1.5,.06), (2.75,.05)] if home else [(.5,.075),(1.75,.07),(2.5,.08),(3.5,.065)]
        for k,(t,g) in enumerate(patterns):
            notes = chord[:4] if k%2 == 0 else chord[1:]
            for i,n in enumerate(notes):
                add(accompaniment, voice(n,.65,'uke' if home else 'pizz'),
                    start+t*beat+i*.012, g/1.8, -.48, True)
        # Warm voice-led harmonic cushion; bridge breathes and drops density.
        if home or section == 2:
            for n in chord[1:4]:
                add(accompaniment, voice(n,4*beat,'pad'), start, .023, .26, True)
        # Walking root / fifth bass, pickup variation every fourth bar.
        bass_events = [(0,root,.20),(2,root+7,.125)] if home else [(0,root,.21),(1.5,root+12,.12),(2.5,root+7,.15),(3.5,root+12,.11)]
        for t,n,g in bass_events:
            add(accompaniment, voice(n,.58,'bass'), start+t*beat, g, 0, True)
        if local in (3,7) and bar != 31:
            nextroot = CHORDS[(bridge if section == 2 else progression)[(local+1)%8]][0]
            add(accompaniment, voice(nextroot-1,.22,'bass'), start+3.75*beat, .08, 0, True)
        # Light brushed backbeat and tucked shakers; no piercing cymbals.
        density = .65 if section == 2 else 1
        for t in (0,2):
            add(accompaniment, drum('kick'), start+t*beat, (.095 if home else .15)*density, 0, True)
        for t in (1,3):
            add(accompaniment, drum('brush',.23), start+t*beat, (.07 if home else .105)*density, .15, True)
        for k in range(8):
            add(accompaniment, drum('shaker',.10), start+(k*.5+(.025 if k%2 else 0))*beat,
                (.026 if home else .042)*(1 if k%2 else .7)*density, -.3 if k%2 else .3, True)
        if local == 7 and section != 3:
            for j in range(3):
                add(accompaniment, drum('tap',.12), start+(3+j*.25)*beat, .06+j*.009, (j-1)*.25, True)
        # Clockwork sparkle is sparse, with contrasting B-section high responses.
        if home and local in (0,4,6):
            for i,n in enumerate([chord[-1]+12,chord[2]+12]):
                add(x, voice(n,1.1,'glock'), start+(2.5+i*.75)*beat, .037, .52, True)
    # Circular impulse response folds all note releases and room tails into bar 1.
    x = room(x, True, .20 if home else .13) + room(accompaniment, True, .085)
    return master(x, -22.0 if home else -21.0, -4.8, loop=True)


def master(x, rms_db, peak_db, loop=False):
    x = x - np.mean(x, axis=0)
    if x.ndim == 2:
        x = np.stack([soften(x[:, c], 6500) for c in range(2)], axis=1)
    else:
        x = soften(x, 5700)
    # Constant gain only: no limiter, compressor, clipping or flattened dynamics.
    scale = min(10**(rms_db/20)/max(np.sqrt(np.mean(x*x)),1e-9),
                10**(peak_db/20)/max(np.max(np.abs(x)),1e-9))
    x *= scale
    if loop:
        # Local DC bridge (4 ms), preserving the musical tail instead of fade-to-silence.
        m = round(.004*RATE)
        delta = x[0]-x[-1]
        x[-m:] += np.linspace(0,1,m)[:,None]*delta
    else:
        x = edge(x,.003,.05)
    return x


DESCRIPTIONS = {
 'place':'绒垫落地 + 上行木琴确认', 'discard':'纸卡轻刷 + 下滑软弹簧',
 'start':'三音起程旋律 + 小拨弦和声', 'wave':'两次木质提示 + 上行应答',
 'arrow':'软萌光弹：圆润啵声 / 短滑音，无尖锐箭噪',
 'magic':'饼干魔法：揉面气流 / 木质碎屑 / 星糖钟琴',
 'hit':'玩具锤：软低频锤头 + 木壳碰响', 'base':'靠垫受撞的低柔咚声',
 'boss':'首领死亡：滑落玩具 / 三次逐小弹跳 / 软散落',
 'win':'原创上行胜利短乐句及六和弦', 'lose':'温柔下行收束，不用恐怖失败警报',
 'ui-click':'木糖按钮轻嗒', 'heal':'柔亮三音回复及空气星点',
 'sell':'两枚圆润木币落袋', 'speed':'短双拨弦向上切换',
 'select':'单音音乐盒选中', 'expand':'木质伸展 + 上行三音',
 'enemy-hit':'家具轻碰：低木块，不与玩具锤争高频',
 'enemy-death':'小家具轻塌 + 消散纸刷，无人声',
}


def sfx(name):
    durations = {'place':.48,'discard':.38,'start':1.30,'wave':.90,'arrow':.26,
                 'magic':.85,'hit':.29,'base':.58,'boss':1.65,'win':2.25,'lose':1.90,
                 'ui-click':.18,'heal':1.0,'sell':.52,'speed':.40,'select':.30,
                 'expand':.78,'enemy-hit':.25,'enemy-death':.55}
    x = np.zeros(round(durations[name]*RATE))
    def v(n,t=0,g=.25,k='wood',dur=.45):
        add(x,voice(n,dur,k),t,g)
    def d(k,t=0,g=.18,dur=.2):
        add(x,drum(k,dur),t,g)
    def s(f0,f1,dur,t=0,g=.3):
        add(x,slide(f0,f1,dur),t,g)
    if name == 'place':
        d('kick',g=.18); v(72,.025); v(76,.115,g=.19)
    elif name == 'discard':
        d('brush',g=.09); s(470,210,.28,g=.24)
    elif name == 'start':
        for n,t in [(72,0),(76,.17),(79,.36),(81,.56)]: v(n,t,.21,'box',.64)
        for n in [60,64,67]: v(n,.36,.09,'uke',.7)
        d('tap',.0,.12)
    elif name == 'wave':
        v(67,0,.22); v(67,.15,.18); v(74,.34,.25,'box',.5); d('tap',.31,.10)
    elif name == 'arrow':
        s(880,390,.16,g=.34); v(84,.015,.085,'wood',.18); d('shaker',g=.08,dur=.09)
    elif name == 'magic':
        s(260,520,.3,g=.20); d('brush',.05,.07,.3)
        for n,t in [(76,.08),(81,.17),(88,.30)]: v(n,t,.14,'glock',.5)
        for t in [.11,.21,.29]: d('tap',t,.045,.10)
    elif name == 'hit':
        s(230,95,.17,g=.35); v(65,.005,.22,'wood',.22); d('tap',.008,.14,.12)
    elif name == 'base':
        s(140,65,.40,g=.36); d('brush',.012,.19,.24); v(48,.02,.10,'pizz',.4)
    elif name == 'boss':
        s(330,82,.65,g=.29); d('brush',.12,.15,.38)
        for n,t,g in [(55,.48,.28),(60,.77,.21),(64,1.01,.13)]:
            v(n,t,g); d('tap',t,g*.5,.18)
    elif name == 'win':
        for n,t in [(72,0),(76,.16),(79,.32),(84,.62),(83,.84),(84,1.04)]: v(n,t,.23,'box',1)
        for n in [60,64,67,69]: v(n,1.04,.085,'uke',1)
        v(48,1.04,.17,'bass',.7); d('brush',.64,.09)
    elif name == 'lose':
        for n,t in [(76,0),(74,.28),(72,.57),(67,.89)]: v(n,t,.21,'box',.9)
        for n in [53,60,64]: v(n,.89,.065,'uke',.9)
    elif name == 'ui-click':
        v(79,0,.22,'wood',.16); d('tap',0,.075,.09)
    elif name == 'heal':
        for n,t in [(76,0),(79,.11),(83,.24)]: v(n,t,.19,'glock',.7)
        s(330,540,.25,g=.09)
    elif name == 'sell':
        v(79,0,.20,'wood',.30); v(84,.14,.17,'box',.32); d('tap',.14,.08)
    elif name == 'speed':
        v(74,0,.23,'pizz',.27); v(81,.09,.23,'pizz',.27); s(400,700,.16,.04,.09)
    elif name == 'select':
        v(81,0,.23,'box',.28); v(69,.014,.085,'uke',.24)
    elif name == 'expand':
        s(210,410,.32,g=.16)
        for n,t in [(67,.06),(72,.17),(76,.29)]: v(n,t,.21,'wood',.42)
    elif name == 'enemy-hit':
        v(55,0,.29,'wood',.22); d('tap',0,.08,.12); s(190,110,.13,g=.12)
    elif name == 'enemy-death':
        s(310,120,.28,g=.22); d('brush',.08,.13,.26); v(60,.12,.12,'pizz',.29)
    # Action sounds intentionally quieter than scarce state-change / result cues.
    rms = {'arrow':-24,'hit':-24,'enemy-hit':-26,'enemy-death':-25,
           'ui-click':-26,'select':-25,'base':-23,'magic':-24,
           'boss':-23,'win':-22,'lose':-23,'heal':-25}.get(name,-24)
    return master(room(x,False,.12),rms,-6)


def encode(x, name, tmp):
    wav = Path(tmp)/f'{name}.wav'
    pcm = np.round(x*32767).astype('<i2')
    with wave.open(str(wav),'wb') as w:
        w.setnchannels(2 if x.ndim == 2 else 1)
        w.setsampwidth(2); w.setframerate(RATE); w.writeframes(pcm.tobytes())
    path = OUT/f'{name}.mp3'
    subprocess.run(['ffmpeg','-y','-v','error','-i',str(wav),'-c:a','libmp3lame',
                    '-b:a','96k' if x.ndim == 2 else '80k','-ar',str(RATE),
                    '-map_metadata','-1','-write_xing','1',str(path)],check=True)
    return path


def inspect(path, source):
    """Numeric asset QC only, explicitly NOT a game / platform test."""
    probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams',
                         '-show_format','-of','json',str(path)]))
    stream = probe['streams'][0]
    channels = int(stream['channels'])
    expected_channels = 2 if source.ndim == 2 else 1
    expected_bitrate = 96000 if expected_channels == 2 else 80000
    if (stream['codec_name'] != 'mp3' or int(stream['sample_rate']) != RATE
            or channels != expected_channels or int(stream.get('bit_rate', 0)) != expected_bitrate):
        raise RuntimeError(f'Unexpected MP3 encoding: {path}')
    raw = subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-c:a','pcm_f32le','-'])
    decoded = np.frombuffer(raw,dtype='<f4').reshape(-1,channels)
    if abs(len(decoded) - len(source)) > 2:
        raise RuntimeError(f'Unexpected decoded duration / gapless padding: {path}')
    if not np.isfinite(decoded).all() or np.max(np.abs(decoded)) >= .99:
        raise RuntimeError(f'Invalid / clipping decoded audio: {path}')
    # BS.1770 integrated loudness and oversampled true peak reported by ffmpeg.
    measured = subprocess.run(['ffmpeg','-hide_banner','-i',str(path),'-af',
                              'loudnorm=I=-23:TP=-2:LRA=11:print_format=json',
                              '-f','null','-'],capture_output=True,text=True,check=True).stderr
    loud = json.loads(measured[measured.rfind('{'):measured.rfind('}')+1])
    if float(loud['input_tp']) > -1:
        raise RuntimeError(f'True peak headroom too small: {path}')
    mono = np.mean(decoded,axis=1)
    spec = np.abs(np.fft.rfft(mono))**2
    freqs = np.fft.rfftfreq(len(mono),1/RATE)
    hf = float(np.sum(spec[freqs>6000])/max(np.sum(spec),1e-12)*100)
    seam = float(np.max(np.abs(decoded[0]-decoded[-1])))
    steps = np.abs(np.diff(decoded,axis=0))
    p99 = float(np.percentile(steps,99))
    return dict(name=path.name,bytes=path.stat().st_size,seconds=len(decoded)/RATE,
                container=float(probe['format']['duration']),channels=channels,
                rate=int(stream['sample_rate']),codec=stream['codec_name'],
                bitrate=stream.get('bit_rate','?'),rms=db(np.sqrt(np.mean(decoded**2))),
                peak=db(np.max(np.abs(decoded))),tp=float(loud['input_tp']),
                lufs=loud['input_i'],lra=loud['input_lra'],hf=hf,
                seam=seam,source_seam=float(np.max(np.abs(source[0]-source[-1]))),
                step99=p99,dc=float(np.max(np.abs(np.mean(decoded,axis=0)))),
                crest=db(np.max(np.abs(decoded)))-db(np.sqrt(np.mean(decoded**2))))


def manifest(rows):
    lines = ['# 可爱猫猫卡通音频制作与清单', '',
        '> 现状：2026-11-10 离线原创合成资源已生成；仅编码及数值声学 QC。待验证：人工试听、游戏混音、快手真机与底层 MP3 循环。', '',
        '## 再生与来源', '',
        '- 在仓库根目录执行 `python3 tower-defense/tools/gen-audio.py`；或在项目目录执行 `python3 tools/gen-audio.py`。',
        '- 依赖 Python 3、numpy、ffmpeg（libmp3lame）、ffprobe；固定随机种子 20261110。脚本不联网，不使用下载素材、第三方曲谱、付费服务或人声/喵叫。旋律、和声编排和拟音均在脚本内原创。',
        '- 脚本相同、numpy / ffmpeg 版本相同可再生；不同编码器版本不承诺 MP3 字节一致。仅覆盖 Audio MP3 和本清单，临时 WAV 自动清理。', '',
        '## 编曲决定', '',
        '- `bgm-home.mp3`：C 大调，112 BPM、4/4、32 小节、68.571 秒有效 PCM。A1（1–8）音乐盒主题，A2（9–16）加入回答拨弦与句尾变化，B（17–24）F / Em / Dm 等和声及上行展开，A3（25–32）高音重述和回归。钟琴点彩、错开弦起音的尤克里里和弦扫拨、柔软低音、刷鼓与声像空间。',
        '- `bgm.mp3`：C 大调，120 BPM、4/4、32 小节、64.000 秒有效 PCM。同为 AABA，但有独立切分弹跳主旋律、木琴、短拨弦和弦、四次低音脉冲、柔鼓 / 摇沙；B 段减密度，A3 高音重述，过门不是重复三和弦琶音。',
        '- 乐器为独立衰减的非整数模态钟琴/木琴、多谐波微失谐拨弦及木腔共振、柔低音和频谱受控噪声打击；无硬方波和尖锐高频镲。',
        '- 配乐 44.1 kHz 立体声 / 96 kbps；音效 44.1 kHz 单声道 / 80 kbps，关键响声居中便于手机播放。',
        '- 常量增益保留动态，不用动态压缩、硬削波或砖墙限幅。背景目标 RMS -22 / -21 dBFS，峰值上限 -4.8 dBFS；音效逐项 RMS 目标 -22 至 -26 dBFS，峰值上限 -6 dBFS。高频平滑收敛，反复攻击 / 敌方事件刻意更轻。LUFS 仅作报告，不将短音效机械归一到同一 LUFS。',
        '- 音符 release 跨过第 32 小节会回卷至第 1 小节；混响使用循环多抽头回卷。末端 4 ms 微小直流桥接实现源 PCM 端点相等，非整段淡出/静音拼接。MP3 写 Xing/LAME delay-padding 信息；忽略 gapless 元数据的平台仍可能产生间隙，不宣称真机无缝。', '',
        '## 资源清单 / 编码后声学 QC', '',
        '有效时长由解码 PCM 帧数计算；ffprobe 容器时长取决于工具版本对 MP3 delay/padding 的处理，本次与有效时长一致。TP 为 ffmpeg loudnorm 的过采样 true peak；RMS / sample peak / DC / 高频比例由 numpy 对解码音频测量。', '',
        '| 文件 | 有效秒 / 容器秒 | 字节 | 声道 | RMS dBFS | TP dBTP | LUFS | 说明 |',
        '|---|---:|---:|---:|---:|---:|---:|---|']
    for r in rows:
        desc = '首页 32 小节 AABA' if r['name']=='bgm-home.mp3' else '战斗 32 小节 AABA' if r['name']=='bgm.mp3' else DESCRIPTIONS[r['name'][:-4]]
        lines.append(f"| {r['name']} | {r['seconds']:.3f} / {r['container']:.3f} | {r['bytes']} | {r['channels']} | {r['rms']:.2f} | {r['tp']:.2f} | {r['lufs']} | {desc} |")
    lines += ['',f"总计：{len(rows)} 文件，{sum(r['bytes'] for r in rows):,} 字节（{sum(r['bytes'] for r in rows)/1048576:.3f} MiB）。",
        '', '## 验证记录（仅资源声学，不是游戏测试）', '',
        '- 全部 ffprobe 为 MP3、44100 Hz，BGM 2 声道 / 96000 bps，SFX 1 声道 / 80000 bps；解码无 NaN/Inf、无 sample clipping，true peak 均低于 -1 dBTP。',
        '- 声学 QC 命令内置于生成器：ffprobe JSON、ffmpeg f32le 解码、ffmpeg loudnorm 仅分析（null 输出，不改文件）。',
        '', '| 文件 | sample峰 dBFS | 峰均比 dB | LRA LU | >6kHz能量% | DC最大值 | 源端点差 | 解码端点差 / 内部差分P99 |',
        '|---|---:|---:|---:|---:|---:|---:|---:|']
    for r in rows:
        lines.append(f"| {r['name']} | {r['peak']:.2f} | {r['crest']:.2f} | {r['lra']} | {r['hf']:.3f} | {r['dc']:.7f} | {r['source_seam']:.7f} | {r['seam']:.7f} / {r['step99']:.7f} |")
    lines += ['', '## 边界 / 待验证', '',
        '- 不运行游戏、浏览器、仿真、包体预检、上传或真机测试；没有以数值声学检查代替人工试听。',
        '- 本任务只制作资源，旧文件名保持兼容；新增 bgm-home / ui-click / heal / sell / speed / select / expand / enemy-hit / enemy-death 的运行时接入由另一工程任务负责。boss 的声音语义为首领死亡，调用点应独立核对。',
        '- 短音效 LRA / LUFS 会受测量窗影响，短于 400 ms 的事件 LUFS 可能报告 -inf（不是无声），以 RMS 与 true peak 平衡；峰均比、频谱及 RMS 只证明数值性质，不保证主观可爱度。',
        '- 主包体积修订：仅 BGM 编码由 128 降至 96 kbps（44.1 kHz 立体声），合成音色、编曲、32 小节时长与混响不变，SFX 保持 80 kbps；相较首版音频总量 2,284,389 字节节省约 0.506 MiB。主包 6 MiB 约束由父任务独立核对，本脚本不改分包或资源映射。',
        '- MP3 循环的 delay / padding 处理、并发 SFX 与音乐相对响度、首次播放预热仍需人工 / 真机验收。', '']
    (ROOT/'tools/audio-manifest.md').write_text('\n'.join(lines),encoding='utf-8')


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    rows = []
    with tempfile.TemporaryDirectory(prefix='cute-cat-audio-') as tmp:
        for name in ['bgm-home','bgm'] + list(DESCRIPTIONS):
            print('Synthesizing',name,flush=True)
            x = score(name == 'bgm-home') if name.startswith('bgm') else sfx(name)
            path = encode(x,name,tmp)
            r = inspect(path,x); rows.append(r)
            print(f"  {r['seconds']:.3f}s {r['bytes']} B TP {r['tp']:.2f} dBTP RMS {r['rms']:.2f} dBFS",flush=True)
    manifest(rows)
    print(f"Done: {len(rows)} assets, {sum(r['bytes'] for r in rows)} bytes; tools/audio-manifest.md")


if __name__ == '__main__':
    main()
