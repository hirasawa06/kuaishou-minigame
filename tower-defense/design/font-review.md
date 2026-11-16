# 局内字体调整预览

状态：本地预览待审查，分支 `codex/in-game-art-integration`。

## 选择

原 UI 字体是系统黑体，与暖色木质卡牌和圆润角色造型不够一致。中文改用站酷快乐体；数字和英文改用 Fredoka 600，保留血量、费用等数值的辨识度。游戏仍以 WebGL 1.0 绘制离线位图字形，不调用系统文本 API 或外部 CDN。

## 核对画面

- [字体对比](font-review/comparison.png)：系统黑体与快乐体。
- [中英数字组合对比](font-review/pairing.png)：快乐体单用与快乐体 + Fredoka。
- [战场与卡牌](font-review/battle-preview.png)、[暂停弹窗](font-review/pause-preview.png)、[设置弹窗](font-review/settings-preview.png)。

图集保留原有 445 个字形，离线检查未发现缺字。卡牌布局和战斗数值没有调整。首页大图中已经烘焙的文字不属于运行时字库，此次不会重绘。真机视觉待用户审查。
