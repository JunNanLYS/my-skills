import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skill = readFileSync(join(root, "SKILL.md"), "utf8").replace(/\r\n/g, "\n");

function section(name) {
  const start = skill.indexOf(`## ${name}`);
  assert.notEqual(start, -1, `missing section: ${name}`);
  const next = skill.indexOf("\n## ", start + 1);
  return skill.slice(start, next === -1 ? undefined : next);
}

test("SKILL.md frontmatter declares figma-skill v3.0", () => {
  assert.match(skill, /^---[\s\S]+?---\n/);
  const fm = skill.match(/^---([\s\S]+?)---/)[1];
  assert.match(fm, /\bname:\s*figma-skill\b/);
  assert.match(fm, /\bdescription:\s*Use when\b/);
  assert.match(fm, /\bversion:\s*3\.0\b/);
});

test("SKILL.md states the three v3 authority boundaries", () => {
  const authority = section("Authority Invariant");
  assert.match(authority, /PlanWeave[\s\S]{0,80}workflow authority/);
  assert.match(authority, /figma-cli[\s\S]{0,80}Figma fact and mutation authority/);
  assert.match(authority, /\.figma\//);
  assert.match(authority, /screenshot\/<planweave-ref>/);
  assert.match(authority, /feedback\/<timestamp>\.md/);
  assert.doesNotMatch(authority, /task ledger|state machine|active workflow state|active ledger|archiveStatus\s*=/);
});

test("SKILL.md mandates Pre-Spec Context Gate before spec or plan", () => {
  const rules = section("Non-Negotiable Rules");
  assert.match(rules, /Pre-Spec Context Gate/);
  assert.match(rules, /docs\/FIGMA_DESIGN_SYSTEM\.md[\s\S]{0,120}before spec drafting/);
  assert.match(rules, /figma-cli --version[\s\S]{0,120}figma-cli --help[\s\S]{0,120}figma-cli status/);
  assert.match(rules, /live Figma context[\s\S]{0,120}before spec drafting/);
  assert.match(rules, /no spec, no plan, no Figma write/i);
});

test("SKILL.md keeps figma-cli-only and eval-run six-field gates", () => {
  const rules = section("Non-Negotiable Rules");
  assert.match(rules, /禁止使用 Figma MCP/);
  for (const field of [
    "NativeHelpChecked",
    "MissingNativeCapability",
    "TargetNodeIds",
    "FallbackCodeScope",
    "FallbackImpact",
    "GeometryReaudit",
  ]) {
    assert.ok(rules.includes(field), `${field} missing`);
  }
});

test("SKILL.md routes phases to mandatory references", () => {
  const lookups = section("Mandatory Lookups");
  for (const ref of [
    "references/installation.md",
    "references/design-system.md",
    "references/planning.md",
    "references/state-and-recovery.md",
    "references/execution.md",
    "references/geometry-verifier.md",
    "references/validation.md",
    "references/self-reflection.md",
    "references/naming.md",
  ]) {
    assert.ok(lookups.includes(ref), `missing lookup: ${ref}`);
  }
});

test("SKILL.md defines v3 lifecycle and review contract", () => {
  const lifecycle = section("PlanWeave Lifecycle");
  for (const marker of [
    "Requirements discovery",
    "Pre-Spec Context Gate",
    "Spec Review Gate",
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
    assert.ok(lifecycle.includes(marker), `missing lifecycle marker: ${marker}`);
  }
  const review = section("Review Gate Contract");
  assert.match(review, /result:\s*pass \| needs_changes/);
  assert.match(review, /targetBlock:/);
  assert.match(review, /reason:/);
  assert.match(review, /requiredChange:/);
});

test("SKILL.md preserves three-page architecture and task types", () => {
  for (const marker of ["01 Library", "02 Screens", "03 Flows"]) {
    assert.ok(skill.includes(marker), `missing page marker: ${marker}`);
  }
  for (const taskType of ["Create", "Modify", "Audit", "Migrate", "Export"]) {
    assert.ok(skill.includes(taskType), `missing task type: ${taskType}`);
  }
});

test("SKILL.md refuses old ledger commands instead of teaching them", () => {
  assert.doesNotMatch(skill, /figma-task-state\.mjs\s+(init-project|create|checkpoint|validate|archive|close|reflect)/);
  assert.doesNotMatch(skill, /\.figma\/tasks\/<task-id>\//);
  assert.doesNotMatch(skill, /state\.validation\.visual\.summary/);
  assert.doesNotMatch(skill, /archiveStatus\s*=?\s*(ARCHIVED|ARCHIVE_FAILED)/);
  const redFlags = section("Red Flags and Rationalizations");
  assert.match(redFlags, /old \.figma\/tasks ledger/);
  assert.match(redFlags, /PlanWeave/);
  assert.match(redFlags, /禁止/);
});