# 当前状态

更新：2026-11-03（Asia/Shanghai） · 记录范围：协作基线与设计规范整理。

## 现有工程

- 项目仓库：`861289009/kuaishou-minigame`。唯一游戏工程是 `tower-defense/`，当前为通用竖屏单机塔防 Demo。
- 截至本次记录，游戏仍为通用塔防 Demo；当前代码行为与项目阶段以 `tower-defense/PROJECT.md`、`aigc-context.json` 为准。后续以 Git 合并记录核对策划是否生效。
- 已知待核对项：`tower-defense/package/kwaiStandard/main.js` 与随仓库 Skill 的模板不同；平台真机兼容、只读适配层要求与预检结果尚未在本次迁移中验证。
- 已建立并实现屏幕安全区、平台按钮保守预留、触摸一致性与真机验收口径；本地布局、玩法仿真和浏览器交互回归通过，仍不代表真机平台适配已验收。
- 本地验证命令：`node tools/layout-check.mjs`、`node tools/sim.mjs --seconds 400`、`node tools/shot.mjs --port 8099`、`validate-package.mjs --dir .`；结果提交以本分支最终 Git SHA 为证据。

## 策划衔接

- 基础策划和当前 Demo 的差异由 `codex/planning-foundation` 整理。其合并状态以 Git/PR 为准；策划提案不能直接当作已实现功能。
- 本协作基线记录跨会话入口、策划迁入边界与版本规则，不改变游戏工程。

## 下一步

1. 团队审阅基础策划与当前 Demo 的差异，决定要保留、实验或替换的规则。
2. 审阅设计规范与本次布局实现，再单独处理入口/适配层和玩法改造。
3. 在 iOS / Android 真机核对平台按钮占位、上下安全边界与拖拽命中；目前不声明已通过平台适配。
