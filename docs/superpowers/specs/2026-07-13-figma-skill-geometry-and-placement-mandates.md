---
name: figma-skill geometry-and-placement-mandates
model: sonnet
category: design
description: Add geometry + placement + reference-loading mandates to figma-skill so that visual overlaps, three cause families of clipping, and reference-file lookup are made first-class gates inside SKILL.md rather than details hidden in references/*.md.
version: 1.1
---

# `figma-skill` Geometry & Placement Mandates Specification

**Date:** 2026-07-13
**Status:** Awaiting written-spec user review
**Target version:** `figma-skill` 1.2

This spec extends the approved spec at
`docs/superpowers/specs/2026-07-12-figma-skill-naming-and-workflow-design.md`.
It does **not** relax naming, three-page architecture, Workflow 0–11, or
approval gates. It adds a new mandatory dimension: **geometry & placement
correctness**, plus a new gate: **Mandatory Lookups by Phase** so the agent
does not skip `references/*.md`.

---

## 1. Background and Diagnosis (Read Before Approving)

Observed failure modes from live usage on three workspaces:

1. **Visual overlap** when creating new components, screens, or flows — the
   new node ends up stacked on top of an existing node because the agent
   reuses last-session coordinates or places by memory.
2. **Three families of geometry / clipping bugs** — see Section 4. Each
   family is independent and each requires its own detection rule.
3. **References not loaded** — the agent reads `SKILL.md` and treats
   `references/*.md` as optional context. By the time the agent reaches
   Workflow 8 (execution), it has stopped using native CLI commands and
   begun substituting `eval` shortcuts.

### 1.1 Existing-rule coverage matrix

| Failure mode                            | Base spec (naming) | Naming spec (v1.1) | Execution ref | Validation ref | Gap                                                  |
|-----------------------------------------|--------------------|--------------------|---------------|----------------|------------------------------------------------------|
| Naming duplicate                        | covered            | covered            | n/a           | partial        | none                                                 |
| Visual overlap (placement)              | **none**           | **none**           | **none**      | **none**       | **RULE GAP**                                         |
| Auto Layout child overflow              | **none**           | **none**           | edge          | edge           | **RULE GAP** (no explicit HUG/FIXED comparison)      |
| Fixed parent clipping child             | **none**           | **none**           | **none**      | **none**       | **RULE GAP** (no constraints / textAutoResize rule)  |
| Variant baseline divergence             | **none**           | **none**           | **none**      | **none**       | **RULE GAP** (no shared-size requirement)            |
| Reference loading at the right phase     | edge               | edge               | n/a           | n/a            | Reference mapping exists in `## Reference Loading` but it is not a gate; agent skips the lookup. |

**Conclusion**: of the six failure rows, five are rule gaps, not
rationalization gaps. Adding the new geometry rules into `SKILL.md`
itself is the correct fix. The references will be tidied but kept.

### 1.2 Why we move rules into SKILL.md, not into references

User observation: *the agent does not load reference files
voluntarily*. The fix is not to lecture the agent. It is to:

1. Surface the **trigger condition** in `SKILL.md` at the exact workflow
   step that needs the rules;
2. Reduce each reference to **command-level operational detail** so that
   when the agent does load it, it finds the right command fast;
3. Make "load the reference at the gate" an explicit non-negotiable rule,
   not a suggestion.

This spec is therefore partly a **re-architecture of the skill**, not
only an addition.

---

## 2. Decision-Point Reflow Principle

All decisions that **affect a gate or change a flow state** live in
`SKILL.md`. All **operational command/parameter lists** stay in
`references/*.md`.

| Belongs in `SKILL.md` (decision / gate)                                                                                              | Belongs in `references/*.md` (operations)                                 |
|-------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------|
| "Visual overlap is forbidden; verify by bounding-box intersection."                                                                 | The exact `figma-cli` command that returns `children` with bounding boxes. |
| "Component Set variants must share parent size strategy."                                                                          | The full flag list for `figma-cli component variants` and `sizing`.      |
| "Before writing, the agent must load the reference for the current phase."                                                         | The Windows installer commands and Yolo connection flags.                |
| "Geometry validation runs in Workflow 9 between Structure and Visual."                                                              | The exit-code semantics and JSON output spec for `figma-validate-bounds.mjs`. |
| "Auto Layout mode selection is non-negotiable based on intent."                                                                     | The padding/gap/align command surface area.                              |

Forbidden future drift: putting a "must" / "禁止" sentence inside
`references/*.md` while `SKILL.md` describes it as optional. If a rule
is in references, it must be referenced as a **gate trigger** in
`SKILL.md`.

---

## 3. Visual-Overlap Rules (Failure Mode 1)

### 3.1 Component placement (Workflow 4A)

Fixed additional actions, in order, before any write:

1. Run the command that lists children of the target Section (e.g.
   `figma-cli <discover> get-children` or equivalent) and capture every
   neighbor node's `id`, `name`, `type`, `absoluteBoundingBox`.
2. Compute the available placement rectangle inside the Section.
3. Pick the new node's `(x, y)` from that rectangle.
4. After write, re-read the parent's children and the new node's
   `absoluteBoundingBox`. Confirm zero intersection with every neighbor.
5. If intersection is found, treat it as a Workflow 10 failure and
   apply the standard ≤3 correction loop.

A new master must not be created with the default `(0, 0)` offset if
the target Section is non-empty. Re-using last-session coordinates is
forbidden unless they come from a re-read in this session.

### 3.2 Screen placement (Workflow 4D)

Same rule as 3.1, applied to the Domain/Flow Section in `02 Screens`.
Reads the Section's existing Frames; the new Screen Frame's `(x, y)`
must lie in a non-intersecting rectangle. If the user explicitly
requests an overlap (e.g. layered comparison), that request must be
recorded in `OutOfScopeIssues` of the Workflow 6 plan before approval.

### 3.3 Flow connector placement (Workflow 4F)

Before drawing a connector from Screen A → Screen B, read both
screens' `absoluteBoundingBox` and pick the connector magnet based on
the actual geometry, not memory. After draw, re-read the connector and
its endpoints.

### 3.4 Mandatory action language

The above rules appear in `SKILL.md` using the established mandatory
wording:

> 创建任何节点前必须读取父级 children 与 `absoluteBoundingBox`，写入后必须
> 重新读取并确认与邻居 0 相交。禁止沿用上次会话坐标，禁止把 `(0, 0)`
> 作为非空 Section 的默认起点。

---

## 4. Three Families of Geometry / Clipping Rules (Failure Mode 2)

Each family is a distinct rule. Each runs in **Workflow 9 Geometry
Validation Layer** between Structure and Visual.

### 4.1 Family A — Auto Layout child overflow

Trigger: a Frame has `layoutMode != NONE` and children extend past the
parent's content box.

Mandatory prevention (Workflow 4A / 4D / 8):

- Decide `primaryAxisSizingMode` and `counterAxisSizingMode` **before
  write**:
  - Content-sized intent → `AUTO` (HUG).
  - Container that must not grow → `FIXED`, and parent size is widened
    explicitly to absorb children.
  - Mixed: parent `FIXED`, inner stack `AUTO` is allowed, but the
    fixed parent's size must be large enough.

Mandatory detection (Workflow 9):

- For every new or modified `layoutMode != NONE` Frame, read each
  child's `absoluteBoundingBox` and the parent's content box.
- Any child whose box extends outside parent's content box is a fail.

### 4.2 Family B — Fixed parent clipping child

Trigger: a Frame has `layoutMode == NONE` and `width`/`height` is
`FIXED`, and children exceed the box.

Mandatory prevention:

- Layout-positioning children inside non-auto-layout Frames must have
  `constraints` set to `MIN/MAX/STRETCH/SCALE` deliberately.
- Text nodes must have `textAutoResize` set deliberately:
  - `HEIGHT` when the box should grow with content.
  - `NONE` only when the box is meant to clip.

Mandatory detection:

- For each non-auto-layout Frame added or modified, compare children
  `absoluteBoundingBox` vs Frame box. List every clipped child.
- For each Text node whose `textAutoResize == NONE`, run a Visual check
  (the text might be intentionally clipped; record the decision).

### 4.3 Family C — Component Set variant baseline divergence

Trigger: a Component Set has multiple variants with different parent
size strategies or different effective render sizes.

Mandatory prevention (Workflow 4A Create Component Set):

- Create the first variant with the intended parent size + Auto Layout
  mode.
- Every subsequent variant must **clone the first variant's parent
  structure first**, then mutate only the variant-specific contents.
- Forbidden: hand-writing a second variant from scratch and assuming
  the size matches.

Mandatory detection (Workflow 9):

- For every Component Set in scope, list `(variant, parentSize,
  primaryAxisSizingMode, counterAxisSizingMode)` rows.
- If any row differs in `primaryAxisSizingMode` /
  `counterAxisSizingMode` from the majority, the row is a fail.
- Visual sizing surprises (one variant rendering smaller than another)
  fall under the Visual layer regardless of structural parity.

### 4.4 Layer insertion point in Workflow 9

New order:

```text
Naming → Structure → Geometry → Visual → DesignSystem → Flow
```

Geometry is **before** Visual because Visual cannot interpret a clipping
artifact correctly when the geometry layer is the root cause; we want
the agent to fail geometrically first when it should.

---

## 5. Mandatory Lookups by Phase (Failure Mode 3)

### 5.1 New `SKILL.md` chapter

Inserted **before** `## Workflows 0–11`:

```text
## Mandatory Lookups by Phase

在每个阶段必须加载对应 reference，缺失即停止或拒绝写：

- Workflow 1（环境 / 安装 / 连接）        → 必须加载 references/installation.md
- Workflow 2 / 4G（设计系统）              → 必须加载 references/design-system.md
- Workflow 3 / 4 / 4A–4H / 5 / 6（发现与方案）→ 必须加载 references/discovery-and-planning.md
- Workflow 6 / 7 / 8（写入与执行）         → 必须加载 references/execution.md
- Workflow 9 / 10 / 11（验证 / 修正 / 交付）→ 必须加载 references/validation.md

禁止：用 SKILL.md 替代以上任何一次加载。
禁止：跳到 Workflow 7 之前仍未加载 references/execution.md。
禁止：跳到 Workflow 9 之前仍未加载 references/validation.md。
禁止：把"读 SKILL.md 已够"作为不进 reference 的理由。
```

### 5.2 Non-negotiable rule added

> 每个 Workflow 阶段开始时必须先加载规定的 reference，证据是相关命令
> 的 `--help` 或同义查询文本与 reference 章节至少各出现一次。缺少证据
> 视为该阶段 `Gate=FAIL` 并禁止进入下一阶段。

This rule is added to `## Non-Negotiable Rules` near the existing
red-flag rule on `eval/run`.

### 5.3 What references look like after this spec

- `references/installation.md` — Windows installer, version check,
  Yolo connection flags; command-truth table.
- `references/design-system.md` — additive rule proposals, three-way
  classification.
- `references/discovery-and-planning.md` — pre-flight for geometry,
  page-targeting, screen-discovery, name audit, command-choice.
- `references/execution.md` — small-batch loop, eval/run gate,
  geometry-aware command table, undo safety.
- `references/validation.md` — three required layers, geometry-layer
  specifics, bounds audit, correction limit.

Each reference gains a heading (e.g. `## Geometry-aware commands`) but
no rule migration moves the **gate language** out of `SKILL.md`.

---

## 6. Workflows 0–11 Field-Change List

This is the exact surface area of `SKILL.md` that changes. Each
addition is the minimum needed to host the new rules.

### 6.1 Workflow 4A — Create Component

Add fixed sub-steps at the end of the current action list:

- 6. Read Section children + bounding boxes.
- 7. Compute placement rectangle.
- 8. Place and write.
- 9. Re-read, verify zero intersection.

### 6.2 Workflow 4D — Create Screen

Add the same 4-step overlap block, with the user-explicit-overlap
exception written into the Workflow 6 plan.

### 6.3 Workflow 4F — Create Flow

Add magnet-from-geometry rule. Endpoints must be re-read after write.

### 6.4 Workflow 5 — Name Decision (no change here; planning is here)

No schema change, but `ParentGeometry` and `PlacementBox` appear in
Workflow 6 plan, not here.

### 6.5 Workflow 6 — Figma Write Plan Approval

Added fixed fields:

```text
PlacementAudit: <command + neighbor list + expected empty intersection>
GeometryAudit: <mode + sizing + variant row matrix>
OverlapCheck: <per-node intersection matrix>
EvalRunFallback.GeometryReaudit: True | False
```

`EvalRunFallback` already contains the five-fact list; we add a
sixth fact: *a re-read of geometry after write is mandatory even for
`eval/run`*.

### 6.6 Workflow 7 — Baseline Capture

Added baseline fields for every targeted node:

```text
Geometry:
  LayoutMode: NONE | HORIZONTAL | VERTICAL
  PrimaryAxisSizing: FIXED | AUTO
  CounterAxisSizing: FIXED | AUTO
  Constraints: H=<MIN|CENTER|MAX|STRETCH|SCALE> V=<...>
  TextAutoResize: NONE | HEIGHT | WIDTH_AND_HEIGHT | TRUNCATE
NeighborsInParent: <id, box>
```

### 6.7 Workflow 8 — Fixed-Order Execution

Each batch check step becomes:

```text
read → write → re-read → check (names, NodeIds, hierarchy,
geometry including Auto Layout mode, sizing strategy, bounding-box
non-intersection) → next batch
```

### 6.8 Workflow 9 — Fixed-Order Validation

Insert **Geometry** layer between Structure and Visual:

```text
Naming → Structure → Geometry → Visual → DesignSystem → Flow
```

Geometry-layer fixed actions:

- Read every in-scope node's `layoutMode`, `primaryAxisSizingMode`,
  `counterAxisSizingMode`, `constraints`, `textAutoResize`.
- Compute and report the bounding-box intersection matrix.
- For every Component Set, list the variant row matrix.
- `GeometryValidation: PASS | FAIL` decides whether to enter Visual.

### 6.9 Workflow 10 / 11 (no schematic change)

But the delivery report in Workflow 11 grows three fields:

```text
- Geometry:
- OverlapMatrix:
- VariantRowParity:
```

---

## 7. New `## Component Geometry Mandates` Chapter

Inserted between `## Diagrams` and `## Reference Loading`. Contains
all three families in one place for direct agent lookup.

```text
## Component Geometry Mandates

### Auto Layout Mode Selection
- 内容驱动 → 父级 AUTO (HUG)
- 必须保留容器尺寸 → 父级 FIXED，且 size 显式给到能容下子项
- 混用：父级 FIXED，内层 AUTO 时父级 size 必须显式可容纳

### Fixed Parent Clipping
- 非 auto-layout Frame 内子项必须显式设置 constraints
- TextNode 必须显式设置 textAutoResize：HEIGHT 让其生长，NONE 仅在故意裁切时

### Component Set Variant Baseline
- 创建第一个 variant 时确定父级 size + Auto Layout
- 之后每个 variant 必须 clone 第一个 variant 再修改
- 每个 variant 的 primaryAxisSizingMode / counterAxisSizingMode 必须一致（默认全部 HUG 或全部 FIXED）

### 强制语言
- 必须：所有几何/布局写入前必须重读父级 children 与 bounding box
- 必须：写入后必须验证 bounding box 与邻居 0 相交
- 必须：Component Set 每个 variant 显式共享 size 策略
- 禁止：沿用上次会话残留坐标
- 禁止：把 `(0, 0)` 作为非空 Section 默认起点
```

---

## 8. New Red Flags (Six Items)

Add to `## Red Flags — Stop`:

- "位置和上次差不多就行。"
- "这个组件不大，肯定不裁。"
- "变体形状应该一致。"
- "读完 spec 就能写，几何之后再说。"
- "引用文件太长，参考 SKILL.md 就行。"
- "父级默认就是 HUG，不用看。"

---

## 9. Reference-File Edit List (Minimal)

### 9.1 `references/execution.md`

Insert before `## Small-Batch Loop`:

```text
## Geometry-aware Commands
- 必须使用 silships/figma-cli 当前帮助确认 geometry-affecting 命令
  集合（sizing、pin、padding、gap、align、auto-layout 等）当前是否
  原生可用。被合并或拆分的命令以最新帮助为准。
- `duplicate|dup` 会改变父级 NodeId 与 bounding box，必须 Workflow 8
  重读。
```

### 9.2 `references/validation.md`

Insert before `## Three Required Layers`:

```text
## Geometry Validation Checklist
- 每个 in-scope 节点的 layoutMode / primaryAxisSizingMode /
  counterAxisSizingMode / constraints / textAutoResize
- 每个 in-scope 节点与邻居的 bounding box intersection 矩阵
- 每个 Component Set 的 variant row matrix
- 只有父子越界、裁切、变体不共享具体风险时才调用
  scripts/figma-validate-bounds.mjs；离线审计禁止替代结构和视觉验证
```

### 9.3 `references/discovery-and-planning.md`

Add a `## Geometry Pre-flight` section: read parent children + bounding
box before choosing placement; align to `SKILL.md` Section 3 mandates.

---

## 10. Tests Changes

### 10.1 New scenarios S11 / S12 / S13

In `tests/scenarios.md`:

- S11 — Visual overlap on create. The new component lands at
  `(0, 0)` inside a non-empty Section.
- S12 — Auto Layout overflow. A child exceeds parent's content box.
- S13 — Variant baseline divergence. Two variants of the same set have
  different `primaryAxisSizingMode`.

In `tests/expected-behaviors.md`:

- S11 → B: read Section children, choose non-intersecting placement,
  verify overlap-free.
- S12 → B: choose explicit HUG/FIXED strategy; verify children inside
  content box.
- S13 → B: clone first variant, mutate content; verify all variants share
  parent size strategy.

### 10.2 `tests/validate-skill.mjs` new asserts

- Mandatory Lookups by Phase section exists.
- Component Geometry Mandates section exists.
- All six new red flags are detected by keyword.
- Mandatory Lookups rule exists in `## Non-Negotiable Rules`.

### 10.3 `tests/naming-and-workflow.test.mjs` new tests

- Visual overlap placement keywords present.
- Three geometry families keywords present.
- Component Set variant parity keyword present.

### 10.4 Final sync

`tests/naming-results.md` updated to v1.2 with spec-section-to-line
mapping for Sections 3–10 of this spec.

---

## 11. Completion Gate (v1.2)

PASS requires:

- Spec sections 3–7 all reflected in `SKILL.md`.
- Spec section 5.1's `## Mandatory Lookups by Phase` exists with all
  five rows present.
- Spec section 8's six Red Flags all detectable by keyword.
- Spec section 10.2's new asserts all pass.
- Spec section 10.3's new tests all pass.
- `tests/figma-validate-bounds.test.mjs` still PASS (no regression).
- Updated `tests/naming-results.md` covers Sections 3–10.

---

## 12. Out of Scope (this spec)

- 运行时缓存 v1 + 跨任务持久缓存（base spec 已禁止）。
- 第三方设计系统（shadcn 等）导入，沿用 base spec 处理。
- 多文件 Figma 拓扑，沿用 base spec 处理。
- `FIGMA_DESIGN_SYSTEM.md` ↔ Variables 同步，沿用 naming spec 处理。
- 字体、字号、字重等纯排版规则；本 spec 只约束几何与位置。

---

## 13. Self-Review Checklist

- All Sections 3–7 are mapped to a concrete `SKILL.md` chapter in
  Section 6.
- Section 8 list matches Section 3 + Section 4 + Section 5.
- Section 9 covers all five reference files with at most one new
  section each.
- Section 10 covers `validate-skill.mjs`, `naming-and-workflow.test.mjs`,
  `scenarios.md`, `expected-behaviors.md`, and `naming-results.md`.
- No conflict with naming spec (Sections 1–5) or base spec.
- Version bump minor 1.1 → 1.2 justified by new chapter + three new
  workflow fields + six new Red Flags.
