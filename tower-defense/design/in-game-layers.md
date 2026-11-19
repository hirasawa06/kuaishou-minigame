# 局内画面分层

# 当前实现说明（2026-11-09）

下文记录早期沙发守护物的分层过程，属于历史方案。首关目标现已改为主人与猫狗的合照：正式相框图见 `package/res/Image/guardian-photo-v1.png`，攻击与受击反馈锚定相框；沙发不再作为独立守护对象加载。后续分层以当前代码与 `PROJECT.md` 为准。当前顶部 HUD 只展示波次、剩余敌人与暂停；合照完好度跟随相框，上场人数不常驻展示。

## L0 全屏环境背景

素材：[in-game-background-v1.png](in-game-background-v1.png)。客厅、地毯三路、地板和环境光铺满整个屏幕；不受交互安全区裁切，也没有触摸命中区。首页渲染图若使用此素材，须留在主包。

## 后续独立层

守护物、敌人、己方角色、生命条、伤害与技能特效、状态栏、商店和按钮均不烘焙进 L0。它们分别按战场坐标、设备安全区和交互规则定位。沙发守护物需独立素材，以便受击和血量状态变化。

背景中的地毯纵向分道仅是美术引导；部署采用连续坐标，实际命中区域与移动路径由游戏逻辑计算。适配不同纵横比时可裁切背景边缘，但须保持三路战场可见，并防止背景地毯分界与逻辑分道明显错位。

## 接入与预览状态

当前分支已把 L0 接入 `gameplay/render/scene.js`，并采用保持比例的居中裁切铺满画布。仅替换背景和移除旧的全屏压暗/通道几何叠层，未改规则或触摸。H5 战斗截图见 [in-game-background-preview.png](in-game-background-preview.png)。旧 HUD、基地条、商店及单位仍在其上绘制，因而此图是背景接入预览，不是 v3 效果图的完整还原。真机与极端纵横比仍待验收。

## 从 v3 效果图继续拆出的图层

| 顺序 | 图层内容 | 独立原因与形态 |
|---|---|---|
| L1 | 战场环境提示：入口提示、可部署范围、合法/非法落点、范围圈 | 随波次、拖拽和设备布局变化；用 WebGL 几何绘制，不烘焙到背景 |
| L2 | 守护物沙发：本体、受击反馈、生命条/数字 | 血量与受击会变化；本体透明图，生命条动态绘制 |
| L3 | 敌方家具：台灯、柜子、书架及其阴影 | 按敌人类型、坐标、动作、血量独立绘制；同类复用素材 |
| L4 | 己方猫狗：盾、战、射手、法师及其阴影 | 可重复部署至 10 名；按单位状态和坐标实例化，不从整张效果图切十份 |
| L5 | 战斗反馈：投射物、攻击、受击、状态、飘字、血条 | 按实时事件绘制，避免静态贴图遮挡或无法更新 |
| L6 | 顶部 HUD：波次、剩余敌人、暂停 | 数字与状态动态绘制；面板、图标可切透明素材；绘制及命中遵守安全区 |
| L7 | 底部商店底板与状态栏：木质面板、饼干 | 底板可延伸背景，但饼干数据必须独立；控件受安全区约束 |
| L8 | 商店控件：刷新、扩建/满级、四张英雄卡、价格与售罄态 | 每个按钮/卡牌独立透明素材与状态效果；绘制矩形和点击热区共用布局 |
| L9 | 顶层反馈：拖拽卡影、弹窗、暂停/胜负、提示 | 必须压在战斗与商店之上，交互仍由安全区限制 |

拆分顺序建议先 L2 与 L6/L7/L8，确认守护物和界面的视觉占位，再做单位和特效。资源分层不改变当前规则、商店价格或单位上限。

## L2 守护物首轮接入

- 沙发源图：[guardian-sofa-source.png](guardian-sofa-source.png)；运行时透明素材：[guardian-sofa.png](../package/res/Image/guardian-sofa.png)，缩至 1024×446 RGBA。
- `gameplay/assets.js` 将沙发加入资源清单；`gameplay/render/scene.js` 在现有基地坐标绘制沙发，生命条、血量数字和受击闪红仍由运行时状态控制。
- 预览：[guardian-sofa-preview.png](guardian-sofa-preview.png)。H5 截图脚本通过，未见加载失败或脚本异常；真机视觉与触摸仍待验收。
- 当前仅有静态沙发本体；受击形变、损坏阶段或拆分抱枕等动画属于后续视觉迭代。守护物判定和血量规则未变。

## L3 敌方家具首轮接入

