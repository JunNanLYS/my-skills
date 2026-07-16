import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(join(root, name), "utf8").replace(/\r\n/g, "\n");

const refs = {
  state: read("references/state-and-recovery.md"),
  execution: read("references/execution.md"),
  validation: read("references/validation.md"),
  reflection: read("references/self-reflection.md"),
  geometry: read("references/geometry-verifier.md"),
  naming: read("references/naming.md"),
  installation: read("references/installation.md"),
};

const joined = Object.values(refs).join("\n");

test("state-and-recovery.md uses PlanWeave as state authority", () => {
  assert.match(refs.state, /PlanWeave[\s\S]{0,100}state authority/);
  for (const cmd of [
    "planweave status",
    "planweave current",
    "planweave claim",
    "planweave prompt",
    "planweave submit",
    "plan-recovery",
  ]) {
    assert.ok(refs.state.includes(cmd), `missing state command marker: ${cmd}`);
  }
  assert.match(refs.state, /needs_changes[\s\S]{0,120}targetBlock/);
  assert.match(refs.state, /live-revalidate/);
});

test("execution.md preserves figma-cli command truth and eval-run six fields", () => {
  assert.match(refs.execution, /figma-cli <command>/);
  assert.match(refs.execution, /figma-cli <command> <subcommand> --help/);
  for (const field of [
    "NativeHelpChecked",
    "MissingNativeCapability",
    "TargetNodeIds",
    "FallbackCodeScope",
    "FallbackImpact",
    "GeometryReaudit",
  ]) {
    assert.ok(refs.execution.includes(field), `${field} missing`);
  }
  assert.match(refs.execution, /Pre-write Live Revalidation Block/);
});

test("validation.md feeds PlanWeave review and uses planweave screenshot refs", () => {
  assert.match(refs.validation, /PlanWeave Final Review Gate/);
  assert.match(refs.validation, /\.figma\/screenshot\/<planweave-ref>/);
  assert.match(refs.validation, /actual visual inspection|实际打开/);
  assert.match(refs.validation, /Correction Block/);
  assert.match(refs.validation, /Delivery Block/);
});

test("self-reflection.md writes feedback artifact without task ledger helper", () => {
  assert.match(refs.reflection, /Self-Reflection Block/);
  assert.match(refs.reflection, /\.figma\/feedback\/<timestamp>\.md/);
  assert.match(refs.reflection, /# figma-skill v3\.0 Self-Reflection/);
  assert.doesNotMatch(refs.reflection, /figma-task-state\.mjs\s+reflect/);
  assert.doesNotMatch(refs.reflection, /events\.jsonl|archiveStatus|lease/);
});

test("geometry-verifier.md preserves seven gates and points visual artifacts to planweave-ref", () => {
  const order = [
    "Gate 1 — Lint",
    "Gate 2 — Duplicate-Origin",
    "Gate 3 — Top-Level AABB",
    "Gate 4 — Scoped Children AABB",
    "Gate 5 — Variant Parity",
    "Gate 6 — Visual",
    "Gate 7 — Containment",
  ];
  let cursor = -1;
  for (const marker of order) {
    const next = refs.geometry.indexOf(marker);
    assert.ok(next > cursor, `${marker} missing or out of order`);
    cursor = next;
  }
  assert.match(refs.geometry, /\.figma\/screenshot\/<planweave-ref>/);
});

test("naming and installation references no longer mention v2 workflow routing", () => {
  assert.doesNotMatch(refs.naming, /Workflow\s+[0-9A-I]/);
  assert.match(refs.naming, /PlanWeave/);
  assert.match(refs.installation, /Pre-Spec Context Gate/);
});

test("runtime references do not teach active old ledger commands", () => {
  assert.doesNotMatch(joined, /figma-task-state\.mjs\s+(init-project|create|checkpoint|todo-update|validate|archive|close|reflect)/);
  assert.doesNotMatch(joined, /\.figma\/tasks\/<task-id>\//);
  assert.doesNotMatch(joined, /state\.validation\.visual\.summary/);
  assert.doesNotMatch(joined, /archiveStatus\s*=?\s*(ARCHIVED|ARCHIVE_FAILED)/);
  assert.doesNotMatch(joined, /lease\.json/);
  assert.doesNotMatch(joined, /events\.jsonl/);
});
