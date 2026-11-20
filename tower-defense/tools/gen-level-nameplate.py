#!/usr/bin/env python3
"""决定：导入用户透明关卡信息条，保留原图并生成运行素材。"""
import argparse
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "tools/src/level-nameplate/approved-paw.png"
OUTPUT = ROOT / "package/res/Image/ui/components/home-level-nameplate-v3.png"


def build(input_path):
    # ── 原图归档；固定裁切只移除组件外的透明空白 ──────────
    with Image.open(input_path) as original:
        image = original.convert("RGBA")
    if input_path != SOURCE:
        SOURCE.parent.mkdir(parents=True, exist_ok=True)
        image.save(SOURCE)
    image = image.crop((6, 4, 1302, 408))
    image = image.resize((1024, 319), Image.Resampling.LANCZOS)
    image.save(OUTPUT, optimize=True)
    print(f"关卡信息条：{OUTPUT}，{image.size}，{image.mode}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=SOURCE)
    build(parser.parse_args().input)
