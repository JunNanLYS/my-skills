import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "..", "scripts", "figma-validate-bounds.mjs");

function run(args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
}

function config(root) {
  return JSON.stringify({ root });
}

const parent = (child, clipsContent = false) => ({
  id: "root",
  x: 0,
  y: 0,
  w: 100,
  h: 100,
  clipsContent,
  children: [child],
});

const inside = { id: "child", x: 10, y: 10, w: 40, h: 40, children: [] };
const outside = { id: "child", x: 80, y: 10, w: 40, h: 40, children: [] };

// ── Happy path ───────────────────────────────────────────────────────

test("returns 0 and structured summary when every child fits", () => {
  const result = run(["root", "--config", config(parent(inside))]);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.summary.totalIssues, 0);
  assert.equal(output.summary.nodesVisited, 2);
});

test("returns 1 and reports right overflow", () => {
  const result = run(["root", "--config", config(parent(outside))]);
  assert.equal(result.status, 1);
  const output = JSON.parse(result.stdout);
  assert.equal(output.violations[0].issues[0].side, "right");
  assert.equal(output.violations[0].issues[0].overflow, 20);
});

test("detects left overflow", () => {
  const leftOverflow = { id: "child", x: -20, y: 10, w: 30, h: 30, children: [] };
  const result = run(["root", "--config", config(parent(leftOverflow))]);
  assert.equal(result.status, 1);
  const output = JSON.parse(result.stdout);
  assert.equal(output.violations[0].issues[0].side, "left");
});

test("detects top overflow", () => {
  const topOverflow = { id: "child", x: 10, y: -15, w: 30, h: 30, children: [] };
  const result = run(["root", "--config", config(parent(topOverflow))]);
  assert.equal(result.status, 1);
  const output = JSON.parse(result.stdout);
  assert.equal(output.violations[0].issues[0].side, "top");
});

test("detects bottom overflow", () => {
  const bottomOverflow = { id: "child", x: 10, y: 80, w: 30, h: 50, children: [] };
  const result = run(["root", "--config", config(parent(bottomOverflow))]);
  assert.equal(result.status, 1);
  const output = JSON.parse(result.stdout);
  assert.equal(output.violations[0].issues[0].side, "bottom");
});

test("reports nested violations", () => {
  const grandchild = { id: "gc", x: 10, y: 10, w: 200, h: 10, children: [] };
  const child = { id: "child", x: 5, y: 5, w: 80, h: 80, children: [grandchild] };
  const result = run(["root", "--config", config(parent(child))]);
  assert.equal(result.status, 1);
  const output = JSON.parse(result.stdout);
  assert.equal(output.summary.parentsWithIssues, 1); // grandchild overflows child, not root
  const gcViolation = output.violations.find(v => v.childId === "gc");
  assert.ok(gcViolation, "grandchild violation reported");
});

test("ignores clipped overflow unless strict", () => {
  const relaxed = run(["root", "--config", config(parent(outside, true))]);
  const strict = run(["root", "--config", config(parent(outside, true)), "--strict"]);
  assert.equal(relaxed.status, 0, relaxed.stderr);
  assert.equal(strict.status, 1, strict.stderr);
});

test("supports flat figma-json and tolerance", () => {
  const payload = JSON.stringify({
    rootId: "root",
    nodes: {
      root: { id: "root", x: 0, y: 0, w: 100, h: 100, children: ["child"] },
      child: { id: "child", x: 99, y: 0, w: 2, h: 10, children: [] },
    },
  });
  const result = run(["root", "--figma-json", payload, "--tolerance", "1"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).inputFormat, "figma-json");
});

// ── Exit 2: invalid input ────────────────────────────────────────────

