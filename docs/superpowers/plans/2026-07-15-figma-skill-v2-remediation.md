# figma-skill v2.2 — Containment Gate and Write-Action Idempotency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `figma-skill` 2.2 — add Containment Gate (Gate 7) for silent-clipping detection and `--check-exists` / `--reuse` / `--strict` / `--rename` flags to `figma-cli create.*` so duplicate creation under daemon stalls cannot happen without explicit agent consent.

**Architecture:** Two parallel tracks, each shippable independently:
- **Track A (Containment):** Add `--gate containment` sub-mode to `scripts/overlap-check.mjs` that detects child-vs-parent AABB overflow under `clipsContent=true`. Default-deny whitelist lives in `plan.md##ClipWhitelist`. Documented as Gate 7 in `geometry-verifier.md`, surfaced in `SKILL.md` I/O Contract and Red Flags.
- **Track B (Idempotency):** Document `--check-exists`, `--reuse`, `--strict`, `--rename` contract in `references/execution.md`. The actual CLI flag implementation lives in the figma-cli repo (out of scope here). figma-skill-side validation: stub-based tests for the contract.

**Tech Stack:** Node.js (`.mjs`, ESM), JSON Schema (`schemas/task-state.schema.json`), `vm` sandbox test harness (`tests/helpers/run-figma-script.mjs`), `figma-cli` v2.2+ (companion repo).

## Global Constraints

- **Version:** `SKILL.md` YAML frontmatter `version: 2.1 → 2.2` (major bump per CLAUDE.md — new gate + write-action contract change).
- **Backward compat:** `overlap-check.mjs` without `--gate containment` MUST behave identically to v2.1. `figma-cli create.*` without `--check-exists` MUST behave identically to v2.1.
- **Naming:** Containment Gate (Gate 7). Whitelist section name: `ClipWhitelist` (CamelCase, single section in `plan.md`). Issue schema: `{ gate: "Containment", severity: "error", parentId, parentName, childId, childName, side, overflowPx, suggestedHeight, recommendation }`.
- **Whitelist schema:** `{ type: "array", items: { type: "object", required: ["nodeId", "rationale"], properties: { nodeId: string, rationale: string minLength 5 } } }`.
- **Exit codes (figma-cli side):** duplicate default → 3; `--reuse` success → 0; `--strict` abort → 4.
- **Tests:** All new tests use `tests/helpers/run-figma-script.mjs` for vm-sandboxed mock figma API. figma-cli side uses stub command (`tests/helpers/stub-figma-cli.mjs` created in Task 8).
- **Commit cadence:** Every task ends with a commit. Commit messages use conventional commits prefix (`feat:`, `test:`, `docs:`, `fix:`, `chore:`).
- **Push:** After all 10 tasks, push to `origin main`. Hook `node sync-skills.mjs --only-changed -v` will run.
- **Out of scope:** C2 (daemon timeout / transactional snapshot) — deferred to v2.3. P2-7 (self-reflection review cadence) — deferred until Workflow 12 has production data.

---

## Task 1: Add `plan.clipWhitelist` to plan validation helper

**Files:**
- Modify: `figma-skill/scripts/lib/task-state/validate.mjs` (add `assertValidPlan` for the parsed plan markdown)
- Modify: `figma-skill/scripts/lib/task-state/model.mjs` (export `CLIP_WHITELIST_SCHEMA` if needed)
- Test: `figma-skill/tests/plan-clipwhitelist.test.mjs` (new file)

**Discovery (plan review):** The existing `task-state.schema.json` validates only `state.json` / `index.json` / `event.json` — it has no `plan` top-level field. `plan.md` is markdown, not validated by JSON schema. Therefore `clipWhitelist` is best enforced via a small `assertValidPlan` helper that parses the parsed plan object. The plan object shape is determined by `references/planning.md` (Required Fields Quick Map). This task adds the helper.

**Interfaces:**
- Consumes: parsed `plan.md` as `{ clipWhitelist: Array<{nodeId, rationale}>, writeOrder: Array<{step, command}> }` (shape mirrors Required Fields Quick Map; absent fields default to `[]`)
- Produces: `assertValidPlan(plan)` — throws `TaskStateError("PLAN_INVALID", ...)` on violation; returns plan on success.

- [ ] **Step 1: Write failing test for `assertValidPlan`**

