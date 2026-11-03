# 当前状态

更新：2026-11-03（Asia/Shanghai） · 记录范围：本仓库协作基线，待本分支审阅合并。

## 现有工程

- 项目仓库：`861289009/kuaishou-minigame`。唯一游戏工程是 `tower-defense/`，当前为通用竖屏单机塔防 Demo。
- `main` 尚无《猫狗大战家具》的已合并策划或玩法改造。当前代码行为与项目阶段以 `tower-defense/PROJECT.md`、`aigc-context.json` 为准。
- 已知待核对项：`tower-defense/package/kwaiStandard/main.js` 与随仓库 Skill 的模板不同；平台真机兼容、只读适配层要求与预检结果尚未在本次迁移中验证。

## 当前待审阅内容

- `codex/planning-foundation`：基础策划和当前 Demo 的差异，尚未合并。
- `codex/collaboration-memory`：项目入口、策划迁入边界和版本记录，尚未合并。

## 下一步

1. 团队审阅两条独立分支，确认需要迁入的策划内容和协作约束；合并前以各分支自己的文件为准。
2. 对齐目标产品与当前 Demo 的差异，再单独开工程分支处理入口/适配层和玩法改造。
3. 真机与平台上传结果由实际测试者记录；目前不声明已通过。
