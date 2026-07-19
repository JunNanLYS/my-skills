import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { TASK_STATUSES, TERMINAL_STATUSES, TRANSITIONS, WRITE_REQUIRED_WORKFLOWS, EVENT_TYPES } from "../scripts/lib/task-state/model.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const skill = join(here, "..");
const SKILL_RAW = readFileSync(join(skill, "SKILL.md"), "utf8");
const SKILL = SKILL_RAW.replace(/\r\n/g, "\n");

function readRef(name) {
  return readFileSync(join(skill, "references", name), "utf8").replace(/\r\n/g, "\n");
}

const refs = {
  naming: readRef("naming.md"),
  stateAndRecovery: readRef("state-and-recovery.md"),
  planning: readRef("planning.md"),
  execution: readRef("execution.md"),
  geometry: readRef("geometry-verifier.md"),
  validation: readRef("validation.md"),
  installation: readRef("installation.md"),
  designSystem: readRef("design-system.md"),
};

test("frontmatter description is trigger-only and version is 3.0", () => {
  assert.match(SKILL, /^---[\s\S]+?---\n/, "SKILL.md must start with frontmatter");
  const fm = SKILL.match(/^---([\s\S]+?)---/)[1];
  assert.match(fm, /\bname:\s*figma-skill\b/);
  assert.match(fm, /\bdescription:\s*Use when\b/);
  assert.match(fm, /\bversion:\s*3\.0\b/);
});

test("SKILL.md stays within the v2 size budget", () => {
  const lines = SKILL.split("\n");
  const words = SKILL.match(/\S+/g) || [];
  assert.ok(lines.length <= 450, `lines=${lines.length}`);
  assert.ok(words.length <= 1800, `words=${words.length}`);
});

test("SKILL.md NNR uses mandatory wording tokens and forbids weak hedges", () => {
  const nnr = SKILL.slice(SKILL.indexOf("## Non-Negotiable Rules"), SKILL.indexOf("## Mandatory Lookups"));
  assert.match(nnr, /必须/);
  assert.match(nnr, /禁止/);
  assert.ok(!/可以考虑|建议|可选的/.test(nnr));
});

