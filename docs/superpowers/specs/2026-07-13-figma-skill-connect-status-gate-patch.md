---
name: figma-skill connect-status-gate
model: sonnet
category: design
description: v1.2.1 patch combining (a) Workflow 1 status-before-connect reflow for concurrent agents and (b) reducing component Section required Specimens from four to one (Specimen/StateGallery only).
version: 1.2.1
---

# `figma-skill` Connect-Status Gate + Specimen Reduction Patch (v1.2.1)

**Date:** 2026-07-13
**Status:** Awaiting written-spec user review
**Target version:** `figma-skill` 1.2.1 (patch bump)

This spec is a **patch on top of v1.2**. It contains two independent rule
tightenings packaged in a single version bump:

1. **Connect-Status Gate** — Reflow Workflow 1 so `figma-cli status`
   runs before `connect`, and forbid `daemon restart / stop / reconnect`
   which break shared sessions.
2. **Specimen Reduction** — Reduce component Section required Specimens
   from four (`Specimen/StateGallery`, `Specimen/VariantMatrix`,
   `Specimen/Properties`, `Specimen/Usage`) to one (`Specimen/StateGallery`).

Both changes are rule-tightening within existing chapters. No new
chapters, no new Workflows, no new mandatory fields. Patch is correct.

This spec does not change Workflows 2–11 (except Workflow 1 reordering
and 4A specimen count), naming grammar, three-page architecture,
geometry mandates, or approval gates. The base spec
(`docs/superpowers/specs/2026-07-12-figma-skill-naming-and-workflow-design.md`)
is **not** updated to match the specimen reduction; historical record of
v1.1's four-Specimen rule is preserved.

---

# Part I — Connect-Status Gate

## I.1 Background and Diagnosis

### I.1.1 Observed failure

A user runs multiple Claude agents (or Claude + Codex + any agent with
`figma-cli` access) against the **same Figma Desktop session**, each agent
operating on a different Page, Section, or task boundary. When a second
agent reaches Workflow 1, it executes `figma-cli connect` blindly. This
invokes the underlying daemon's `restart` path (the user's confirmed
behaviour) and **regenerates the auth token** (`~/.figma-ds-cli/.daemon-token`).
Every other agent that was holding the old token loses the connection and
must reconnect — at which point the same `restart` fires again, and the
loop continues until only one agent survives.

### I.1.2 Root cause

`SKILL.md` Workflow 1 currently mandates `connect` then `status`, with no
branching. The skill treats `connect` as always-required, even when the
daemon is already healthy and another agent already holds a valid token.
The "Yolo Connection Gate" in `references/installation.md` repeats the
same flat sequence.

### I.1.3 Real status output observed

```text
$ figma-cli status
Connected to Figma
  File: Nono
  ✓ Daemon running (port 3456)
```

`status` is **side-effect free** and returns enough information to skip
`connect` when both lines are present. `daemon diagnose` provides deeper
checks but is not required for the gate.

### I.1.4 What `connect` actually does (per `connect --help`)

```text
Usage: figma-ds-cli connect [options]
Options:
  --safe      Use Safe Mode (plugin-based, no patching required)
  -h, --help  display help for command
```

There is no `--force` / `--no-restart` flag. The user's empirical evidence
is that `connect` against an existing healthy daemon triggers `restart`.
Until upstream exposes a non-restart connect, the only safe posture is
**status first, connect only when status is not healthy**.

---

## I.2 Goals and Non-Goals

### I.2.1 Goals

1. Run `status` before `connect` in every Workflow 1 invocation.
2. Skip `connect` when `status` reports the daemon is healthy and the
   CDP connection is alive.
3. Forbid `daemon restart / stop / reconnect` from any Workflow 1 step;
   these commands regenerate the auth token and break shared sessions.
4. Keep backward compatibility: a single agent in a fresh session still
   reaches a connected state with the same effective flow.

### I.2.2 Non-goals

- No change to write locking between concurrent agents. Out of scope
  here. The user's stated model is "different agents do different
  things", so a write lock is not needed.
- No change to `--safe` mode behaviour. It remains user-approved only.
- No change to the auto-install path (`scripts/install-figma-cli.ps1`).
- No new chapter or sub-section in `references/installation.md`
  covering concurrent-agent scenarios. Concurrent-agent risk is fully
  expressed by the prohibitions in Workflow 1 itself; no standalone
  section is added.

---

## I.3 New Workflow 1 Sequence

Replace the current one-line action list in `SKILL.md`:

```text
固定动作：固定 <Current workspace>；执行 figma-cli --version、--help、Windows
安装（必要时）；connect；status。完成条件：EnvironmentGate=PASS。
```

with:

