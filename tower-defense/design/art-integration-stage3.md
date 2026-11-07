# 美术接入阶段 3：通用退场烟雾

状态：待用户视觉审查。分支：`codex/in-game-art-integration`，承接射手猫阶段的 `67d60ec`。

## 接入内容

- 使用阶段 1 已导入的三帧 `fx-smoke`、`fx-smoke-2`、`fx-smoke-3`。原始素材来自 `origin/petsAndFurniture-art-assets` 的 `7b4441d`，运行时帧位于 `res/Image/game.png`。
- 英雄生命值归零后仍显示原有 0.4 秒退场姿势；移除角色时才触发烟雾，避免遮挡姿势。敌人被击倒时立即触发同款烟雾，保持其原有即时移除方式。
- 烟雾按原有效果生命周期和半径更新，画面依次显示起、中、末三帧。死亡判定、伤害、金币奖励、角色移除时间与敌人移除时机不变。

## H5 定格预览

- [起始帧](art-integration-stage3/01-smoke-start.png)
- [中间帧](art-integration-stage3/02-smoke-middle.png)
- [收尾帧](art-integration-stage3/03-smoke-end.png)

由 `node tools/anim-shot.mjs --port 8102 --smoke` 在当前局内 UI 中定格。截图脚本验证三帧均可从游戏图集加载。

## 验证与限制

- 120 秒玩法仿真通过；增加定向检查，确认英雄烟雾在退场姿势结束后触发且只触发一次。代码语法与差异格式检查通过。
- 主包超限和 `gameplay/ui.js` 平台预检错误沿用阶段 1 的记录；本阶段不声明可上传或真机通过。
- 这组截图展示烟雾三个时间点；连续运动速度、真机透明混合与手感等待用户验收。
