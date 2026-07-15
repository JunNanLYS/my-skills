---
name: figma-skill
model: sonnet
category: design
description: Use when creating, modifying, extending, or validating product UI, components, variables, tokens, responsive layouts, or design systems in Figma or through figma-cli; also use when a request mentions Figma, figma-cli, or NodeId.
version: 2.1
---

# Figma End-to-End Execution v2

将用户需求转化为可编辑、可复用、经过实际截图验收的 Figma 产品 UI。v2 引入跨会话持久任务账本（`.figma/`），状态机、租约与压缩归档共同保证跨任务可恢复但不替代 live Figma 读取。Web、桌面端、移动端 UI 与设计系统同等适用。

## Authority Invariant

- SKILL.md 是 v2 路由合约：概述、强制门禁、必读 reference、状态机摘要、审批门禁、Workflow I/O 契约、归档门禁、Red Flags。
- 所有具体名词解释、执行细节、几何验证、命令矩阵、术语表仅在 `references/`。Workflow 阶段必须加载对应 reference，禁止用 SKILL.md 替代任何一次加载。
- `.figma/` 是跨会话任务账本；它记录计划、Todo、事件、租约、evidence 与 visual summary，但 **永远不替代 live Figma 读取或当前 `--help` 查询**。所有结论必须由最新一次实时读取或会话内 help 输出交叉验证。
- `scripts/figma-task-state.mjs` 与 `scripts/figma-validate-bounds.mjs` 是离线助手，不与 Figma daemon 通信，不调用 git，不需要 eval/run gate。

## Non-Negotiable Rules

- 所有 Figma 读取、创建、修改、导出和验证必须使用 `figma-cli`。禁止使用 Figma MCP、其他 Figma CLI 或 GUI 自动化作为替代路径。
- 每个新会话首次执行 Figma 任务前必须按顺序运行 `figma-cli --version`、`figma-cli --help`、`figma-cli status`；未连接才允许 `figma-cli connect`，最后再 `figma-cli status` 确认。详细顺序见 `references/installation.md`。
- `<Current workspace>/docs/FIGMA_DESIGN_SYSTEM.md` 是唯一设计规范来源；设计系统审批与 Figma 写入审批是两次独立审批，前者禁止授权后者。
- 只有 `NativeHelpChecked`、`MissingNativeCapability`、`TargetNodeIds`、`FallbackCodeScope`、`FallbackImpact`、`GeometryReaudit` 六字段在 Workflow 6 的 `EvalRunFallback` 段完整且经用户批准时，才允许使用 `eval/run`。禁止凭旧记忆、第三方文档或示例代码推断 figma-cli 命令是否存在、参数或行为。
- 任何 `eval/run` 与 `figma-cli` 之外的运行时（node / python / pwsh / sh / 直接读 JSON / 直接调 Figma REST API 等）按上述六字段同等待遇。例外：`scripts/figma-validate-bounds.mjs`、`scripts/figma-task-state.mjs`（前者离线 JSON 分析，后者离线任务账本）。
- 项目预设助手脚本 `scripts/{list-children,overlap-check,page-overlap-check,inspect-geometry}.mjs`（只读）由 eval/run gate 预设批准，无需在 CommandPlan 中再次提供六字段；`scripts/{apply-layout,resize-section}.mjs`（写动作）仍必须经 Workflow 6 审批，且 `TASK_ID` / `BASELINE_REVISION` / `PARENT_IDS` / `EXPECTED_PARENT_TYPE` / `PAD_X` / `PAD_Y` / `PLANS` 等入口常量必须在 CommandPlan 中显式列出并经用户审批。
- duplicate、reparent、unwrap、组件化、组合 variants、删除重建或大幅层级调整后，必须重新读取 NodeId 和当前几何，再写入。任务上下文（`.figma/observedContext`、`state.observedContext`）只能辅助记录，不能替代 live 读取。
- 验证失败最多自动修正三轮（≤3）；仍失败必须停止写入并完整报告。
- 硬性要求必须用「必须」「禁止」「只有……才允许」；禁止用弱措辞稀释门禁。
- 每个 Workflow 阶段开始时必须先加载规定的 reference，证据是相关命令的 `--help` 或同义查询文本与 reference 章节至少各出现一次。缺少证据视为该阶段 `Gate=FAIL` 并禁止进入下一阶段。
- 任务分类 (`Create | Modify | Audit | Migrate | Export`) 在 Workflow 0B 决定；`Audit` 与 `Export` 类型 `writeRequired=false`，不能进入 Workflow 6 / 8 / 10。`Workflow 6` 必须把 `readOnly` 类型拦截在更早的 Workflow。
- 状态机变更必须经过 `.figma/` 任务账本：每个 checkpoint 通过 `figma-task-state.mjs checkpoint` 写入 `events.jsonl`、`state.json`、`index.json`、`recovery.md`、lease heartbeat；任何阶段失败按 byte-for-byte snapshot 回滚。
- 截图与视觉结论：截图保存到 `.figma/screenshot/<task-id>/`，必须实际打开并目视结论；视觉结论必须写入 `state.validation.visual.summary` 或 `final-summary.md`；归档时只删除本任务截图目录。

