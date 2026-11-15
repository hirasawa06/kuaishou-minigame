# 四角色动作素材审查稿 v1

状态：已临时接入 `codex/in-game-art-integration` 的本地预览，待视觉审查；未调整战斗逻辑与数值。概念图作为素材来源保留。

## 共通规格

- 战场统一背视、约 45° 俯视、Q 版柔和 3D、透明底；商店继续使用正视图。
- 每个角色保持待机、受击、退场三态；受击短促且动作清楚，退场姿势先出现，再触发已有通用烟雾。
- 角色识别锚点必须固定：盾犬的盾、游侠猫的头盔与手炮、近战猫的爪锤与黄围巾、法师狗的零食法杖与橙披风。

## 各角色动作性格

| 角色 | 待机 | 受击 | 退场 |
| --- | --- | --- | --- |
| 铁盾柴犬 | 原素材：稳守、盾光轻呼吸 | 原素材：举盾扛击 | 原素材：盾失力、身形倒下 |
| 游侠猫 | 原素材：瞄准警戒 | [新概念图](character-action-concepts-v1/archer-cat-hurt.png)：后撤一步、手炮下压、披风扬起 | 原素材：翻倒眩晕 |
| 近战猫 | [三态概念图](character-action-concepts-v1/melee-cat-poses.png)左：爪锤扛肩、蓄势摇摆 | 中：锤头下坠、耳朵后压、侧身失衡 | 右：仰倒、锤子脱力、短暂星晕 |
| 法师狗 | [三态概念图](character-action-concepts-v1/mage-dog-poses.png)左：举法杖、暖色魔法微粒 | 中：收身护杖、披风扬起、紫色受击星 | 右：坐倒、法杖倒在旁边、魔法消散 |

## 审查重点

1. 近战猫和法师狗是否仍像各自的原设定；动作是否与职业一致。
2. 退场是否足够清楚，尤其法师狗坐倒的幅度是否需要加大。
3. 这三张图是生成的视觉草案，透明边缘存在少量杂色。当前预览直接采用三态图集，批准方向后仍需清边、统一画幅与锚点。

## 局内预览

- [近战猫：待机](character-action-integration-preview/war/01-idle.png) · [受击](character-action-integration-preview/war/02-hurt.png) · [退场](character-action-integration-preview/war/03-die.png)
- [法师狗：待机](character-action-integration-preview/mage/01-idle.png) · [受击](character-action-integration-preview/mage/02-hurt.png) · [退场](character-action-integration-preview/mage/03-die.png)
- [游侠猫：受击](character-action-integration-preview/arch/06-hurt.png)

角色本体姿势由绘制层根据 `un.anim` 选择；受击时间、死亡延迟、烟雾时序与原战斗逻辑相同。商店、详情、拖拽中的角色正视图保持原样。`node tools/sim.mjs --seconds 120` 与三角色 H5 截图检查通过。当前只是 H5 视觉预览，真机画面尚待审查。
