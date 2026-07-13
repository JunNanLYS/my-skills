---
name: figma-skill geometry-verifier-strict
model: sonnet
category: design
description: v1.2.4 patch — wires SKILL.md Workflow 9 validation phase to three explicit verifier commands (lint, unstack --dry-run, overlap-check.mjs) and lifts the latter into the project's permanent helper script set; replaces the parked v1.2.2 spec.
version: 1.2.4
---

# `figma-skill` Geometry Verifier — Strict Validation Phase (v1.2.4)

**Date:** 2026-07-13
**Status:** Awaiting written-spec user review
**Target version:** `figma-skill` 1.2.4 (patch bump)

This spec is a **patch on top of v1.2.3**. It does not change Workflows 0–8,
naming grammar, three-page architecture, approval gates, or the eval/run gate.
It promotes the Workflow 9 Geometry layer from "rules written, verifier
optional" to "verifier mandatory, three explicit commands run in fixed order".

This patch supersedes the parked `2026-07-13-figma-skill-geometry-verifier-wiring.md`
v1.2.2 spec. The parked spec is kept as historical record; its v1.2.2 number is
not re-shipped because v1.2.3 already used that version slot.

---

## 1. Background and Diagnosis

### 1.1 Observed gap (carried from parked v1.2.2 spec)

