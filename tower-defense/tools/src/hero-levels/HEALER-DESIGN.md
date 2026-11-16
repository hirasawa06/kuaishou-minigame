# 奶糖喵首次正式形态设计

状态：**本轮授权的新设计 / 待用户美术验收**。2026-11-11 22:10。

此前没有奶糖喵专属角色图/三视图，本轮授权合理默认创建新母版。参考来源是工程 `宠物情绪版.png`（统一风格）、`法师狗.png` 与 `射手猫.png`（仅玩具材质、比例、正背面构图），不声称这些是已有奶糖喵身份参考，不复制原英雄身份、武器或毛色。

## 真实生成与后处理

- `gen-healer.py` 实际调用 Skill 官方 Sunburst i2i，明确 `-n 1`，独立任务与 `healer-sunburst-20261111-221014.log`。
- 原始 RGB 图片 `healer-three-levels-20261111-221014.png`，2048×1152，3列×2行。每列 Lv1/Lv2/Lv3，上行正面收藏，下行背面静态参考；原图永久保留。
- 奶油白猫、浅薄荷披风/医疗包、祖母绿眼睛、爪形治愈杖，无攻击武器。Lv1简单小包与短杖，Lv2结构包/短肩披与普通爪杖，Lv3双药瓶医疗包/分层披风与金框强化治愈杖。Lv2 是本轮首次正式设计，不再把心形当形象。
- 洋红幕标准去背景，保留绿色装备；半透明边缘去溢色，不重画、不以变色伪造等级。真正 alpha 源 `healer-three-levels-20261111-221014-alpha.png`。六张独立源帧 `healer-lv{1,2,3}-{front,back}-alpha-full.png`。
- 读取原图、深色检查板、最终 runtime 图集：身体、尾巴、医疗包和杖完整，没有洋红/棋盘背景。白毛细边采用正常抗锯齿。

## 接入与限制

- Runtime `hero-levels.png` 第5列填入三级正面图，其他4列已对填入前后 decoded RGBA 像素核对，完全一致。
- `HeroForms` 五角色全部 `[true,true,true]`；没有新 healer Rig，没有改变治疗周期/动作/伤害逻辑。
- 背面图 prompt 指定南→北俯角60°，但生成实际更接近较浅背面视角，不应宣称已通过60°战斗相机验收。背面只作为源素材保留，本轮不打入 runtime、不作为正式动作；若父任务后续用于战场须修正镜头并单独接入/验证。
- 本轮新身份与三级装备外观仍待用户验收；可以作为当前默认正式收藏形象使用，不表示用户已确认美术。

## 重建

```bash
python3 tower-defense/tools/src/hero-levels/gen-healer.py
# 实际读取新生成源图后再去背景：
python3 tower-defense/tools/src/hero-levels/gen-healer.py --key
# 仅更新治疗列，四角色不变：
python3 tower-defense/tools/gen-hero-levels.py --healer-only
```

完整 `gen-hero-levels.py --pack` 也会读取已存在 healer 独立alpha并填入第5列。未运行浏览器、游戏、仿真、真机或测试；未 commit/push。未修改 scene.js 或既有角色资源。
