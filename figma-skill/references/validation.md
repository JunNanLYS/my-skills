# Validation and Delivery

## Geometry Validation Checklist

- 每个 in-scope 节点的 `layoutMode` / `primaryAxisSizingMode` / `counterAxisSizingMode` / `constraints` / `textAutoResize`
- 每个 in-scope 节点与邻居的 bounding box intersection 矩阵
- 每个 Component Set 的 variant row matrix
- 只有父子越界、裁切、变体不共享具体风险时才调用 `scripts/figma-validate-bounds.mjs`；离线审计禁止替代结构和视觉验证

## Three Required Layers

### Structural

必须重新读取关键节点并核对层级、type、NodeId、尺寸、位置、Auto Layout、约束、instances 和变量绑定。复刻 Component 或 Component Set 时必须运行适用的 `spec --check`。

### Visual

必须根据当前 `verify --save` 或 `export` 帮助把 PNG 保存到 `[Current workspace]/temp/figma-screenshot/`，使用页面或功能语义命名。必须实际打开每张最终截图，检查文字裁切、遮挡、对齐、间距、颜色、状态、圆角和层级。退出码 0 和导出成功禁止代替看图。

### Design System

必须逐项检查当前任务的 tokens、字体、间距、栅格、图标、组件状态和响应式行为是否符合 `docs/FIGMA_DESIGN_SYSTEM.md`。范围外历史差异只报告，禁止修改。

## Bounds Audit

只有父子越界、裁切、局部坐标、reparent 或复杂父框 resize 存在具体风险时，才运行 `scripts/figma-validate-bounds.mjs`。离线审计只能补充，禁止替代结构和视觉验证。

## Correction Limit

失败项进入固定循环：

1. 定位具体节点和原因；
2. 执行最小修正；
3. 重新运行受影响验证。

最多自动修正三轮。第三轮后仍失败必须停止写入。失败报告必须列出失败检查、受影响节点和可见症状、三轮修正、当前 Figma 可用性以及恢复或人工处理方式。禁止隐藏失败、降低标准或只展示通过区域。

## Completion Gate

只有批准写入全部完成、三层验证通过、最终截图已实际打开并归档、当前范围符合设计系统且没有未披露失败、范围变化或未经批准降级时，才允许报告完成。