- 源图：[enemy-furniture-atlas-source.png](enemy-furniture-atlas-source.png)；运行时透明图集：[enemy-furniture-atlas.png](../package/res/Image/enemy-furniture-atlas.png)，1024×1024 RGBA，2×2 等分。
- 图集顺序：左上小怪＝台灯，右上普通怪＝抽屉柜，左下精英怪＝书架，右下首领＝落地钟。同类敌人复用相同格子，由实例坐标与状态绘制。
- `gameplay/assets.js` 加载图集，`gameplay/render/scene.js` 依敌人 `id` 取对应格；血条、生成淡入、减速圈、受击闪白和首领光环仍由运行时代码绘制。尺寸系数只作用于美术，不改敌人碰撞半径、速度、生命或伤害。
- H5 战斗预览：[enemy-furniture-preview.png](enemy-furniture-preview.png)。截图脚本未报告资源失败或脚本异常；截图只覆盖首波小怪，其他三档仍需在对应波次视觉验收。当前敌人素材为静态图，攻击/死亡分件动画尚未制作。

## L4 己方猫狗首轮接入

- 源图：[hero-pets-atlas-source.png](hero-pets-atlas-source.png)；早期透明图集（已归档，现不加载）：[hero-pets-atlas.png](legacy-package-assets/hero-pets-atlas.png)，1024×1024 RGBA，2×2 等分。
- 图集顺序：左上铁盾柴犬、右上冲锋犬、左下游侠猫、右下魔法猫。同类角色按实例复用图集格，不为 10 个席位各存一张图。
- `gameplay/assets.js` 加载素材。战场中盾位继续走原有分件动画，避免动画倒退；战、射手、法师在 `gameplay/render/scene.js` 走新透明图，拖拽预览也使用角色图。商店卡片仍是旧图标，待 L8 统一。
- H5 预览：[hero-pets-preview.png](hero-pets-preview.png)。截图脚本无加载失败或脚本异常。战、射手、法师尚为静态图；后续可补待机、攻击、受击和死亡分件动画。角色碰撞、价格、职业与上场席位规则未变。

## L5 战斗反馈首轮接入

- 源图：[battle-fx-atlas-source.png](battle-fx-atlas-source.png)；运行时透明图集：[battle-fx-atlas.png](../package/res/Image/battle-fx-atlas.png)，1024×1024 RGBA，2×2 等分。
- 图集顺序：左上金色箭矢，右上紫橙魔法弹，左下爪印命中，右下奶油色烟雾。`gameplay/render/scene.js` 按现有投射物/特效事件绘制；箭矢跟随飞行方向旋转，特效随原有生命周期淡出。未修改事件生成、伤害结算或持续时间。
- 英雄与敌人血条继续实时计算比例，给细血条增加暖色描边；飘字、攻击斩光、范围圈、减速和受击闪光继续由运行时绘制，不烘焙进背景或角色图。
- `node --check`、`git diff --check`、120 秒玩法仿真和 H5 截图均通过。预览：[battle-fx-preview.png](battle-fx-preview.png)。截图没有捕捉到命中瞬间，只证明图集资源加载与战斗画面正常；动态视觉需在实际交战中验收。

## L6 顶部 HUD 首轮接入

- 源图：[hud-panel-source.png](hud-panel-source.png)；运行时透明面板：[hud-panel.png](../package/res/Image/hud-panel.png)。只保留奶油色牌匾与装饰爪印，波次、剩余敌人、基地血量、饼干和席位数字继续实时绘制。
- `gameplay/render/hud.js` 读取 `Layout.ui.hud` 和 `Layout.ui.pauseBtn` 绘制。暂停按钮的外观改成暖色圆钮，命中区仍是原布局矩形；顶部全屏暗色遮罩移除，让 L0 背景完整显示。
- 基地血条仍保留在沙发前方，因此 HUD 只放基地血量数字，避免 76px 高度内重复挤压。商店中的饼干/席位暂时保留旧版，待 L7 统一。
- H5 预览：[hud-preview.png](hud-preview.png)。截图脚本无资源失败或脚本异常，`node --check` 和 `git diff --check` 通过；不同设备安全区与窄屏文字长度仍待真机检查。
- 后续排版修正：左列起点右移，双行基线上移，避开左爪印和底部描边；用初始饼干三位数与实战数据截图检查了文本未挤出面板。`hud-preview.png` 已替换为修正版。

## L7 底部商店底板与状态栏首轮接入

