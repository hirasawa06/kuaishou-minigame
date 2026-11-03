#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen-audio.py — 合成短音效（无第三方素材，纯 ffmpeg 正弦/噪声合成）

输出到 package/res/Audio/：
  place / discard / start / win / lose / wave / boss / base / arrow / magic / hit
所有音效都很短（0.15~1.2s），单声道 44.1kHz，体积只有几 KB。
"""

import math
import os
import struct
import subprocess
import wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "package", "res", "Audio")
RATE = 44100


def envelope(i, n, attack=0.01, release=0.6):
    a = int(RATE * attack)
    if i < a:
        return i / max(1, a)
    r = n - i
    tail = int(n * release)
    if r < tail:
        return r / max(1, tail)
    return 1.0


def tone(freq, dur, kind="sine", vol=0.35, sweep=None, decay=2.0):
    n = int(RATE * dur)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / RATE
        f = freq if sweep is None else freq + (sweep - freq) * (i / max(1, n))
        phase += 2 * math.pi * f / RATE
        if kind == "sine":
            s = math.sin(phase)
        elif kind == "square":
            s = 1.0 if math.sin(phase) > 0 else -1.0
        elif kind == "tri":
            s = 2.0 * abs(2.0 * (phase / (2 * math.pi) % 1.0) - 1.0) - 1.0
        else:
            s = math.sin(phase)
        env = envelope(i, n) * math.exp(-decay * t)
        out.append(s * env * vol)
    return out


def noise_burst(dur, vol=0.25, lowpass=0.25, decay=4.0):
    n = int(RATE * dur)
    prev = 0.0
    out = []
    for i in range(n):
        t = i / RATE
        r = (math.sin(i * 12.9898) * 43758.5453) % 1.0 * 2 - 1
        prev = prev + lowpass * (r - prev)
        out.append(prev * math.exp(-decay * t) * vol * envelope(i, n))
    return out


def mix(*tracks):
    n = max(len(t) for t in tracks)
    out = [0.0] * n
    for t in tracks:
        for i, v in enumerate(t):
            out[i] += v
    peak = max(1e-6, max(abs(v) for v in out))
    scale = 0.85 / peak if peak > 0.85 else 1.0
    return [v * scale for v in out]


def write_wav(samples, path):
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        frames = bytearray()
        for s in samples:
            v = int(max(-1.0, min(1.0, s)) * 32767)
            frames += struct.pack("<h", v)
        w.writeframes(bytes(frames))


def to_mp3(wav_path, mp3_path):
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-i", wav_path,
        "-codec:a", "libmp3lame", "-b:a", "64k", "-ac", "1", mp3_path,
    ], check=True)


SFX = {
    # 放置单位：短促上行
    "place": lambda: mix(tone(420, 0.18, "tri", 0.35, sweep=720, decay=6),
                         noise_burst(0.06, 0.12)),
    # 丢卡：下行
    "discard": lambda: mix(tone(520, 0.16, "tri", 0.28, sweep=260, decay=7)),
    # 开始
    "start": lambda: mix(tone(392, 0.16, "tri", 0.3, decay=3),
                         tone(523, 0.16, "tri", 0.0, decay=3)[:0] + [],
                         tone(587, 0.30, "tri", 0.3, decay=2.5)),
    # 新一波
    "wave": lambda: mix(tone(330, 0.35, "tri", 0.3, sweep=495, decay=3),
                        noise_burst(0.12, 0.08)),
    # 弓箭
    "arrow": lambda: mix(noise_burst(0.09, 0.3, 0.5, 8), tone(1200, 0.06, "sine", 0.12, sweep=700, decay=12)),
    # 法术
    "magic": lambda: mix(tone(660, 0.28, "sine", 0.22, sweep=300, decay=4),
                         noise_burst(0.2, 0.1, 0.18, 5)),
    # 近战命中
    "hit": lambda: noise_burst(0.09, 0.28, 0.3, 9),
    # 基地受击
    "base": lambda: mix(tone(110, 0.32, "sine", 0.45, sweep=70, decay=4),
                        noise_burst(0.16, 0.2, 0.12, 6)),
    # 首领登场 / 死亡
    "boss": lambda: mix(tone(90, 0.7, "sine", 0.4, sweep=55, decay=1.6),
                        noise_burst(0.5, 0.18, 0.08, 3)),
    # 胜利
    "win": lambda: mix(tone(523, 0.5, "tri", 0.3, decay=1.4),
                       tone(659, 0.5, "tri", 0.3, decay=1.4),
                       tone(784, 0.7, "tri", 0.32, decay=1.1)),
    # 失败
    "lose": lambda: mix(tone(392, 0.6, "tri", 0.3, sweep=196, decay=1.9),
                        tone(196, 0.7, "sine", 0.25, sweep=130, decay=1.6)),
}


def main():
    os.makedirs(OUT, exist_ok=True)
    tmp = "/tmp/td-sfx"
    os.makedirs(tmp, exist_ok=True)
    made = []
    for name, fn in SFX.items():
        wav = os.path.join(tmp, name + ".wav")
        mp3 = os.path.join(OUT, name + ".mp3")
        write_wav(fn(), wav)
        to_mp3(wav, mp3)
        made.append((name, os.path.getsize(mp3)))
    total = sum(s for _, s in made)
    print("音效:", ", ".join(f"{n}({s}B)" for n, s in made))
    print("合计 %.1f KB" % (total / 1024))


if __name__ == "__main__":
    main()
