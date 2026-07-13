---
name: figma-skill geometry-verifier-strict
model: sonnet
category: design
description: Execution plan for v1.2.4 — wires SKILL.md Workflow 9 to three strict verifier gates (lint, unstack --dry-run, overlap-check.mjs) and lifts four project helper scripts into the skill repo's scripts/ directory.
version: 1.2.4
---

# `figma-skill` Geometry Verifier Strict — Execution Plan (v1.2.4)

**Date:** 2026-07-14
**Status:** Awaiting written-plan user review
**Target version:** `figma-skill` 1.2.4 (patch bump)
**Spec:** `docs/superpowers/specs/2026-07-13-figma-skill-geometry-verifier-strict-v124.md`

This plan maps the v1.2.4 spec into 10 executable tasks. Tasks are
linear; each has explicit completion conditions. Inline execution; no
subagents.

---

## Task 1 — SKILL.md NNR +1 rule

**Files:**
- `D:\ai-skills\figma-skill\SKILL.md` (modify)

**Change:** Append one NNR rule per spec §3.5. Insert before the final
"硬性要求必须用「必须」「禁止」「只有……才允许」" rule.

**Body to insert:**

```text
- `scripts/` 下的四个脚本属于项目预设助手脚本，通过 eval/run gate 预设批准：
  `list-children.mjs`（只读）、`overlap-check.mjs`（只读）、
  `apply-layout.mjs`（写动作，必须经 Workflow 6 审批）、
  `resize-section.mjs`（写动作，必须经 Workflow 6 审批）。
  调用只读类不需要在 Workflow 6 EvalRunFallback 中再次提供六字段事实链；
  调用写动作类必须在 Workflow 6 CommandPlan 中显式列出 PLANS / PAD_X /
  PAD_Y 等入口常量并经用户审批。四个脚本的路径与入口常量都必须在
  CommandPlan 中显式列出。
```

**Done when:**
- File contains literal `scripts/` AND literal `list-children.mjs` AND
  literal `apply-layout.mjs` AND literal `resize-section.mjs` in the
  NNR section.

---

## Task 2 — SKILL.md Workflow 9 three-gate rewrite

**Files:**
- `D:\ai-skills\figma-skill\SKILL.md` (modify)

**Change:** Replace the v1.2 Geometry layer block in Workflow 9 per
spec §3.1. Insert literal:
- `figma-cli lint --json`
- `figma-cli unstack --dry-run`
- `figma-cli run scripts/overlap-check.mjs`

Keep existing variant-row parity and TextNode / Visual fallback
paragraphs intact.

**Done when:** all three command literals appear in Workflow 9.

---

## Task 3 — SKILL.md Workflow 10 verifier-aware correction

**Files:**
- `D:\ai-skills\figma-skill\SKILL.md` (modify)

**Change:** Append spec §3.2 to Workflow 10 body. Insert literal
references to: `overlap-check.mjs`, `unstack --dry-run`, `inspect --json`,
`apply-layout.mjs`, `canvas next`.

**Done when:** Workflow 10 body contains `overlap-check.mjs` and
`unstack --dry-run`.

---

## Task 4 — SKILL.md Workflow 11 GeometryVerifierPipeline

**Files:**
- `D:\ai-skills\figma-skill\SKILL.md` (modify)

**Change:** Append spec §3.3 to Workflow 11 delivery template. Insert
literal `GeometryVerifierPipeline` and the three command lines (lint /
unstack / overlap-check.mjs) and the `OverlapMatrix` field. Add the
"未提交视为 FinalStatus=FAILED" delivery rule.

**Done when:** Workflow 11 template contains `GeometryVerifierPipeline`.

---

## Task 5 — SKILL.md Workflow 6 OverlapCheck split

**Files:**
- `D:\ai-skills\figma-skill\SKILL.md` (modify)

**Change:** Replace the v1.2 `OverlapCheck` line in Workflow 6 fixed
template with spec §3.4 three-line block. Also extend CommandPlan
guidance to list the three gates and require PARENT_ID.

**Done when:** Workflow 6 template contains literal
`scripts/overlap-check.mjs`.

---

## Task 6 — SKILL.md Workflow 7 list-children baseline

**Files:**
- `D:\ai-skills\figma-skill\SKILL.md` (modify)

**Change:** Append spec §3.6 to Workflow 7. Insert literal
`list-children.mjs`, `PARENT_ID`, and Workflow 7 FAIL rule.

**Done when:** Workflow 7 body contains literal `list-children.mjs`.

---

## Task 7 — SKILL.md Workflow 8 apply-layout / resize-section

**Files:**
- `D:\ai-skills\figma-skill\SKILL.md` (modify)

**Change:** Append spec §3.7 to Workflow 8. Insert literal
`apply-layout.mjs`, `resize-section.mjs`, `PLANS`, `PAD_X`, `PAD_Y`.

**Done when:** Workflow 8 body contains both `apply-layout.mjs` AND
`resize-section.mjs`.

---

## Task 8 — references/execution.md decision table

**Files:**
- `D:\ai-skills\figma-skill\references\execution.md` (modify)

