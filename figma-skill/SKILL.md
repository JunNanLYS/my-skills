---
name: figma-skill
model: sonnet
category: design
description: Use when creating, modifying, extending, auditing, exporting, or validating product UI, components, variables, tokens, responsive layouts, or design systems in Figma or through figma-cli; also use when a request mentions Figma, figma-cli, NodeId, or PlanWeave Figma work.
version: 3.0
---

# Figma End-to-End Execution v3

将用户需求转化为可编辑、可复用、经过实际截图验收的 Figma 产品 UI。v3 硬依赖 PlanWeave：先了解需求与 live facts，再写 spec，再写 plan，最后执行。旧 `.figma/tasks` 账本不再是流程来源。

## Authority Invariant

- SKILL.md 是 v3 compact router：只负责强制门禁、必读 reference、PlanWeave 生命周期、review contract、Figma artifact 边界和 Red Flags。
- PlanWeave is the workflow authority：requirements discovery、spec approval、implementation plan approval、task/block dependencies、runner/reviewer prompts、`pass` / `needs_changes`、rework routing、completion 和 recovery 必须由 PlanWeave 承载。
- `figma-cli` is the Figma fact and mutation authority：环境检查、live reads、writes、exports、screenshots、geometry evidence 和 validation data 必须来自 `figma-cli`。
- `.figma/` 只保留 artifact duty：`.figma/screenshot/<planweave-ref>/` 保存视觉验收截图；`.figma/feedback/<timestamp>.md` 保存 self-reflection。`.figma/` 禁止承载 task plan、state、events、recovery 或 completion authority（历史 ledger 命名例如 `.figma/tasks`、`lease.json`、`events.jsonl`、`archiveStatus` 不再是 active state）。
- `scripts/{list-children,overlap-check,page-overlap-check,inspect-geometry,figma-validate-bounds}.mjs` 是只读 helper；`scripts/{apply-layout,resize-section}.mjs` 是写入 helper。所有 helper 只能通过批准的 `figma-cli run` 路径进入 Figma 任务。

## Non-Negotiable Rules

- 所有 Figma 读取、创建、修改、导出和验证必须使用 `figma-cli`。禁止使用 Figma MCP、其他 Figma CLI、GUI 自动化、直接 REST API 或记忆作为替代路径。
- Pre-Spec Context Gate 必须在 spec drafting 之前完成；未完成时 no spec, no plan, no Figma write。
- Pre-Spec Context Gate 必须确认用户目标、非目标、任务类型 (`Create | Modify | Audit | Migrate | Export`)、是否需要 Figma 写入，以及阻塞性未知项。
- Pre-Spec Context Gate 必须先读取 `<Current workspace>/docs/FIGMA_DESIGN_SYSTEM.md`，before spec drafting。文档缺失或缺少当前任务规则时，必须先提出最小设计系统补充、说明依据/影响/范围外冲突、等待用户明确批准并更新文档；设计系统审批禁止授权 Figma 写入。
- 每个新会话首次执行需要 live Figma 的任务前必须按顺序运行 `figma-cli --version`、`figma-cli --help`、`figma-cli status`；只有未连接时才允许 `figma-cli connect`，随后必须再运行 `figma-cli status`。
- spec drafting 前必须通过 `figma-cli` 收集 live Figma context（当前文件/page/section/frame、直接 children、关键 geometry、相关 components、variables、styles、dependencies），before spec drafting；视觉基线需要时截图写入 `.figma/screenshot/<planweave-ref>/`。
- Spec Gate 只描述完成时必须为真的状态：requirements、design-system basis、live facts、target state、affected nodes、naming、geometry/visual acceptance、out-of-scope、approved assumptions。禁止在 spec 中写 command sequence、write batch order、eval/run code、correction-loop details 或 runner/reviewer assignments。
- Plan Gate 必须生成 PlanWeave implementation canvas，包含 Plan Draft、Plan Review、Pre-write Live Revalidation、Figma Write Blocks、Geometry Validation、Correction、Visual Validation、Final Review、Delivery、Self-Reflection，并为每个失败路径写明 rework route。
- 只有 approved spec、approved plan、Pre-write Live Revalidation 三者均通过后，才允许任何 Figma 写入。
- `Audit` 与 `Export` 默认 `writeRequired=false`；它们禁止进入会修改 Figma 的 write/correction block，除非用户开启新的 write-capable task。
- 只有 `NativeHelpChecked`、`MissingNativeCapability`、`TargetNodeIds`、`FallbackCodeScope`、`FallbackImpact`、`GeometryReaudit` 六字段完整且在 PlanWeave write block 中经批准时，才允许使用 `eval/run` 或任何非原生 figma-cli 能力。
- duplicate、reparent、unwrap、组件化、组合 variants、删除重建或大幅层级调整后，必须重新读取 NodeId、parent relation 和 geometry，再继续写入。
- 验证失败最多自动修正三轮（≤3）；仍失败必须停止写入，并由 PlanWeave 记录失败证据与 recovery options。
- 截图必须保存到 `.figma/screenshot/<planweave-ref>/`，必须实际打开并目视检查；导出成功或 exit 0 禁止替代看图。
- Self-Reflection Block 必须写 `.figma/feedback/<timestamp>.md`；文件必须包含问题列表和优化方向，且不得包含 daemon token、凭据或敏感绝对路径。
- 硬性要求必须用「必须」「禁止」「只有……才允许」；禁止用弱措辞稀释门禁。

