"""制作工具：导入方圆体，检查下载完整性与 Bold/圆体变轴。"""
import base64
import hashlib
import json
import re
import urllib.request
from pathlib import Path
from fontTools.ttLib import TTFont

DIRECTORY = Path(__file__).resolve().parent / "fonts"
URL = "https://cdn.jsdelivr.net/npm/@fontpkg/alimama-fang-yuan-ti-vf@1.0.5/AlimamaFangYuanTiVF-Thin.ttf"
EXPECTED = "sLjEwFevfbxsy1KjrQATj+1B0a031PSmZrbNQxyRPZQ="


def main():
    target = DIRECTORY / "AlimamaFangYuanTiVF.ttf"
    if not target.exists():
        with urllib.request.urlopen(URL, timeout=60) as response:
            data = response.read()
        digest = base64.b64encode(hashlib.sha256(data).digest()).decode()
        if digest != EXPECTED:
            raise ValueError("字体文件校验失败")
        target.write_bytes(data)
    font = TTFont(target)
    atlas_path = DIRECTORY.parents[1] / "package/gameplay/data/font-atlas.js"
    data = json.loads(re.search(r"A.FontAtlas = (.*);", atlas_path.read_text(encoding="utf-8")).group(1))
    missing = [ch for ch in data["18"]["glyphs"] if ord(ch) >= 128 and ord(ch) not in font.getBestCmap()]
    axes = [{"tag": a.axisTag, "min": a.minValue, "default": a.defaultValue, "max": a.maxValue}
            for a in font["fvar"].axes]
    print(json.dumps({"axes": axes, "source": URL, "missing": missing}, ensure_ascii=False))


if __name__ == "__main__":
    main()
