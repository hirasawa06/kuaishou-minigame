# 塔防小游戏（快手小游戏 / Yoola）

竖屏单机塔防 + 卡牌布阵。用 WebGL 1.0 自绘，所有图片与音频由 `tools/` 下的脚本离线生成，无外部素材依赖。

```
.
├── tower-defense/      游戏项目本体
│   ├── package/        小游戏包（game.js 入口，上传 Yoola 的内容）
│   ├── tools/          资源生成、截图、仿真脚本
│   ├── PROJECT.md      项目约定：渲染约束、资源管线、动画与特效、数值入口
│   └── aigc-context.json
└── ks-yoola-devkit/    快手小游戏开发规范 + 校验/打包脚本
```

两份目录必须放在同一层：`PROJECT.md` 里的校验命令用的是相对路径 `../ks-yoola-devkit/scripts/...`。

## 环境

- Node.js ≥ 14，Python 3 + Pillow + NumPy（只有重新生成资源时需要）
- ffmpeg（只有重新生成音效时需要）

```bash
python3 -m pip install pillow numpy
```

## 本地跑起来

```bash
# 启动 H5 预览（默认自动开浏览器）
node ks-yoola-devkit/scripts/scaffold-preview.mjs --dir tower-defense --port 8099
# 打开 http://localhost:8099/index.html
```

快手真机上 `game.js` 才是入口，`index.html` 只用于桌面浏览器预览。

## 常用脚本

```bash
cd tower-defense

node tools/sim.mjs --seconds 400        # 无浏览器玩法仿真（数值 / 状态机回归）
node tools/shot.mjs --port 8099         # CDP 驱动真实 Chrome：交互用例 + 截图
node tools/anim-shot.mjs --port 8099    # 定格动画帧：待机 / 蓄力 / 出手 / 受击 / 死亡
node ../ks-yoola-devkit/scripts/validate-package.mjs --dir .
node ../ks-yoola-devkit/scripts/build-zip.mjs --dir .
```

## 重新生成资源

```bash
cd tower-defense
python3 tools/gen-assets.py        # 字形图集 + 旧图标 + Yoola 平台素材
python3 tools/gen-shiba-atlas.py   # 战斗图集 game.png（柴犬分件 + 特效 + 继承图标）
python3 tools/gen-audio.py         # 11 个短音效
python3 tools/gen-home-asset.py    # 首页渲染图
```

新增中文文案后必须重跑 `gen-assets.py`，否则界面会缺字；改动分件或特效后必须重跑 `gen-shiba-atlas.py`。

## 内容来源

- `tower-defense/`：项目自研代码。角色美术（护盾柴犬）来自项目内的角色设定图，原始文件见 `tower-defense/tools/src/shiba-front.png`
- `ks-yoola-devkit/`：快手小游戏官方开发 Skill 的工具与规范包，随项目一并提供，方便协作者在没有本地安装的情况下直接校验与打包；其权利归原发布方，不在本仓库开源范围
- `tower-defense/package/kwaiStandard/`、`kwaiOpenApi/`：快手小游戏运行时脚手架

## 协作约定

- 开发前先读 [tower-defense/PROJECT.md](tower-defense/PROJECT.md)，渲染约束、资源管线和动画约定都写在那里
- 生成的图集（`package/res/Image/*.png`、`gameplay/data/*.js`）**随仓库提交**，克隆后无需生成脚本即可直接预览；脚本和源图一起改才提交
- 不提交：`*.zip` 打包产物、`.DS_Store`、图集中间件
- 上传 Yoola 需在 [开放平台](https://open.kuaishou.com/platform/minigame/yoola) 手动操作，`appid` 由平台在创建时替换

## 分支

- `main` 始终可预览、可校验通过
- 功能开发走短期分支，合入前跑 `sim.mjs` + `shot.mjs` + `validate-package.mjs`
