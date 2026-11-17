# 包体优化（现状 / 待视觉验收）

2026-11-17 15:46，feature/package-size-optimization，基于main4861c19。

- 本地预检主包19.3466→5.929MiB，低于6MiB，剩余约73KiB，空间有限。总包包含yoola-assets需另计，不从压缩ZIP大小推断主包。
- 两张不透明背景PNG改JPEG，quality72，尺寸保持；assets.js路径更新。
- 透明图片量化：多数256色FASTOCTREE，有损颜色与alpha量化；首页插画卡128色MEDIANCUT，保留原alpha。原图在design/package-size-originals，脚本tools/optimize-runtime-images.py可重复处理。
- enemy-furniture-atlas与lamp-small未发现绘制调用，运行资源归档unused-runtime，正式怪物仍走GameAtlas/Rig；其余备用动作保留。
- 48号字体原2048×4096拆2048×2048和2048×1024；所有443字形metrics和RGBA像素无损一致，字体PNG改调色板白色+完整透明度。draw.js按glyph.page选页，Assets逐页加载；gen-assets.py --fonts-only可重建字体不改其他资源。
- 所有运行图片边长≤2048，预检通过errors0、8条既有警告。布局、菜单、资源错误门禁及seed42、400秒模拟通过；首关121秒胜利，不等于平衡验收。
- 未做浏览器目视和快手真机，透明渐变有色阶、JPEG有损细节，须用户验收。未提交推送或合入。
