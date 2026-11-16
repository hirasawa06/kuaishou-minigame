# 美术接入阶段 4：台灯小怪

状态：待用户视觉审查。分支：`codex/in-game-art-integration`，承接通用烟雾阶段的 `4cd2865`。

## 素材来源与处理

- 权威参考：`origin/petsAndFurniture-art-assets` 的 `7b4441d` 中 `tools/src/characters/角色/台灯小怪/台灯小怪.png`；`codex/main-with-character-animations` 中为同一张设定板。
- 原图为 1448×1086、不含透明通道的三视图设定板。依据左侧正视造型提取单只台灯，去除标题、其他视角和底色，保存为[透明提取源图](lamp-small-cutout-source.png)。这是基于原图生成的衍生切图，供视觉审查；不是原图逐像素抠取。
- 运行时素材 [lamp-small.png](../package/res/Image/lamp-small.png) 为 468×512 RGBA。按原始宽高比绘制；阴影由 WebGL 单独绘制。

## 接入边界

- 只替换敌人 `small` 的战场视觉，普通、精英和首领仍使用原 `enemy-furniture-atlas`。角色、商店、背景与其他敌人素材不变。
- 保留小怪当前生成、血量、碰撞半径、移动、攻击、奖励和受击反馈。源分支只提供静态三视图，没有可直接接入的台灯动作帧；当前仍用原有轻微位移表达攻击。

## H5 预览与验证

- [战场预览](art-integration-stage4/lamp-in-battle.png)：射手猫和台灯同屏，便于比较当前局内比例。
- `node tools/anim-shot.mjs --port 8102 --hero arch --lamp` 校验资源加载和绘制；120 秒玩法仿真、代码语法和差异格式检查通过。
- 原有主包超限及 `gameplay/ui.js` 平台预检错误仍未处理；真机画面和动作由用户后续验收。
