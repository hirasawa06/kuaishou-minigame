# 美术接入阶段 1：盾犬战场动作

状态：待用户视觉审查。分支：`codex/in-game-art-integration`，基底：`codex/in-game-ui` 的 `8325989`。

## 来源与范围

- 来源：`origin/petsAndFurniture-art-assets` 的 `7b4441d`。`origin/codex/main-with-character-animations` 含同一套角色动作，并用于核对 Rig 接法；未整支合并。
- 从来源分支引入角色与通用特效源图、动作规格、图集生成器以及其已生成的 `game.png`、`rigs.js`、`character-animations.js`。源图位于 `tools/src/`，不会随游戏包上传。
- 当前只启用盾犬 `tank` 的背视待机、受击、退场三种战场姿势。射手猫帧虽已装入共享图集，战场仍使用现有静态角色图；后续单独验收。
- 盾犬不攻击；没有改角色数值、碰撞、商店、伤害或死亡移除时间。卡牌正面图保留现状。图集帧仍经 WebGL 1.0 绘制。

## 预览

- [待机](art-integration-stage1/tank-idle.png)
- [受击](art-integration-stage1/tank-hurt.png)
- [退场](art-integration-stage1/tank-die.png)

三张图由 `node tools/anim-shot.mjs --port 8102` 在 H5 预览中定格生成。旧截图脚本使用已废弃的英雄、敌人 ID，曾使绘制中途异常；已修正并增加资源加载与绘制异常检查。

## 验证与待办

- 120 秒玩法仿真与布局检查通过；盾犬三态截图资源加载和完整绘制通过。
- 本地包体预检仍有 5 项错误：主包约 12.37 MiB，以及既有 `gameplay/ui.js` 的 URL、DOM 与裸平台 API。基底提交的包文件合计约 12.24 MiB；本阶段图集从约 0.14 MiB 增至约 0.36 MiB。这些平台问题需要独立处理，不能将本阶段认定为可上传包。
- 当前机器的 `python3` 缺少 Pillow，故本阶段复用来源分支生成的图集，未在本机重新运行 `gen-shiba-atlas.py`。后续接入更多角色前需在具备 Pillow、NumPy 的环境复核可再生性。
- 真机画面、动作流畅度与安全区尚待用户验收。射手猫背视动画已进入[阶段 2](art-integration-stage2.md)独立审查；之后再处理通用退场烟雾。
