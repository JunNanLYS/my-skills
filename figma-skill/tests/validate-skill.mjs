import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(join(root, name), "utf8").replace(/\r\n/g, "\n");

const required = [
  "SKILL.md",
  "references/installation.md",
  "references/design-system.md",
  "references/state-and-recovery.md",
  "references/planning.md",
  "references/execution.md",
  "references/validation.md",
  "references/geometry-verifier.md",
  "references/naming.md",
  "references/self-reflection.md",
  "scripts/install-figma-cli.ps1",
  "scripts/figma-validate-bounds.mjs",
  "scripts/list-children.mjs",
  "scripts/overlap-check.mjs",
  "scripts/page-overlap-check.mjs",
  "scripts/inspect-geometry.mjs",
  "scripts/apply-layout.mjs",
  "scripts/resize-section.mjs",
  "scripts/README.md",
];

for (const file of required) {
  assert.ok(existsSync(join(root, file)), `missing ${file}`);
}

for (const removed of [
  "scripts/figma-task-state.mjs",
  "scripts/lib/task-state/model.mjs",
  "schemas/config.schema.json",
  "schemas/event.schema.json",
  "schemas/index.schema.json",
  "schemas/task-state.schema.json",
]) {
  assert.ok(!existsSync(join(root, removed)), `removed ledger file still exists: ${removed}`);
}

const skill = read("SKILL.md");
const refs = Object.fromEntries(
  required.filter((file) => file.startsWith("references/")).map((file) => [file, read(file)]),
);
const runtimeMarkdown = [skill, ...Object.values(refs), read("scripts/README.md")].join("\n");

assert.ok(skill.startsWith("---\n"), "frontmatter must be first");
for (const field of ["name: figma-skill", "model:", "category:", "description:", "version: 3.0"]) {
  assert.match(skill, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

for (const phrase of [
  "PlanWeave is the workflow authority",
  "`figma-cli` is the Figma fact and mutation authority",
  ".figma/screenshot/<planweave-ref>/",
  ".figma/feedback/<timestamp>.md",
  "Pre-Spec Context Gate",
  "docs/FIGMA_DESIGN_SYSTEM.md",
  "Spec Review Gate",
  "Plan Review Gate",
  "Final Review Gate",
  "Self-Reflection Block",
]) {
  assert.ok(runtimeMarkdown.includes(phrase), `missing v3 marker: ${phrase}`);
}

for (const field of [
  "NativeHelpChecked",
  "MissingNativeCapability",
  "TargetNodeIds",
  "FallbackCodeScope",
  "FallbackImpact",
  "GeometryReaudit",
]) {
  assert.ok(runtimeMarkdown.includes(field), `missing eval/run field: ${field}`);
}

for (const marker of [
  "01 Library",
  "02 Screens",
  "03 Flows",
  "Component Path",
  "Specimen/StateGallery",
  "Variant Parity",
  "Gate 7 — Containment",
]) {
  assert.ok(runtimeMarkdown.includes(marker), `missing preserved marker: ${marker}`);
}

for (const forbidden of [
  /figma-task-state\.mjs\s+(init-project|create|checkpoint|todo-update|validate|archive|close|reflect)/,
  /\.figma\/tasks\/<task-id>\//,
  /state\.validation\.visual\.summary/,
  /archiveStatus\s*=?\s*(ARCHIVED|ARCHIVE_FAILED)/,
  /lease\.json/,
  /events\.jsonl/,
]) {
  assert.doesNotMatch(runtimeMarkdown, forbidden);
}

assert.doesNotMatch(runtimeMarkdown, /\.figma\/cache\.json/);
assert.doesNotMatch(runtimeMarkdown, /temp\/figma-screenshot/);
assert.doesNotMatch(runtimeMarkdown, /figma-guide/);

console.log("PASS: figma-skill v3 PlanWeave structure, references, preserved invariants, and old-ledger removal");
