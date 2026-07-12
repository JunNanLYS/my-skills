# Design-System Authority

## Workspace Path

当前工作区是用户启动 Claude Code 或 Codex 时选择并授权的目录。命令目录变化和父级 `.git` 禁止重新定义它。

唯一规范来源固定为 `[当前工作区]/docs/FIGMA_DESIGN_SYSTEM.md`。

## Required Coverage

文档必须覆盖当前任务所需的：

- 设计原则与目标平台；
- 颜色与语义角色；
- 字体层级；
- 间距与尺寸尺度；
- 栅格与响应式断点；
- 圆角、描边与阴影；
- 图标体系；
- 基础组件与状态；
- 交互状态与可访问性底线；
- 命名和组件组织。

## Missing Document

按以下优先级建立当前任务的最小完整草案：

1. 用户明确需求和品牌资料；
2. 现有 Figma variables、styles 和 components；
3. 目标页面稳定、重复的视觉规律；
4. 前三者都无依据时才采用专业默认值。

必须展示拟新增规则、依据、影响和范围外冲突，并等待明确设计系统审批后才写入文档。

## Incomplete Document

文档缺少当前任务所需规则时，必须只补充最小缺口并等待批准。禁止使用临时默认值绕过缺项，禁止先改 Figma 后补文档。

## Conflict Policy

文档优先于现有 Figma。必须修正已批准任务范围及其直接依赖；范围外历史冲突只报告，禁止修改。直接依赖修正影响其他页面时，必须在审批前披露。

## Approval Boundary

设计系统审批只授权 Markdown 文档，禁止授权 Figma 写入。文档确定后必须进入独立的 Figma 执行方案审批。
