---
name: figma-skill-v2-remediation
model: sonnet
category: design
description: v2.1 remediation for the two P0 issues exposed by the 2026-07-15 news-screen retrospective — silent clipping (C1, Containment Gate) and silent duplicate creation under daemon stalls (C3, write-action idempotency).
version: 2.2
---

# `figma-skill` v2.2 — Containment Gate and Write-Action Idempotency

**Date:** 2026-07-15
**Status:** Pending review
**Target version:** `figma-skill` 2.2
**Depends on:** `figma-skill` 2.1
**Source:** `.figma/feedback/figma-skill-v2-news-screen-retrospective.md` (task `20260715-news-screen-overview`)

## 1. Decision Summary

Version 2.2 closes the two CRITICAL gaps surfaced by the 2026-07-15 news-screen task:

1. **C1 — Silent clipping under `clipsContent=true`.** `overlap-check` and `geometry-verifier` only check sibling AABB overlap. When a Section/Frame/Component has `clipsContent=true` and any child exceeds the parent bounds, the overflow is silently cut off and visual screenshots are the only signal. The news Library container (`1741:439`, 1600 px tall) was clipping ~4247 px of stacked components; only the upper portion was visible. This adds a **Containment Gate** (Gate 7) with a default-deny whitelist model: any `clipsContent=true` parent not explicitly listed in `plan.md#ClipWhitelist` fails.
2. **C3 — Silent duplicate creation under daemon stalls.** When `figma-cli` daemon stalls but partial writes still land, retrying `create section --name X` produces duplicate Sections sharing the same `(name, parent)` identity. The news task created Section id `1739:435`, `1739:436`, and `1740:437` before manual `c.remove()` cleanup. This makes `figma-cli create.*` natively support `--check-exists name+parent` with a strict default: **duplicate detection fails by default**; reuse requires an explicit `--reuse` flag.

C2 (daemon ETIMEDOUT → silent partial writes → transactional snapshot) is **out of scope** for this version. It depends on figma-cli protocol changes and is tracked as a separate item under "Deferred to v2.3".

## 2. Goals

1. Make silent clipping impossible to ship. Any `clipsContent=true` parent that overflows must fail the Geometry Gate before the task reaches `Workflow 11` archive.
2. Make duplicate creation impossible without explicit agent consent. Default behavior is `FAIL` with structured `DUPLICATE` payload, never silent reuse.
3. Keep the three existing Core Invariants intact (`.figma/` is not live truth, stored NodeIds are advisory, lease is not a distributed lock) — both gates are read-only at execution time and do not introduce new state mutations beyond what already exists.
4. Provide machine-checkable tests so regressions in containment or idempotency are caught by `tests/`.
5. Stay within the existing versioning discipline: this is a minor+structural change, hence version bump `2.1 → 2.2`.

## 3. Non-Goals

1. **C2 (daemon timeout / transactional snapshot) is not addressed.** It requires changes to `figma-cli` itself and an explicit `--timeout` protocol negotiation; deferred to v2.3.
2. **No auto-fix.** When Containment Gate fails, the gate emits structured recommendations (`suggestedHeight`); agent decides whether to resize, redesign, or whitelist. Same for `WriteOrder` in `plan.md`.
3. **No structural changes to `Three-Page Architecture`**, lease semantics, or the Workflow 0–11 state machine.
4. **No new subcommands in `figma-task-state.mjs`.** Both fixes live in `overlap-check.mjs` (read-only helper) and `figma-cli create.*` flags (write surface).
5. **No migration of historical tasks.** Existing `.figma/tasks/<task-id>/plan.md` files without `ClipWhitelist` are still valid for their original Workflow 9 run; the new requirement applies only to tasks whose `Workflow 6` happens after v2.2 ships.
6. **`P2-7 self-reflection feedback cadence` is intentionally deferred.** Workflow 12 has no production data yet; the review cadence will be designed after the first batch of self-reflection files is harvested.

## 4. Core Invariants (preserved from v2.1)

1. The ledger is not live truth. Both new gates operate on live Figma reads, not `.figma/` cache.
2. The Geometry Verifier does not auto-fix. It reports structured issues; the agent (Workflow 10) decides.
3. Stored NodeIds, parent relations, geometry are advisory; both new gates re-read live state.
4. Task leases are not distributed locks. Both new gates respect the lease but do not change it.
5. Workflow 12 self-reflection must not be skipped; this remediation does not bypass it.

## 5. Detailed Design

### 5.1 Containment Gate (Gate 7)

**Trigger:** any Section / Frame / Component / Instance whose `clipsContent=true` contains at least one child whose `absoluteBoundingBox` is not fully contained in the parent's `absoluteBoundingBox`.

**Algorithm** (pseudocode, lives in `scripts/overlap-check.mjs`):

