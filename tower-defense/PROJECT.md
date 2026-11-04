# 塔防小游戏 — 项目上下文

> 本文件记录该游戏项目特有的约定（自定义资源目录、特殊玩法约束等）。
> 一个 AI 对话只处理一个游戏项目；多个项目并行时使用独立会话。
> 使用 AI 工具开发本项目前，手动将本文件加入 AI 工具上下文（如 `/add PROJECT.md`）。

## 当前状态

见 `aigc-context.json`：`gameName` / `features`（已接入能力模块）/ `subpackages`（分包配置）/ `currentStep`（当前所处开发阶段）。

- 当前阶段：可玩测试版（Step 5 完成，待真机验证与上传）
- 平台：快手小游戏（Yoola），竖屏 `portrait`
- 已接入能力：登录、广告、转发分享、Toast/Modal、媒体（音效 + 背景音乐）、设备（振动 / 键盘）、本地存储（资料与设置）

## 玩法概要

竖屏单机塔防 + 自走棋式商店：金币来自击杀与清波，下方固定 4 格英雄卡池随机出卡（可重复），
花钱刷新卡池、扩建上场席位；点卡自动落地，拖卡可指定战场位置。

- 只有 4 个英雄：
  - 盾（铁盾柴犬）：高血量，嘲讽半径 96，零攻击，只格挡
  - 战（冲锋犬）：中血量近战，移动速度 52，会主动出击寻敌
  - 射手（游侠猫）：射程 260，单体高伤，血量最少
  - 法师（魔法猫）：射程 170，群攻半径 70，血量全场最少
- 敌人四档：小怪（血少、数量多、快）、普通怪、精英怪、首领（范围压血）
- 敌人自上而下三条通道推进；被嘲讽会横向吸附到盾位，无人阻挡时直扑基地
- 共 10 波；金币：击杀 2/5/16/60，清波 +6；初始席位 4，上限 10
- 基地血量 100；进入游戏前有独立首页（头像/体力/设置/排行榜/章节卡/开始按钮）
- 个人中心（`gameplay/profile.js` + `gameplay/ui.js`）：设置开关、我的名片、9 个头像、昵称（2 到 8 字）、邀请好友、虚拟地区排行榜；单机无服务端，榜单按地区 id 稳定播种，地区身份固定为中国

## 项目特有约定

### 渲染
- 只使用 WebGL 1.0：`gameplay/render/gl.js` 是唯一的批渲染器（单 shader、顶点色、mode 0=圆角矩形/圆、1=纹理、2=圆环）
- 禁止 canvas 2D：中文全部走离屏烘焙的字形图集（`res/Image/font-48|28|18.png` + `gameplay/data/font-atlas.js`）
- `gameplay/layout.js` 通过 `KwaiBase.getSystemInfo()` 读取完整安全边界，统一计算可交互内容的 `contentTop/contentBottom`；顶部无控件矩形时保守预留 32px 间距和 64px 平台控制带。背景、战场视觉底层、托盘底色等非交互美术铺满整个画布；按钮、卡牌、部署范围及其触摸命中区须位于安全区内。预览调试层仅标边界，不遮盖美术。
- HUD、暂停按钮、战场、卡牌和菜单按钮必须从同一布局结果派生，绘制与命中不得各自维护坐标
- `Layout.ui.interactiveRect` 是触摸交互的总边界；`Input` 在按钮、卡牌和拖放处理前校验该边界，卡牌还需落在 `ui.cards` 内。战斗部署同时校验交互边界和战场范围。全屏视觉层不参与命中判断。
- H5 Demo 通过 `gameplay/render/safe-area-debug.js` 默认展示 A–E 五区和 iOS 44/68 参考边界；快手容器默认关闭该调试层并读取真机数据
- 纹理对象不带宽高，`draw.texture(tex, texW, texH, sx, sy, sw, sh, ...)` 必须显式传纹理尺寸
- 纹理上传后必须调用 `A.Render.invalidateTexture()`，否则批渲染器的绑定缓存会失效
- `kwaiStandard/main.js` 的 `draw()`（脚手架唯一允许替换的占位绘制）已改为调用 `AIGCUtils.GameLoop.frame()`

### 资源生成
所有图片、音频均由 `tools/` 下的脚本离线生成，不依赖外部素材：

