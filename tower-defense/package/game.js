/**
 * game.js — 主包入口
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 【主包 vs 分包职责 - 代码生成（codegen）阶段强制规则】
 * ────────────────────────────────────────────────────────────────────────────
 * 主包只放首屏必需的代码与素材；**非必要的文件在代码生成（codegen）阶段自动放入分包**。
 *
 * 判定规则（codegen 阶段执行）：
 *   1) 仅在特定关卡 / 场景 / 结局下使用的代码文件  → 放入对应分包根目录
 *      例：第 2 关逻辑 → subpackages/subpackage1/，第 3 关逻辑 → subpackages/subpackage2/
 *   2) 仅在特定关卡使用的素材（非首屏）           → 放入对应分包 res/
 *      例：level2-bg.png → subpackages/subpackage1/res/Image/level2-bg.png
 *   3) 首屏必需代码 / 首屏必需素材 / res/home-asset/ → 必须留在主包，禁止入分包
 *   4) 资源体积无需按大小判断：平台在上传阶段统一做 CDN 化（视频等大文件不占用包体）
 *
 * 分包加载（主包侧调用，按需触发）：
 *   AIGCUtils.SubpackageLoader.load({
    *     name: 'subpackage1', // 与 game.json subpackages[].name 一致
 *     onSuccess: function () { /* 分包已就绪，进入分包场景 *\/ },
 *     onFail:    function (e) { console.error('[SubPkg] 加载失败', e); },
 *   });
 *
 * 分包内 game.js 由 ks.loadSubpackage 加载成功后自动执行一次（场景注册用），
 * 详见 subpackages/subpackage1/game.js、subpackages/subpackage2/game.js 顶部说明。
 * ────────────────────────────────────────────────────────────────────────────
 */

require("./kwaiadapter.js");
require("./kwaiStandard/engines/ks-adapter.js");
require("./kwaiStandard/core/kshelper.js");
// 快手小游戏唯一模块装配入口：所有 require 必须写在这里。
require("./kwaiStandard/core/aigc-init.js"); // 初始化 AIGCUtils.Layout 等全局基础参数
require("./kwaiStandard/manager/asset-manager.js"); // 统一资源管理器（引用计数 + 分组释放）
require("./kwaiStandard/core/kwai-event-bus.js"); // 事件总线
require("./kwaiStandard/loaders/subpackage-loader.js"); // 分包加载器
require("./kwaiStandard/loaders/resource-manifest.js"); // 资源映射表（平台上传阶段注入 CDN 映射）
require("./kwaiStandard/loaders/resource-loader.js"); // 统一资源路径解析器
require("./kwaiStandard/manager/game-logger.js"); // 重要日志输出
require("./kwaiStandard/engines/spine38.js"); // Spine 3.8 运行时
require("./kwaiStandard/engines/spine-fx.js"); // Spine 特效渲染器
require("./kwaiStandard/core/kwai-ad-config.js"); // 广告位配置
require("./kwaiOpenApi/kwai-login.js"); // 用户登录
require("./kwaiOpenApi/kwai-ad.js"); // 广告
require("./kwaiOpenApi/kwai-repost.js"); // 转发分享
require("./kwaiOpenApi/kwai-ui.js"); // Toast / Modal / Loading
// ↓ 其他平台能力模块按需引入
require("./kwaiOpenApi/kwai-base.js"); // 系统安全区 / 生命周期
require("./kwaiOpenApi/kwai-render.js"); // 图片 / 字体加载
// require("./kwaiOpenApi/kwai-network.js");
// require("./kwaiOpenApi/kwai-file.js");
require("./kwaiOpenApi/kwai-media.js"); // 音效 / 背景音乐
require("./kwaiOpenApi/kwai-device.js"); // 振动 / 键盘
require("./kwaiOpenApi/kwai-storage.js"); // 本地存档（资料与设置）
// require("./kwaiOpenApi/kwai-open.js");
// require("./kwaiOpenApi/kwai-record.js");
// require("./kwaiOpenApi/kwai-shortcut.js");
// require("./kwaiOpenApi/kwai-siderbar.js");
// require("./kwaiOpenApi/kwai-commonuse.js");
// require("./kwaiOpenApi/kwai-official.js");
// require("./kwaiOpenApi/kwai-game-community.js");
// require("./kwaiOpenApi/kwai-subpackage.js");
// require("./kwaiOpenApi/kwai-data-analysis.js");
// ↓ 游戏文件（按依赖顺序填入，禁止在业务文件内写 require）
require("./gameplay/data/font-atlas.js"); // 字形图集数据
require("./gameplay/data/sprites.js"); // 图标精灵图数据
require("./gameplay/data/avatars.js"); // 共用头像图集
require("./gameplay/data/rigs.js"); // 战斗图集元数据（动作帧 + 特效）
require("./gameplay/data/character-animations.js"); // 角色动作规格（生成）
require("./gameplay/data/avatars.js"); // 首页与个人资料头像元数据
require("./gameplay/config.js"); // 数值配置
require("./gameplay/layout.js"); // 竖屏布局
require("./gameplay/state.js"); // 运行时数据模型
require("./gameplay/profile.js"); // 个人资料 / 设置 / 虚拟地区榜
require("./gameplay/render/gl.js"); // WebGL 批渲染器
require("./gameplay/render/draw.js"); // 绘图原语
require("./gameplay/assets.js"); // 纹理加载
require("./gameplay/audio.js"); // 音效
require("./gameplay/anim/rig.js"); // 分件关键帧动画
require("./gameplay/anim/defs.js"); // 单位动画表
require("./gameplay/play/battle.js"); // 核心玩法
require("./gameplay/rewards.js"); // 激励奖励业务门禁（禁止占位/H5 假奖励）
require("./gameplay/input.js"); // 触摸输入
require("./gameplay/render/scene.js"); // 战场绘制
require("./gameplay/hero-forms.js"); // 角色三等级形象
require("./gameplay/tutorial.js"); // 首关操作引导
require("./gameplay/ui.js"); // 设置 / 名片 / 排行榜 / 邀请
require("./gameplay/render/hud.js"); // HUD 与界面
require("./gameplay/render/safe-area-debug.js"); // H5 安全区调试层
require("./gameplay/game.js"); // 主循环装配

window.canvas = kshelper.GetMainCanvas("canvas");

require("kwaiStandard/main.js");
