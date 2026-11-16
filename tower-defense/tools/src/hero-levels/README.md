# 英雄三级形态素材

状态：**现状 / 待验证**。2026-11-11，分支 `feature/hero-upgrades-tutorial-collection`。

> **22:10 最新状态覆盖下文历史缺图记录**：本轮授权首次创建奶糖喵母版，真实 Sunburst i2i + 洋红幕标准去背景，治疗三形态已填第5列，五英雄所有等级素材均可用。其他四列 decoded RGBA 像素完全不变。奶糖喵新设计待用户美术验收，见 [HEALER-DESIGN.md](HEALER-DESIGN.md)；背面源图视角尚未达严格60°要求，不打入 runtime、不宣称战斗相机通过。

## 已确认边界

- 三等级、两次升级；现有形象是 Lv2；新增 Lv1/Lv3 必须是真实生图的新装备结构，不是程序变色。
- 本目录素材只用于收藏及升级面板静态预览。攻击动作、Rig、命中时刻、战斗图集均不变。
- 无浏览器、游戏、仿真或真机验收结论；只进行源图阅读、尺寸/alpha 检查与代码语法检查。
- 此子任务只新增 `hero-forms.js`、`hero-levels.png`、本源目录和 `tools/gen-hero-levels.py`，不修改其他既有文件。

## 工程参考盘点

| 内部 id | 角色 | 锁定的结构参考 | 现有 Lv2 独立资源 |
|---|---|---|---|
| tank | 柴不破 | `../characters/角色/柴不破/柴不破三视图-60度-已确认-v1.png` | GameAtlas `unit-tank-1` |
| war | 锤锤喵 | `../characters/角色/近战猫/近战猫三视图参考-v1.png` | GameAtlas `war-front-idle` |
| arch | 镭射喵 | `../characters/角色/射手猫/射手猫.png`（完整正/侧/后参考，含晕倒图） | GameAtlas `arch-back-idle`（`unit-arch-1` 是遗留弓图标，不可当镭射喵形象） |
| mage | 哈利边牧 | `../characters/角色/法师狗/法师狗.png`（正/侧/后三视图） | GameAtlas `mage-back-idle` |
| healer | 奶糖喵 | **缺专属角色图和三视图** | 当前只有 `ui-heart` + 绿色医疗十字占位 |

每次正式请求同时提供以上四角色结构参考与必带风格图 `../characters/情绪版/宠物情绪版.png`。不使用随机历史附件或无关角色作为奶糖喵设计参考。读取了角色行动规范与 devkit AI 图片规范；本轮不制作战斗镜头/动作，因此不运行相机浏览器预演。奶糖喵须等待用户确认专属角色参考后再正式设计。

## 布局与父任务接入合同

- 资源 key：`hero-levels`；src：`res/Image/hero-levels.png`。
- RGBA PNG，1000×600，72 PPI；5 列 × 3 行；格位 200×200。
- 列从左至右 `tank, war, arch, mage, healer`；行从上至下 `Lv1, Lv2, Lv3`。
- 采样矩形 `[column*200, (level-1)*200, 200, 200]`。图集中第五列故意为空，禁止将其当作完成的奶糖喵立绘。
- 现有 Lv2 精灵直接复制，不 AI 重画。保留原样的法师背面待机作为 Lv2；其他已有对应卡牌/正面帧不变。
- 建议父任务在 Assets manifest 注册 `['hero-levels', A.HeroForms.src]`，并在 game.js / index.html 登记新脚本。
- `A.HeroForms.init(cb)` 是可选独立加载入口（Render 初始化后调用），走 `KwaiMedia.Image.load`、`A.Render.textureFromSource`、`invalidateTexture`；如已在 Assets 注册，无需第二次加载。
- `draw(id, level, centerX, centerY, size, alpha)` 返回 true 只代表确切等级真实图已绘制。缺图或加载失败返回 false，并绘制现有形象/心形 + 琥珀虚线占位框；父任务应结合 `status` 显示「形态素材待补」或「奶糖喵形象待确认」。本模块不引入新中文字形。
- `status(id,level)` 返回 `available`（素材）、`ready`（纹理）、`placeholder`、`reason`、`frame`。
- 战斗等级 overlay 与 scene.js 接入由父任务负责，不调用本静态接口替换攻击 Rig。

