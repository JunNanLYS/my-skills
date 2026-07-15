import assert from "node:assert/strict";
import { test } from "node:test";
import { runFigmaScript } from "./helpers/run-figma-script.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "..", "scripts", "overlap-check.mjs");

function makeMock({ parent, children }) {
  const parentNode = {
    id: parent.id,
    name: parent.name,
    type: parent.type,
    clipsContent: parent.clipsContent,
    absoluteBoundingBox: parent.bbox,
    children,
  };
  return {
    figma: {
      getNodeByIdAsync: async (id) => (id === parent.id ? parentNode : null),
    },
  };
}

async function runGate(parent, children, clipWhitelist = []) {
  const overrides = {
    PARENT_IDS: [parent.id],
    OUTPUT_MODE: "json",
    GATE: "containment",
    CLIP_WHITELIST: clipWhitelist,
  };
  // runFigmaScript returns the already-parsed JSON object.
  return runFigmaScript(SCRIPT, makeMock({ parent, children }).figma, overrides);
}

// Fixture 1: clipsContent=true, child 100px below parent bottom → expect FAIL, side=bottom
test("containment: clipsContent=true + child overflows bottom → CONTAINMENT_FAIL", async () => {
  const parent = {
    id: "P1", name: "Section", type: "SECTION",
    clipsContent: true,
    bbox: { x: 0, y: 0, width: 200, height: 200 },
  };
  const child = {
    id: "C1", name: "Card", type: "FRAME",
    absoluteBoundingBox: { x: 10, y: 250, width: 100, height: 50 },
  };
  const result = await runGate(parent, [child]);
  assert.equal(result.code, "CONTAINMENT_FAIL");
  assert.equal(result.containmentIssues.length, 1);
  const issue = result.containmentIssues[0];
  assert.equal(issue.side, "bottom");
  assert.equal(issue.overflowPx, 100);
  assert.equal(issue.suggestedHeight, 300);
});

// Fixture 2: same as 1 but child fits → expect PASS
test("containment: clipsContent=true + child fits → OK", async () => {
  const parent = {
    id: "P2", name: "Section", type: "SECTION",
    clipsContent: true,
    bbox: { x: 0, y: 0, width: 200, height: 200 },
  };
  const child = {
    id: "C2", name: "Card", type: "FRAME",
    absoluteBoundingBox: { x: 10, y: 10, width: 100, height: 50 },
  };
  const result = await runGate(parent, [child]);
  assert.equal(result.code, "OK");
  assert.equal(result.containmentIssues.length, 0);
});

// Fixture 3: clipsContent=false, child overflows → expect PASS (no clipping risk)
test("containment: clipsContent=false + child overflows → OK (no clipping risk)", async () => {
  const parent = {
    id: "P3", name: "Section", type: "SECTION",
    clipsContent: false,
    bbox: { x: 0, y: 0, width: 200, height: 200 },
  };
  const child = {
    id: "C3", name: "Card", type: "FRAME",
    absoluteBoundingBox: { x: 10, y: 250, width: 100, height: 50 },
  };
  const result = await runGate(parent, [child]);
  assert.equal(result.code, "OK");
  assert.equal(result.containmentIssues.length, 0);
});

// Fixture 4: clipsContent=true + overflow + parent in ClipWhitelist → expect PASS
test("containment: clipsContent=true + overflow + whitelisted → OK", async () => {
  const parent = {
    id: "P4", name: "Card", type: "FRAME",
    clipsContent: true,
    bbox: { x: 0, y: 0, width: 200, height: 200 },
  };
  const child = {
    id: "C4", name: "Inner", type: "FRAME",
    absoluteBoundingBox: { x: 10, y: 250, width: 100, height: 50 },
  };
  const whitelist = [{ nodeId: "P4", rationale: "scroll container" }];
  const result = await runGate(parent, [child], whitelist);
  assert.equal(result.code, "OK");
  assert.equal(result.containmentIssues.length, 0);
});

// Fixture 5: multi-level — Rectangle overflows Frame, report is under FR (immediate parent), not SEC
test("containment: multi-level — issue reported under immediate parent, not grandparent", async () => {
  const frame = {
    id: "FR", name: "Frame", type: "FRAME",
    clipsContent: true,
    absoluteBoundingBox: { x: 10, y: 10, width: 200, height: 200 },
    children: [],
  };
  const rect = {
    id: "R", name: "Rectangle", type: "RECTANGLE",
    absoluteBoundingBox: { x: 20, y: 250, width: 100, height: 100 },
  };
  frame.children.push(rect);
  const overrides = {
    PARENT_IDS: ["FR"],
    OUTPUT_MODE: "json",
    GATE: "containment",
    CLIP_WHITELIST: [],
  };
  const figmaApi = {
    getNodeByIdAsync: async (id) => (id === "FR" ? frame : null),
  };
  const result = await runFigmaScript(SCRIPT, figmaApi, overrides);
  assert.equal(result.code, "CONTAINMENT_FAIL");
  assert.equal(result.containmentIssues.length, 1);
  assert.equal(result.containmentIssues[0].parentId, "FR");
});