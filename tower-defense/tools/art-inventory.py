#!/usr/bin/env python3
"""只读美术盘点：输出JSON，不搬移、不删除任何文件。"""
import hashlib
import argparse
import json
import re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MEDIA = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ttf", ".otf", ".woff", ".woff2", ".psd", ".ai"}


def domain(path):
    value = str(path).lower()
    if "reference-analysis/" in value:
        return "references"
    if any(key in value for key in ["font", "sprites", "hud-panel", "shop-", "menu-icons", "arrows", "nameplate", "frame-overlay", "level-lock", "start-paw"]):
        return "ui"
    if any(key in value for key in ["collection", "level-covers", "avatars", "home-background", "home-level-card", "hero-levels", "yoola-assets", "guardian-photo"]):
        return "outgame"
    return "ingame"


def tier(path):
    value = str(path)
    if "/package/res/" in value:
        return "runtime"
    if "/package/yoola-assets/" in value:
        return "platform"
    if any(key in value for key in ["history/", "review", "comparison", "reference-analysis/"]):
        return "reference"
    if "/tools/src/" in value or "/tools/fonts/" in value:
        return "source"
    return "reference"


def text_sources():
    result = []
    for base in [ROOT / "tower-defense/package", ROOT / "tower-defense/tools"]:
        for path in sorted(base.rglob("*")):
            if path.is_file() and path.suffix in {".js", ".html", ".json", ".py", ".mjs"}:
                result.append((str(path.relative_to(ROOT)), path.read_text(errors="replace")))
    return result


def inventory():
    sources = text_sources()
    records = []
    for base in [ROOT / "tower-defense", ROOT / "reference-analysis"]:
        for path in sorted(base.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in MEDIA:
                continue
            if any(part in {"node_modules", ".git", ".venv"} for part in path.parts):
                continue
            relative = path.relative_to(ROOT)
            refs = [name for name, text in sources if path.name in text]
            kind = tier(relative)
            active = [name for name in refs if "/package/" in name]
            if kind == "runtime" and re.fullmatch(r"level-\d+\.jpg", path.name):
                active.append("tower-defense/package/gameplay/assets.js（1—10关模板路径）")
            if kind == "runtime" and "collection-scenes-figma-263-161-hd/" in str(relative):
                active.append("tower-defense/package/gameplay/assets.js（5位英雄动态模板路径）")
            state = "运行/元数据引用" if active else "工具引用，保留生成链" if refs else "未发现静态引用，待核对"
            if kind in {"source", "reference"}:
                state = "生成/参考用途，不能按未引用直接删除"
            destination = domain(relative)
            if kind == "runtime":
                # 运行图已经按领域和用途入位；盘点输出当前实体而非扁平化猜测路径。
                target = str(relative)
            elif kind == "platform":
                target = str(relative)
            else:
                target = "tower-defense/art/" + destination + "/" + kind + "/" + str(relative)
            dimensions = "—"
            if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".webp"}:
                with Image.open(path) as image:
                    dimensions = f"{image.width}×{image.height} {image.mode}"
            records.append({"path": str(relative), "domain": destination, "tier": kind,
                            "bytes": path.stat().st_size, "dimensions": dimensions,
                            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                            "refs": refs[:3], "reference_count": len(refs),
                            "active": active[:3], "state": state, "suggested": target})
    return records


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--domain", choices=["ui", "outgame", "ingame", "references"])
    selected = parser.parse_args().domain
    print(json.dumps([item for item in inventory() if not selected or item["domain"] == selected], ensure_ascii=False))