Create `figma-skill/tests/plan-clipwhitelist.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { test } from "node:test";
import { assertValidPlan } from "../scripts/lib/task-state/validate.mjs";
import { TaskStateError } from "../scripts/lib/task-state/errors.mjs";

const goodPlan = {
  clipWhitelist: [
    { nodeId: "1741:439", rationale: "Library preview card — internal scroll is intentional" },
  ],
  writeOrder: [
    { step: 1, command: "figma-cli create section --name \"News\" --parent P1 --check-exists" },
  ],
};

test("accepts plan with valid clipWhitelist and writeOrder", () => {
  assert.doesNotThrow(() => assertValidPlan(goodPlan));
});

test("accepts plan with empty clipWhitelist and writeOrder (default-deny)", () => {
  assert.doesNotThrow(() => assertValidPlan({ clipWhitelist: [], writeOrder: [] }));
});

test("accepts plan with absent clipWhitelist and writeOrder (treated as empty)", () => {
  assert.doesNotThrow(() => assertValidPlan({}));
});

test("rejects clipWhitelist entry with rationale shorter than 5 chars", () => {
  assert.throws(
    () => assertValidPlan({ clipWhitelist: [{ nodeId: "1:2", rationale: "no" }], writeOrder: [] }),
    (err) => err instanceof TaskStateError && err.code === "PLAN_INVALID",
  );
});

test("rejects clipWhitelist entry with missing nodeId", () => {
  assert.throws(
    () => assertValidPlan({ clipWhitelist: [{ rationale: "scroll container" }], writeOrder: [] }),
    (err) => err instanceof TaskStateError && err.code === "PLAN_INVALID",
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from repo root:
```bash
cd figma-skill && node --test tests/plan-clipwhitelist.test.mjs
```
Expected: FAIL — `assertValidPlan` is not exported from `validate.mjs`.

- [ ] **Step 3: Add `assertValidPlan` to validate.mjs**

Append at the end of `figma-skill/scripts/lib/task-state/validate.mjs`:

```javascript
export function assertValidPlan(value) {
  function invalid(message, details = {}) {
    throw new TaskStateError("PLAN_INVALID", message, details);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    invalid("plan must be an object", { path: "plan" });
  }
  const clipWhitelist = Object.hasOwn(value, "clipWhitelist") ? value.clipWhitelist : [];
  if (!Array.isArray(clipWhitelist)) {
    invalid("plan.clipWhitelist must be an array", { path: "plan.clipWhitelist" });
  }
  clipWhitelist.forEach((entry, index) => {
    const p = `plan.clipWhitelist[${index}]`;
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      invalid(`${p} must be an object`, { path: p });
    }
    if (typeof entry.nodeId !== "string" || entry.nodeId.length < 1) {
      invalid(`${p}.nodeId must be a non-empty string`, { path: `${p}.nodeId` });
    }
    if (typeof entry.rationale !== "string" || entry.rationale.length < 5) {
      invalid(`${p}.rationale must be a string of at least 5 characters`, { path: `${p}.rationale` });
    }
  });
  const writeOrder = Object.hasOwn(value, "writeOrder") ? value.writeOrder : [];
  if (!Array.isArray(writeOrder)) {
    invalid("plan.writeOrder must be an array", { path: "plan.writeOrder" });
  }
  return value;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd figma-skill && node --test tests/plan-clipwhitelist.test.mjs
```
Expected: PASS (5 tests, 0 failures).

- [ ] **Step 5: Run regression on existing schema tests**

Run:
```bash
cd figma-skill && node --test tests/task-state-schema.test.mjs
```
Expected: PASS — adding a new export does not break existing tests.

- [ ] **Step 6: Commit**

```bash
git add figma-skill/scripts/lib/task-state/validate.mjs figma-skill/tests/plan-clipwhitelist.test.mjs
git commit -m "feat(figma-skill): add assertValidPlan for plan.clipWhitelist and plan.writeOrder"
```

---

## Task 2: overlap-check.mjs `--gate containment` — failing tests

**Files:**
- Modify: `figma-skill/scripts/overlap-check.mjs`
- Test: `figma-skill/tests/containment-gate.test.mjs`

**Interfaces:**
- Consumes: existing `figma.getNodeByIdAsync`, parent/child AABB data
- Produces: JSON output with shape:
  ```javascript
  { ok: bool, code: "OK"|"CONTAINMENT_FAIL", summary: { parents, totalItems, containmentFails: number }, issues: Array<Issue>, containmentIssues: Array<ContainmentIssue> }
  ```
  where `ContainmentIssue = { gate: "Containment", severity: "error", parentId, parentName, childId, childName, side: "left"|"right"|"top"|"bottom", overflowPx: number, suggestedHeight: number, recommendation: string }`.

- [ ] **Step 1: Create test file with 5 fixtures (all should fail initially)**

Create `figma-skill/tests/containment-gate.test.mjs`:

```javascript
import { runFigmaScript } from "./helpers/run-figma-script.mjs";
import assert from "node:assert/strict";

const SCRIPT = new URL("../scripts/overlap-check.mjs", import.meta.url).pathname;

// Mock factory: builds a figma mock with one parent and arbitrary children.
function makeMock({ parent, children, plan = {} }) {
  const parentNode = {
    id: parent.id,
    name: parent.name,
    type: parent.type,
    clipsContent: parent.clipsContent,
    absoluteBoundingBox: parent.bbox,
    children,
  };
  return {
    figma: {
      getNodeByIdAsync: async (id) => (id === parent.id ? parentNode : null),
    },
  };
}

async function runGate(parent, children, plan, gateFlag = "containment") {
  // We need to inject PARENT_IDS, OUTPUT_MODE, GATE, CLIP_WHITELIST into the script source.
  const overrides = {
    PARENT_IDS: [parent.id],
    OUTPUT_MODE: "json",
    GATE: gateFlag,
    CLIP_WHITELIST: plan.clipWhitelist || [],
  };
  return runFigmaScript(SCRIPT, makeMock({ parent, children }).figma, overrides);
}