After v1.2 deployment, visual overlap and clipping failures persist in real
runs. The geometry **rules are written** in `SKILL.md` (Workflow 9 Geometry
layer, `## Component Geometry Mandates` chapter, 6 new Red Flags). The
geometry **verification path is not strictly wired**. `figma-cli` exposes
built-in commands that can produce the matrices the rules call for, and the
user has authored a permanent helper script set at
`D:\Project\Nono\scripts\` (the original project workspace). Neither
the script set nor its commands are mandated.

### 1.2 Verified command behaviour (this session, 2026-07-13)

Probed against `figma-cli 2.1.0` real output:

| Need                                       | Command                                              | Output confirmed                                                |
|--------------------------------------------|------------------------------------------------------|-----------------------------------------------------------------|
| File-wide design lint                      | `figma-cli lint [--json] [--fix]`                    | JSON list of issues (or auto-fix)                               |
| Top-level node overlap (dry-run)           | `figma-cli unstack --dry-run`                        | List of overlapping top-level pairs (non-destructive)           |
| Single-node geometry + sizing              | `figma-cli inspect --json <id>`                      | `layoutMode`, `layoutSizingHorizontal/Vertical`, constraints     |
| Canvas range + next non-overlapping coord   | `figma-cli canvas info` / `figma-cli canvas next`    | bounds / `{x, y}`                                               |
| **Section-internal AABB overlap (PARENT_ID scoped)** | `figma-cli run scripts/overlap-check.mjs` | JSON `{total, overlapPairs, overlaps[]}` or text summary |
| **List parent children bbox**                 | `figma-cli run scripts/list-children.mjs`   | JSON `{parent, count, items[]}` |
| **Apply move plan (write)**                   | `figma-cli run scripts/apply-layout.mjs`     | JSON `{planned, applied, errors[]}` |
| **Resize Section to bbox+padding (write)**    | `figma-cli run scripts/resize-section.mjs`   | JSON `{parent, previous, resized, padding}` |
| TextNode `textAutoResize`                  | not exposed by `figma-cli get` or `inspect`          | **gap**: cannot verify directly; defer to Visual layer          |

### 1.3 Three-layer overlap detection rationale

The three verifiers are **complementary**, not redundant:

| Layer | Scope | Catches |
|---|---|---|
| `lint` | whole file | naming / a11y / spacing / structural lint issues |
| `unstack --dry-run` | top-level nodes of current page | top-level Page-level overlap |
| `overlap-check.mjs` | direct children of `PARENT_ID` (any depth Section) | Section-internal 0-overlap — the **main rule** in v1.2 SKILL.md Workflow 4A / 4D |

Workflow 9 must run **all three**, in fixed order, before declaring
`GeometryValidation: PASS`.

### 1.4 Why this patch ships as 1.2.4

The parked spec at `2026-07-13-figma-skill-geometry-verifier-wiring.md`
declared target version 1.2.2. v1.2.3 (Help Discovery Gate) was approved and
shipped after the v1.2.2 spec was drafted but before its plan was approved.
Per the project's versioning rule (`combine patches to avoid version
collision`), this patch lands as **1.2.4**. The parked spec remains on disk
for traceability.

---

## 2. Goals and Non-Goals

### 2.1 Goals

1. Workflow 9 Geometry layer is **executable**: every step names the
   command that produces the matrix.
2. Workflow 9 Geometry layer runs **three verifiers in fixed order**:
   `lint` → `unstack --dry-run` → `overlap-check.mjs`.
3. `overlap-check.mjs` is registered in `SKILL.md` as the **canonical
   Section-internal overlap verifier**, with a fixed absolute path.
4. All four project helper scripts (`list-children`, `overlap-check`,
   `apply-layout`, `resize-section`) live under
   `D:\ai-skills\figma-skill/scripts/` (authoritative; mirrors the
   original at `D:\Project\Nono\scripts\`). Skill-side path is
   authoritative; absolute paths to the project workspace are accepted
   for cross-workspace invocation but the skill's own copy is preferred.
5. The four scripts are treated as **pre-approved project helper
   scripts** under the v1.2.3 eval/run gate — they do not require
   per-task `EvalRunFallback` six-field justification, but their path
   and entry constants (PARENT_ID, PLANS, PAD_X, PAD_Y, OUTPUT_MODE)
   must be quoted in Workflow 6 `CommandPlan`. Read-only scripts
   (list-children, overlap-check) may be called freely; write scripts
   (apply-layout, resize-section) must additionally pass the standard
   Write Plan Approval gate because they mutate Figma.
6. Workflow 10 ≤3 correction loop reads verifier output and decides
   minimum-fix targets.

### 2.2 Non-goals

- No change to v1.2 / v1.2.1 / v1.2.3 rule wording.
- No new chapters in `SKILL.md` (only insertions into existing Workflow
  bodies and one update to `references/execution.md`).
- No claim that `textAutoResize` is verifiable — Visual layer stays
  authoritative for text clipping.
- No upstream `figma-cli` feature requests.
- Project helper scripts are mirrored to
  `D:\ai-skills\figma-skill/scripts/` (read-only mirror of
  `D:\Project\Nono\scripts/`); the skill-side copy is
  authoritative and must be kept in sync manually.

---

## 3. `SKILL.md` Workflow Body Changes

### 3.1 Workflow 9 — three-verifier fixed-order validation

Replace the v1.2 Geometry layer block with:

```text
Geometry 层必须按下列固定顺序执行三道闸门，任一闸门 FAIL 立即停止
验收并进入 Workflow 10：

1. figma-cli lint --json
   - 作用域：当前 Page / 文件全量 lint
   - 输出：lint issue 列表；非空即为 FAIL
   - 不通过禁止进入下一闸门

2. figma-cli unstack --dry-run
   - 作用域：当前 Page top-level 节点
   - 输出：top-level 重叠对列表；非空即为 FAIL
   - 不通过禁止进入下一闸门

3. figma-cli run scripts/overlap-check.mjs
   - 调用前必须编辑脚本顶部 PARENT_ID 为当前任务目标 Section / Frame
     的 NodeId
   - 作用域：PARENT_ID 直接子节点的两两 AABB 相交矩阵
   - 输出：JSON { total, overlapPairs, overlaps[] }，OUTPUT_MODE 改
     'summary' 出人读文本
   - overlapPairs > 0 即为 FAIL
   - 不通过禁止进入 Visual 层

对每个 in-scope Component Set 额外列出每个 variant 的
(variant, layoutSizingHorizontal, layoutSizingVertical)；若任意 variant
与多数行的 layoutSizing 不同值，即为 FAIL。

