---
name: figma-skill geometry-verifier
model: sonnet
category: design
description: v1.2.2 patch wiring SKILL.md geometry rules to figma-cli's built-in verifiers (unstack --dry-run, canvas next, inspect) so visual-overlap and parent-clipping checks are executable, not just written.
version: 1.2.2
---

# `figma-skill` Geometry Verifier Wiring (v1.2.2)

**Date:** 2026-07-13
**Status:** Awaiting written-spec user review
**Target version:** `figma-skill` 1.2.2 (patch bump)

This spec is a **patch on top of v1.2.1**. It does not change Workflows 2–11,
naming grammar, three-page architecture, geometry mandates, or approval
gates. It wires the existing v1.2 geometry rules to **figma-cli
built-in commands** that can execute the checks offline, so the rules
move from "written" to "executable".

---

## 1. Background and Diagnosis

### 1.1 Observed gap

After v1.2 deployment, the user observed that visual overlap and
clipping failures persist in real runs. Investigation showed:

- The geometry **rules are written** in `SKILL.md` (Workflow 9 Geometry
  layer, `## Component Geometry Mandates` chapter, 6 new Red Flags).
- The geometry **verification path is not wired**. `figma-cli` exposes
  built-in commands that can produce the matrices the rules call for,
  but `SKILL.md` and `references/execution.md` never name them.
- The agent therefore re-implements detection by memory, which is the
  failure mode the rules were supposed to prevent.

### 1.2 Verified command behaviour (this session, 2026-07-13)

Probed against `figma-cli` real output:

| Need                                       | Command                                              | Output confirmed                                                |
|--------------------------------------------|------------------------------------------------------|-----------------------------------------------------------------|
| Bounding box per node                      | `figma-cli get <id>`                                 | `x, y, width, height` (JSON)                                   |
| Layout mode + sizing modes                 | `figma-cli inspect --json <id>`                      | `layoutMode` + `layoutSizingHorizontal/Vertical`               |
| Constraints                                | `figma-cli inspect --json <id>`                      | `raw.constraints.horizontal/vertical`                            |
| Canvas bounds                              | `figma-cli canvas info`                              | `bounds`, `nextX`, `nextY`                                      |
| Next non-overlapping position              | `figma-cli canvas next`                              | `{x, y}` ready-to-place                                          |
| **Sibling overlap detection (dry-run)**    | `figma-cli unstack --dry-run`                        | JSON list of overlapping pairs (non-destructive)                |
| TextNode `textAutoResize`                  | not exposed by `figma-cli get` or `inspect`          | **gap**: cannot verify directly; defer to Visual layer          |

### 1.3 What this patch does

1. Wire `unstack --dry-run`, `canvas info`, `canvas next`, and
   `inspect --json` into Workflows 4A / 4D / 6 / 7 / 8 / 9.
2. Reduce `references/execution.md` `## Geometry-aware Commands` to a
   concrete decision table.
3. Add a new `references/geometry-verifier.md` describing the full
   verifier pipeline (input → command → matrix → output).
4. Add validator coverage that the wiring exists in `SKILL.md`.
5. Add S15 — variant parity through clone (real regression).
6. Defer `textAutoResize` direct verification explicitly. Visual layer
   remains the fallback.

---

## 2. Goals and Non-Goals

### 2.1 Goals

1. Workflow 4A sibling-overlap check uses `unstack --dry-run` for
   placement verification, not memory.
2. Workflow 4A placement uses `canvas next` for non-empty Sections, not
   `(0, 0)`.
3. Workflow 9 Geometry layer is **executable**: every step names the
   figma-cli command that produces the matrix.
4. Workflow 10 ≤3 correction loop reads verifier output and decides
   minimum-fix targets.
5. S15 verifies that variant parity is enforced through clone-first
   mutation.

### 2.2 Non-goals

- No change to v1.2 rule wording.
- No new chapters in `SKILL.md` (only insertions into existing
  Workflow bodies).
- No claim that `textAutoResize` is verifiable — Visual layer stays
  authoritative for text clipping.