```bash
python3 tools/gen-assets.py        # 字形图集 + 图标精灵图 + yoola 素材
python3 tools/gen-shiba-atlas.py   # 战斗图集 game.png（柴犬分件 + 特效 + 继承图标）
python3 tools/gen-audio.py         # 11 个短音效 + 循环背景音乐（ffmpeg 合成）
python3 tools/gen-home-asset.py    # 首页渲染图
python3 tools/gen-profile-art.py   # 9 只猫狗头像图集
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
- 界面图标（关闭、返回、箭头、勾选、音乐、音效、分享、链接）只在 `sprites.png`；`Assets.sprite()` 先查战斗图集，未命中再回退界面图集
- 字形图集只有 18 / 28 / 48 三档，界面文字不要写 20 / 24 / 26 等其他字号，否则该行会整段不绘制

### 验证
```bash
node tools/sim.mjs --seconds 400    # 无浏览器玩法仿真（虚拟时钟，验证数值与状态机）
node tools/layout-check.mjs         # iOS / Android / H5 安全区与交互区域布局合同
node tools/assets-check.mjs         # 资源404/纹理上传失败时必须阻止进入游戏
node tools/shot.mjs                 # CDP 驱动真实 Chrome：截图 + 拖拽/丢卡/暂停/结算用例
node tools/anim-shot.mjs            # 定格动画帧：待机/蓄力/出手/受击/死亡逐帧截图
node tools/menu-shot.mjs            # 首页、商店、战场截图
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
- 英雄 / 敌人 / 波次：`gameplay/config.js`（`HEROES`、`ENEMIES`、`WAVES`、`waveHpScale`、`waveAtkScale`）
- 经济与席位：`GOLD_START` / `REFRESH_COST*` / `CAP_COST*` / `UNIT_CAP_START` / `UNIT_CAP_MAX` / `BASE_HP`
- 布局：`gameplay/layout.js`（HUD 76、商店托盘约 27% 屏高、卡池 2×2，`L.shopRect(i)` 同时供绘制与命中使用）

## 待办

- 真机验证：iOS / Android 的平台按钮实际占位、安全区、刘海与底部手势避让、音效与背景音乐播放、系统键盘、剪贴板、60fps
- 个人中心：昵称远端合规校验、头像资源在真机的内存占用、BGM 循环接缝听感
- 广告接入：复活 / 加倍奖励位（`kwaiStandard/core/kwai-ad-config.js` 占位，上传阶段替换）
- 存档：已接入个人资料与最高关卡（`KwaiStorage`，key `td_profile_v1`）；体力、章节进度仍未接入
- 动画：战 / 射手 / 法师仍是整图图标，只有盾位接了分件动画
- 数值：金币产出、席位与刷新价格曲线尚未做长期仿真调平
- 商店：卡池有重复卡，暂未做保底或锁定
- 特效：法师/射手投射物仍是几何图形，待接 `fx-glow` 拖尾

## 文件清单

```
gameplay/
  config.js            数值、卡牌、敌人、波次表
  layout.js            竖屏布局（HUD / 战场 / 基地 / 卡槽 / 各弹窗几何）
  profile.js           个人资料、设置开关、最高关卡与虚拟地区榜
  state.js             运行时状态与工具函数
  assets.js            纹理加载与缓存
  audio.js             音效节流、背景音乐与首次交互预热
  input.js             触摸/鼠标：拖拽放卡、滑动丢卡、按钮
  game.js              主循环装配（GameLoop.frame）
  play/battle.js       能量、卡槽、单位、敌人、投射物、波次
  render/gl.js         WebGL 1.0 批渲染器
  render/draw.js       矩形/圆角/圆环/纹理/文字原语
  render/scene.js      战场绘制
  ui.js                设置 / 名片 / 头像 / 昵称 / 排行榜 / 邀请
  render/hud.js        HUD、卡槽、说明、菜单、暂停、结算
  data/avatars.js      头像图集元数据（生成）
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
  menu-shot.mjs        首页与商店截图
  profile-shot.mjs     个人中心界面截图与冒烟流程
  gen-profile-art.py   头像图集生成
  src/                 素材源：柴犬正视图、旧图标图集
```