## 生成与重建

```bash
# 新设计请求（每次均带角色结构参考和风格情绪版）
python3 tower-defense/tools/gen-hero-levels.py --generate
# 如模型生成假棋盘格，保留既有八格设计，只改成统一绿幕：
python3 tower-defense/tools/gen-hero-levels.py --generate --chroma-background
# 本次已落盘的绿幕母版 -> 真正 alpha；原图不覆盖：
python3 tower-defense/tools/src/hero-levels/key-background.py \
  --source tower-defense/tools/src/hero-levels/hero-lv1-lv3-20261111-211128.png
# 实际 Read 深/浅检查图后打包：
python3 tower-defense/tools/gen-hero-levels.py --pack
```

生成使用 Skill 官方 `generate_with_fallback.py` Sunburst i2i（明确 `-n 1`），每次新时间戳文件、独立任务与日志。不自动降级模型；重试由 Skill 编排独占。只下载本次自身生成输出，不下载任何受限或外部未知来源素材。脚本及日志/任务不包含认证凭据；任务中可能有生成 URL，不是游戏运行时联网地址。

### 制作记录与当前结果（2026-11-11 21:15，素材检查完成 / 游戏待验证）

1. 第一轮 `hero-lv1-lv3-20261111-205416.png` 与第二轮 `hero-lv1-lv3-20261111-205726.png` 为真实 AI 新装备设计，但 RGB 假棋盘格不直接打包。原图全部保留。
2. 用户本轮明确允许标准去背景后处理，不允许用变色冒充新等级。`remove-background.py` 尝试 OpenCV GrabCut 分割；查看结果发现盾牌银边缺失、脚间棋盘残留，**该实验 alpha 文件不采用**。
3. 第三轮 `hero-lv1-lv3-20261111-211128.png` 仍为 Sunburst i2i，同时输入第一轮八格设计 + 工程情绪版 + 四角色结构参考，仅将背景替换为统一绿幕，保留四角色装备区别；所有人物、尾巴和武器完整。
4. `key-background.py` 标准色键生成 alpha，并仅对混合边缘去绿幕溢色；角色内部毛色/装备不改色。按连通角色完整边界归格，防止 AI 不完美分栏切掉尾巴、披风或武器。保留原布局 alpha 与归格 alpha 独立输出。
5. 已实际 Read 原图、深色检查板、浅色检查板、最终 runtime 图集：无棋盘格残留，白眼/浅毛/银盾边保留，四角色 Lv1/Lv3 各八格均完成。细毛边与银盾边极少像素存在正常抗锯齿色调，不影响预览形象；不宣称逐像素专业手绘精修。
6. `hero-forms.js` availability 更新为四英雄 `[true,true,true]`，奶糖喵保持 `[false,false,false]`。原始 Lv2 由相同已有 GameAtlas 精灵原样复制，没有 AI 重画；镭射喵/法师沿用已有背面帧。

### 新装备差异（不是程序换色）

| 角色 | Lv1 | Lv3 |
|---|---|---|
| 柴不破 | 简单蓝围巾、基础爪盾 | 分层肩披/护肩、骨形胸扣、强化大盾 |
| 锤锤喵 | 单头小爪锤、简单黄领巾、无腰包 | 双头大爪锤、分层短披风、工具腰带及爪纹腰包 |
| 镭射喵 | 简化开放头盔、短披风、小镭射枪 | 大侧耳护件头盔、分层披风、强化长镭射枪 |
| 哈利边牧 | 单饼干罐法杖、简单肩披 | 双饼干罐支架法杖、分层长肩披、工具腰带 |

最终 alpha 源为 `hero-lv1-lv3-20261111-211128-alpha.png`，全尺寸独立抠图为 `*-lv1-alpha-full.png` / `*-lv3-alpha-full.png`；最终200px格图为 `*-lv1.png` / `*-lv3.png`；深/浅检查板为 `alpha-inspection-dark.png` / `alpha-inspection-light.png`。未运行浏览器、游戏、仿真或测试，未 commit/push。奶糖喵仍等待专属角色参考确认，未擅自制作母版。
