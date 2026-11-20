# 美术素材清理核对表

状态：2026-11-18 21:26清理候选已核对；图片实体未删除。

## 已确认的旧运行派生图

| 当前路径 | 核对依据 | 处理状态 |
| --- | --- | --- |
| package/res/Image/ui/components/home-level-nameplate-v1.png | 当前Assets已改用v3，package与tools代码/JSON未发现该文件名引用 | 待删除 |
| package/res/Image/ui/components/home-level-nameplate-v2.png | 已由爪印v3替换，package与tools代码/JSON未发现该文件名引用 | 待删除 |

v3及其approved-paw.png源图、gen-level-nameplate.py保留。旧approved.png属于用户源图历史，不能与旧运行派生PNG同时认定无用。

## 明确保留

- sprites-legacy.png：gen-shiba-atlas.py实际读取，不能删除。
- 十关封面与五张收藏场景：Assets动态拼接加载，不能只搜完整文件名。
- 字体源/图集/元数据、animation-specs、三视图、情绪版、特效原帧和派生源：保留生成链与来源。
- reference-analysis：研究参考，未运行引用不等于无用；本次仅分类索引。
- tools/src/audio-user与audio-unused-runtime：不是本次美术图片范围，不动。

## 尚不能确认可删除

history/review/comparison类文件可能是已批准素材的来源或裁切检查结果，需逐项对照生成记录与用户确认。完全相同SHA256只证明字节相同，不证明两处路径都无用途。扫描表内“未发现静态引用”一律不自动删除。

## 实体迁移与清理未完成

运行图片已按本清单迁移，且资源清单、元数据与生成器路径已同步；上述候选尚未删除。后续清理仍应以当前文件清单和哈希为准，并检查运行资源请求；不得以此表作为已经删除的证据。
