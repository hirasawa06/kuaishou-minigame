# WebGL 渲染规范

快手小游戏所有渲染必须通过 WebGL API（`gl.*`），禁止使用 `canvas.getContext('2d')` 或任何 Canvas 2D API。

## 画布获取

```js
var canvas = window.canvas; // 全局唯一 Canvas 元素，由脚手架预置

// 只能使用 webgl 1.0；webgl2 未加白，调用会直接失败；禁止使用 '2d'
var gl;
try { gl = canvas.getContext('webgl'); } catch (e) {}
```

通过 `KwaiRender.init()` 初始化后，`KwaiRender.canvas` 和 `KwaiRender.gl`（WebGL 上下文）已就绪，无需手动调用上述代码。

## 离屏画布

```js
// 离屏渲染优先在主 WebGL 上下文内使用 framebuffer
var framebuffer = gl.createFramebuffer();
// 用于渲染到纹理、缓存图层等
```

快手环境中离屏画布为 `ks.createCanvas()`（第 2 次及以后调用），H5 环境为 `document.createElement('canvas')`，`KwaiRender` 内部已做适配。

## 屏幕适配（resize）

`kwaiStandard/main.js` 内置 `resize()` 函数，已按 `devicePixelRatio` 设置 canvas 物理尺寸，布局参数写入 `AIGCUtils.Layout`。无需重复实现。

游戏坐标系以**逻辑像素**为单位（`AIGCUtils.Layout.w` / `AIGCUtils.Layout.h`），绘制时不需要手动乘以 DPR。

Y 轴起点必须从 `AIGCUtils.Layout.safeTop` 开始，禁止从 `0` 绘制（会被刘海/状态栏遮住）。

## 帧循环

游戏主循环使用 `requestAnimationFrame`，`main.js` 已提供骨架，替换【占位绘制】部分即可：

```js
// main.js 骨架（🔒 禁止修改结构，只替换 draw() 函数体）
function draw() {
  // ← 在此填入 WebGL 绘制逻辑，或调用 AIGCUtils.Render.draw(gl, dt)
}
```

时间差使用 `AIGCUtils._now()` 计算，禁止直接调用 `performance.now()`。

## 触摸输入

```js
canvas.addEventListener('touchstart', onStart, { passive: false });
canvas.addEventListener('touchmove',  onMove,  { passive: false });
canvas.addEventListener('touchend',   onEnd,   { passive: false });
canvas.addEventListener('mousedown',  onStart);
canvas.addEventListener('mouseup',    onEnd);

// 坐标换算（逻辑像素）
function scalePos(cx, cy) {
  var r   = canvas.getBoundingClientRect();
  var dpr = window.devicePixelRatio || 1;
  return {
    x: ((cx - r.left) * (canvas.width  / dpr)) / r.width,
    y: ((cy - r.top)  * (canvas.height / dpr)) / r.height,
  };
}
```

`{ passive: false }` 是强制要求，否则快手容器无法阻止默认滚动行为。

## 禁止的 UI 实现方式

完整禁用 Web API 清单（含 DOM / Canvas 2D / WebGL2 / 外部字体库等）见 [kwai-minigame-spec.md](kwai-minigame-spec.md#禁用-web-api-清单)，此处不重复列出。

## 帧率控制

```js
require('./kwaiOpenApi/kwai-render.js'); // game.js 中按需引入
KwaiRender.setPreferredFramesPerSecond(60); // 目标 60 fps
```

## 字体加载

```js
require('./kwaiOpenApi/kwai-render.js');
// 字体通过 ks.loadFont 加载，KwaiRender 内部封装，详见 kwai-api/render/font.md
```