- No upstream `figma-cli` feature requests in this patch.

---

## 3. `SKILL.md` Workflow Body Changes

### 3.1 Workflow 4A — five concrete commands

Replace the v1.2 geometry sub-steps 6-9 (added in v1.2) with a
**command-anchored** version. Each step names the figma-cli command
that produces the required data.

```text
几何与位置硬性附加动作：

1. 必须运行 figma-cli canvas info 取得当前 Page 的 canvas bounds 与
   nextX/nextY，作为可用矩形参考。
2. 必须运行 figma-cli get <sectionNodeId> 或 find 列出目标 Section
   的 children，并捕获每个邻居节点的 id 与 x/y/width/height。
3. 必须运行 figma-cli canvas next 取得 Section 内的非相交坐标；
   禁止把 (0, 0) 作为非空 Section 的默认起点。
4. 写入后必须再次运行 figma-cli get 取得新节点 x/y/width/height，
   并运行 figma-cli unstack --dry-run 验证与所有邻居 0 相交。
5. unstack --dry-run 输出非空时视为 Workflow 10 失败，按 ≤3 修正
   循环处理；最小修正是 canvas next 推荐的新坐标。
6. 若创建 Component Set，第一个 variant 写入后必须运行
   figma-cli inspect --json 读取 layoutSizingHorizontal / Vertical
   作为基线；之后每个 variant 必须基于该基线 clone 再修改，clone
   后再次运行 inspect --json 确认两个 variant 的 layoutSizing
   值相同。
```

### 3.2 Workflow 4D — same commands, scoped to 02 Screens

Append:

```text
7. 必须运行 figma-cli canvas info 与 unstack --dry-run 验证新
   Screen Frame 与既有 Frame 0 相交；若用户显式批准重叠，必须
   在 Workflow 6 计划的 OutOfScopeIssues 中显式记录后再提交审批。
```

### 3.3 Workflow 4F — geometry-from-inspect

Append:

```text
4. 必须运行 figma-cli inspect --json 对源与目标 Screen 各读取一次
   layoutSizingHorizontal / Vertical；connector endpoint magnet 必须
   与最近邻边的 layoutSizing 一致；写入后必须再次 inspect 验证
   endpoint 在源/目标 Screen bounding box 内。
```

### 3.4 Workflow 6 — fix command references

Replace the v1.2 PlacementAudit / GeometryAudit / OverlapCheck lines
with explicit command references:

```text
PlacementAudit: figma-cli canvas next + unstack --dry-run 验证零相交
GeometryAudit: figma-cli inspect --json 读取 layoutMode / sizing / 变体行矩阵
OverlapCheck: figma-cli unstack --dry-run 输出 JSON 必须为空
```

### 3.5 Workflow 7 — baseline commands

Replace the v1.2 Geometry baseline block with command-anchored form:

```text
Geometry:
  Source: figma-cli inspect --json <nodeId>
  LayoutMode: <output.layoutMode>
  LayoutSizingHorizontal: <output.absolutePositioning.layoutSizingHorizontal>
  LayoutSizingVertical: <output.absolutePositioning.layoutSizingVertical>
  Constraints: <output.raw.constraints.{horizontal, vertical}>
  TextAutoResize: <Visual layer fallback — figma-cli 不暴露>
  BoundingBox: <output.{x, y, width, height}>
```

### 3.6 Workflow 8 — per-batch verifier call

Replace the v1.2 batch check line:

```text
每批：读 → 写 → 重读 → 检查（names、NodeIds、hierarchy、geometry 含
Auto Layout mode / sizing 策略 / bounding box 0 相交）→ 通过则下一批。
```

with:

```text
每批：读 → 写 → 重读 → figma-cli inspect --json + unstack --dry-run
→ 检查（names、NodeIds、hierarchy、layoutMode、layoutSizing*、bounding
box 0 相交）→ 通过则下一批。结构变化后必须重读 NodeId。
```

### 3.7 Workflow 9 — Geometry-layer fixed commands

Replace the v1.2 Geometry-layer block with:

```text
Geometry 层必须按下列顺序执行：

1. figma-cli find 列出 in-scope 节点 id。
2. 对每个节点运行 figma-cli inspect --json，采集 layoutMode、
   layoutSizingHorizontal、layoutSizingVertical、raw.constraints。
3. 运行 figma-cli unstack --dry-run；输出非空即为 FAIL。
4. 对每个 Component Set，列出每个 variant 的
   (variant, layoutSizingHorizontal, layoutSizingVertical)；
   若任意 variant 与多数行的 layoutSizing 不同值，即为 FAIL。
5. TextNode 的 textAutoResize 直接验证未实现，由 Visual 层兜底；
   Visual 截图必须实际打开 <Current workspace>/temp/figma-screenshot/
   中的截图，并对照 <Current workspace>/docs/FIGMA_DESIGN_SYSTEM.md。

GeometryValidation: PASS | FAIL 决定是否进入 Visual。
```

### 3.8 Workflow 10 — minimum-fix targets from verifier

Append to Workflow 10 body:

```text
修正循环定位阶段必须读取 verifier 输出：
- unstack --dry-run 输出非空 → 最小修正是把相交节点坐标改为
  figma-cli canvas next 输出值，再重写 + 重检。
- inspect --json 输出显示 variant 的 layoutSizing 与基线不一致 →
  最小修正是重新 clone 基线 variant 再修改，再重检。
- 上述两步无法解决即视为 STOP；禁止第四轮。
```

### 3.9 Workflow 11 — verifier output paths

Append to the delivery report template:

```text
- Geometry:
- OverlapMatrix: <path to unstack --dry-run JSON>
- VariantRowParity: <path to per-variant inspect --json output>
- GeometryVerifierPipeline: <list of verifier commands run>
```

---

## 4. `references/execution.md` Geometry-aware Commands Update

Replace the v1.2 `## Geometry-aware Commands` block with a decision
table that names the four core commands:

```text
## Geometry-aware Commands

| 需要                       | 命令                                                |
|----------------------------|----------------------------------------------------|
| 列出 Page 范围             | figma-cli canvas info                              |
| 取得非重叠坐标             | figma-cli canvas next                              |
| 列出 Section children      | figma-cli find -t FRAME / figma-cli get <id>       |
| 单节点几何 + sizing        | figma-cli inspect --json <id>                      |
| 兄弟相交检测（dry-run）    | figma-cli unstack --dry-run                        |

TextNode 的 textAutoResize 字段 figma-cli 当前不暴露；涉及文字
裁切的最终判定仍归 Visual 层。任何重复命令必须按 references/
installation.md 的 status-first 顺序，避免 daemon restart。

duplicate|dup 会改变父级 NodeId 与 bounding box，必须 Workflow 8
重读。
```

---

## 5. New `references/geometry-verifier.md`

Insert new file in `figma-skill/references/`:

```text
# Geometry Verifier Pipeline

Workflow 9 Geometry 层的可执行管线。每条命令对应 SKILL.md Component
Geometry Mandates 中的一族规则。

## 输入

- in-scope NodeId 列表（由 figma-cli find 输出）

## 命令链

1. figma-cli find [name pattern] -t FRAME — 列出节点
2. figma-cli inspect --json <id> — 单节点几何 + sizing
3. figma-cli unstack --dry-run — 兄弟相交矩阵
4. figma-cli canvas info / canvas next — 范围与下个安全坐标

## 输出矩阵

- LayoutMode 矩阵：每个节点的 layoutMode（NONE / HORIZONTAL / VERTICAL）
- LayoutSizing 矩阵：每个节点的 (H, V) = (FIXED | HUG | FILL)
- BoundingBox 矩阵：每个节点的 (x, y, w, h)
- 兄弟相交矩阵：来自 unstack --dry-run JSON
- 变体行 parity 矩阵：每 Component Set 的一行 (variant, H, V)

## 失败判定

- 任意兄弟相交 → FAIL
- 任意 Component Set variant 的 (H, V) 与基线 variant 不一致 → FAIL
- Auto Layout 父级 FIXED 但子项 bounding box 越出 → FAIL（取自
  inspect 输出与父级 bounding box 对比）
- TextNode 文字裁切 → 由 Visual 层兜底

## 修正优先级（Workflow 10）

1. 兄弟相交：把节点改到 figma-cli canvas next 推荐坐标
2. Variant 不一致：删除该 variant、clone 基线、修改内容、保留 (H, V)
3. 父子越界：把父级改 AUTO (HUG) 或显式增大父级 size
4. 文字裁切：Visual 层修正

每步必须重新跑对应命令验证通过再进入下一轮。
```

