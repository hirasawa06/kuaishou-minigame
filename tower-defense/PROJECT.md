# 塔防小游戏 — 项目上下文

> 本文件记录该游戏项目特有的约定（自定义资源目录、特殊玩法约束等）。
> 一个 AI 对话只处理一个游戏项目；多个项目并行时使用独立会话。
> 使用 AI 工具开发本项目前，手动将本文件加入 AI 工具上下文（如 `/add PROJECT.md`）。

## 当前状态

见 `aigc-context.json`：`gameName` / `features`（已接入能力模块）/ `subpackages`（分包配置）/ `currentStep`（当前所处开发阶段）。

- 当前阶段：可玩测试版（Step 5 完成，待真机验证与上传）
- 平台：快手小游戏（Yoola），竖屏 `portrait`
- 已接入能力：登录、广告、转发分享、Toast/Modal、媒体（音效）、设备（可扩展振动）

## 玩法概要

竖屏单机塔防 + 卡牌：屏幕下方能量条持续积攒能量（上限 10），下方 4 个卡槽滚动出牌；
按住卡牌拖到战场任意位置即可消耗能量放置单位，向左右滑动卡牌可立即丢弃（0.45s 后补新牌）。

- 单位分 4 类：坦克（高血量近战、附带小范围溅射）、战士（近战高输出）、射手（远程单体、高速箭矢）、法师（远程范围伤害 / 减速）
- 敌人自上而下三条通道推进，会攻击挡在前面的单位；无人阻挡时直扑基地并持续扣基地血量
- 共 10 波，第 10 波首领（范围压血）登场；能量上限 10，击杀回能 0.3，清波回能 1.5
- 单位上场上限 12；基地血量 100

## 项目特有约定

### 渲染
- 只使用 WebGL 1.0：`gameplay/render/gl.js` 是唯一的批渲染器（单 shader、顶点色、mode 0=圆角矩形/圆、1=纹理、2=圆环）
- 禁止 canvas 2D：中文全部走离屏烘焙的字形图集（`res/Image/font-48|28|18.png` + `gameplay/data/font-atlas.js`）
- `gameplay/layout.js` 通过 `KwaiBase.getSystemInfo()` 读取完整安全边界，统一计算 `contentTop/contentBottom`；顶部无控件矩形时保守预留 32px 间距和 64px 平台控制带
- HUD、暂停按钮、战场、卡牌和菜单按钮必须从同一布局结果派生，绘制与命中不得各自维护坐标
- H5 Demo 通过 `gameplay/render/safe-area-debug.js` 默认展示 A–E 五区和 iOS 44/68 参考边界；快手容器默认关闭该调试层并读取真机数据
- 纹理对象不带宽高，`draw.texture(tex, texW, texH, sx, sy, sw, sh, ...)` 必须显式传纹理尺寸
- 纹理上传后必须调用 `A.Render.invalidateTexture()`，否则批渲染器的绑定缓存会失效
- `kwaiStandard/main.js` 的 `draw()`（脚手架唯一允许替换的占位绘制）已改为调用 `AIGCUtils.GameLoop.frame()`

### 资源生成
所有图片、音频均由 `tools/` 下的脚本离线生成，不依赖外部素材：

```bash
python3 tools/gen-assets.py        # 字形图集 + 图标精灵图 + yoola 素材
python3 tools/gen-shiba-atlas.py   # 战斗图集 game.png（柴犬分件 + 特效 + 继承图标）
python3 tools/gen-audio.py         # 11 个短音效（ffmpeg 合成）
python3 tools/gen-home-asset.py    # 首页渲染图
```

- 字形图集从 `gameplay/**.js` 的字符串字面量自动收集用字：**新增中文文案后必须重新执行 `gen-assets.py`**，否则会缺字
- 图集尺寸自动选宽，保证高度 ≤ 2048（低端机纹理上限）

**战斗图集（`res/Image/game.png`，1024×512，22 格）**
- 单元格 128px，含 4px padding（旋转 + 线性过滤时防渗色），有效区 120px
- row0：整只柴犬 / 柴犬身体 / 柴犬盾牌 / fx-glow / fx-slash / fx-smoke / fx-ring
- row2~3：`gen-assets.py` 生成的旧图标，由本脚本裁入，保证卡牌与 HUD 仍有图
- 分件以**整张正视图为共同参照**落格，不能各自居中，否则拼合错位
- 源图放 `tools/src/shiba-front.png`（`cut1` 抠图结果）；旧图标源放 `tools/src/sprites-legacy.png`
- **改分件/特效后必须重新执行 `gen-shiba-atlas.py`**，并检查 `sprites.js` 里旧图标仍完整