// Fixture 1: clipsContent=true, child 100px below parent bottom → expect FAIL, side=bottom
export async function testContainmentOverflowBottom() {
  const parent = {
    id: "P1", name: "Section", type: "SECTION",
    clipsContent: true,
    bbox: { x: 0, y: 0, width: 200, height: 200 },
  };
  const child = {
    id: "C1", name: "Card", type: "FRAME",
    absoluteBoundingBox: { x: 10, y: 250, width: 100, height: 50 },
  };
  const result = JSON.parse(await runGate(parent, [child]));
  assert.equal(result.code, "CONTAINMENT_FAIL", "expected CONTAINMENT_FAIL");
  assert.equal(result.containmentIssues.length, 1);
  const issue = result.containmentIssues[0];
  assert.equal(issue.side, "bottom");
  assert.equal(issue.overflowPx, 100);
  assert.equal(issue.suggestedHeight, 300);
}

// Fixture 2: same as 1 but child fits → expect PASS
export async function testContainmentNoOverflow() {
  const parent = {
    id: "P2", name: "Section", type: "SECTION",
    clipsContent: true,
    bbox: { x: 0, y: 0, width: 200, height: 200 },
  };
  const child = {
    id: "C2", name: "Card", type: "FRAME",
    absoluteBoundingBox: { x: 10, y: 10, width: 100, height: 50 },
  };
  const result = JSON.parse(await runGate(parent, [child]));
  assert.equal(result.code, "OK");
  assert.equal(result.containmentIssues.length, 0);
}

// Fixture 3: clipsContent=false, child overflows → expect PASS (no clipping risk)
export async function testContainmentNoClipIrrelevant() {
  const parent = {
    id: "P3", name: "Section", type: "SECTION",
    clipsContent: false,
    bbox: { x: 0, y: 0, width: 200, height: 200 },
  };
  const child = {
    id: "C3", name: "Card", type: "FRAME",
    absoluteBoundingBox: { x: 10, y: 250, width: 100, height: 50 },
  };
  const result = JSON.parse(await runGate(parent, [child]));
  assert.equal(result.code, "OK");
  assert.equal(result.containmentIssues.length, 0);
}

// Fixture 4: clipsContent=true + overflow + parent in ClipWhitelist → expect PASS
export async function testContainmentWhitelisted() {
  const parent = {
    id: "P4", name: "Card", type: "FRAME",
    clipsContent: true,
    bbox: { x: 0, y: 0, width: 200, height: 200 },
  };
  const child = {
    id: "C4", name: "Inner", type: "FRAME",
    absoluteBoundingBox: { x: 10, y: 250, width: 100, height: 50 },
  };
  const plan = { clipWhitelist: [{ nodeId: "P4", rationale: "scroll container" }] };
  const result = JSON.parse(await runGate(parent, [child], plan));
  assert.equal(result.code, "OK");
  assert.equal(result.containmentIssues.length, 0);
}

// Fixture 5: multi-level — Rectangle overflows Frame, Frame does not overflow Section
export async function testContainmentMultiLevel() {
  const section = {
    id: "SEC", name: "Section", type: "SECTION",
    clipsContent: true,
    bbox: { x: 0, y: 0, width: 500, height: 500 },
  };
  const frame = {
    id: "FR", name: "Frame", type: "FRAME",
    clipsContent: true,
    bbox: { x: 10, y: 10, width: 200, height: 200 },
  };
  const rect = {
    id: "R", name: "Rectangle", type: "RECTANGLE",
    absoluteBoundingBox: { x: 20, y: 250, width: 100, height: 100 },
  };
  // The mock returns Section when asked for SEC, but we need to recurse.
  // For now, containment-check only iterates PARENT_IDS directly, so test runs against Frame as parent.
  // This means: the Section > Frame nesting is NOT walked. Multi-level test asserts:
  //   - If PARENT_IDS=[FR], containment-issue is reported for rect under FR, NOT under SEC.
  const mock = {
    figma: {
      getNodeByIdAsync: async (id) => {
        if (id === "FR") return frame;
        return null;
      },
    },
  };
  frame.children = [rect];
  const overrides = { PARENT_IDS: ["FR"], OUTPUT_MODE: "json", GATE: "containment", CLIP_WHITELIST: [] };
  const result = JSON.parse(await runFigmaScript(SCRIPT, mock.figma, overrides));
  assert.equal(result.code, "CONTAINMENT_FAIL");
  assert.equal(result.containmentIssues.length, 1);
  assert.equal(result.containmentIssues[0].parentId, "FR");
}
```

- [ ] **Step 2: Run tests to verify they all fail**

Run:
```bash
cd figma-skill && node --test tests/containment-gate.test.mjs
```
Expected: 5 failures, all "expected CONTAINMENT_FAIL" / "expected OK" because the script does not yet know `GATE` or `CLIP_WHITELIST`.

- [ ] **Step 3: Implement `--gate containment` mode in overlap-check.mjs**

Edit `figma-skill/scripts/overlap-check.mjs`. Replace the const block (lines 16–19):

```javascript
  // ===== 在这里改 =====
  const PARENT_IDS = [];
  const OUTPUT_MODE = "json";
  const GATE = ""; // "" | "containment"
  const CLIP_WHITELIST = []; // [{ nodeId, rationale }]
  // ====================
