# 游戏 UI 字体来源

运行时只加载 `package/res/Image/font-*.png` 位图图集；字体文件仅供离线再生成，不在小游戏里动态加载。

- 中文：ZCOOL KuaiLe Regular，来源 [googlefonts/zcool-kuaile](https://github.com/googlefonts/zcool-kuaile/tree/main/fonts/ttf)，SIL OFL 1.1，见 `ZCOOLKuaiLe-OFL.txt`。
- ASCII、数字：Fredoka Variable，来源 [google/fonts/ofl/fredoka](https://github.com/google/fonts/tree/main/ofl/fredoka)，字重 600、宽度 100，SIL OFL 1.1，见 `Fredoka-OFL.txt`。

再生成命令：`/usr/bin/python3 tools/gen-assets.py --fonts-only`（在 `tower-defense/` 目录运行，需 Pillow）。该命令只更新 18、28、48px 字体图集和 `gameplay/data/font-atlas.js`，不重绘其他游戏素材。
