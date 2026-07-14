# Planning and Approval Gates

`planning.md` is the single authority for Workflow 0A / 0B discovery, the Workflow 6 write plan template, both approval gates, and Todo construction.

## Bounded Discovery (Workflow 0A)

任何写入前必须通过 `figma-cli` 只读获取当前任务需要的最小上下文：

- 当前打开文件和目标文件；
- 目标 page、Section、Frame 与直接层级；
- 相关 variables、styles、components、Component Sets、variants、instances 和 reuse handles；
- 当前尺寸、布局行为和绑定；
- 目标区域基线截图（写入到 `.figma/screenshot/<task-id>/`）。

搜索必须限定 page、parent 或 name。局部查询足够时禁止扫描整份大型文件。此阶段禁止 Figma 写入。

## Task Classification (Workflow 0B)

每个新需求先按以下规则分类，确定 task 类型：

1. 从零产出 UI → `Create`；
2. 修改已有结构 → `Modify`；
3. 只读问题排查 → `Audit`；
4. 跨文件或跨结构搬迁 → `Migrate`；
5. 仅产出 PNG / Spec 之类资产 → `Export`；
6. 选择唯一类目后必须 init `.figma/` 并 create 一个 task ledger（写入 `state.json`, `plan.md`, `todo.md`, `recovery.md`）。

`readRequired` 任务在分类阶段就标记 `writeRequired=false`，后续 Workflow 6/8/10 必须被转换校验拒绝。

## Reuse Decision

使用第一条适用路径：

1. 已有组件或 reuse handle：先 `spec`，再 `instantiate`。
2. 跨页、多状态或需要统一演进：Component 或 Component Set。
3. 同页结构相同、内容不同：先完成一份，`duplicate`，重新读取 NodeId，再逐份修改。
4. 多个完全相同且独立的节点：`render-batch`。
5. 确认没有可复用结构后才允许新建。

用户要求 N 个同类对象时必须得到 N 个独立节点。禁止把 wrapper 升级成一个组件冒充多个对象。

## Approval Gates

### Gate 1 — Design System (Workflow 2)

文档缺失或缺少当前任务规则时，必须先提出最小必要规范，说明依据、影响和范围外冲突，并等待明确批准。批准后才允许写入 Markdown。该批准禁止授权任何 Figma 写入。

### Gate 2 — Figma Write Plan (Workflow 6)

设计系统确定后，必须提交：

- 目标文件、页面、Frame 和明确边界；
- 将复用、实例化、duplicate、修改或创建的结构；
- 将修改的组件和 variables；
- 布局与响应式行为；
- 文档冲突和修正边界；
- 基线记录与批次顺序；
- 每个 `eval/run` 降级的原生命令缺失证据、代码范围和目标 NodeId；
- 验证对象与验收标准。

设计系统审批禁止满足此门禁。结构、设计系统、范围、共享组件或降级方法变化时，原批准失效。

## Workflow 6 Write Plan Template

```text
Task
  taskId
  title
  taskType
  writeRequired
  status
  currentWorkflow

Figma Write Plan
  targetFile
  page
  parent
  scope

Reuse / Create
  spec / instantiate
  duplicate / set
  render-batch

Variables / Styles
  collections
  bindings

Layout / Responsive
  layoutMode
  sizing
  breakpoints

Conflict and Scope
  in-scope fixes
  out-of-scope report

Baseline
  Workflow 7 source
  batch order

EvalRunFallback (optional)
  NativeHelpChecked
  MissingNativeCapability
  TargetNodeIds
  FallbackCodeScope
  FallbackImpact
  GeometryReaudit

Approval
  designSystem
  figmaWrite
```

`Cmd` 段仅允许引用 `references/execution.md` 已批准的入口常量；不允许在 `Cmd` 段塞入项目预设助手脚本未公开的脚本。

## Todo Construction (Workflow 4I/6)

`todo.md` 使用规范 4 行 Markdown：

```markdown
- [ ] T-001 Re-read target Section children
  - workflow: 7
  - blockedBy: []
  - evidence: []
```

- `T-001` 不可变 ID；同一 task 内 ID 唯一。
- `workflow` 字段必须对应 Workflow 1–11 数字。
- `blockedBy` 必须是同 task 内已存在的 `T-###` ID；解析器检测环并拒绝。
- `evidence` 在 Todo 完成前必须包含至少一条证据 ID（如 `EV-####`）或事件 ID（如 `E-####`）。
- 完成 Todo 必须经 `figma-task-state.mjs checkpoint` 写入 `TODO_UPDATED` 事件并更新 `state.validation` 或 `state.evidenceRefs`。

## Plan Versioning

每次审批失效（结构、规范、范围、共享组件或降级方式变化）必须创建新 plan 版本并在 `plan.md` 顶部追加：

```markdown
## Revisions
- v2 (2026-07-14T10:42:00+08:00) Replaced apply-layout.mjs path with new helper; old plan archived.
- v1 (2026-07-14T10:00:00+08:00) Initial approval.
```

旧版本不删除，新 plan 必须显式 supersede。