```

Then **insert a new branch BEFORE the existing sibling-overlap loop** (after `allItems.push(...items);` on line 90, before the `for (let i ...)` block):

```javascript
    if (GATE === "containment" && parent.clipsContent) {
      const whitelisted = CLIP_WHITELIST.some((w) => w.nodeId === parent.id);
      if (!whitelisted) {
        for (const item of items) {
          const cb = { x: item.x, y: item.y, width: item.width, height: item.height };
          const pb = parent.absoluteBoundingBox;
          let side = null;
          let overflowPx = 0;
          if (cb.x < pb.x) {
            side = "left";
            overflowPx = pb.x - cb.x;
          } else if (cb.y < pb.y) {
            side = "top";
            overflowPx = pb.y - cb.y;
          } else if (cb.x + cb.width > pb.x + pb.width) {
            side = "right";
            overflowPx = cb.x + cb.width - (pb.x + pb.width);
          } else if (cb.y + cb.height > pb.y + pb.height) {
            side = "bottom";
            overflowPx = cb.y + cb.height - (pb.y + pb.height);
          }
          if (side) {
            const suggestedHeight = pb.height + overflowPx;
            issues.push({
              gate: "Containment",
              severity: "error",
              parentId: parent.id,
              parentName: parent.name,
              childId: item.id,
              childName: item.name,
              side,
              overflowPx,
              suggestedHeight,
              recommendation:
                "Resize parent to height " + suggestedHeight + "px, or add parent.id to plan.md##ClipWhitelist with rationale.",
            });
          }
        }
      }
    }
```

Then modify the **final return** (lines 163–180) to compute `code` and expose `containmentIssues`:

```javascript
  const containmentIssues = issues.filter((i) => i.gate === "Containment");
  const code = containmentIssues.length > 0 ? "CONTAINMENT_FAIL" : "OK";
  return JSON.stringify(
    {
      ok: containmentIssues.length === 0,
      code,
      summary: {
        parents: PARENT_IDS.length,
        totalItems: allItems.length,
        containmentFails: containmentIssues.length,
      },
      issues: issues,
      containmentIssues: containmentIssues,
      observedAt: null,
      total: allItems.length,
    },
    null,
    2,
  );
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd figma-skill && node --test tests/containment-gate.test.mjs
```
Expected: PASS (5 tests, 0 failures).

- [ ] **Step 5: Run regression suite**

Run:
```bash
cd figma-skill && node --test tests/figma-read-helpers.test.mjs tests/figma-validate-bounds.test.mjs tests/workflow-contract.test.mjs
```
Expected: All pre-existing tests still PASS (default `GATE=""` keeps old behavior).

- [ ] **Step 6: Commit**

```bash
git add figma-skill/scripts/overlap-check.mjs figma-skill/tests/containment-gate.test.mjs
git commit -m "feat(figma-skill): add Containment Gate (Gate 7) to overlap-check.mjs"
```

---

## Task 3: Document Gate 7 in `references/geometry-verifier.md`

**Files:**
- Modify: `figma-skill/references/geometry-verifier.md`

**Interfaces:**
- Consumes: existing 6-gate structure
- Produces: new `## Gate 7 — Containment` section with algorithm, whitelist contract, gate semantics table

- [ ] **Step 1: Add Gate 7 section**

Append to `figma-skill/references/geometry-verifier.md` after the existing `## Gate 6 — Visual` section:

```markdown
## Gate 7 — Containment

**Trigger:** any Section / Frame / Component / Instance whose `clipsContent=true` contains at least one child whose `absoluteBoundingBox` is not fully contained in the parent's `absoluteBoundingBox`.

**Algorithm** (lives in `scripts/overlap-check.mjs`, mode `--gate containment`):

```
for parent in (Section | Frame | Component | Instance) on active page:
  if !parent.clipsContent: continue       # not clipping → no risk
  if parent.id in plan.ClipWhitelist[*].nodeId:
    log(INFO, "whitelisted", {parent, rationale: ...})
    continue
  for child in parent.children:
    cb = child.absoluteBoundingBox
    pb = parent.absoluteBoundingBox
    if cb.x < pb.x or cb.y < pb.y
       or cb.x + cb.width  > pb.x + pb.width
       or cb.y + cb.height > pb.y + pb.height:
      side = (left | right | top | bottom) derived from which inequality failed
      overflowPx = max(0, ...)
      suggestedHeight = pb.height + overflowPx
      emit ISSUE({ gate: "Containment", severity: "error", parentId, parentName, childId, childName, side, overflowPx, suggestedHeight, recommendation })
```

**Whitelist contract** — `plan.md` must contain `## ClipWhitelist` if any `clipsContent=true` parent exists. Schema-validated:

```json
"plan.clipWhitelist": {
  "type": "array",
  "items": {
    "type": "object",
    "required": ["nodeId", "rationale"],
    "properties": {
      "nodeId":    { "type": "string" },
      "rationale": { "type": "string", "minLength": 5 }
    }
  }
}
```

**Gate semantics:**

| `clipsContent` | In `ClipWhitelist` | Result |
| - | - | - |
| `false` | n/a | PASS (skip) |
| `true`  | yes | PASS (whitelisted) |
| `true`  | no, with overflowing child | FAIL |
| `true`  | no, no overflowing child | PASS |

