# 当前状态

更新：2026-11-05（Asia/Shanghai） · `feature/heroes-shop-waves` 已快进合入 `main`（功能结果 `8aa9562`）；`petsAndFurniture-art-assets` 含射手猫与盾狗背面动画工作区改动，尚未合入。

## 现有工程

- 项目仓库：`861289009/kuaishou-minigame`。唯一游戏工程是 `tower-defense/`，当前为竖屏单机塔防测试 Demo。
- 当前已实现金币经济、四格英雄商店、四类英雄、四档敌人、十波战斗与 Figma 首页；以 `tower-defense/PROJECT.md`、`aigc-context.json` 和当前代码核对实际行为。首页视觉仍待进一步验收。
- 已知待核对项：`tower-defense/package/kwaiStandard/main.js` 与随仓库 Skill 的模板不同；平台真机兼容、只读适配层要求与预检结果尚未在本次迁移中验证。
- 已建立并实现屏幕安全区、平台按钮保守预留及统一触摸边界。背景、战场视觉底层和托盘底色可延伸至全屏，交互控件和命中区由 `Layout.ui.interactiveRect` 约束；真机平台适配尚未验收。
- 合并前验证（2026-11-03，H5 预览，414×896，DPR 2）：`node tools/layout-check.mjs`、`node tools/assets-check.mjs`、`node tools/sim.mjs --seconds 400`、`node tools/shot.mjs --port 8102 --dpr 2`（12/12）、`validate-package.mjs --dir .` 均通过。预检保留 6 条已知警告（模板修改 2、上传占位 2、首页图目录 2）；浏览器自动播放音频警告及 favicon 404 未阻断交互。
- 预览服务必须指向本仓库 `tower-defense/package/`；资源404会被门禁阻断，可用 `node tools/assets-check.mjs` 回归。
- 本次合并检查：`node tower-defense/tools/sim.mjs --seconds 200`、`layout-check.mjs`、`menu-interaction-check.mjs` 均通过；包体静态预检无错误、10 条警告（模板文件 2、配置/广告占位 2、资源目录 6）。本次未进行快手真机验证。
- 当前动画工作区：射手猫背面待机 / 瞄准 / 左右开火 / 后坐 / 仰面晕倒、枪口锚点与单发光弹已接入；左右目标各用一帧，均为右手持枪。晕倒帧保持不透明，落地后播放全角色共用的三帧纯白烟雾并直接移除。角色源素材按 `tools/src/characters/角色/<角色名>/` 收纳，跨角色风格参考放在 `tools/src/characters/情绪版/`，通用特效放在 `tools/src/effects/`。H5 定格截图、资源门禁、400 秒仿真、布局检查、Chrome 回归 12/12 和包体预检通过；未做快手真机验证。原始角色与情绪参考图已迁出 `package/res/`，当前主包目录约 4.7 MiB。
- 已确认后续制作规范：用户提供角色图与特点后，按 `docs/角色行动动画制作规范.md` 自动决定动作样式、图集帧、Rig、命中时刻与验收流程。
- 已修复规范落地缺口：英雄与敌人共用移动/攻击/死亡状态生命周期和死亡烟雾；动作规格 JSON 驱动图集与 Rig 数据，图集格位自动分配并校验重复与容量。
- 盾狗已接入背面待机、背面受击与仰面晕倒。盾狗不攻击；嘲讽仍由战斗逻辑处理，但不播放光盾。受击在 0.34 秒内轻微后移、失衡后回正，不压扁角色；晕倒姿势保持不透明，头朝战场南侧，随后播放通用白烟雾直接退场。H5 定格帧、资源门禁、400 秒仿真、布局检查和包体预检通过；未做快手真机验证。

## 策划衔接

- 基础策划和当前 Demo 的差异由 `codex/planning-foundation` 整理。其合并状态以 Git/PR 为准；策划提案不能直接当作已实现功能。
- 本协作基线记录跨会话入口、策划迁入边界与版本规则，不改变游戏工程。

## 下一步

1. 继续核对基础策划与当前 Demo 的差异，调整玩法数值、首页与战斗 UI。
2. 独立核对入口/适配层差异与包体预检警告。
3. 在 iOS / Android 真机核对平台按钮占位、上下安全边界与拖拽命中；目前不声明已通过平台适配。