### 验证
```bash
node tools/sim.mjs --seconds 400    # 无浏览器玩法仿真（虚拟时钟，验证数值与状态机）
node tools/layout-check.mjs         # iOS / Android / H5 安全区与交互区域布局合同
node tools/assets-check.mjs         # 资源404/纹理上传失败时必须阻止进入游戏
node tools/shot.mjs                 # CDP 驱动真实 Chrome：截图 + 拖拽/丢卡/暂停/结算用例
node tools/anim-shot.mjs            # 定格动画帧：待机/蓄力/出手/受击/死亡逐帧截图
node ../ks-yoola-devkit/scripts/validate-package.mjs --dir .
```

仿真脚本的机器人会按梯队随机布阵，作为难度基线：约 3~4 次能通关 1 次。

### 动画与特效
- 单位分件动画在 `gameplay/anim/`：`rig.js`（关键帧采样 + 绘制）、`defs.js`（各单位 `states`）
- 有 `A.Rigs[cardId]` 的单位走分件动画，没有的仍走整图 `Scene.icon`，新增单位可逐个接入
- 攻击伤害**不在起手结算**：`updateUnits` 只切 `anim='atk'` + `pendingHit`，到达出手帧才 `resolveAttack`
- `hitstop` 只压缩战斗推进（`battleDt`），特效仍按真实 `dt` 衰减，否则闪点会一起卡住
- 死亡单位要等 `die` 动画播完（`dieT`）才移出 `S.units`，**名额统计必须跳过 `dead`**，否则尸体卡上限
- 加法混合通过 `A.Render.setAdditive(true/false)` 切换，进出都会 flush；着色器带 `uAdd`，
  在加法模式下把贴图 alpha 预乘进 RGB，否则 PNG 透明区的白色会把四边形加成方块
- 旋转与翻转在 `gl.push` 的 CPU 端处理（`opts.rot` / `opts.flipX`），不改 shader、不扩顶点格式

### 数值调整入口
- 单位 / 敌人 / 波次：`gameplay/config.js`（`CARDS`、`ENEMIES`、`WAVES`、`waveHpScale`、`waveAtkScale`）
- 能量与基地：`ENERGY_MAX` / `ENERGY_START` / `ENERGY_REGEN` / `KILL_ENERGY` / `BASE_HP`
- 布局：`gameplay/layout.js`（HUD 76、托盘约 21% 屏高、4 卡等分）

## 待办

- 真机验证：iOS / Android 的平台按钮实际占位、安全区、刘海与底部手势避让、音效播放、60fps
- 广告接入：复活 / 加倍奖励位（`kwaiStandard/core/kwai-ad-config.js` 占位，上传阶段替换）
- 存档：最佳波次 / 通关次数（`KwaiStorage`，当前未接入）
- 动画：其余 7 个单位仍用整图图标，待逐个接分件动画
- 特效：法师/射手投射物仍是几何图形，待接 `fx-glow` 拖尾

## 文件清单

```
gameplay/
  config.js            数值、卡牌、敌人、波次表
  layout.js            竖屏布局（HUD / 战场 / 基地 / 卡槽）
  state.js             运行时状态与工具函数
  assets.js            纹理加载与缓存
  audio.js             音效节流与首次交互预热
  input.js             触摸/鼠标：拖拽放卡、滑动丢卡、按钮
  game.js              主循环装配（GameLoop.frame）
  play/battle.js       能量、卡槽、单位、敌人、投射物、波次
  render/gl.js         WebGL 1.0 批渲染器
  render/draw.js       矩形/圆角/圆环/纹理/文字原语
  render/scene.js      战场绘制
  render/hud.js        HUD、卡槽、说明、菜单、暂停、结算
  render/safe-area-debug.js  H5 五区安全区域调试层（正式容器默认关闭）
  anim/rig.js          分件关键帧采样与绘制
  anim/defs.js         单位动画表（状态、关键帧、支点）
  data/font-atlas.js   字形图集元数据（生成）
  data/sprites.js      图标精灵图元数据（生成，仅作旧图标手册）
  data/rigs.js         战斗图集元数据：图集尺寸、格子、图标表、分件锚点（生成）
tools/
  gen-assets.py        字形图集、旧图标与 yoola 素材
  gen-shiba-atlas.py   战斗图集：柴犬分件 + 特效 + 继承图标
  gen-audio.py         音效生成
  gen-home-asset.py    首页渲染图生成
  sim.mjs              无浏览器玩法仿真
  shot.mjs             CDP 截图与交互用例
  anim-shot.mjs        定格动画帧截图（待机/攻击/受击/死亡）
  layout-check.mjs     iOS / Android / H5 安全区布局合同测试
  assets-check.mjs     资源加载失败门禁测试
  src/                 素材源：柴犬正视图、旧图标图集
```