**Multi-level nesting:** each parent is independently checked. A grandchild overflowing its child is reported under the *child* (the immediate parent), not the grand-parent. This avoids double-reporting and keeps the FAIL list one-to-one with the offending edge.

**Default policy:** `clipsContent=true` is treated as dangerous. Designers must opt-in via `plan.md##ClipWhitelist` with a `rationale` (min 5 chars) explaining why the clipping is intentional (e.g., scroll containers, internal cards).
```

Also update the top-of-file heading: "六道闸门" → "七道闸门".

- [ ] **Step 2: Verify file reads cleanly**

Run:
```bash
cd figma-skill && wc -l references/geometry-verifier.md
```
Expected: ≥ 100 lines (was ~70).

- [ ] **Step 3: Commit**

```bash
git add figma-skill/references/geometry-verifier.md
git commit -m "docs(figma-skill): document Containment Gate (Gate 7) in geometry-verifier"
```

---

## Task 4: Bump SKILL.md to 2.2 and surface Containment

**Files:**
- Modify: `figma-skill/SKILL.md`

**Interfaces:**
- Consumes: existing SKILL.md v2.1
- Produces: `version: 2.2`; new `ContainmentGate` in I/O Contract Gate list; "六道闸门" → "七道闸门"; new Red Flag entry

- [ ] **Step 1: Bump version field**

Edit `figma-skill/SKILL.md` line 4: `version: 2.1` → `version: 2.2`.

- [ ] **Step 2: Add `ContainmentGate` to I/O Contract Gate list**

In SKILL.md, locate the line starting with "Gate 名：固定的". Replace the gate name list to add `ContainmentGate` (between `GeometryGate` and `CorrectionGate`):

Old: `/ ... / GeometryGate / CorrectionGate / DeliveryGate / SelfReflectionGate`
New: `/ ... / GeometryGate / ContainmentGate / CorrectionGate / DeliveryGate / SelfReflectionGate`

- [ ] **Step 3: Update Workflow 9 sentence from "六道闸门" to "七道闸门"**

In SKILL.md, locate the sentence about Workflow 9闸门. Replace "六道闸门" with "七道闸门" (likely appears once; verify with `grep -n "六道闸门" SKILL.md` before edit).

- [ ] **Step 4: Add Red Flag entry**

In SKILL.md `## Red Flags and Rationalizations`, add a new bullet:

```
- "重名同 parent 节点必须 FAIL 或显式 `--reuse`，不得静默新建。"（与 Task 5 配套）
```

- [ ] **Step 5: Verify YAML frontmatter is valid**

Run:
```bash
cd figma-skill && head -10 SKILL.md
```
Expected: First line is `---`, second line has `name: figma-skill`, third has `model: sonnet`, fourth has `version: 2.2`.

- [ ] **Step 6: Commit**

```bash
git add figma-skill/SKILL.md
git commit -m "feat(figma-skill): bump to v2.2 — surface Containment Gate in workflow contract"
```

---

## Task 5: Update `references/planning.md` Required Fields

**Files:**
- Modify: `figma-skill/references/planning.md`

**Interfaces:**
- Consumes: existing "Required Fields Quick Map" section
- Produces: `ClipWhitelist` (schema-validated) and `WriteOrder` (human-readable) entries added to the map

- [ ] **Step 1: Locate "Required Fields Quick Map"**

Run:
```bash
cd figma-skill && grep -n "Required Fields Quick Map" references/planning.md
```
Expected: line number near 146 (per spec reference).

- [ ] **Step 2: Add `ClipWhitelist` and `WriteOrder` rows**

In `references/planning.md`, find the Quick Map table and append two rows:

```markdown
| `plan.clipWhitelist` | array | 否（可省略，省略视作 `[]`） | Section/Frame/Component 含 `clipsContent=true` 时必填；每项 `{ nodeId, rationale }` 且 `rationale.length >= 5` |
| `plan.writeOrder` | markdown section | 否 | `## WriteOrder` 段，列出 `figma-cli create.*` 调用顺序，便于 `--check-exists` 复用已声明节点 |
```

- [ ] **Step 3: Add explanatory subsection**

After the Quick Map table, append:

```markdown
### ClipWhitelist

When any `clipsContent=true` container exists in the design, `plan.md` MUST contain a `## ClipWhitelist` table:

```markdown
## ClipWhitelist

| nodeId | rationale |
| ------ | --------- |
| 1741:439 | Library preview card — internal scroll is intentional |
```

Validation: schema enforces `nodeId` non-empty and `rationale.length >= 5`. Absent section is treated as `[]` and triggers Containment Gate FAIL.

### WriteOrder

`## WriteOrder` is a human-readable section only (no schema field). Order of `figma-cli create.*` calls the agent intends to make:

```markdown
## WriteOrder

1. figma-cli create section --name "News Section" --parent <pageId>
2. figma-cli create frame --name "News Hero" --parent <newsSectionId> --check-exists
3. figma-cli create component --name "NewsCard" --parent <libraryPageId> --check-exists --reuse
```