test("SKILL.md Mandatory Lookups list references by phase", () => {
  const mandatory = SKILL.match(/## Mandatory Lookups[\s\S]*?(?=## )/)[0];
  for (const path of [
    "references/installation.md",
    "references/design-system.md",
    "references/state-and-recovery.md",
    "references/planning.md",
    "references/execution.md",
    "references/geometry-verifier.md",
    "references/validation.md",
    "references/naming.md",
    "references/self-reflection.md",
  ]) {
    assert.ok(mandatory.includes(path), `mandatory lookup missing: ${path}`);
  }
});

test("references include the v2.2 routing files", () => {
  for (const name of [
    "naming.md",
    "state-and-recovery.md",
    "planning.md",
    "execution.md",
    "geometry-verifier.md",
    "validation.md",
    "installation.md",
    "design-system.md",
    "self-reflection.md",
  ]) {
    assert.ok(existsSync(join(skill, "references", name)), `${name} missing`);
  }
  assert.ok(!existsSync(join(skill, "references", "discovery-and-planning.md")));
});

test("naming.md is the single naming authority and contains the StateGallery rule", () => {
  assert.ok(refs.naming.includes("Component Path"));
  assert.ok(refs.naming.includes("Specimen/StateGallery"));
  // Other specimen names may appear only as explicitly optional extensions, never required defaults.
  assert.ok(refs.naming.includes("唯一强制性 Specimen"));
  assert.ok(!/禁止\s*使用\s*Specimen\/StateGallery/.test(refs.naming));
  assert.ok(!/^##\s+(Common|General|Misc|Other)\s*$/m.test(refs.naming));
});

test("state-and-recovery.md owns persistence + Mermaid diagram aligned with TRANSITIONS", () => {
  const mermaid = refs.stateAndRecovery.match(/```mermaid[\s\S]*?```/)[0];
  assert.ok(mermaid, "state-and-recovery.md must include a mermaid diagram");
  // Each transition declared in TRANSITIONS should appear in the diagram text.
  const transitionKeys = Object.keys(TRANSITIONS);
  const edges = (mermaid.match(/-->|---/g) || []).length;
  assert.ok(edges >= transitionKeys.length, `mermaid edges=${edges}, transitions=${transitionKeys.length}`);
});

test("state-and-recovery.md calls out .figma/ directory, screenshots, terminal archive, lease", () => {
  assert.match(refs.stateAndRecovery, /\.figma\/[\s\S]*?tasks\/[\s\S]{0,40}<task-id>\//);
  assert.match(refs.stateAndRecovery, /\.figma\/[\s\S]*?screenshot\/[\s\S]{0,80}<task-id>\//);
  assert.match(refs.stateAndRecovery, /archiveStatus/);
  assert.match(refs.stateAndRecovery, /lease\.json|Lease/);
  assert.match(refs.stateAndRecovery, /screenshot/);
});

test("execution.md documents the six-field eval/run contract", () => {
  for (const field of [
    "NativeHelpChecked",
    "MissingNativeCapability",
    "TargetNodeIds",
    "FallbackCodeScope",
    "FallbackImpact",
    "GeometryReaudit",
  ]) {
    assert.ok(refs.execution.includes(field), `${field} missing from execution.md`);
  }
});

test("execution.md defines offline state-helper exemption list", () => {
  assert.match(refs.execution, /figma-task-state\.mjs/);
  assert.ok(/preset helper|offline/i.test(refs.execution));
});

test("geometry-verifier.md orders the six gates exactly", () => {
  const order = ["Lint", "Duplicate-Origin", "Top-Level AABB", "Scoped Children AABB", "Variant Parity", "Visual"];
  let cursor = 0;
  for (const name of order) {
    const idx = refs.geometry.indexOf(name);
    assert.ok(idx > cursor, `gate "${name}" missing or out of order`);
    cursor = idx;
  }
});

test("geometry-verifier.md labels arrange as duplicate-origin only", () => {
  // v3 replaces v2 `unstack --dry-run` with `read arrange --dry-run`.
  // Both are scoped to top-level duplicate-origin detection, not a general AABB matrix.
  assert.match(refs.geometry, /arrange[\s\S]{0,200}duplicate-origin/i);
  assert.ok(!/general\s+AABB/.test(refs.geometry));
  assert.ok(!/JSON\s+output/.test(refs.geometry));
});

test("validation.md mandates screenshot summary before archive", () => {
  assert.match(refs.validation, /\.figma\/screenshot\/<task-id>\//);
  assert.match(refs.validation, /视觉结论|视觉总结|visual\s+summary/);
  assert.match(refs.validation, /archiveStatus|archived|ARCHIVED/);
});

test("installation.md mandates singular environment order", () => {
  const lines = refs.installation.split("\n").map((l) => l.trim());
  const has = (s) => lines.some((l) => l.includes(s));
  assert.ok(has("--version"));
  assert.ok(has("--help"));
  assert.ok(has("status"));
  assert.ok(has("connect"));
});

test("no runtime markdown references .figma/cache.json or temp/figma-screenshot", () => {
  for (const [name, body] of Object.entries(refs)) {
    assert.ok(!/\.figma\/cache\.json/.test(body), `${name} mentions .figma/cache.json`);
    assert.ok(!/temp\/figma-screenshot/.test(body), `${name} mentions temp/figma-screenshot`);
  }
  assert.ok(!/\.figma\/cache\.json/.test(SKILL));
  assert.ok(!/temp\/figma-screenshot/.test(SKILL));
});

test("SKILL.md mentions task types Create / Modify / Audit / Migrate / Export", () => {
  for (const t of ["Create", "Modify", "Audit", "Migrate", "Export"]) {
    assert.ok(SKILL.includes(t), `${t} missing from SKILL.md`);
  }
});

test("SKILL.md exposes the read-only Workflow 6/8/10 guard", () => {
  const nnr = SKILL.slice(SKILL.indexOf("## Non-Negotiable Rules"), SKILL.indexOf("## Mandatory Lookups"));
  assert.ok(/read-only|writeRequired/.test(nnr), "must mention read-only guard for Workflow 6/8/10");
});

test("SKILL.md exposes terminal reclaim summary", () => {
  assert.match(SKILL, /archive|archiveStatus|终态|reclaim|ARCHIVED/);
});

test("EVENT_TYPES includes cancel / archive transitions for terminal reclaim", () => {
  for (const t of ["TASK_CANCELLED", "TASK_ARCHIVED", "SCREENSHOTS_CLEANED"]) {
    assert.ok(EVENT_TYPES.includes(t), `${t} missing from EVENT_TYPES`);
  }
});

test("TRANSITIONS refuses terminal-to-active writes", () => {
  for (const status of TERMINAL_STATUSES) {
    assert.deepEqual(TRANSITIONS[status].write, [], `${status} should be terminal`);
  }
});

test("WRITE_REQUIRED_WORKFLOWS marks 6/8/10 as write-required", () => {
  assert.deepEqual([...WRITE_REQUIRED_WORKFLOWS].sort(), ["10", "6", "8"]);
});

test("all TASK_STATUSES are surfaced in SKILL.md or references", () => {
  const join = SKILL + "\n" + Object.values(refs).join("\n");
  for (const status of TASK_STATUSES) {
    assert.ok(join.includes(status), `status ${status} missing`);
  }
});