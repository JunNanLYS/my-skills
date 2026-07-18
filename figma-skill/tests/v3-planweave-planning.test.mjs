import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(join(root, name), "utf8").replace(/\r\n/g, "\n");
const planning = read("references/planning.md");
const designSystem = read("references/design-system.md");

test("planning.md defines Pre-Spec Context Gate before any spec drafting", () => {
  assert.match(planning, /## Pre-Spec Context Gate/);
<<<<<<< HEAD
  assert.match(planning, /before spec drafting[\s\S]{0,500}docs\/FIGMA_DESIGN_SYSTEM\.md/);
  assert.match(planning, /figma-cli --version[\s\S]{0,160}figma-cli --help[\s\S]{0,160}figma-cli status/);
  assert.match(planning, /Live Figma Context[\s\S]{0,160}Before spec drafting/);
  assert.doesNotMatch(planning, /Step 1:\s*read\s+FIGMA_DESIGN_SYSTEM\.md[\s\S]{0,80}implementation plan/i);
});

test("planning.md defines required Spec Canvas blocks", () => {
  for (const marker of [
    "Requirements Discovery Block",
    "Design System Context Block",
    "Figma Live Context Block",
    "Spec Draft Block",
    "Spec Review Gate",
  ]) {
    assert.ok(planning.includes(marker), `missing spec canvas marker: ${marker}`);
  }
});

test("planning.md defines required Implementation Canvas blocks", () => {
  for (const marker of [
    "Plan Draft Block",
    "Plan Review Gate",
    "Pre-write Live Revalidation Block",
    "Figma Write Blocks",
    "Geometry Validation Block",
    "Correction Block",
    "Visual Validation Block",
    "Final Review Gate",
    "Delivery Block",
    "Self-Reflection Block",
  ]) {
    assert.ok(planning.includes(marker), `missing implementation canvas marker: ${marker}`);
  }
});

test("planning.md requires fixed final blocks and rework routing", () => {
  assert.match(planning, /Fixed Final Blocks as Plan Lint/);
  assert.match(planning, /\.figma\/screenshot\/<planweave-ref>/);
  assert.match(planning, /\.figma\/feedback\/<timestamp>\.md/);
  assert.match(planning, /rework route/);
  assert.match(planning, /fails Plan Review/);
});

test("planning.md defines structured pass needs_changes review output", () => {
  assert.match(planning, /result:\s*pass \| needs_changes/);
  assert.match(planning, /targetBlock:/);
  assert.match(planning, /reason:/);
  assert.match(planning, /requiredChange:/);
});

test("planning.md does not teach old task ledger plan construction", () => {
  assert.doesNotMatch(planning, /figma-task-state\.mjs\s+(init-project|create|checkpoint|todo-update|validate)/);
  assert.doesNotMatch(planning, /\.figma\/tasks\/<task-id>\//);
  assert.doesNotMatch(planning, /state\.json|events\.jsonl|lease\.json|archiveStatus/);
  assert.doesNotMatch(planning, /Task\.currentWorkflow|GateStatus/);
});

test("design-system.md marks design-system work as pre-spec and not Figma approval", () => {
  assert.match(designSystem, /Pre-Spec Context Gate/);
  assert.match(designSystem, /docs\/FIGMA_DESIGN_SYSTEM\.md/);
  assert.match(designSystem, /before spec drafting/);
  assert.match(designSystem, /Design-system approval does not authorize Figma writes/);
});