When `--check-exists` is invoked and the agent has `WriteOrder` declared, the agent MAY reuse any node already declared in `WriteOrder` (matched by `name + parent`).
```

- [ ] **Step 4: Commit**

```bash
git add figma-skill/references/planning.md
git commit -m "docs(figma-skill): add ClipWhitelist and WriteOrder to planning Required Fields"
```

---

## Task 6: Document `--check-exists` contract in `references/execution.md`

**Files:**
- Modify: `figma-skill/references/execution.md`

**Interfaces:**
- Consumes: existing execution reference
- Produces: new `## Write order & --check-exists` section documenting the four flags

- [ ] **Step 1: Locate insertion point**

Run:
```bash
cd figma-skill && grep -n "^##" references/execution.md
```
Pick a logical insertion point (e.g., after `## 原子化批次` if it exists, or before `## Final summary`).

- [ ] **Step 2: Add new section**

Append the following section to `references/execution.md`:

```markdown
## Write order & `--check-exists` (v2.2+)

`figma-cli create.*` subcommands that produce a single named node (`create section`, `create frame`, `create component`, `create instance`, `create rectangle`, `create ellipse`, `create text`) accept four flags:

| Flag | Default | Effect |
| - | - | - |
| `--check-exists` | off | Probe `(name, parent)` before creating |
| `--reuse` | off | Allow reuse of existing node (must pair with `--check-exists`) |
| `--strict` | off | Duplicate is a hard abort (no `--reuse` rescue) |
| `--rename <new-name>` | off | Retry with new name on duplicate (must pair with `--check-exists`) |

### Behavior matrix

```
figma-cli create section --name "X" --parent P --check-exists
  ├─ not found → create normally, return new nodeId
  ├─ found, no --reuse → return { status: "DUPLICATE", code: "DUPLICATE_NODE",
  │                                existingId, existingName, parent,
  │                                message: "..." }, exit 3
  ├─ found, --reuse → skip create, return existingId with { reused: true }, exit 0
  └─ found, --strict → abort (no --reuse allowed), exit 4
```

### Agent workflow integration

1. Declare `## WriteOrder` in `plan.md` listing intended `create.*` calls.
2. Use `--check-exists` on every `create.*` that might collide with prior daemon retries.
3. Default to `--reuse` only if the agent has confirmed via live read that the existing node has the intended shape. Otherwise, prefer FAIL + manual review.
4. Never pass `--reuse` without first reading the existing node's children and structure.

### Failure recovery

When `--check-exists` returns `DUPLICATE` (exit 3):

- If `WriteOrder` already declared this node: read it via `figma-cli get <id>`, verify structure, then re-issue with `--reuse`.
- If `WriteOrder` did not declare this node: this is a real duplicate — STOP, report to user, do NOT auto-resolve.
- If `--rename` was passed: retry automatically with new name.

### Red Flag

> "重名同 parent 节点必须 FAIL 或显式 `--reuse`，不得静默新建。"

This is enforced by default. The only way to bypass is explicit `--reuse` after live re-read.
```

- [ ] **Step 3: Commit**

```bash
git add figma-skill/references/execution.md
git commit -m "docs(figma-skill): document --check-exists / --reuse / --strict / --rename contract"
```

---

## Task 7: Create stub-figma-cli helper for idempotency tests

**Files:**
- Create: `figma-skill/tests/helpers/stub-figma-cli.mjs`

**Interfaces:**
- Consumes: command-line arguments matching `figma-cli create section --name X --parent Y [--check-exists] [--reuse] [--strict] [--rename Z]`
- Produces: exit code + JSON output matching the spec behavior matrix

- [ ] **Step 1: Create stub script**

Create `figma-skill/tests/helpers/stub-figma-cli.mjs`:

```javascript
#!/usr/bin/env node
// tests/helpers/stub-figma-cli.mjs
//
// Stub figma-cli for idempotency contract tests. Records calls to
// .figma-stub-state.json so successive invocations can simulate "node already exists".
//
// Usage: node tests/helpers/stub-figma-cli.mjs create section --name "X" --parent Y [--check-exists] [--reuse] [--strict] [--rename Z]
//
// State file: tests/helpers/.figma-stub-state.json
//   { nodes: [{ id, name, parent }] }
//
// Exit codes:
//   0 — created or reused
//   3 — DUPLICATE (default with --check-exists, no --reuse)
//   4 — STRICT_ABORT (--strict + duplicate)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(__dirname, ".figma-stub-state.json");

function loadState() {
  if (!existsSync(STATE_PATH)) return { nodes: [] };
  return JSON.parse(readFileSync(STATE_PATH, "utf8"));
}

function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}

const [, , cmd, subCmd, ...rest] = process.argv;

if (cmd !== "create") {
  console.error("stub-figma-cli: only `create` subcommand supported in stub");
  process.exit(2);
}

if (subCmd !== "section" && subCmd !== "frame" && subCmd !== "component") {
  console.error("stub-figma-cli: only section/frame/component subcommands supported");
  process.exit(2);
}

const flags = parseFlags(rest);
const { name, parent, checkExists, reuse, strict, rename } = {
  name: flags.name,
  parent: flags.parent,
  checkExists: !!flags["check-exists"],
  reuse: !!flags.reuse,
  strict: !!flags.strict,
  rename: flags.rename,
};