## Mandatory Lookups

```text
Pre-Spec Context Gate（需求 / 设计系统 / 环境 / live facts）
  → references/planning.md
  → references/design-system.md
  → references/installation.md

Spec Canvas / Implementation Canvas / Review Gates / fixed final blocks
  → references/planning.md

State / recovery / stale context / needs_changes routing
  → references/state-and-recovery.md

Figma write execution / command truth / eval-run fallback / helper scripts
  → references/execution.md

Geometry validation / correction loop
  → references/geometry-verifier.md

Visual validation / final review / delivery
  → references/validation.md

Self-reflection artifact
  → references/self-reflection.md

Naming / component paths / variant grammar
  → references/naming.md
```

禁止：用 SKILL.md 替代以上任何一次加载。禁止：在未加载 `references/planning.md` 与 `references/design-system.md` 的情况下写 spec。

## Three-Page Architecture

```text
01 Library
02 Screens
03 Flows
```

禁止创建第四个 Page。`01 Library` 内部按 Section 分区（`00 Foundations`、`10 Components`、`80 Internal`、`90 Deprecated`）。`02 Screens` 通过业务域和 Flow Section 组织；`03 Flows` 只承载流程编排，不承载权威 Component 或 Screen。截图由 `.figma/screenshot/<planweave-ref>/` 管理，不进入 Page。

## PlanWeave Lifecycle

```text
User request
  → Requirements discovery
  → Pre-Spec Context Gate
  → PlanWeave Spec Canvas
  → Spec Review Gate
  → PlanWeave Implementation Canvas
  → Plan Review Gate
  → Pre-write Live Revalidation Block
  → Figma Write Blocks
  → Geometry Validation Block
  → Correction Block as needed
  → Visual Validation Block
  → Final Review Gate
  → Delivery Block
  → Self-Reflection Block
```

Routing rules:

- Requirements unclear → ask targeted questions before spec.
- Pre-Spec Context Gate incomplete → no spec, no plan, no Figma write.
- Spec Review Gate `needs_changes` → return to the named requirements/design-system/live-context/spec block.
- Plan Review Gate `needs_changes` → return to Plan Draft Block.
- Pre-write live revalidation conflicts with approved plan → return to Plan Draft or Spec Draft according to drift source.
- Geometry or visual validation fails → Correction Block, then rerun affected validation.
- Final Review Gate `needs_changes` → reviewer names the smallest responsible block.
- Correction budget exhausted → stop writes and present recovery options through PlanWeave.

## Review Gate Contract

Every Figma PlanWeave review gate must return exactly one of these YAML forms. The accepted literal values for `result` are `pass` or `needs_changes`:

```yaml
# result: pass | needs_changes
result: pass
checked:
  - spec_coverage
  - design_system_alignment
  - figma_live_evidence
  - dependency_order
  - validation_evidence
  - visual_evidence
  - out_of_scope_integrity
```

or:

```yaml
result: needs_changes
checked:
  - spec_coverage
  - design_system_alignment
  - figma_live_evidence
  - dependency_order
  - validation_evidence
  - visual_evidence
  - out_of_scope_integrity
targetBlock: <block-id>
reason: <specific failure>
requiredChange: <observable correction>
```

`needs_changes` 必须写 targetBlock、reason、requiredChange。Reviewer 禁止在已知 geometry、visual、evidence 或 scope failure 存在时 pass。

## Fixed Final Blocks

Write-capable implementation plans must include:

1. Pre-write Live Revalidation Block;
2. Figma Write Blocks;
3. Geometry Validation Block;
4. Correction Block with ≤3 budget;
5. Visual Validation Block;
6. Final Review Gate;
7. Delivery Block;
8. Self-Reflection Block;
9. `.figma/screenshot/<planweave-ref>/` artifact handling;
10. `.figma/feedback/<timestamp>.md` artifact handling.

A plan missing any required final block fails Plan Review.

## Red Flags and Rationalizations

- "先写 plan，执行时再读 FIGMA_DESIGN_SYSTEM.md" → 错；设计系统读取属于 Pre-Spec Context Gate，必须在 spec drafting 之前完成。
- "旧 .figma/tasks ledger 里有 plan，可以直接继续" → 错；old .figma/tasks ledger is not workflow authority。必须通过 PlanWeave state/recovery，并 live-read Figma facts。
- "PlanWeave 已记录 NodeId，所以不用重新读" → 错；PlanWeave 记录是 orchestration evidence，不替代 live Figma read。
- "Audit 只是小修一下" → 错；`Audit` / `Export` 的 read-only 约束禁止任何 Figma mutation。
- "Spec Review 有小问题但我知道怎么改，先继续" → 错；`needs_changes` 必须返回 targetBlock 并重做对应 block。
- "Plan 缺少 final review，但我会自己看" → 错；Final Review Gate 是固定 final block，禁止省略。
- "截图导出成功就是视觉通过" → 错；必须实际打开截图并写出视觉结论。
- "自省只是维护者用，不影响完成" → 错；Self-Reflection Block 是 v3 final block。