test("returns 2 for invalid JSON", () => {
  const result = run(["root", "--config", "{not-json}"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Invalid config JSON/);
});

test("returns 2 when --config and --figma-json are both provided", () => {
  const result = run(["root", "--config", config(inside), "--figma-json", "{}"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /mutually exclusive/);
});

test("returns 2 for invalid tolerance (negative)", () => {
  const result = run(["root", "--config", config(inside), "--tolerance", "-1"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /tolerance/);
});

test("returns 2 for invalid tolerance (non-numeric)", () => {
  const result = run(["root", "--config", config(inside), "--tolerance", "abc"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /tolerance|Invalid/);
});

test("returns 2 for config.root.id mismatch with rootNodeId arg", () => {
  const mismatchedRoot = {
    id: "other-root",
    x: 0, y: 0, w: 100, h: 100,
    children: [inside],
  };
  const result = run(["root", "--config", config(mismatchedRoot)]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /root\.id|mismatch|rootNodeId/);
});

test("returns 2 for figma-json.rootId mismatch with rootNodeId arg", () => {
  const payload = JSON.stringify({
    rootId: "other-root",
    nodes: {
      "other-root": { id: "other-root", x: 0, y: 0, w: 100, h: 100, children: [] },
    },
  });
  const result = run(["root", "--figma-json", payload]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /rootId|mismatch|rootNodeId/);
});

test("returns 2 for missing referenced child nodes in figma-json", () => {
  const payload = JSON.stringify({
    rootId: "root",
    nodes: {
      root: { id: "root", x: 0, y: 0, w: 100, h: 100, children: ["ghost"] },
    },
  });
  const result = run(["root", "--figma-json", payload]);
  assert.equal(result.status, 2, `expected exit 2 for missing child, got ${result.status}: ${result.stderr}`);
  assert.match(result.stderr, /missing|referenced|not found|ghost/i);
});

test("returns 2 for negative width in config", () => {
  const bad = { id: "child", x: 10, y: 10, w: -40, h: 40, children: [] };
  const result = run(["root", "--config", config(parent(bad))]);
  assert.equal(result.status, 2, `expected exit 2 for negative width, got ${result.status}: ${result.stderr}`);
  assert.match(result.stderr, /negative|non-negative|width|\.w/i);
});

test("returns 2 for negative height in config", () => {
  const bad = { id: "child", x: 10, y: 10, w: 40, h: -40, children: [] };
  const result = run(["root", "--config", config(parent(bad))]);
  assert.equal(result.status, 2, `expected exit 2 for negative height, got ${result.status}: ${result.stderr}`);
  assert.match(result.stderr, /negative|non-negative|height|\.h/i);
});

test("returns 2 for negative width in figma-json", () => {
  const payload = JSON.stringify({
    rootId: "root",
    nodes: {
      root: { id: "root", x: 0, y: 0, w: 100, h: 100, children: ["bad"] },
      bad: { id: "bad", x: 0, y: 0, w: -50, h: 20, children: [] },
    },
  });
  const result = run(["root", "--figma-json", payload]);
  assert.equal(result.status, 2, `expected exit 2 for negative width, got ${result.status}: ${result.stderr}`);
  assert.match(result.stderr, /negative|non-negative|width|\.w/i);
});

test("returns 2 for non-finite width (NaN) in config", () => {
  const raw = JSON.stringify({
    root: { id: "root", x: 0, y: 0, w: "NaN", h: 100, children: [inside] },
  });
  const result = run(["root", "--config", raw]);
  assert.equal(result.status, 2, `expected exit 2 for NaN width, got ${result.status}: ${result.stderr}`);
  assert.match(result.stderr, /finite|NaN|\.w/i);
});

test("returns 2 for non-finite geometry (Infinity) in figma-json", () => {
  const payload = JSON.stringify({
    rootId: "root",
    nodes: {
      root: { id: "root", x: 0, y: 0, w: 100, h: 100, children: ["bad"] },
      bad: { id: "bad", x: 0, y: 0, w: 30, h: "Infinity", children: [] },
    },
  });
  const result = run(["root", "--figma-json", payload]);
  assert.equal(result.status, 2, `expected exit 2 for Infinity height, got ${result.status}: ${result.stderr}`);
  assert.match(result.stderr, /finite|Infinity|\.h/i);
});

test("returns 2 for cycle in figma-json children", () => {
  const payload = JSON.stringify({
    rootId: "root",
    nodes: {
      root: { id: "root", x: 0, y: 0, w: 100, h: 100, children: ["a"] },
      a: { id: "a", x: 0, y: 0, w: 10, h: 10, children: ["b"] },
      b: { id: "b", x: 0, y: 0, w: 10, h: 10, children: ["a"] },
    },
  });
  const result = run(["root", "--figma-json", payload]);
  assert.equal(result.status, 2, `expected exit 2 for cycle, got ${result.status}: ${result.stderr}`);
  assert.match(result.stderr, /cycle/i);
});