if (!name || !parent) {
  console.error("stub-figma-cli: --name and --parent required");
  process.exit(2);
}

const state = loadState();
const existing = state.nodes.find((n) => n.name === name && n.parent === parent);

if (checkExists && existing) {
  if (strict) {
    console.error("STRICT_ABORT: duplicate detected under strict mode");
    process.exit(4);
  }
  if (reuse) {
    process.stdout.write(JSON.stringify({ reused: true, existingId: existing.id }, null, 2));
    process.exit(0);
  }
  process.stdout.write(JSON.stringify({
    status: "DUPLICATE",
    code: "DUPLICATE_NODE",
    existingId: existing.id,
    existingName: existing.name,
    parent: existing.parent,
    message: "node already exists; pass --reuse to bind, --rename <name> to create, or remove the existing one first",
  }, null, 2));
  process.exit(3);
}

// Either no check-exists, or check-exists but no existing node.
if (rename && checkExists) {
  // Retry with new name.
  const newName = rename;
  const newExisting = state.nodes.find((n) => n.name === newName && n.parent === parent);
  if (newExisting) {
    process.stdout.write(JSON.stringify({
      status: "DUPLICATE", code: "DUPLICATE_NODE",
      existingId: newExisting.id, existingName: newExisting.name, parent,
      message: "renamed target also exists",
    }, null, 2));
    process.exit(3);
  }
  const id = "stub-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
  state.nodes.push({ id, name: newName, parent });
  saveState(state);
  process.stdout.write(JSON.stringify({ created: true, id, name: newName, parent }, null, 2));
  process.exit(0);
}

