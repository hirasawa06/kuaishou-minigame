# 快手小游戏资源规范

## 目录结构

```
res/
  home-asset/  # 首页渲染图（🔒 必须主包，禁止 CDN，禁止分包，首帧必需）
  Image/       # 图片（PNG / JPG / WebP）
  Audio/       # 音频（MP3 / OGG）
  Video/       # 视频（仅本地调试用，平台上传阶段统一 CDN 化）
  Icon/        # 应用图标（128×128 / 512×512）
subpackages/
  <sub-name>/
    res/       # 分包专属素材（与主包结构一致）
      Image/
      Audio/
```

## 命名规则（强制）

- 全小写，单词用 `-` 连接，禁止空格、中文、特殊字符
- 文件名不超过 60 个字符

## 资源存放决策总表

所有资源由平台在上传阶段统一上传至平台 CDN，并自动替换引用地址。开发者**无需**按体积判断是否上 CDN，也**禁止**在代码中拼接外部 CDN 地址；只需决定资源放在主包还是分包（影响首屏加载）。

| 资源类型 | 存放位置 |
|---|---|
| 首页渲染图（`home-asset/`）| 主包（强制，禁止分包）|
| 首屏必需图片 / 音频 | 主包 |
| 非首屏图片 / 音频 | 对应分包 |
| 图标 / 启动图 | 主包 `res/Icon/` |
| 视频 | 本地放 `res/Video/` 调试，平台上传阶段统一 CDN 化 |

> 游戏代码始终只调用 `KwaiRender.loadImage` / `KwaiMedia.Image.load` /
> `KwaiMedia.Audio.*` / `KwaiMedia.Video.*`，传入**包内相对路径**。路径如何被替换为 CDN URL 由封装内部统一处理，业务代码无需感知。

## 图片加载

```js
// 主包图片（首屏必需）
KwaiRender.loadImage({
  src: 'res/Image/menu-bg-full.png',
  onSuccess: function (img) {
    // img 为 Image 对象，可用于 WebGL 纹理
  },
  onFail: function (err) { console.warn(err); },
});

// 普通图片加载（无需绑纹理，如 UI 精灵图）
// 代码里始终写本地相对路径，CDN 化由 ResourceLoader 内部查映射表自动解析，调用方式不变
KwaiMedia.Image.load('res/Image/menu-bg-full.png').then(function (img) {
  // img: Image 对象
});

// 分包图片（先加载分包，再加载资源）
AIGCUtils.SubpackageLoader.load('level2', {
  onSuccess: function () {
    KwaiRender.loadImage({
      src: 'subpackages/level2/res/Image/level2-bg.png',
      onSuccess: function (img) {},
    });
  },
});
```
## 音频加载

```js
// 背景音乐（循环播放）
KwaiMedia.Audio.playBgm('res/Audio/bgm-main.mp3');

// 音效（自动复用实例池，最多 10 个）
KwaiMedia.Audio.playSfx('res/Audio/sfx-click.mp3');
```

禁止使用原生 `new Audio()`，统一走 `KwaiMedia.Audio`（`ks.createInnerAudioContext` 封装）。

## 视频资源规则

视频文件本地放 `res/Video/` 用于预览调试，平台在上传阶段统一上传 CDN 并写入资源映射表（不改动游戏代码），开发者无需手动上传。

视频使用 `KwaiMedia.Video.create / play`，`src` 始终传本地相对路径（如 `'res/Video/xxx.mp4'`），真实播放地址（本地调试返回本地路径，平台上传后自动返回 CDN URL）由 `KwaiMedia.Video` 内部自动解析。互动视频类玩法（underView）需单独联系平台加白。

## 资源自检清单

```
[] home-asset/ 下首页渲染图已放主包，未上传 CDN，未移入分包
[] 所有资源文件名全小写，用 - 连接，无空格/中文/特殊字符，且不超过 60 个字符
[] 首屏必需资源（home-asset/、Image/、Audio/）已放主包 res/ 对应目录
[] 非首屏资源已放入对应分包，首屏必需资源留主包
[] 分包专属资源已放 subpackages/<sub-name>/res/ 对应目录，未重复放入主包 res/
[] 图标 / 启动图已放主包 res/Icon/
[] 视频仅本地调试使用，已放 res/Video/，生产代码中不拼接 CDN 地址
[] 音频通过 KwaiMedia.Audio，未使用 new Audio()
[] 视频通过 KwaiMedia.Video
[] 离开场景时已销毁/释放不再使用的图片、音频、视频资源
```
