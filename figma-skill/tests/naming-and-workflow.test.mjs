import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skill = readFileSync(join(root, "SKILL.md"), "utf8");
const refs = {
  naming: readFileSync(join(root, "references", "naming.md"), "utf8"),
  execution: readFileSync(join(root, "references", "execution.md"), "utf8"),
  geometry: readFileSync(join(root, "references", "geometry-verifier.md"), "utf8"),
  validation: readFileSync(join(root, "references", "validation.md"), "utf8"),
  state: readFileSync(join(root, "references", "state-and-recovery.md"), "utf8"),
  planning: readFileSync(join(root, "references", "planning.md"), "utf8"),
  designSystem: readFileSync(join(root, "references", "design-system.md"), "utf8"),
  installation: readFileSync(join(root, "references", "installation.md"), "utf8"),
};

function includesAny(haystack, needles) {
  return needles.some((n) => haystack.includes(n));
}

test("SKILL.md declares the three-page architecture", () => {
  assert.ok(includesAny(skill, ["01 Library", "02 Screens", "03 Flows"]));
});

test("SKILL.md or references/naming.md declares the five reference authority areas", () => {
  for (const area of [
    "references/installation.md",
    "references/design-system.md",
    "references/state-and-recovery.md",
    "references/planning.md",
    "references/execution.md",
    "references/geometry-verifier.md",
    "references/validation.md",
    "references/naming.md",
  ]) {
    assert.ok(skill.includes(area) || existsSync(join(root, area)), `${area} missing`);
  }
});

test("SKILL.md routes every Workflow 0..11 and entry 4A..4H through references", () => {
  // SKILL.md is the compact router; it must enumerate Workflow stages and reference the authority for each.
  for (const id of [
    "Workflow 0A",
    "Workflow 0B",
    "Workflow 1",
    "Workflow 2",
    "Workflow 4",
    "Workflow 4A",
    "Workflow 5",
    "Workflow 6",
    "Workflow 7",
    "Workflow 8",
    "Workflow 9",
    "Workflow 10",
    "Workflow 11",
  ]) {
    const source = `${skill}\n${Object.values(refs).join("\n")}`;
    assert.ok(source.includes(id), `missing workflow: ${id}`);
  }
});

test("naming.md lists the fixed base categories", () => {
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
    assert.ok(refs.naming.includes(category), `missing category: ${category}`);
  }
});

test("naming.md lists all Variant axes", () => {
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
    assert.ok(refs.naming.includes(axis), `missing axis: ${axis}`);
  }
});

test("naming.md forbids placeholder bucket categories", () => {
  for (const bad of ["Common", "General", "Misc", "Other"]) {
    const re = new RegExp(`^\\s*-\\s*${bad}\\s*$`, "m");
    assert.ok(!refs.naming.match(re), `forbidden bucket listed in naming.md: ${bad}`);
  }
});

test("SKILL.md uses mandatory wording tokens", () => {
  for (const phrase of ["必须", "禁止", "只有"]) {
    assert.ok(skill.includes(phrase), `missing mandatory wording: ${phrase}`);
  }
});

test("geometry-verifier.md covers overlap keywords and three geometry families", () => {
  for (const phrase of [
    "absoluteBoundingBox",
    "layoutSizingHorizontal",
    "layoutSizingVertical",
    "textAutoResize",
    "Variant Parity",
    "Visual",
  ]) {
    assert.ok(refs.geometry.includes(phrase), `missing keyword: ${phrase}`);
  }
});

test("state-and-recovery.md anchors Component Set variant parity in Geometry Gate 5", () => {
  assert.match(refs.geometry, /Variant Parity[\s\S]{0,200}layoutSizingHorizontal[\s\S]{0,200}layoutSizingVertical/);
});

test("SKILL.md / state-and-recovery.md mandate Read-Only guard for Workflow 6/8/10", () => {
  const joined = skill + "\n" + refs.state + "\n" + refs.execution;
  assert.match(joined, /read[\s_-]*only/i);
  assert.match(joined, /writeRequired\s*=\s*false|writeRequired\s+false/);
  assert.match(joined, /Workflow\s+6[\s\S]{0,80}8[\s\S]{0,80}10/);
});

test("SKILL.md mandates the singular environment order", () => {
  const joined = skill + "\n" + refs.installation;
  assert.match(joined, /--version/);
  assert.match(joined, /--help/);
  assert.match(joined, /status/);
  assert.match(joined, /connect/);
});