const id = "stub-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
state.nodes.push({ id, name, parent });
saveState(state);
process.stdout.write(JSON.stringify({ created: true, id, name, parent }, null, 2));
process.exit(0);
```

- [ ] **Step 2: Verify stub runs**

Run:
```bash
cd figma-skill && rm -f tests/helpers/.figma-stub-state.json
node tests/helpers/stub-figma-cli.mjs create section --name "Test" --parent "P1"
echo "Exit: $?"
cat tests/helpers/.figma-stub-state.json
```
Expected: Exit 0, JSON `{ created: true, ... }`, state file has 1 node.

Run again:
```bash
cd figma-skill && node tests/helpers/stub-figma-cli.mjs create section --name "Test" --parent "P1" --check-exists
echo "Exit: $?"
```
Expected: Exit 3, JSON `DUPLICATE`.

Run with `--reuse`:
```bash
cd figma-skill && node tests/helpers/stub-figma-cli.mjs create section --name "Test" --parent "P1" --check-exists --reuse
echo "Exit: $?"
```
Expected: Exit 0, JSON `{ reused: true, existingId: ... }`.

- [ ] **Step 3: Commit**

```bash
git add figma-skill/tests/helpers/stub-figma-cli.mjs
git commit -m "test(figma-skill): add stub-figma-cli helper for idempotency contract tests"
```

---

## Task 8: Write idempotency tests using stub-figma-cli

**Files:**
- Create: `figma-skill/tests/write-idempotency.test.mjs`

**Interfaces:**
- Consumes: stub-figma-cli.mjs, .figma-stub-state.json
- Produces: 4 sub-tests verifying the spec behavior matrix

- [ ] **Step 1: Write failing tests**

Create `figma-skill/tests/write-idempotency.test.mjs`:

```javascript
import { execFileSync } from "node:child_process";
import { rmSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STUB = join(__dirname, "helpers", "stub-figma-cli.mjs");
const STATE = join(__dirname, "helpers", ".figma-stub-state.json");

function resetState() {
  if (existsSync(STATE)) rmSync(STATE);
}

function runStub(args) {
  return execFileSync("node", [STUB, ...args], { encoding: "utf8" });
}

beforeEach(() => resetState());

test("--check-exists + no existing → exit 0, new id", () => {
  resetState();
  const out = runStub(["create", "section", "--name", "News", "--parent", "P1", "--check-exists"]);
  const result = JSON.parse(out);
  assert.equal(result.created, true);
  assert.ok(result.id);
});

test("--check-exists + existing → exit 3, DUPLICATE payload", () => {
  resetState();
  runStub(["create", "section", "--name", "News", "--parent", "P1"]);
  let exitCode = 0;
  let out = "";
  try {
    out = runStub(["create", "section", "--name", "News", "--parent", "P1", "--check-exists"]);
  } catch (e) {
    exitCode = e.status;
    out = e.stdout.toString();
  }
  assert.equal(exitCode, 3);
  const result = JSON.parse(out);
  assert.equal(result.status, "DUPLICATE");
  assert.equal(result.code, "DUPLICATE_NODE");
  assert.ok(result.existingId);
});

test("--check-exists --reuse + existing → exit 0, reused:true", () => {
  resetState();
  const first = JSON.parse(runStub(["create", "section", "--name", "News", "--parent", "P1"]));
  const out = runStub(["create", "section", "--name", "News", "--parent", "P1", "--check-exists", "--reuse"]);
  const result = JSON.parse(out);
  assert.equal(result.reused, true);
  assert.equal(result.existingId, first.id);
});

test("--check-exists --strict + existing → exit 4", () => {
  resetState();
  runStub(["create", "section", "--name", "News", "--parent", "P1"]);
  let exitCode = 0;
  try {
    runStub(["create", "section", "--name", "News", "--parent", "P1", "--check-exists", "--strict"]);
  } catch (e) {
    exitCode = e.status;
  }
  assert.equal(exitCode, 4);
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run:
```bash
cd figma-skill && node --test tests/write-idempotency.test.mjs
```
Expected: PASS (4 tests, 0 failures).

- [ ] **Step 3: Commit**

```bash
git add figma-skill/tests/write-idempotency.test.mjs
git commit -m "test(figma-skill): verify --check-exists / --reuse / --strict contract via stub"
```

---

## Task 9: Full regression run + green-results update

**Files:**
- Modify: `figma-skill/tests/green-results.md`
- Modify: `figma-skill/tests/v2-green-results.md`

**Interfaces:**
- Consumes: existing test files
- Produces: re-recorded green-results showing all 4 new test files passing alongside existing tests

- [ ] **Step 1: Run full test suite**

Run:
```bash
cd figma-skill && node --test tests/
```
Expected: All test files pass. Capture the output.

- [ ] **Step 2: Update `tests/green-results.md`**

Append a new section at the bottom of `figma-skill/tests/green-results.md`:

```markdown
## v2.2 remediation — 2026-07-15

New test files:
- tests/task-state-schema.test.mjs (3 tests, schema clipWhitelist)
- tests/containment-gate.test.mjs (5 fixtures)
- tests/write-idempotency.test.mjs (4 sub-tests via stub-figma-cli)

Total tests run: <N>. Pass: <N>. Fail: 0.

New helper:
- tests/helpers/stub-figma-cli.mjs (records state to .figma-stub-state.json)

Regression: all v2.1 tests still green.
```

Replace `<N>` with the actual count.

- [ ] **Step 3: Update `tests/v2-green-results.md` similarly**

Append the same v2.2 section to `tests/v2-green-results.md`.

- [ ] **Step 4: Commit**

```bash
git add figma-skill/tests/green-results.md figma-skill/tests/v2-green-results.md
git commit -m "test(figma-skill): record v2.2 green run results"
```

---

## Task 10: Final commit, version tag, push

**Files:**
- Modify: none (final review + push)

- [ ] **Step 1: Verify version is 2.2**

Run:
```bash
cd figma-skill && head -10 SKILL.md
```
Expected: `version: 2.2` on line 4.

- [ ] **Step 2: Verify no uncommitted changes**

Run:
```bash
cd /d/ai-skills && git status
```
Expected: clean working tree.

- [ ] **Step 3: Tag v2.2**

Run:
```bash
cd /d/ai-skills && git tag -a figma-skill-v2.2 -m "figma-skill v2.2 — Containment Gate + write-action idempotency"
```

- [ ] **Step 4: Push to origin main**

Run:
```bash
cd /d/ai-skills && git push origin main --follow-tags
```
Expected: push succeeds; sync-skills.mjs hook fires (best-effort, non-blocking).

- [ ] **Step 5: Verify push**

Run:
```bash
cd /d/ai-skills && git log --oneline -12 origin/main
```
Expected: 10 new commits visible on origin/main, ending with the green-results update.

---

## Self-Review (post-write)

**Spec coverage check** (against `docs/superpowers/specs/2026-07-15-figma-skill-v2-remediation-design.md`):

| Spec section | Covered by |
| - | - |
| §5.1 Containment Gate algorithm | Task 2 (impl) + Task 3 (doc) |
| §5.1 Whitelist contract | Task 1 (assertValidPlan helper) + Task 5 (planning.md) |
| §5.1 Multi-level nesting | Task 2 Fixture 5 |
| §5.2 `--check-exists` behavior | Task 7 (stub) + Task 8 (tests) |
| §5.2 `--reuse` / `--strict` / `--rename` flags | Task 7 (stub impl) + Task 8 (tests) |
| §5.3 Version bump 2.1 → 2.2 | Task 4 |
| §6 Affected Files (8 files) | Tasks 1–7 cover all 8 |
| §7 Test Strategy (5 + 4 = 9) | Tasks 1 (3) + 2 (5) + 8 (4) = 12 tests, exceeding 9 |
| §8 Migration compatibility | Implicit: Tasks 2, 7 keep default off |
| §10 Acceptance Criteria (7) | Tasks 1–10 collectively |

**Placeholder scan:** Searched for "TBD", "TODO", "implement later", "appropriate", "edge cases" — none present in the plan body.

**Type consistency:**
- `containmentIssues` field — used consistently in Tasks 2, 3.
- `parent.id`, `parent.name`, `child.id`, `child.name` — consistent.
- `clipWhitelist` schema — Task 1 (schema) matches Task 5 (planning.md) matches Task 6 (execution.md).
- Exit codes 3 / 4 — consistent in Tasks 6, 7, 8.

**One gap noted inline:** Task 9 references `tests/` glob, but Node's `--test tests/` does not recurse without the right flag. Verify with `node --test --test-name-pattern="" tests/*.test.mjs` if the simple glob fails. This is documented in the step, not fixed preemptively, because shell behavior varies.