```
for parent in (Section | Frame | Component | Instance) on active page:
  if !parent.clipsContent: continue       # not clipping → no risk
  if parent.id in plan.ClipWhitelist[*].nodeId:
    log(INFO, "whitelisted", {parent, rationale: ...})
    continue
  for child in parent.children:
    cb = child.absoluteBoundingBox
    pb = parent.absoluteBoundingBox
    if cb.x < pb.x
       or cb.y < pb.y
       or cb.x + cb.width  > pb.x + pb.width
       or cb.y + cb.height > pb.y + pb.height:
      side = (left | right | top | bottom) derived from which inequality failed
      overflow_px = max(0, (cb.x + cb.width)  - (pb.x + pb.width),
                            (cb.y + cb.height) - (pb.y + pb.height))
      suggestedHeight = pb.height + overflow_px
      emit ISSUE({ gate: "Containment",
                   parent: parent.id, parentName: parent.name,
                   child:  child.id,  childName:  child.name,
                   side, overflow_px, suggestedHeight })
```

**Whitelist contract** — `plan.md` gains a `## ClipWhitelist` section:

```markdown
## ClipWhitelist

| nodeId | rationale |
| ------ | --------- |
| 1741:439 | Library preview card — internal scroll is intentional |
```

Schema addition in `schemas/task-state.schema.json`:

```json
"plan.clipWhitelist": {
  "type": "array",
  "items": {
    "type": "object",
    "required": ["nodeId", "rationale"],
    "properties": {
      "nodeId": { "type": "string" },
      "rationale": { "type": "string", "minLength": 5 }
    }
  }
}
```

**Gate semantics:**

| `clipsContent` | In `ClipWhitelist` | Result |
| - | - | - |
| `false` | n/a | PASS (skip) |
| `true` | yes | PASS (whitelisted) |
| `true` | no, with overflowing child | FAIL |
| `true` | no, no overflowing child | PASS |

**Output format** matches the existing `overlap-check.mjs` issue schema (`{gate, severity, nodeId, message, recommendation}`) so Workflow 10 already understands it.

**Multi-level nesting:** each parent is independently checked. A grandchild overflowing its child is reported under the *child* (the immediate parent), not the grand-parent. This avoids double-reporting and keeps the FAIL list one-to-one with the offending edge.

### 5.2 Write-Action Idempotency (`--check-exists`)

**Scope:** all `figma-cli create.*` subcommands that produce a single named node:

- `create section`
- `create frame`
- `create component`
- `create instance`
- `create rectangle`
- `create ellipse`
- `create text`

**Behavior:**

```
figma-cli create section --name "News Section" --parent <pageId> --check-exists
  ├─ Step 1: probe `parent.findOne(n => n.name === "News Section")` via daemon
  ├─ not found → proceed with normal create; return new nodeId (unchanged)
  ├─ found, no --reuse → return:
  │   { status: "DUPLICATE",
  │     code: "DUPLICATE_NODE",
  │     existingId: "1739:435",
  │     existingName: "News Section",
  │     parent: "<pageId>",
  │     message: "node already exists; pass --reuse to bind, --rename <name> to create, or remove the existing one first" }
  │   exit code 3 (distinct from validation errors)
  ├─ found, --reuse → skip create, return existingId with `{ reused: true }` and exit 0
  └─ found, --strict → abort immediately (differs from default FAIL in that --reuse cannot recover)
```

**Flag matrix:**

| Flag | Default | Effect |
| - | - | - |
| `--check-exists` | off | When on, probe `(name, parent)` before creating |
| `--reuse` | off | When on, allow reuse of existing node (must pair with `--check-exists`) |
| `--strict` | off | When on, duplicate is a hard abort (no `--reuse` rescue) |
| `--rename <new-name>` | off | When on and duplicate found, retry with new name (must pair with `--check-exists`) |

**Agent workflow integration:**

`SKILL.md` Red Flags gains one new entry:

> "重名同 parent 节点必须 FAIL 或显式 `--reuse`，不得静默新建。"

`references/execution.md` §"Write order" gains:

> "在 `plan.md` 显式声明创建顺序（`## WriteOrder` 段）。`--check-exists` 命中时优先复用 `WriteOrder` 中已声明的节点；若 `WriteOrder` 中无该节点，则按 `--check-exists` 默认行为 FAIL。"

### 5.3 Version Bump

`SKILL.md` YAML frontmatter `version: 2.1 → 2.2`. Per CLAUDE.md versioning rules, this is a major bump because it adds a new gate (Gate 7) and changes the write-action contract. No reference file renames; no schema version bumps except the additive `plan.clipWhitelist` field.

## 6. Affected Files

