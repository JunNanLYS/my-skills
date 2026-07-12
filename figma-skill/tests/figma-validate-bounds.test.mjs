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

test("returns 2 for invalid input", () => {
  const result = run(["root", "--config", "{not-json}"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Invalid config JSON/);
});