TextNode 的 textAutoResize 直接验证未实现，由 Visual 层兜底；
Visual 截图必须实际打开 <Current workspace>/temp/figma-screenshot/
中的截图，并对照 <Current workspace>/docs/FIGMA_DESIGN_SYSTEM.md。

GeometryValidation: PASS | FAIL 决定是否进入 Visual。
```

### 3.2 Workflow 10 — minimum-fix targets from verifier

Append to Workflow 10 body:

```text
修正循环定位阶段必须读取三道闸门输出：
- lint 输出非空 → 最小修正是按 lint 报告逐项改；自动 --fix 仅在
  lint 报告明确标注可自动修复时使用，禁止批量 --fix。
- unstack --dry-run 输出非空 → 最小修正是把相交节点坐标改为
  figma-cli canvas next 输出值，再重写 + 重跑 unstack --dry-run。
- overlap-check.mjs 输出 overlapPairs > 0 → 最小修正是改节点 (x, y)
  后用 apply-layout.mjs 一次性应用计划，再用 overlap-check.mjs 重检。
- inspect --json 输出显示 variant 的 layoutSizing 与基线不一致 →
  最小修正是重新 clone 基线 variant 再修改，再重检。
- 上述任一闸门无法解决即视为 STOP；禁止第四轮。
```

### 3.3 Workflow 11 — verifier output paths and evidence

Append to the delivery report template (after `HelpEvidence`):

```text
GeometryVerifierPipeline:
  - figma-cli lint --json: <path or inline excerpt>
  - figma-cli unstack --dry-run: <path or inline excerpt>
  - figma-cli run scripts/overlap-check.mjs: <path or inline excerpt>
OverlapMatrix: <path to overlap-check JSON>
VariantRowParity: <path to per-variant inspect --json output>
```

Append a delivery rule:

```text
- 三道闸门输出必须随 Workflow 11 交付报告一并提交，至少 inline excerpt；
  未提交视为 FinalStatus=FAILED。
```

### 3.4 Workflow 6 — CommandPlan references

In the Workflow 6 fixed template, replace the
`OverlapCheck: figma-cli unstack --dry-run 输出 JSON 必须为空` line with:

```text
OverlapCheck:
  LintEvidence: figma-cli lint --json 计划
  UnstackEvidence: figma-cli unstack --dry-run 计划
  OverlapCheckEvidence: figma-cli run scripts/overlap-check.mjs 计划（必须填 PARENT_ID）
```

Append to `CommandPlan` guidance:

```text
CommandPlan 必须列出 Workflow 9 三道闸门命令（lint / unstack --dry-run /
overlap-check.mjs）的预期调用点；overlap-check.mjs 的 PARENT_ID 必须在
计划中显式给出。
```

### 3.5 Eval/run gate exemption for project helper scripts

Append to NNR (Non-Negotiable Rules) the following rule:

```text
- scripts/ 下的四个脚本属于项目预设助手脚本，通过
  eval/run gate 预设批准：
  - list-children.mjs（只读）
  - overlap-check.mjs（只读）
  - apply-layout.mjs（写动作，必须经 Workflow 6 审批）
  - resize-section.mjs（写动作，必须经 Workflow 6 审批）
  调用只读类不需要在 Workflow 6 EvalRunFallback 中再次提供六字段事实链；
  调用写动作类必须在 Workflow 6 CommandPlan 中显式列出 PLANS / PAD_X /
  PAD_Y 等入口常量并经用户审批。四个脚本的路径与入口常量都必须在
  CommandPlan 中显式列出。
```

### 3.6 Workflow 7 — list-children baseline

Append to Workflow 7 baseline capture body:

```text
每个目标节点的 baseline 几何数据必须通过 list-children.mjs 取得：

1. 编辑 scripts/list-children.mjs 顶部 PARENT_ID 为目标
   parent NodeId；如需过滤类型，调整 ONLY_TYPE。
2. 运行 figma-cli run scripts/list-children.mjs 取得 JSON
   { parent, count, items[] }，每项含 id/name/type/x/y/w/h/right/bottom。
