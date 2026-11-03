# 快手小游戏广告位配置规范

## 广告位 ID 约定

广告位 ID（激励视频）由快手平台在审核通过后统一分配，**开发者代码中不填写真实 ID**。脚手架在 `kwaiStandard/core/kwai-ad-config.js` 中写入占位符，由 yoola 平台在上传阶段自动替换：

```js
// kwaiStandard/core/kwai-ad-config.js（🔒 禁止修改，由脚手架写入，yoola 平台替换占位符）
window.KwaiAdConfig = {
  rewardedAdUnitId: '__REWARDED_AD_UNIT_ID__',
};
```

`kwaiOpenApi/kwai-ad.js` 自动从 `window.KwaiAdConfig` 读取，无需手动传入 ID。

## 接入流程

1. 在 `game.js` require 块中引入广告模块（脚手架默认已引入）：

   ```js
   require('./kwaiOpenApi/kwai-ad.js');
   ```

2. 在游戏逻辑中调用封装方法：

```js
// 激励广告（复活 / 双倍奖励）
KwaiAd.showRewarded(
  function () { giveReward(); },  // 用户看完
  function () { /* 用户中途关闭 */ }
);
```

详细 API 参数见 [激励广告](kwai-api/ad/rewarded-ad.md)。

## 频控说明

| 广告类型 | 冷启动保护 | 最小展示间隔 | 超出频控时 |
|---|---|---|---|
| 激励视频 | 无 | 无 | 正常展示 |

## 本地调试说明

H5 预览时广告 API 静默降级（不报错，直接执行回调），模拟用户"看完广告"的路径。`validate-package.mjs` 预检会提示占位符残留（INFO 级，不阻断上传）。