## Mandatory Lookups

```text
Workflow 1（环境 / 安装 / 连接）        → references/installation.md
Workflow 2 / 4G（设计系统）              → references/design-system.md
Workflow 0A / 4A–4F / 4H / 5 / 6 / 9–11（发现 / 命名 / 计划 / 验证 / 归档）
                                       → references/planning.md
Workflow 6 / 7 / 8（写入与执行）         → references/execution.md
Workflow 9 / 10（几何验证 / 修正）       → references/geometry-verifier.md
Workflow 11（终态交付 / 压缩归档）       → references/validation.md
Workflow 12（自省归档 / feedback 落盘）   → references/self-reflection.md
任何阶段（命名 / 变体 / 命名解析）       → references/naming.md
任何阶段（`.figma/` 任务账本 / 状态 / 租约 / 恢复 / 归档）
                                       → references/state-and-recovery.md
```

禁止：用 SKILL.md 替代以上任何一次加载。禁止：跳到 Workflow 7 之前仍未加载 `references/execution.md`。

## Three-Page Architecture

```text
01 Library
02 Screens
03 Flows
```

禁止创建第四个 Page。`01 Library` 内部按 Section 分区（`00 Foundations`、`10 Components`、`80 Internal`、`90 Deprecated`）。`02 Screens` 通过业务域和 Flow Section 组织；`03 Flows` 只承载流程编排，不承载权威 Component 或 Screen。截图由各任务的 `.figma/screenshot/<task-id>/` 管理，不进入 Page。

## State Machine Summary

```text
接收需求
  → Workflow 0A  bounded discovery
  → Workflow 0B  task classification (Create | Modify | Audit | Migrate | Export)
       → init .figma/ + figma-task-state.mjs create
  → Workflow 1   环境与连接 (installation.md)
  → Workflow 2   设计系统门禁 (design-system.md)
  → Workflow 3   Figma 文件结构审计
  → Workflow 4   目标发现与命名审计
  → Workflow 4A  复用决策 / 4B–4H 任务入口
  → Workflow 4I  Plan 编写与 Todo 构造 (planning.md)
  → Workflow 5   命名决策 (naming.md)
  → Workflow 6   Figma 写入方案审批 (planning.md + execution.md)
  → Workflow 7   记录基线 (execution.md)
  → Workflow 8   按固定顺序执行 (execution.md)
  → Workflow 9   几何验证 (geometry-verifier.md)
  → Workflow 10  最多三轮修正 (validation.md)
  → Workflow 11  交付 + 压缩归档 (validation.md + state-and-recovery.md)
  → Workflow 12  自省归档 (self-reflection.md)
```

完整 Mermaid 状态图与合法迁移见 `references/state-and-recovery.md`。`Audit` / `Export` 类型不进入 Workflow 6 / 8 / 10；`readOnly` 任务即使到达 Workflow 5 也只走 `state.taskType` 的 `readOnly` 子集。

## Approval Gates

### Gate 1 — Design System (Workflow 2)

文档缺失或缺少当前任务规则时，必须先提出最小必要规范，说明依据、影响和范围外冲突，并等待明确批准。批准后才允许写入 Markdown。该批准禁止授权任何 Figma 写入。

### Gate 2 — Figma Write Plan (Workflow 6)

设计系统确定后必须提交：

- 目标文件、页面、Frame 与明确边界；
- 复用、实例化、duplicate、修改或创建结构；
- 将修改的组件与 variables；
- 布局与响应式行为；
- 文档冲突与修正边界；
- 基线记录与批次顺序；
- 每个 `eval/run` 降级的六字段事实链；
- 验证对象与验收标准。

设计系统审批禁止满足此门禁。结构、设计系统、范围、共享组件或降级方式实质变化时必须重新审批。完整模板见 `references/planning.md`。

## Workflow I/O Gate Contract

每个 Workflow 阶段必须包含：

- 输入：上一阶段 Gate 状态、当前 `.figma/tasks/<task-id>/state.json`；
- 输出：`state.currentWorkflow`、`state.gate`、`state.gateStatus`、`events.jsonl` 中至少一条对应类型事件；
- Gate 名：固定的 `EnvironmentGate` / `DesignSystemGate` / `TaskClassificationGate` / `DiscoveryGate` / `NamingGate` / `WritePlanGate` / `BaselineGate` / `ExecutionGate` / `GeometryGate` / `CorrectionGate` / `DeliveryGate` / `SelfReflectionGate`；
- 下一态：`state.status` 与 `state.currentWorkflow`。

`GateStatus` 仅 `PENDING | PASS | FAIL | BLOCKED | NOT_REQUIRED`。任何阶段 FAIL 立刻停止并返回上一阶段。

## Completion and Archival Gate (Workflow 11)

`COMPLETED` 必须同时满足：