3. 将 items[] 与 Workflow 6 GeometryAudit 字段交叉对照：
   - 节点数与 count 一致；
   - bbox 字段全部齐全；
   - 无 id 重复。
4. 写入前 baseline 与 Workflow 8 重读值必须一致；不一致视为
   Workflow 7 FAIL。
```

### 3.7 Workflow 8 — apply-layout / resize-section

Append to Workflow 8 fixed-order execution body:

```text
每批"读 → 写 → 重读"中：

- 读阶段除 figma-cli get / inspect --json 外，必要时应同时运行
  list-children.mjs 取 parent children baseline。
- 写阶段如需批量应用 (id, x, y) 计划，使用 apply-layout.mjs：
  1. 编辑 scripts/apply-layout.mjs 顶部 PLANS 数组；
  2. figma-cli run scripts/apply-layout.mjs；
  3. 重读 children 与 bbox 验证与计划一致。
- 每批结束后如需收敛 Section / Frame 实际占用空间，使用
  resize-section.mjs：
  1. 编辑 scripts/resize-section.mjs 顶部 PARENT_ID 与
     PAD_X / PAD_Y；
  2. figma-cli run scripts/resize-section.mjs；
  3. 重读 parent bbox 验证新尺寸。

apply-layout.mjs / resize-section.mjs 的 PLANS / PARENT_ID / PAD_X / PAD_Y
必须在 Workflow 6 CommandPlan 显式给出并经用户审批。
```

---

## 4. `references/execution.md` Geometry-aware Commands Update

Replace the v1.2 `## Geometry-aware Commands` block with a decision table
that names **all nine core commands** (five figma-cli + four project helpers):

```text
## Geometry-aware Commands

| 需要                              | 命令                                                                |
|-----------------------------------|--------------------------------------------------------------------|
| 文件级 lint                       | figma-cli lint [--json] [--fix]                                     |
| Top-level 节点相交（dry-run）     | figma-cli unstack --dry-run                                         |
| 列 Page 范围                      | figma-cli canvas info                                               |
| 取非重叠坐标                      | figma-cli canvas next                                               |
| 列 Section children               | figma-cli run scripts/list-children.mjs |
| 单节点几何 + sizing               | figma-cli inspect --json <id>                                       |
| Section 内 AABB 相交矩阵          | figma-cli run scripts/overlap-check.mjs |
| 移动计划应用                      | figma-cli run scripts/apply-layout.mjs   |
| 收敛 Section size                 | figma-cli run scripts/resize-section.mjs |

调用项目预设助手脚本时必须遵守 figma-cli 沙箱约束：
- 不透传 --arg；调用前编辑脚本顶部 PARENT_ID 等入口常量
- plugin sandbox 无 process / 环境变量访问
- 写入类脚本（apply-layout / resize-section）必须先在 Workflow 6 审批

TextNode 的 textAutoResize 字段 figma-cli 当前不暴露；涉及文字
裁切的最终判定仍归 Visual 层。

任何 figma-cli 与项目预设助手脚本之外的运行时仍按 NNR 的 eval/run gate
六字段事实链执行；禁止借项目预设助手脚本夹带未审批脚本。
```

---

## 5. `references/geometry-verifier.md` (new)

Insert new file in `figma-skill/references/`:

