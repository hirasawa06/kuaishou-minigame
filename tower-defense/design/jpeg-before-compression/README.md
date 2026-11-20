# 场景JPEG压缩前归档

现状｜2026-11-20 17:33

保留本轮重新编码前的场景JPEG，按原包内路径归档。运行图片采用quality=78、渐进与优化编码，像素尺寸保持不变，JPEG属于有损压缩，目视与快手真机待验。归档不计入主包。

维护：`python3 tower-defense/tools/gen-assets.py --prepare-resource-packages`，处理JPEG并将战斗与收藏资源搬入两个资源分包。重建其他图集后须再次执行此步骤并检查重复路径；不允许用不同文件覆盖已有分包资源。
