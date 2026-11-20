#!/usr/bin/env python3
"""首页封面：按关卡范围导入原图，默认重建第1—10关。"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "tools/src/level-covers/approved"
OUTPUT = ROOT / "package/res/Image/outgame/level-covers"
# --- 按视觉主体取景：第一关保留顶部飞碟，第六关聚焦下方宠物 ---
FOCUS = {1: (0.5, 0.0), 7: (0.5, 0.25)}
SUBJECT_CROP = {}


def import_sources(directory, levels):
    SOURCE.mkdir(parents=True, exist_ok=True)
    metadata = json.loads((SOURCE / "sources.json").read_text(encoding="utf-8"))
    records = {item["level"]: item for item in metadata["items"]}
    for level in levels:
        original = directory / ("第" + str(level) + "关.png")
        name = "level-" + str(level) + ".png"
        target = SOURCE / name
        if target.exists() and target.read_bytes() != original.read_bytes():
            history = SOURCE.parent / "history"
            history.mkdir(exist_ok=True)
            digest = hashlib.sha256(target.read_bytes()).hexdigest()[:12]
            (history / ("level-" + str(level) + "-" + digest + ".png")).write_bytes(target.read_bytes())
        target.write_bytes(original.read_bytes())
        records[level] = {"level": level, "source": original.name, "file": name,
            "sha256": hashlib.sha256(original.read_bytes()).hexdigest()}
    (SOURCE / "sources.json").write_text(json.dumps({"status": "决定：用户指定第1—10关封面，第6—10关本轮更新",
        "origin": "用户附件，2026-11-18", "items": [records[key] for key in sorted(records)]}, ensure_ascii=False,
        indent=2) + "\n", encoding="utf-8")


def build_cover(level):
    with Image.open(SOURCE / ("level-" + str(level) + ".png")) as original:
        source = original.convert("RGB")
        if level in SUBJECT_CROP:
            source = source.crop(SUBJECT_CROP[level])
        image = ImageOps.fit(source, (1107, 928),
            method=Image.Resampling.NEAREST if level == 8 else Image.Resampling.LANCZOS,
            centering=FOCUS.get(level, (0.5, 0.5))).convert("RGBA")
    # --- 只输出完整封面，圆角由运行时容器裁切 ---
    image.convert("RGB").resize((768, 644), Image.Resampling.NEAREST if level == 8 else Image.Resampling.LANCZOS).save(
        OUTPUT / ("level-" + str(level) + ".jpg"), quality=92, subsampling=0, optimize=True)


def clean_previous_outputs():
    # --- 仅清理本生成器的七个旧派生文件，不触碰正式原图 ---
    previous = ROOT / "package/res/Menu/level-covers"
    names = ["level-" + str(level) + ".png" for level in range(1, 7)]
    for name in names + ["frame-mask.png"]:
        (previous / name).unlink(missing_ok=True)
    if previous.exists() and not any(previous.iterdir()):
        previous.rmdir()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--import-dir", type=Path)
    parser.add_argument("--levels", type=int, nargs=2, default=[1, 10], metavar=("START", "END"))
    args = parser.parse_args()
    levels = range(args.levels[0], args.levels[1] + 1)
    if args.import_dir:
        import_sources(args.import_dir, levels)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for level in levels:
        build_cover(level)
    # --- 并排复核取景，不进入运行包 ---
    review = Image.new("RGB", (320 * len(levels), 292), "#f3e2c8")
    for index, level in enumerate(levels):
        with Image.open(OUTPUT / ("level-" + str(level) + ".jpg")) as cover:
            review.paste(cover.resize((320, 268), Image.Resampling.LANCZOS), (index * 320, 24))
        ImageDraw.Draw(review).text((index * 320 + 8, 6), "Level " + str(level), fill="#704026")
    review.save(SOURCE.parent / ("review-" + str(args.levels[0]) + "-" + str(args.levels[1]) + ".jpg"), quality=95)
    clean_previous_outputs()
    print("已重建指定关卡封面：768 x 644，JPG质量92，旧派生素材已清理")


if __name__ == "__main__":
    main()