**Change:** Replace the v1.2 `## Geometry-aware Commands` block with
spec §4 decision table. Nine commands total: lint, unstack, canvas info,
canvas next, inspect, list-children.mjs, overlap-check.mjs,
apply-layout.mjs, resize-section.mjs.

**Done when:** All nine command literals appear in
`references/execution.md`.

---

## Task 9 — references/geometry-verifier.md (new)

**Files:**
- `D:\ai-skills\figma-skill\references\geometry-verifier.md` (create)

**Change:** Create per spec §5. Content:
- Frontmatter not required (it's a reference, not a SKILL).
- Four闸门 sections (lint / unstack / overlap-check / variant parity).
- Three 配套脚本 sections (list-children / apply-layout / resize-section).
- 失败处理优先级 list.

**Done when:** File exists and contains all four command names (lint,
unstack, overlap-check.mjs, inspect --json) and all four matrix / pipeline
names (LayoutMode / LayoutSizing / BoundingBox / 兄弟相交矩阵).

---

## Task 10 — validator + tests + traceability

**Files:**
- `D:\ai-skills\figma-skill\tests\validate-skill.mjs` (modify)
- `D:\ai-skills\figma-skill\tests\scenarios.md` (modify)
- `D:\ai-skills\figma-skill\tests\expected-behaviors.md` (modify)
- `D:\ai-skills\figma-skill\tests\naming-results.md` (modify)

**Change:**
1. Add `assertGeometryVerifierStrict(skill, runtimeMarkdown)` to
   `validate-skill.mjs` per spec §6. 11 assertions:
   - Workflow 9 contains `figma-cli lint --json`
   - Workflow 9 contains `figma-cli unstack --dry-run`
   - Workflow 9 contains `scripts/overlap-check.mjs`
   - Workflow 10 contains `overlap-check.mjs`
   - Workflow 11 template contains `GeometryVerifierPipeline`
   - NNR contains `scripts/` + `list-children.mjs` +
     `apply-layout.mjs` + `resize-section.mjs`
   - Workflow 7 contains `list-children.mjs`
   - Workflow 8 contains `apply-layout.mjs` AND `resize-section.mjs`
   - `references/execution.md` mentions all 9 commands
   - `references/geometry-verifier.md` exists + 4 commands + 4 matrix names
   - `scripts/` directory contains 4 mjs + README (fs.existsSync check)
2. Bump SKILL.md frontmatter version to `1.2.4`.
3. Add S15 (multi-step) to `scenarios.md` and `expected-behaviors.md`:
   - **S15.1 lint 闸门**: agent runs `figma-cli lint --json`; non-empty
     output → Workflow 9 FAIL.
   - **S15.2 unstack 闸门**: agent runs `figma-cli unstack --dry-run`;
     non-empty output → Workflow 9 FAIL.
   - **S15.3 overlap-check 闸门**: agent runs
     `figma-cli run scripts/overlap-check.mjs` with PARENT_ID edited;
     `overlapPairs > 0` → Workflow 9 FAIL.
   - All three must PASS in fixed order before Workflow 11 can declare
     `FinalStatus=PASS`.
4. Add v1.2.4 traceability rows to `naming-results.md`.
5. Bump validator regex from `1.2.3` to `1.2.4`.

**Done when:**
- `node figma-skill/tests/validate-skill.mjs` PASS.
- `node --test figma-skill/tests/naming-and-workflow.test.mjs` still
  10/10 PASS.
- `figma-skill/tests/figma-validate-bounds.test.mjs` still PASS.

---

## Task 11 — commit + push

**Files:** all v1.2.4 changes staged.

**Change:**
1. `git add -A`
2. `git commit -m "feat(figma-skill): ship v1.2.4 with strict verifier gates"`
3. `git push origin main`
4. Post-push hook (`node sync-skills.mjs --only-changed -v`) runs
   automatically.

**Done when:** push reports `main -> main` and post-push hook exits 0.

---

## Completion Gate

PASS requires ALL of the following (per spec §8):

1. SKILL.md Workflows 6 / 9 / 10 / 11 updated per Tasks 5/2/3/4.
2. SKILL.md NNR +1 rule per Task 1.
3. SKILL.md Workflow 7 / 8 updates per Tasks 6/7.
4. SKILL.md frontmatter version = `1.2.4` per Task 10.
5. `references/execution.md` decision table rewritten per Task 8.
6. `references/geometry-verifier.md` created per Task 9.
7. `tests/validate-skill.mjs` 11 assertions added per Task 10.
8. `tests/scenarios.md` S15 appended.
9. `tests/expected-behaviors.md` S15 row appended.
10. `tests/naming-results.md` v1.2.4 rows added.
11. `node --test tests/naming-and-workflow.test.mjs` 10/10 PASS.
12. `node figma-skill/tests/validate-skill.mjs` PASS.
13. Push succeeds; post-push hook exits 0.

---

## Self-Review Checklist

- Tasks are linear; no parallel branches.
- Each task has explicit Done condition.
- Task 10 includes the version bump + validator regex bump (combined
  to avoid intermediate broken state).
- No subagent dispatched.
- All file paths absolute.
- Final task is push + hook; no manual sync.