```text
固定动作（顺序固定，禁止调换）：
1. 固定 <Current workspace>；
2. 执行 figma-cli --version 与 --help；任一失败禁止继续；
3. Windows 安装仅在 CLI 缺失或两个检查失败时执行；
4. 执行 figma-cli status：
   a. 输出同时包含 "Connected to Figma" 与 "Daemon running" → 视为
      已连接，跳过 connect；EnvironmentGate=PASS 直接进入 Workflow 2；
   b. 否则按 references/installation.md 的 connect 路径继续。
5. 禁止在 status 之前调用 connect；
6. 禁止调用 figma-cli daemon restart / stop / reconnect；这些命令
   会重发 token，破坏共享 daemon 的其他会话。

完成条件：EnvironmentGate=PASS。下一状态：PASS → Workflow 2；FAIL → 停止。
```

The spec reserves the new fixed ordering in Workflow 1 by anchoring on
the existing mandatory wording `必须 / 禁止`.

---

## I.4 No New Reference Section

Concurrent-agent risk is fully expressed by the prohibitions in Workflow 1
itself (Section I.3, items 5 and 6). No new section is added to
`references/installation.md`. The existing Yolo Connection Gate is
updated as Section I.5 below.

---

## I.5 Updated `## Yolo Connection Gate` Section

Replace the current Yolo Connection Gate body in
`references/installation.md`:

```text
## Yolo Connection Gate

每个新会话必须按下列顺序执行：

1. figma-cli status
   - 输出同时包含 "Connected to Figma" 与 "Daemon running" → 跳过
     connect，直接进入下一步；
   - 否则按步骤 2-4 继续。
2. figma-cli connect（不传 --safe，除非用户明确批准）
3. figma-cli status（确认 PASS）
4. 失败时按当前 connect --help / status --help / daemon --help 报告；
   失败层必须明确（CLI 缺失 / daemon 未运行 / token 失效 / CDP 断开）。
   任何情况下禁止自动调用 daemon restart。
```

This rewording makes the gate **status-first** and forbids `daemon
restart` as a recovery path.

---

# Part II — Specimen Reduction

## II.1 Background

The v1.1 base spec required every component Section to contain four
Specimens:

```text
Specimen/StateGallery
Specimen/VariantMatrix
Specimen/Properties
Specimen/Usage
```

After v1.2 deployment, the user reviewed the four and judged three of
them (VariantMatrix, Properties, Usage) to be redundant or low-value
relative to the cost of producing and maintaining them. The Component
Set master itself already exposes variants; the Properties panel already
shows component properties; usage samples can be inspected by walking the
Screen tree.

The user confirms:

- `Specimen/StateGallery` will remain mandatory and must contain **all**
  variants (no Default-only shortcut).
- The remaining three Specimens are removed from the required set.
- The base spec (`2026-07-12-figma-skill-naming-and-workflow-design.md`)
  is **not** edited; the v1.1 historical record of four Specimens stays
  accurate for v1.1. v1.2.1 supersedes it for SKILL.md only.

## II.2 Goals and Non-Goals

### II.2.1 Goals

1. Workflow 4A creates exactly **one** Specimen per component:
   `Specimen/StateGallery`, containing every variant of the Component Set.
2. The naming grammar `Specimen/<Role>` is unchanged; only the
   required-Role set shrinks.
3. The three dropped Specimens may still be created optionally if a
   future task needs them, but they are no longer gate-required.

### II.2.2 Non-goals

- No change to `Specimen/<Role>` path grammar.
- No change to Specimen placement inside the Section.
- No retroactive cleanup of existing Specimens already in Figma
  (out of scope; the user can prune manually if desired).

---

## II.3 Updated Workflow 4A — Specimen Count

Replace the current Workflow 4A body in `SKILL.md`:

```text
固定动作：在 01 Library 中只读检查是否已有匹配组件；不存在则按 Category
创建 Section；创建主组件或 Component Set；补齐 Variant Property；添加四个
Specimen。完成条件：组件和 Specimen 已就位。
```

with:

```text
固定动作：在 01 Library 中只读检查是否已有匹配组件；不存在则按 Category
创建 Section；创建主组件或 Component Set；补齐 Variant Property；添加
Specimen/StateGallery，且必须包含 Component Set 的全部 variant。

完成条件：组件和 Specimen/StateGallery 已就位。下一状态：Workflow 5。
```

The four-Specimen wording becomes one-Specimen wording. The geometry
sub-steps added in v1.2 remain unchanged.

---

## II.4 Updated Validator Assertions

In `tests/validate-skill.mjs`, the existing `assertNamingAndWorkflow`
function asserts the four Specimen names. Reduce to **only**
`Specimen/StateGallery`:

- Keep: `Specimen/StateGallery`
- Drop: `Specimen/VariantMatrix`, `Specimen/Properties`, `Specimen/Usage`

The variant axes, naming grammar, and other markers are unchanged.

In `tests/naming-and-workflow.test.mjs`, no Specimen assertions are
present, so this file needs no edit beyond confirming the unchanged
10/10 pass rate.

---

# Part III — Validator Coverage

## III.1 Validator Assertions for Part I (Connect-Status)

Add to `tests/validate-skill.mjs` a new function
`assertConnectStatusGate(skill, installation)`:

1. `SKILL.md` Workflow 1 mentions `status` before the first `connect`
   after the `### Workflow 1` heading (literal position check).
2. `SKILL.md` Workflow 1 contains the prohibition `禁止在 status 之前调用 connect`.
3. `SKILL.md` Workflow 1 contains the prohibition `daemon restart` (in
   the Workflow 1 block, scope-limited).
4. `references/installation.md` `## Yolo Connection Gate` first numbered
   step is `figma-cli status` (regex check on the section body).
5. `references/installation.md` does **not** contain a
   `## Concurrent Agent Connection` heading (negative assertion,
   enforces the dropped section).

## III.2 Validator Assertions for Part II (Specimen)

Modify `assertNamingAndWorkflow` to drop the three Specimen assertions:

- Drop: `Specimen/VariantMatrix`
- Drop: `Specimen/Properties`
- Drop: `Specimen/Usage`
- Keep: `Specimen/StateGallery`

No positive assertion is added that "exactly one Specimen is required";
the kept `StateGallery` assertion is sufficient because the negative
"forbidden bucket" test still verifies no other Specimen names appear
as required entries in the grammar table.

---

# Part IV — Tests, Completion, Justification

## IV.1 Test Updates

- No new scenarios needed. S2 (missing CLI / MCP alternative) still
  applies to Part I. Part II is purely a Specimen count change and is
  verified by the validator assertions in Part III.
- Optional: add S14 — Concurrent agent skips connect. Triggers when
  status already reports healthy. Required choice: B (status-first;
  skip connect). **Decision: do not add S14 in this patch.** Add only
  if a real regression appears.

## IV.2 Completion Gate

PASS requires:

1. `SKILL.md` Workflow 1 reordered per Section I.3.
2. `references/installation.md` Yolo Connection Gate rewritten per
   Section I.5.
3. `SKILL.md` Workflow 4A Specimen count reduced per Section II.3.
4. `tests/validate-skill.mjs` Part I asserts (Section III.1) all pass.
5. `tests/validate-skill.mjs` Part II Specimen asserts (Section III.2)
   pass with three Specimens removed.
6. `node --test tests/naming-and-workflow.test.mjs` still 10/10 PASS.
7. `node figma-skill/tests/validate-skill.mjs` PASS.
8. `tests/naming-results.md` updated to mark v1.2.1 rows for both Part I
   and Part II.

## IV.3 Version Bump Justification

This is a **patch** (1.2 → 1.2.1) per the project's CLAUDE.md minor-vs-
patch rule:

- Part I: Workflow 1 internal ordering changes; one section rewritten
  in `references/installation.md`.
- Part II: One Workflow body line shortened; validator loses three
  string-list entries.

Neither part adds new chapters, new Workflows, or new mandatory fields.
Both are rule-tightening / rule-reduction within existing chapters.
Patch is correct.

Note: the dropped base-spec update for Part II is intentional. The base
spec remains the historical record of v1.1's four-Specimen rule;
v1.2.1 supersedes it for SKILL.md only. This avoids rewriting history
in the v1.1 spec file.

## IV.4 Out of Scope

- Multi-agent write locking (Part I; user's model already avoids same-
  node writes).
- Upstream `figma-cli` flag requests (`--no-restart`).
- Changes to daemon diagnose usage in installation.
- PowerShell installer behaviour changes.
- A dedicated concurrent-agent reference chapter (Part I).
- Retroactive cleanup of existing Specimens in Figma files (Part II).
- Editing base spec to reflect four → one Specimen (Part II).

## IV.5 Self-Review Checklist

- Part I Section I.3 anchors on existing `必须 / 禁止` wording.
- Part I Section I.5 does not conflict with the existing Yolo
  Connection Gate.
- Part II Section II.3 keeps the v1.2 geometry sub-steps intact.
- Part III.1 / III.2 asserts use literal substrings and one regex;
  scope is precise (Workflow 1 block only).
- Part IV.2 has 8 verifiable items, all runnable from this session.
- Version bump 1.2 → 1.2.1 justified per Part IV.3.
- Both Part I and Part II covered in single v1.2.1 to avoid version
  collision and to ship one atomic patch.