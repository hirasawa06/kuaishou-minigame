# 美术接入阶段 2：射手猫背视动作

状态：待用户视觉审查。分支：`codex/in-game-art-integration`，承接阶段 1 的 `4ceb11d`。

## 接入范围

- 使用阶段 1 已导入的射手猫背视帧：待机、瞄准、左右开火、后坐、退场。受击目前复用待机帧加短促位移，来源素材没有独立受击帧。
- 战场上的 `arch` 根据现有 `facing` 选择右侧或左侧开火姿势；商店卡图继续使用现有正面角色图。
- 现有攻击结算由 `battle.js` 在约 0.07 秒触发。本阶段把动画规格及开火姿势同步到 0.07 秒，没有改投射物起点、飞行、伤害、攻击间隔或死亡移除时间。
- 角色动画仍走 WebGL 1.0 图集。通用退场烟雾还未接入，留待下一阶段单独审查。

## H5 定格预览

- [待机](art-integration-stage2/01-idle.png)
- [瞄准](art-integration-stage2/02-aim.png)
- [向右开火](art-integration-stage2/03-fire-right.png)
- [后坐](art-integration-stage2/04-recoil.png)
- [向左开火](art-integration-stage2/05-fire-left.png)
- [受击](art-integration-stage2/06-hurt.png)
- [退场](art-integration-stage2/07-die.png)

预览由 `node tools/anim-shot.mjs --port 8102 --hero arch` 在当前局内 UI 中定格生成。截图脚本校验资源完整和绘制无异常。

## 验证与限制

- 120 秒玩法仿真、代码语法、`git diff --check` 通过；动画采样确认左右开火均在 0.07 秒命中点切到对应帧。
- 本机仍缺少 Pillow，无法重新运行来源图集生成器；本阶段仅同步 `arch.json` 与已生成的动作元数据，不改图集 PNG。
- 阶段 1 已记录的主包超限及 `gameplay/ui.js` 平台预检错误仍存在；本阶段不声明可上传或真机通过。
