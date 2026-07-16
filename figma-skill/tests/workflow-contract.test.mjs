import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const skillRoot = join(here, "..");
const read = (name) => readFileSync(join(skillRoot, name), "utf8").replace(/\r\n/g, "\n");
const skill = read("SKILL.md");
const refs = {
  planning: read("references/planning.md"),
  state: read("references/state-and-recovery.md"),
  execution: read("references/execution.md"),
  geometry: read("references/geometry-verifier.md"),
  validation: read("references/validation.md"),
  designSystem: read("references/design-system.md"),
  selfReflection: read("references/self-reflection.md"),
  naming: read("references/naming.md"),
  installation: read("references/installation.md"),
};
const joined = `${skill}\n${Object.values(refs).join("\n")}`;

test("frontmatter description is trigger-only and version is 3.0", () => {
  assert.match(skill, /^---[\s\S]+?---\n/);
  const fm = skill.match(/^---([\s\S]+?)---/)[1];
  assert.match(fm, /\bname:\s*figma-skill\b/);
  assert.match(fm, /\bdescription:\s*Use when\b/);
  assert.match(fm, /\bversion:\s*3\.0\b/);
});

test("SKILL.md stays compact", () => {
  const lines = skill.split("\n");
  const words = skill.match(/\S+/g) || [];
  assert.ok(lines.length <= 260, `lines=${lines.length}`);
  assert.ok(words.length <= 1900, `words=${words.length}`);
});

test("PlanWeave owns workflow and figma-cli owns Figma facts", () => {
  assert.match(joined, /PlanWeave[\s\S]{0,120}workflow authority/);
  assert.match(joined, /figma-cli[\s\S]{0,120}Figma fact and mutation authority/);
});

test("Pre-Spec Context Gate is before spec drafting", () => {
  assert.match(joined, /Pre-Spec Context Gate/);
  assert.match(joined, /docs\/FIGMA_DESIGN_SYSTEM\.md[\s\S]{0,160}before spec drafting/);
  assert.match(joined, /live Figma context[\s\S]{0,160}before spec drafting/);
});

test("PlanWeave canvases and final blocks are documented", () => {
  for (const marker of [
    "Spec Canvas",
    "Implementation Canvas",
    "Requirements Discovery Block",
    "Spec Review Gate",
    "Plan Review Gate",
    "Pre-write Live Revalidation Block",
    "Geometry Validation Block",
    "Correction Block",
    "Visual Validation Block",
    "Final Review Gate",
    "Delivery Block",
    "Self-Reflection Block",
  ]) {
    assert.ok(joined.includes(marker), `missing marker: ${marker}`);
  }
});

test("review gates require structured needs_changes routing", () => {
  assert.match(joined, /result:\s*pass \| needs_changes/);
  assert.match(joined, /targetBlock:/);
  assert.match(joined, /requiredChange:/);
});

test("old task ledger implementation is absent", () => {
  for (const removed of [
    "scripts/figma-task-state.mjs",
    "scripts/lib/task-state/model.mjs",
    "schemas/task-state.schema.json",
    "schemas/event.schema.json",
    "schemas/index.schema.json",
    "schemas/config.schema.json",
  ]) {
    assert.ok(!existsSync(join(skillRoot, removed)), `${removed} should be deleted`);
  }
});

test("runtime docs do not teach active ledger commands", () => {
  assert.doesNotMatch(joined, /figma-task-state\.mjs\s+(init-project|create|checkpoint|validate|archive|reflect)/);
  assert.doesNotMatch(joined, /\.figma\/tasks\/<task-id>\//);
  assert.doesNotMatch(joined, /state\.validation\.visual\.summary/);
  assert.doesNotMatch(joined, /archiveStatus\s*=?\s*(ARCHIVED|ARCHIVE_FAILED)/);
});

test("preserved Figma invariants remain documented", () => {
  for (const marker of [
    "Figma MCP",
    "figma-cli --version",
    "figma-cli --help",
    "figma-cli status",
    "NativeHelpChecked",
    "Variant Parity",
    "Gate 7 — Containment",
    ".figma/screenshot/<planweave-ref>/",
    ".figma/feedback/<timestamp>.md",
    "Specimen/StateGallery",
  ]) {
    assert.ok(joined.includes(marker), `missing invariant: ${marker}`);
  }
});
