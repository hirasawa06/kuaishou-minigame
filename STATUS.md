# 当前状态

更新：2026-11-03（Asia/Shanghai） · 记录范围：设计规范与交互安全区已合入 `main`（合并提交 `c34fca6`）。

## 现有工程

- 项目仓库：`861289009/kuaishou-minigame`。唯一游戏工程是 `tower-defense/`，当前为通用竖屏单机塔防 Demo。
- 截至本次记录，游戏仍为通用塔防 Demo；当前代码行为与项目阶段以 `tower-defense/PROJECT.md`、`aigc-context.json` 为准。后续以 Git 合并记录核对策划是否生效。
- 已知待核对项：`tower-defense/package/kwaiStandard/main.js` 与随仓库 Skill 的模板不同；平台真机兼容、只读适配层要求与预检结果尚未在本次迁移中验证。
- 已建立并实现屏幕安全区、平台按钮保守预留及统一触摸边界。背景、战场视觉底层和托盘底色可延伸至全屏，交互控件和命中区由 `Layout.ui.interactiveRect` 约束；真机平台适配尚未验收。
- 合并前验证（2026-11-03，H5 预览，414×896，DPR 2）：`node tools/layout-check.mjs`、`node tools/assets-check.mjs`、`node tools/sim.mjs --seconds 400`、`node tools/shot.mjs --port 8102 --dpr 2`（12/12）、`validate-package.mjs --dir .` 均通过。预检保留 6 条已知警告（模板修改 2、上传占位 2、首页图目录 2）；浏览器自动播放音频警告及 favicon 404 未阻断交互。
- 预览服务必须指向本仓库 `tower-defense/package/`；资源404会被门禁阻断，可用 `node tools/assets-check.mjs` 回归。

## 策划衔接

- 基础策划和当前 Demo 的差异由 `codex/planning-foundation` 整理。其合并状态以 Git/PR 为准；策划提案不能直接当作已实现功能。
- 本协作基线记录跨会话入口、策划迁入边界与版本规则，不改变游戏工程。

## 下一步

1. 团队审阅基础策划与当前 Demo 的差异，决定要保留、实验或替换的规则。
2. 设计规范与布局实现完成审阅后，单独处理入口/适配层和玩法改造；预览棋盘格与顶部 HUD 的视觉调整留给 UI 分支。
3. 在 iOS / Android 真机核对平台按钮占位、上下安全边界与拖拽命中；目前不声明已通过平台适配。