| File | Change | Risk |
| - | - | - |
| `scripts/overlap-check.mjs` | Add `--gate containment` sub-mode; emit ISSUE objects in existing schema | Low — additive, existing flags unchanged |
| `references/geometry-verifier.md` | Add §"Gate 7 — Containment" with algorithm pseudocode + whitelist contract | Low |
| `references/planning.md` | Add `ClipWhitelist` and `WriteOrder` to "Required Fields Quick Map". `WriteOrder` is a human-readable section only (no schema field); `ClipWhitelist` is schema-validated. | Low |
| `schemas/task-state.schema.json` | Add `plan.clipWhitelist` (array of `{nodeId, rationale}`) | Low — additive |
| `SKILL.md` | (a) Workflow 9 "六道闸门" → "七道闸门" + new Gate name; (b) I/O Contract Gate list adds `ContainmentGate`; (c) Red Flags gains one entry; (d) `version: 2.1 → 2.2` | Medium — surface area visible to agents |
| `references/execution.md` | New §"Write order & `--check-exists`" | Low |
| `tests/containment-gate.test.mjs` | New test file with fixtures: clipsContent=true + overflow, clipsContent=true + no overflow, clipsContent=false + overflow (must pass), whitelisted overflow | Low |
| `tests/write-idempotency.test.mjs` | New test file exercising `create section` with `--check-exists`, `--reuse`, `--strict`, `--rename` | Medium — requires figma-cli daemon or a stub |

## 7. Test Strategy

**Containment Gate:**
- 4 fixtures, all run via the existing `tests/helpers/run-figma-script.mjs` harness.
- Fixture 1: Section, `clipsContent=true`, child 100 px below parent bottom → expect FAIL, `side=bottom`, `overflow_px=100`.
- Fixture 2: same as 1 but child fits → expect PASS.
- Fixture 3: Section, `clipsContent=false`, child 100 px below parent → expect PASS (no clipping risk).
- Fixture 4: Section, `clipsContent=true`, child 100 px below parent, `ClipWhitelist` contains the parent `nodeId` → expect PASS with `INFO` log.
- A 5th test exercises the multi-level case: Section > Frame > Rectangle where Rectangle overflows Frame; expect exactly one ISSUE under Frame, not Section.

**Write-Idempotency:**
- 4 sub-tests against `figma-cli create section` (or a stub if daemon unavailable in CI):
- 1: `--check-exists` + no existing → exit 0, return new id.
- 2: `--check-exists` + existing → exit 3, payload `status=DUPLICATE`.
- 3: `--check-exists --reuse` + existing → exit 0, payload `{reused: true}`.
- 4: `--check-exists --strict` + existing → exit non-zero with hard-abort message.

**Regression coverage:**
- Existing `tests/figma-validate-bounds.test.mjs`, `tests/figma-read-helpers.test.mjs`, `tests/workflow-contract.test.mjs` must remain green.
- `tests/green-results.md` and `tests/v2-green-results.md` must be re-run and recorded.

## 8. Migration / Compatibility

**Backward compatibility:**
- `overlap-check.mjs` without `--gate containment` flag behaves identically to v2.1.
- `figma-cli create.*` without `--check-exists` behaves identically to v2.1.
- Existing `.figma/tasks/<task-id>/plan.md` files without `ClipWhitelist` section: `overlap-check` treats them as empty whitelist, so any `clipsContent=true` + overflow fails. Tasks archived before v2.2 are unaffected.

**Forward compatibility:**
- v2.2 ships before the news-screen task is re-opened. If the user re-runs Workflow 9 on the news task after upgrade, they must add a `ClipWhitelist` entry for `1741:439` (the Library container) OR redesign it without `clipsContent=true`.
- Tasks created after v2.2 with `plan.md` lacking `ClipWhitelist` will pass the existing WritePlanGate only if they don't contain `clipsContent=true` containers.

## 9. Open Questions Deferred to v2.3

1. **C2 daemon timeout & transactional snapshot.** Requires `figma-cli --timeout` protocol negotiation, dry-run echo after each batch, and pre/post node-list diff. Independent PR.
2. **P2-7 self-reflection review cadence.** Awaiting first batch of `.figma/feedback/<ts>.md` files from production tasks.
3. **Auto-fix safety net.** Containment Gate currently only reports. Auto-resize to `suggestedHeight` could be added in v2.3 if Workflow 10's ≤3-retry budget proves too tight for hand-tuning large containers.

## 10. Acceptance Criteria

- `overlap-check.mjs --gate containment` produces structured ISSUE output in all 4 fixture cases.
- `SKILL.md` `version` field is `2.2`.
- All existing tests remain green.
- New tests added: `containment-gate.test.mjs`, `write-idempotency.test.mjs`.
- `plan.md` schema accepts `clipWhitelist`; absent field is treated as empty array.
- `figma-cli create section --check-exists` returns `DUPLICATE` payload in v2.2 build of figma-cli (companion repo change).
- README + `references/self-reflection.md` are NOT changed (out of scope).