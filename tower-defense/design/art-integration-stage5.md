# 美术接入阶段 5：近战猫与法师狗

状态：待用户视觉审查。分支：`codex/in-game-art-integration`，承接阶段 4。

## 素材与命名

- 角色设定以 `origin/petsAndFurniture-art-assets` 中的 `tools/src/characters/角色/近战猫/近战猫三视图.png` 和 `tools/src/characters/角色/法师狗/法师狗.png` 为准。
- 原设定板没有透明通道。`art-integration-stage5/` 中的四张 `*-source.png` 是依据设定板生成的透明衍生图，保留角色外形和道具，供审查；不是逐像素抠取。运行时缩至最长边 512px，保留 RGBA。
- 现有职业 `war` 显示名从“冲锋犬”改为“近战猫”；`mage` 从“魔法猫”改为“法师狗”。内部 ID、职业、卡费、血量、攻击和所有战斗规则保持原值。

## 绘制位置

- 商店卡牌、拖放和角色详情使用正视图；战场角色使用背视图。近战猫随原有面向值水平翻转，图片按原比例绘制。
- 盾犬、射手猫、敌人和场景的绘制路径不变。新角色目前使用静态视图，沿用原有位移、受击和退场效果；源设定板没有独立动作帧。
- 字体图集新增“狗”，并保留旧字形集合，避免名称少字。

## 核对

- [近战猫战场与卡牌](art-integration-stage5/melee-cat-battle.png)
- [法师狗战场与卡牌](art-integration-stage5/mage-dog-battle.png)
- `node tools/anim-shot.mjs --port 8102 --hero war|mage`：资源加载与画面渲染正常；`node tools/sim.mjs --seconds 120`：玩法仿真通过。
- 本地 H5 截图仅供比例与名称核对，真机视觉效果待用户验收。