```text
# Geometry Verifier Pipeline

Workflow 9 Geometry 层的可执行管线。三道闸门按顺序运行，任一 FAIL 立即
停止验收。

## 闸门 1 — lint

- 命令: figma-cli lint --json
- 作用域: 当前 Page / 文件
- 输出: lint issue 列表
- FAIL 条件: 列表非空
- 修复: 按 lint 报告逐项改；批量 --fix 仅在 lint 报告明确标注可自动修复
  时使用

## 闸门 2 — unstack --dry-run

- 命令: figma-cli unstack --dry-run
- 作用域: 当前 Page top-level 节点
- 输出: top-level 重叠对列表
- FAIL 条件: 列表非空
- 修复: 把相交节点坐标改为 figma-cli canvas next 输出值，重写 + 重检

## 闸门 3 — overlap-check.mjs

- 命令: figma-cli run scripts/overlap-check.mjs
- 入口常量: PARENT_ID (改到目标 Section / Frame 的 NodeId)
- 可选: OUTPUT_MODE = 'json' | 'summary'
- 作用域: PARENT_ID 直接子节点两两 AABB 相交矩阵
- 输出: JSON { total, overlapPairs, overlaps[] } 或 summary 文本
- FAIL 条件: overlapPairs > 0
- 修复: 用 apply-layout.mjs 应用新计划，再用本脚本重检

## 闸门 4 — variant 行 parity (辅助, 非闸门)

- 命令: figma-cli inspect --json <id>  对每个 variant 各跑一次
- 输出矩阵: (variant, layoutSizingHorizontal, layoutSizingVertical)
- FAIL 条件: 任意 variant 与多数行的 layoutSizing 不同值
- 修复: 删除该 variant, clone 基线 variant, 修改内容, 保留 (H, V)

## 配套脚本（Workflow 7 / Workflow 8）

### list-children.mjs（只读，Workflow 7 baseline）

- 命令: figma-cli run scripts/list-children.mjs
- 入口常量: PARENT_ID, ONLY_TYPE (可选)
- 输出: JSON { parent, count, items[] }
- 用途: 取得 parent 直接子节点 id/name/type/x/y/w/h/right/bottom，
  作为 Workflow 7 baseline 与 Workflow 8 写入前/后重读的权威数据源。

### apply-layout.mjs（写，Workflow 8）

- 命令: figma-cli run scripts/apply-layout.mjs
- 入口常量: PLANS = [{id, x, y}, ...]
- 输出: JSON { planned, applied, errors[] }
- 用途: 把移动计划一次性应用到 Figma；调用前 PLANS 必须经
  Workflow 6 审批。
- 重检: 应用后必须用 overlap-check.mjs 或 list-children.mjs 重读
  children bbox 验证一致。

### resize-section.mjs（写，Workflow 8 末尾 / Workflow 9）

- 命令: figma-cli run scripts/resize-section.mjs
- 入口常量: PARENT_ID, PAD_X, PAD_Y
- 输出: JSON { parent, previous, resized, padding } 或 error
- 用途: 基于 children bbox + padding 收敛 Section / Frame 实际占用
  空间；调用前 PARENT_ID / PAD_X / PAD_Y 必须经 Workflow 6 审批。

## 失败处理优先级（Workflow 10）

1. lint 问题: 逐项修；可自动修复的项目用 --fix
2. Top-level 重叠: 节点改到 figma-cli canvas next 推荐坐标
3. Section 内重叠: apply-layout.mjs 一次性应用新坐标 + overlap-check.mjs 重检
4. Variant 不一致: 重新 clone 基线再修改
5. 文字裁切: Visual 层修正

每步必须重新跑对应命令验证通过再进入下一轮。
```

---

## 6. Validator Coverage

Add to `tests/validate-skill.mjs` a new function
`assertGeometryVerifierStrict(skill, runtimeMarkdown)`:

1. `SKILL.md` Workflow 9 Geometry layer contains literal
   `figma-cli lint --json`.
2. `SKILL.md` Workflow 9 Geometry layer contains literal
   `figma-cli unstack --dry-run`.
3. `SKILL.md` Workflow 9 Geometry layer contains literal
   `scripts/overlap-check.mjs`.
4. `SKILL.md` Workflow 10 contains literal `overlap-check.mjs`.
5. `SKILL.md` Workflow 11 template contains literal `GeometryVerifierPipeline`.
6. `SKILL.md` NNR contains literal
   `scripts/` (eval/run exemption marker) plus literal
   `list-children.mjs`, `apply-layout.mjs`, `resize-section.mjs` (all four
   script names exempted together).
7. `SKILL.md` Workflow 7 contains literal `list-children.mjs` (baseline).
8. `SKILL.md` Workflow 8 contains literal `apply-layout.mjs` AND
   `resize-section.mjs` (write scripts).
