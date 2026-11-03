# 排障指南

## 常见兼容问题

| 现象 | 根因 | 解决 |
|---|---|---|
| 白屏 | `game.js` 的 require 路径与 `gameplay/` 下文件名不匹配 | 检查 `game.js` require 块路径，确保与实际文件名一致 |
| `document is not defined` | 快手环境无完整 DOM | 改用 `window.document`（仅可访问 `canvas`/`img` 节点）或 `window.canvas` |
| `performance.now` 报错 | 快手环境不支持 | 改用 `AIGCUtils._now()` |
| 触摸无响应 | 事件监听未加 `{ passive: false }` | `canvas.addEventListener('touchstart', fn, { passive: false })` |
| 视频黑屏 | 互动视频类玩法（underView）未加白，或视频路径错误 | 互动视频类游戏需单独联系平台加白；同时检查视频路径是否正确 |
| 广告不展示 | 广告位 ID 未注入 | 广告位 ID 由 yoola 平台在审核通过后统一注入，本地预览时广告回调仍会触发（静默降级）|
| 分包加载失败 | `game.json` 中 `name` 与代码中 `KwaiSubpackage.load` 的 `name` 不一致 | 两处 `name` 保持完全一致，`root` 路径以 `/` 结尾 |
| `require` 报错 | 在 `play/`、`render/` 等子文件中写了 `require` | 所有 `require` 只允许写在 `kwaiStandard/main.js`，子文件通过 `AIGCUtils.*` 访问其他模块 |
| 图片不显示 | 直接用 `new Image()` | 改用 `KwaiRender.loadImage` / `KwaiMedia.Image.load()` |
| 内存持续增长 | 切换场景时未释放资源 | 离开场景时及时销毁/释放不再使用的图片、音频、视频资源 |
| 网络请求被拦截 | 游戏必须单机，任何网络行为都会被拦截 | 移除 `fetch` / `XMLHttpRequest` / `axios` / `WebSocket` 等网络调用，改为本地计算 |

## 本地预览问题

**H5 预览（`scaffold-preview.mjs`）：**
- 快手专属 API（广告、登录、录制等）在 H5 中静默降级，不报错
- `window.canvas` 由 `kwaiadapter.js` 注入，H5 直接打开 `index.html` 即可验证渲染逻辑
- 控制台看到 `[KwaiBase] 非快手环境，返回空值` 属正常日志，不影响游戏主逻辑

## 包体超限

主包 / 单子包 ≤ 6 MiB，总包 ≤ 30 MiB。运行 `node scripts/validate-package.mjs --dir <GAME_DIR>` 查看详细体积报告。

图片 / 音频 / 视频等资源体积不由开发者关注，平台在上传阶段统一将其上传至平台 CDN 并替换引用。若仍超限，优先排查：

- 分包配置错误导致资源未进入预期分包（非首屏资源应放入分包）
- 代码 / 数据文件本身过大（见 performance-budget.md）

## WebGL 渲染异常

- **画面不更新**：检查 `requestAnimationFrame` 回调是否正常触发，`draw()` 函数体是否已替换【占位绘制】
- **纹理显示异常**：纹理尺寸建议为 2 的幂次（256/512/1024/2048），非 POT 纹理在部分设备性能较差
- **`gl` 为 null**：确认未误用 `webgl2`（未加白，直接失败），`canvas.getContext('webgl')` 调用是否在 `KwaiRender.init()` 之后
