# 三级战场背面待机形态

状态：**新生成 / 静态素材检查完成 / 游戏与相机精确验收待验证**。2026-11-11 22:30。

## 交付

`package/res/Image/hero-levels-back.png`，真正透明 RGBA、1000×600、72PPI，5列×3行、每格200×200。

列：tank / war / arch / mage / healer；行：Lv1 / Lv2 / Lv3。

- 四英雄 Lv1/Lv3 新生成八格背面，带工程情绪版、已设计的 Lv1/Lv3 装备母版、现有背面待机参考和各角色结构参考。
- Lv2 四英雄直接复制 GameAtlas `tank-back-idle / war-back-idle / arch-back-idle / mage-back-idle`，没有重画动作。
- 奶糖喵新生成三级背面，带情绪版、新身份母版和原战场背面构图参考。旧浅角背面不采用。
- 新素材全部背朝观察者，无脸/眼/鼻。盾在左，锤/枪/法杖在右，披风/肩甲/单双锤头/单双罐/医疗包药瓶等等级结构均保留。
- 提示词统一为60°南→北斜俯视；新图视觉为明显斜俯背面，奶糖喵比旧图显著更俯视。AI图片不能测出精确角度，未运行相机预演，不宣称60°已做几何/真机验收。接入后若相机不一致须单独美术验收，不以文字 prompt 当验收证据。

## 来源与后处理

两项 Sunburst i2i 并行，每项明确 `-n 1`，原始源图保留：

- `four-back-20261111-223051.png`（绿幕、4×2）
- `healer-back-20261111-223051.png`（洋红幕、3×1，保留绿色装备）

`gen-back-idles.py` 标准色键/半透明边缘去溢色，输出真正 alpha。按完整连通角色边界隔离归格，防止AI不完美分栏切断镭射枪或带入邻格碎片。已读取原图与最终图集：无脸面替代、无棋盘/色幕背景，尾巴/耳朵/盾/锤/枪/杖完整。没有程序换色伪造新等级。

## 父接入合同

- Assets manifest 增加 `['hero-levels-back', A.HeroForms.backSrc]`，或直接src `res/Image/hero-levels-back.png`。
- `A.HeroForms.drawBattleIdle(id,level,cx,cy,size,alpha)` 仅使用背面 Assets key，采样 `[col*200,(level-1)*200,200,200]`。
- 缺纹理/尺寸错误返回false且**不画任何正面占位**，父场景应保留原背面 Rig。
- `battleIdleReady()` 可查纹理是否可绘制。独立前面 `HeroForms.init` 不自动加载背面，请父通过 Assets 加载。
- 仅idle使用新背面静态形态；atk/move/hurt/die仍原Rig；healer无原Rig可一直绘静态背面，但治疗技能连线保持父现逻辑。
- 接口size为整格边长、cx/cy为整格中心，与收藏draw相同。格内脚底基线为188/200；脚底目标y对应cy=footY-size*0.44。
- 原Lv2透明图保留原占格尺寸，新Lv1/Lv3在176px有效区域内；因此父如要统一实际角色视觉体型，应另按有效alpha占格比调idle绘制size，不修改逻辑占地/攻击距离。

## 重建

```bash
python3 tower-defense/tools/src/hero-levels/gen-back-idles.py
# 实际读取新源图后再打包并读alpha图核对：
python3 tower-defense/tools/src/hero-levels/gen-back-idles.py --pack
```

本轮未修改父 scene/assets/index、前面收藏图集、原战斗动作图集、数值或治疗行为；未测试/浏览器/真机，未 commit/push。