9. `references/execution.md` Geometry-aware Commands decision table
   mentions all nine commands (lint, unstack, canvas info, canvas next,
   inspect, list-children.mjs, overlap-check.mjs, apply-layout.mjs,
   resize-section.mjs).
10. `references/geometry-verifier.md` exists and contains all four script
    names + the four matrix / pipeline names.
11. `scripts/` directory exists with exactly these files:
    `list-children.mjs`, `overlap-check.mjs`, `apply-layout.mjs`,
    `resize-section.mjs`, `README.md`. (5 files in total; presence check.)

---

## 7. New Test Scenario S15

In `tests/scenarios.md` append S15 — Strict validation gate. The agent
runs Workflow 9 in fixed order: `lint --json` → `unstack --dry-run` →
`overlap-check.mjs`, all three must PASS, otherwise `FinalStatus=FAILED`.

In `tests/expected-behaviors.md` add row:

```text
| S15 | C | Workflow 9: lint → unstack --dry-run → overlap-check.mjs, all PASS |
```

---

## 8. Completion Gate

PASS requires:

1. `SKILL.md` Workflows 6 / 9 / 10 / 11 updated per Section 3.
2. `SKILL.md` NNR +1 rule for project preset scripts per Section 3.5.
3. `references/execution.md` Geometry-aware Commands decision table
   rewritten per Section 4.
4. `references/geometry-verifier.md` created per Section 5.
5. `tests/validate-skill.mjs` `assertGeometryVerifierStrict` added per
   Section 6 (11 assertions).
6. `tests/scenarios.md` S15 appended.
7. `tests/expected-behaviors.md` S15 row appended.
8. `scripts/` directory contains the four scripts +
   README (already mirrored in this session).
9. `node --test tests/naming-and-workflow.test.mjs` still 10/10 PASS.
10. `node figma-skill/tests/validate-skill.mjs` PASS.
11. `tests/naming-results.md` updated to mark v1.2.4 rows.

---

## 9. Version Bump Justification

This is a **patch** (1.2.3 → 1.2.4) per the project's CLAUDE.md
minor-vs-patch rule:

- No new chapters in `SKILL.md` (insertions into existing Workflow
  bodies + one NNR rule).
- No new Workflows, no new mandatory fields except
  `GeometryVerifierPipeline` in delivery template (still inside Workflow
  11).
- One new reference file (`geometry-verifier.md`).
- Mirror of four project helper scripts into the skill repo.
- Existing rules become executable by naming concrete commands;
  validation phase is now a strict three-gate pipeline.

The change is **wiring + validation gate enforcement**, not new logic.
Patch is correct.

---

## 10. Out of Scope

- `textAutoResize` direct verification (figma-cli does not expose it).
- Real-time write locking across multiple concurrent agents.
- Upstream `figma-cli` field additions.
- Performance tuning of `unstack --dry-run` for large files.
- Copying `D:\Project\Nono\scripts\` helpers into the
  `D:\ai-skills\figma-skill/` repo (intentional — they belong to the
  user's project workspace, not the skill).

---

## 11. Self-Review Checklist

- Section 3 wires three concrete commands into Workflow 9 in fixed order.
- Section 3.5 places overlap-check.mjs in the eval/run gate **exemption
  list** (not blanket ban) — the v1.2.3 feedback rule ("不要直接禁止
  node 读写 figma") is honoured.
- Section 4 keeps the decision table compact and lists six commands,
  matching real figma-cli 2.1.0 help output.
- Section 5 keeps `geometry-verifier.md` single-screen and operationally
  obvious.
- Section 6 asserts use literal substrings; no regex needed.
- Section 7 reuses S13 / S14 as template; S15 adds the strict-order
  emphasis.
- Section 8 has 10 verifiable items, all runnable from this session.
- Version bump 1.2.3 → 1.2.4 justified per Section 9.
- `textAutoResize` limitation is explicitly stated and Visual layer
  fallback is named.
- Parked v1.2.2 spec is left untouched per project rule on preserving
  historical specs.