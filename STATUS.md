# 当前状态

更新：2026-11-04（Asia/Shanghai） · 记录范围：`main` 仍是设计规范基线（`c34fca6`）；最新玩法在 `feature/heroes-shop-waves`，个人中心相关界面在 `feature/profile-settings-rank`。

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

## 分支进展

- `feature/heroes-shop-waves`：金币经济 + 4 英雄卡池 + 首页（提交 `a18b520`）。
- `feature/profile-settings-rank`：在 shop 版本之上新增设置（音乐 / 音效开关、转发入口）、我的名片、选择头像、修改昵称、邀请好友，以及虚拟地区排行榜（地区身份为中国）。仅完成 H5 截图走查，未做完整回归与真机验证。
- `feature/in-game-settings`：基于上一条，新增战斗内设置按钮与暂停面板（继续 / 设置 / 重新开始 / 返回主页），音乐音效可在局内调整；HUD 右上角重排。H5 冒烟通过，未跑完整回归与真机验证。

## 下一步

1. 团队审阅当前 Demo 与基础策划的差异，决定要保留、实验或替换的规则。
2. 逐分支审阅后合并；个人中心分支需补 `layout-check.mjs`、`shot.mjs` 与包体预检后再合入。
3. 在 iOS / Android 真机核对平台按钮占位、上下安全边界、拖拽命中、系统键盘与剪贴板；目前不声明已通过平台适配。