- 木质底板源图：[shop-tray-source.png](shop-tray-source.png)；运行时透明素材：[shop-tray.png](../package/res/Image/shop-tray.png)。绘制从现有商店上沿延伸至屏幕底边，属于展示层，底部安全区内没有新增交互。
- 商店顶部状态栏改为暖色奶油胶囊，饼干与已上场数量继续取实时状态；按钮、卡牌的坐标和触摸命中仍使用原布局。
- H5 预览：[shop-tray-preview.png](shop-tray-preview.png)。截图无资源或脚本错误，代码检查通过。旧刷新/扩建按钮、卡牌和页脚说明在木纹上对比度偏弱，作为 L8 控件层待改；不把本轮预览称作最终 UI。

## L8 商店控件首轮接入

- 空白角色卡源图：[shop-card-source.png](shop-card-source.png)，旧运行时卡片底图归档为 [shop-card.png](legacy-package-assets/shop-card.png)；当前商店卡片底板、头像槽和信息角标由 WebGL 几何绘制。空白橙色按钮源图：[shop-button-source.png](shop-button-source.png)，运行时透明素材：[shop-button.png](../package/res/Image/shop-button.png)。这些素材均不烘焙角色、文字或价格。
- 四张卡片复用同一底图与 L4 角色图集，名称、职业/属性、价格、售罄和不可购买状态由现有商店数据实时绘制。刷新与扩建按钮复用同一底图，金额、满级、饼干不足由现有状态决定。
- 按下按钮时绘制缩至 94%，松手后短暂回弹；卡片按下时整体略缩。显示变化不改变命中区，所有命中仍来自 `Layout.ui`。按钮高度下限调整为 36px，现有 4px 命中余量合计提供约 44px 触摸高度；滑出原按钮再松手不会误触另一个按钮。
- 底部旧说明文字从商店底边移除，避免压在手势安全区与木纹上；操作说明待 L9 引导层设计。
- 预览：[shop-controls-preview.png](shop-controls-preview.png)。代码与布局检查通过，Chrome 交互回归 12/12 通过（拖卡、点卡、刷新、暂停与重开等）。回归脚本中的重开按钮坐标由旧单按钮布局改为现有暂停面板的实际按钮。真机触摸目标及窄屏卡片文字仍待设备验收。

## L9 顶层反馈首轮接入

当前暂停和结算弹窗已改为 WebGL 几何底板；下方记录的是首轮接入时的历史状态。旧弹窗图已归档到 `legacy-package-assets/`，见 `pause-panel-v1.md` 与 `result-panel-v1.md`。

- 空白竖版弹窗源图：[modal-panel-source.png](modal-panel-source.png)，旧运行时素材已归档为 [modal-panel.png](legacy-package-assets/modal-panel.png)。首轮暂停与胜负结算共用底板，文字、统计与按钮实时绘制；全屏棕色半透明遮罩仅作视觉层，按钮仍在安全区中。
- 暂停预览：[top-layer-pause-preview.png](top-layer-pause-preview.png)；结算预览：[top-layer-result-preview.png](top-layer-result-preview.png)。继续、设置、重开、返回主页和再玩一次保留原逻辑与布局命中。旧深色弹窗/按钮改为奶油色面板和橙色主操作。
- 角色详情改为暖色信息卡，宽度适配交互区域，描述按字形宽度最多拆成两行；预览：[top-layer-inspect-preview.png](top-layer-inspect-preview.png)。短屏与更长描述仍需设备检查。
- 战场提示、预备波次和拖拽卡影改为暖色反馈。开局尚未部署角色且没有临时提示时，战场内显示“点击卡牌自动上场 / 拖动卡牌指定位置”，不占底部安全区。旧字体图集缺少 `s` 字形，预备提示改为“第 n 波准备 x.x”，详情不再显示缺字的单位后缀。
- `pause-shot.mjs` 流程通过，`shot.mjs` 交互回归 12/12 通过，代码语法与字形检查通过。H5 截图不代表 iOS / Android 真机安全区与触摸验收。

## L1 战场环境提示首轮接入

- 波次准备和出怪期间，三路入口按 `Layout.ui.lanes` 绘制轻量方向标记；该标记属于战场视觉层，不产生触摸区域，也不改变敌人生成位置。
- 拖卡进入战场时，按实际部署范围绘制淡绿色区域和边界。部署是连续坐标，因此不显示格子。合法落点显示绿色预览，越界、饼干不足或席位已满显示红色预览和对应提示；攻击、嘲讽与溅射范围圈仍跟随角色配置。
- 预览和实际部署共用 `Battle.deployBlockReason` 的安全区、战场边界、饼干及席位判定；拖卡预览另遵守原有商店上沿的松手限制。改动只统一判定的读取方式，未改变价格、席位上限、部署坐标或伤害规则。
- `node --check`、`git diff --check`、120 秒玩法仿真、布局检查和新文案字形检查通过。H5 及 iOS / Android 真机视觉仍待人工验收。
