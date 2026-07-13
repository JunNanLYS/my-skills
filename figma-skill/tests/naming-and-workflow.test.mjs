import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skill = readFileSync(join(root, "SKILL.md"), "utf8");

function includesAny(haystack, needles) {
  return needles.some((n) => haystack.includes(n));
}

test("SKILL.md declares the three-page architecture", () => {
  assert.ok(includesAny(skill, ["01 Library", "02 Screens", "03 Flows"]));
});

test("SKILL.md includes the five Mermaid graph headings", () => {
  for (const heading of [
    "Total Workflow Graph",
    "Task Entry and Reuse Graph",
    "Single-Direction Dependency Graph",
    "Validation Order Graph",
    "Page Architecture Graph",
  ]) {
    assert.ok(skill.includes(heading), `missing heading: ${heading}`);
  }
});

test("SKILL.md references every Workflow 0..11 and entry 4A..4H", () => {
  const required = [
    "Workflow 0",
    "Workflow 1",
    "Workflow 2",
    "Workflow 3",
    "Workflow 4",
    "Workflow 4A",
    "Workflow 4B",
    "Workflow 4C",
    "Workflow 4D",
    "Workflow 4E",
    "Workflow 4F",
    "Workflow 4G",
    "Workflow 4H",
    "Workflow 5",
    "Workflow 6",
    "Workflow 7",
    "Workflow 8",
    "Workflow 9",
    "Workflow 10",
    "Workflow 11",
  ];
  for (const id of required) {
    assert.ok(skill.includes(id), `missing workflow: ${id}`);
  }
});

test("SKILL.md lists all fixed base categories", () => {
  for (const category of [
    "Foundation",
    "Primitive",
    "Action",
    "Input",
    "Navigation",
    "DataDisplay",
    "Feedback",
    "Overlay",
    "Layout",
    "Content",
    "Internal",
    "Deprecated",
  ]) {
    assert.ok(skill.includes(category), `missing category: ${category}`);
  }
});

test("SKILL.md lists all Variant axes", () => {
  for (const axis of [
    "Variant",
    "Platform",
    "Size",
    "State",
    "Validation",
    "Selection",
    "Orientation",
    "Density",
    "Expanded",
    "Loading",
  ]) {
    assert.ok(skill.includes(axis), `missing axis: ${axis}`);
  }
});

test("SKILL.md forbids placeholder bucket categories", () => {
  for (const bad of ["Common", "General", "Misc", "Other"]) {
    const re = new RegExp(`^\\s*-\\s*${bad}\\s*$`, "m");
    assert.ok(!skill.match(re), `forbidden bucket listed: ${bad}`);
  }
});

test("SKILL.md uses mandatory wording tokens", () => {
  for (const phrase of ["必须", "禁止", "只有", "≤3"]) {
    assert.ok(skill.includes(phrase), `missing mandatory wording: ${phrase}`);
  }
});

test("SKILL.md covers visual-overlap placement keywords", () => {
  for (const phrase of ["children", "absoluteBoundingBox", "0 相交"]) {
    assert.ok(skill.includes(phrase), `missing overlap keyword: ${phrase}`);
  }
});

test("SKILL.md covers three geometry families (A/B/C)", () => {
  for (const phrase of ["textAutoResize", "primaryAxisSizingMode", "counterAxisSizingMode"]) {
    assert.ok(skill.includes(phrase), `missing geometry keyword: ${phrase}`);
  }
});

test("SKILL.md anchors Component Set variant parity chapter", () => {
  assert.ok(skill.includes("Component Set Variant Baseline"), "missing variant parity sub-heading");
});