1. 几何六道闸门全部 `PASS`；
2. 视觉截图实际打开且无未披露问题；
3. `.figma/tasks/<task-id>/` 内 `state.json`、`index.json`、`events.jsonl`、`recovery.md`、`plan.md`、`todo.md` 全量校验 `figma-task-state.mjs validate` 通过；
4. 视觉结论已写入 `state.validation.visual.summary`；
5. 用户对最终范围与降级方式未提出未披露变化。

归档流程：

1. 锁定任务写入；
2. 生成 `final-summary.md`；
3. 写最终 plan / Todo / state / evidence-index 快照；
4. 将视觉结论写入摘要；
5. 删除 `.figma/screenshot/<task-id>/` 并验证零残留；
6. 删除临时文件、batch 输出、可再生成 baseline；
7. 精简 evidence manifest；
8. 写 `SCREENSHOTS_CLEANED` 与 `TASK_ARCHIVED` 事件；
9. `archiveStatus` 写入 `ARCHIVED`；
10. 释放 lease。

任意步骤失败 → `archiveStatus=ARCHIVE_FAILED` + `close` 拒绝。`COMPLETED / FAILED / CANCELLED / SUPERSEDED` 都走压缩归档；`BLOCKED / STALE / NEEDS_REPLAN` 因可恢复仍保留截图。

## Self-Reflection (Workflow 12)

Workflow 11 通过后必须立即执行自省，无论本任务最终是 `COMPLETED / FAILED / CANCELLED / SUPERSEDED`。自省不重复 Figma 写入，只生成一份反思文件供后续会话与维护者使用。

- 存储路径：`<Current workspace>/.figma/feedback/<timestamp>.md`，其中 `<timestamp>` 使用 ISO 8601 文件名安全形式（`YYYY-MM-DDTHH-MM-SS`，本地时区），文件名为单一时间戳，不含 task id。
- 文件首行必须以 `# figma-skill v2.1 Self-Reflection` 开头，紧跟一个 `<!-- skill-version: 2.1 -->` 注释；以下为问题与优化方向两个表。
- 问题列表表头：`# | 问题 | 出现的 Workflow | 影响`。每行写一个具体观察（例如："Workflow 6 审批后立即 ack，没有要求 plan.md 重新打开"。）。
- 优化方向表头：`# | 优化方向 | 优先级 | 关联问题`。每行写一条可执行改进（例如："将 plan 重读纳入 Workflow 8 起步动作"。优先级只允许 `P0 / P1 / P2`。
- 两个表必须同时存在；缺少任何一张视为本 Workflow `Gate=FAIL` 并触发一次重新自省，禁止直接关闭会话。
- `SelfReflectionGate` 默认 `PASS` 即写文件；只有文件落盘、`size > 0`、包含两个表头子串、且首行版本字串匹配当前 `version` 才允许声明 PASS。
- 自省文件不需要 `.figma/tasks/<task-id>/` 任何现有写入；`.figma/feedback/` 是跨任务、跨会话的全局目录，由 `figma-task-state.mjs reflect` 创建或追加。
- 自省文件不得包含 daemon token、`~/.figma-ds-cli/` 路径或凭据；触发 S23 的内容必须脱敏或拒绝落盘。

## Red Flags and Rationalizations

每个失败模式对应一条直接拒绝的判断。所有 Red Flag 同样适用于审计与导出任务。

- "审计任务只是看看，不会改 Figma" → 错；`Audit` 类型 `writeRequired=false` 是积极约束，不是"可以悄悄写"的许可。任何写入都必须新建 `Modify` 任务。
- "上次用过的 `figma-task-state.mjs` 命令应该没变" → 错；版本可微变，必须运行 `--help`。
- "plan.md 还是那一份，Workflow 6 直接批" → 错；结构、规范、范围、共享组件或降级方式任一变化都使原审批失效。
- "存在 node 即可写，不用重新读 geometry" → 错；duplicate / reparent / unwrap 后必须重新读 geometry。
- "Workflow 10 自动修了三次不成功就让它过" → 错；失败超过三必须停止写入并报告。
- "之前那条 .figma 截图只是临时检查，可以保留" → 错；只有归档完成且零残留才允许声明完成。
- "Workflow 11 收尾后直接关掉就行，不用写自省" → 错；任何归档结束的会话都必须落盘 `.figma/feedback/<timestamp>.md`，否则 `SelfReflectionGate=FAIL`。

## Task Entry Pattern (Workflow 0B)

每个具体任务（Create / Modify / Audit / Migrate / Export）必须：

1. `figma-task-state.mjs init-project`（已存在则跳过）；
2. `figma-task-state.mjs create --task <id> --title ... --type <type> --write-required <bool>`；
3. Workflow 6 审批通过后 `figma-task-state.mjs acquire`；
4. 进入 Workflow 7 记录 baseline；
5. 后续 Workflow 9 / 10 / 11 / 12 都通过 `checkpoint` 写入事务。

概念问题不创建任务账本。