---

## 6. Validator Coverage

Add to `tests/validate-skill.mjs` a new function
`assertGeometryVerifierWiring(skill, runtimeMarkdown)`:

1. `SKILL.md` Workflow 4A geometric sub-steps contain literal
   `figma-cli unstack --dry-run` and `figma-cli canvas next`.
2. `SKILL.md` Workflow 9 Geometry layer contains literal
   `figma-cli inspect --json` and `figma-cli unstack --dry-run`.
3. `SKILL.md` Workflow 10 mentions reading verifier output for
   minimum-fix (literal `unstack --dry-run` or `inspect --json` in
   the Workflow 10 block).
4. `references/execution.md` Geometry-aware Commands decision table
   mentions all four core commands (canvas info, canvas next,
   inspect, unstack).
5. `references/geometry-verifier.md` exists and contains the five
   command names + the four matrix names.

---

## 7. New Test Scenario S15

In `tests/scenarios.md` append S15 — Variant parity enforced through
clone. Same shape as S13 but explicitly verifies the agent runs
`figma-cli inspect --json` to compare `layoutSizingHorizontal` and
`layoutSizingVertical` between variants.

In `tests/expected-behaviors.md` add row:

```text
| S15 | B | inspect both variants, confirm layoutSizing parity, fix via clone |
```

---

## 8. Completion Gate

PASS requires:

1. `SKILL.md` Workflows 4A / 4D / 4F / 6 / 7 / 8 / 9 / 10 / 11 updated
   per Section 3.
2. `references/execution.md` Geometry-aware Commands decision table
   rewritten per Section 4.
3. `references/geometry-verifier.md` created per Section 5.
4. `tests/validate-skill.mjs` `assertGeometryVerifierWiring` added per
   Section 6 (5 assertions).
5. `tests/scenarios.md` S15 appended.
6. `tests/expected-behaviors.md` S15 row appended.
7. `node --test tests/naming-and-workflow.test.mjs` still 10/10 PASS.
8. `node figma-skill/tests/validate-skill.mjs` PASS.
9. `tests/naming-results.md` updated to mark v1.2.2 rows.

---

## 9. Version Bump Justification

This is a **patch** (1.2.1 → 1.2.2) per the project's CLAUDE.md
minor-vs-patch rule:

- No new chapters in `SKILL.md` (only insertions into existing
  Workflow bodies).
- No new Workflows, no new mandatory fields.
- One new reference file (`geometry-verifier.md`).
- Existing rules become executable by naming concrete commands.

The change is **wiring**, not new logic. Patch is correct.

---

## 10. Out of Scope

- `textAutoResize` direct verification (figma-cli does not expose it).
- Real-time write locking across multiple concurrent agents.
- Upstream `figma-cli` field additions.
- Performance tuning of `unstack --dry-run` for large files.

---

## 11. Self-Review Checklist

- Section 3 wires concrete commands into every Workflow that v1.2
  called for verification without naming the command.
- Section 5 keeps `geometry-verifier.md` small (single-screen pipeline
  doc).
- Section 6 asserts use literal substrings; no regex needed.
- Section 7 reuses S13 as template; S15 adds inspect-step emphasis.
- Section 8 has 9 verifiable items, all runnable from this session.
- Version bump 1.2.1 → 1.2.2 justified per Section 9.
- `textAutoResize` limitation is explicitly stated and Visual layer
  fallback is named.