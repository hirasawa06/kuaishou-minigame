# 英雄 runtime 图集量化压缩

状态：**已完成离线量化及图片阅读 / 非游戏或平台验收**。2026-11-11 22:36。

仅修改 `package/res/Image/hero-levels.png` 和 `hero-levels-back.png` 两张 runtime 图片，没有更改其他游戏资源或帧映射。

| 图集 | 原始 RGBA bytes | 256色 PNG bytes | 减少 |
|---|---:|---:|---:|
| hero-levels | 587878 | 129027 | 458851 |
| hero-levels-back | 542019 | 112397 | 429622 |
| 合计 | 1129897 | 241424 | 888473 |

Pillow 环境没有 libimagequant，使用 `FASTOCTREE` 256色、PNG optimize/compress_level9、无抖动。PNG存储为索引色P模式，通过tRNS保留各调色板alpha，加载解码后为RGBA；两张均1000×600、72PPI，alpha范围0~255。核对原透明画布没有新增不透明像素，全部角色格位和装备轮廓保留。

已实际 Read 压缩后的前/后图：15格形态、单双锤头、单双饼干罐、肩甲/盾/枪/医疗包/药瓶仍可识别，背景真正透明，不是重新换色设计。256色量化在大面积毛色、头盔与披风渐变上有可见色阶，这是为包体采用的有损颜色近似；不是无损PNG压缩，不宣称与母版颜色逐像素一致。全部完整RGBA母版与生图源永久保留，后续可换libimagequant改善渐变。

## 完整母版与重复重建

当前最终组合（包括父后续调整）的完整RGBA已原样保存在本目录：

- `hero-levels-runtime-fullRGBA.png`（587878 bytes）
- `hero-levels-back-runtime-fullRGBA.png`（542019 bytes）

先按对应生成/打包脚本重建RGBA，**最后**执行：

```bash
python3 tower-defense/tools/src/hero-levels/compress-runtime.py
```

脚本只处理两张runtime图，自动将新RGBA存为fullRGBA母版；若旧母版内容变化，先保留内容哈希命名的历史版本。若输入已是P模式，会从fullRGBA重新量化而不是重复量化有损图。详情统计写入 `runtime-compression.json`。

## 包体读数

压缩后，本地 `tower-defense/package/` 所有普通文件大小累加：**6168822 bytes = 5.8830 MiB**，低于6MiB（6291456 bytes），余量122634 bytes，约119.8KiB。这个值包括本地现有资源，未删除或改压其他资源。

这是文件大小统计，不是快手上传工具/平台CDN迁移/zip包或审核结果；父后续新增文件后需要重新核对，余量较小。未运行浏览器、游戏、仿真、测试或提交推送。
