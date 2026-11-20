# 游戏 UI 字体来源

运行时只加载 `package/res/Image/ui/fonts/font-*.png` 位图图集；字体文件仅供离线再生成，不在小游戏里动态加载。

- 当前中文：阿里妈妈方圆体 VF，Bold `wght=700`、圆体 `BEVL=100`；用户于2026-11-18确认替换。原始可变字体保持完整，文件名里的Thin不代表实际生成字重。
- 发布方与授权入口：[阿里妈妈官方](https://www.iconfont.cn/fonts/detail?cnid=pOvFIr086ADR)、[阿里字体](https://www.alibabafonts.com/#/more)；作者声明免费商用，说明与声明图见[来源介绍](https://www.maoken.com/freefonts/19073.html)。字体镜像：`@fontpkg/alimama-fang-yuan-ti-vf@1.0.5/AlimamaFangYuanTiVF-Thin.ttf`；导入器 `tools/import-fangyuan-font.py` 固定版本并校验SHA-256。字体仅供本工程制作，未加入运行包。
- 旧中文（保留供对照）：ZCOOL KuaiLe Regular，来源 [googlefonts/zcool-kuaile](https://github.com/googlefonts/zcool-kuaile/tree/main/fonts/ttf)，SIL OFL 1.1，见 `ZCOOLKuaiLe-OFL.txt`。
- ASCII、数字：Fredoka Variable，来源 [google/fonts/ofl/fredoka](https://github.com/google/fonts/tree/main/ofl/fredoka)，字重 600、宽度 100，SIL OFL 1.1，见 `Fredoka-OFL.txt`。

再生成命令：`/usr/bin/python3 tools/gen-assets.py --fonts-only`（在 `tower-defense/` 目录运行，需 Pillow）。该命令只更新 18、28、48px 字体图集和 `gameplay/data/font-atlas.js`，不重绘其他游戏素材。
