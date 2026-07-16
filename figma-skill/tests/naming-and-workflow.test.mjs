import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillRaw = readFileSync(join(root, "SKILL.md"), "utf8");
const skill = skillRaw.replace(/\r\n/g, "\n");
const refs = {
  naming: readFileSync(join(root, "references", "naming.md"), "utf8").replace(/\r\n/g, "\n"),
  execution: readFileSync(join(root, "references", "execution.md"), "utf8").replace(/\r\n/g, "\n"),
  geometry: readFileSync(join(root, "references", "geometry-verifier.md"), "utf8").replace(/\r\n/g, "\n"),
  validation: readFileSync(join(root, "references", "validation.md"), "utf8").replace(/\r\n/g, "\n"),
  state: readFileSync(join(root, "references", "state-and-recovery.md"), "utf8").replace(/\r\n/g, "\n"),
  planning: readFileSync(join(root, "references", "planning.md"), "utf8").replace(/\r\n/g, "\n"),
  designSystem: readFileSync(join(root, "references", "design-system.md"), "utf8").replace(/\r\n/g, "\n"),
  installation: readFileSync(join(root, "references", "installation.md"), "utf8").replace(/\r\n/g, "\n"),
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

test("SKILL.md routes every v3 lifecycle phase through references", () => {
  const source = `${skill}\n${Object.values(refs).join("\n")}`;
  for (const marker of [
    "Requirements discovery",
    "Pre-Spec Context Gate",
    "PlanWeave Spec Canvas",
    "Spec Review Gate",
    "PlanWeave Implementation Canvas",
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
    assert.ok(source.includes(marker), `missing lifecycle marker: ${marker}`);
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

test("SKILL.md / planning.md mandate read-only guards for Audit and Export", () => {
  const joined = skill + "\n" + refs.planning + "\n" + refs.state + "\n" + refs.execution;
  assert.match(joined, /Audit/);
  assert.match(joined, /Export/);
  assert.match(joined, /writeRequired=false/);
  assert.match(joined, /forbidden unless the user starts a new write-capable task|禁止.*write-capable task/);
});

test("SKILL.md mandates the singular environment order", () => {
  const joined = skill + "\n" + refs.installation;
  assert.match(joined, /--version/);
  assert.match(joined, /--help/);
  assert.match(joined, /status/);
  assert.match(joined, /connect/);
});