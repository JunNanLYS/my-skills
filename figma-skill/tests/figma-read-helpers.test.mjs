import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { runFigmaScript } from "./helpers/run-figma-script.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ---- paths ----------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const scriptsDir = join(root, "scripts");
const listChildrenScript = join(scriptsDir, "list-children.mjs");
const overlapCheckScript = join(scriptsDir, "overlap-check.mjs");
const inspectGeometryScript = join(scriptsDir, "inspect-geometry.mjs");
const pageOverlapCheckScript = join(scriptsDir, "page-overlap-check.mjs");

// ---- mock helpers ---------------------------------------------------------

/**
 * Factory: create a mock Figma node.
 */
function n(opts = {}) {
  return {
    id: "0:0",
    name: "Mock",
    type: "FRAME",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    children: [],
    absoluteBoundingBox: null,
    parent: null,
    layoutMode: "NONE",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED",
    constraints: null,
    layoutAlign: null,
    layoutGrow: null,
    layoutPositioning: null,
    ...opts,
  };
}

/**
 * Factory: create a mock figma API object.
 */
function mock(nodes = {}, pageChildren = []) {
  return {
    getNodeById: (id) => nodes[id] || null,
    getNodeByIdAsync: async (id) => nodes[id] || null,
    currentPage: { children: pageChildren },
  };
}

// ===========================================================================
// Tests
// ===========================================================================

// ---- runFigmaScript harness ------------------------------------------------

test("runFigmaScript parses JSON returned by the script", async () => {
  // Use list-children.mjs with default PARENT_ID="" to exercise the harness
  const result = await runFigmaScript(listChildrenScript, mock({}));
  assert.equal(typeof result, "object");
  assert.ok("ok" in result);
});

// ---- list-children.mjs -----------------------------------------------------

describe("list-children.mjs", () => {
  test("empty PARENT_ID returns graceful empty envelope", async () => {
    const result = await runFigmaScript(listChildrenScript, mock({}));
    assert.equal(result.ok, false);
    assert.equal(result.code, "EMPTY_PARENT_ID");
    assert.equal(result.count, 0);
    assert.deepEqual(result.items, []);
    assert.ok(Array.isArray(result.issues));
  });

  test("missing node returns error envelope", async () => {
    const result = await runFigmaScript(listChildrenScript, mock({}), {
      PARENT_ID: "999:999",
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "NODE_NOT_FOUND");
    assert.equal(result.count, 0);
  });

  test("node without children returns error envelope", async () => {
    const textNode = n({ id: "1:1", type: "TEXT" });
    delete textNode.children;
    const result = await runFigmaScript(
      listChildrenScript,
      mock({ "1:1": textNode }),
      { PARENT_ID: "1:1" },
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, "NO_CHILDREN");
  });

  test("returns children with local geometry", async () => {
    const c1 = n({
      id: "2:1",
      name: "Child A",
      x: 10,
      y: 20,
      width: 150,
      height: 80,
    });
    const c2 = n({
      id: "2:2",
      name: "Child B",
      x: 200,
      y: 20,
      width: 100,
      height: 80,
    });
    const parent = n({ id: "1:1", children: [c1, c2] });
    const result = await runFigmaScript(
      listChildrenScript,
      mock({ "1:1": parent }),
      { PARENT_ID: "1:1" },
    );

    assert.equal(result.ok, true);
    assert.equal(result.code, "OK");
    assert.equal(result.count, 2);
    assert.equal(result.items[0].id, "2:1");
    assert.equal(result.items[0].right, 160); // 10 + 150
    assert.equal(result.items[0].bottom, 100); // 20 + 80
    assert.equal(result.items[1].id, "2:2");
    assert.equal(result.items[1].right, 300); // 200 + 100
  });

  test("emits limitation issue when absoluteBoundingBox is unavailable", async () => {
    const withBbox = n({
      id: "2:1",
      name: "With BBox",
      absoluteBoundingBox: { x: 100, y: 200, width: 150, height: 80 },
    });
    const withoutBbox = n({
      id: "2:2",
      name: "Without BBox",
      absoluteBoundingBox: null,
    });
    const parent = n({ id: "1:1", children: [withBbox, withoutBbox] });
    const result = await runFigmaScript(
      listChildrenScript,
      mock({ "1:1": parent }),
      { PARENT_ID: "1:1" },
    );

    assert.equal(result.ok, true);
    assert.equal(result.count, 2);
    // With BBox: absoluteBoundingBox populated
    assert.deepEqual(result.items[0].absoluteBoundingBox, {
      x: 100,
      y: 200,
      width: 150,
      height: 80,
      right: 250,
      bottom: 280,
    });
    // Without BBox: absoluteBoundingBox is null
    assert.equal(result.items[1].absoluteBoundingBox, null);
    // Limitation issue present
    const limitations = result.issues.filter(
      (i) => i.severity === "limitation",
    );
    assert.equal(limitations.length, 1);
    assert.ok(limitations[0].message.includes("absoluteBoundingBox"));
    assert.equal(limitations[0].nodeId, "2:2");
  });

  test("parent field matches PARENT_ID", async () => {
    const c = n({ id: "2:1", name: "Only" });
    const parent = n({ id: "1:1", children: [c] });
    const result = await runFigmaScript(
      listChildrenScript,
      mock({ "1:1": parent }),
      { PARENT_ID: "1:1" },
    );
    assert.equal(result.parent, "1:1");
    assert.equal(result.count, 1);
  });

  test("observedAt is null (plugin-safe)", async () => {
    const c = n({ id: "2:1", name: "Only" });
    const parent = n({ id: "1:1", children: [c] });
    const result = await runFigmaScript(
      listChildrenScript,
      mock({ "1:1": parent }),
      { PARENT_ID: "1:1" },
    );
    assert.equal(result.observedAt, null);
  });
});

// ---- overlap-check.mjs -----------------------------------------------------

describe("overlap-check.mjs", () => {
  test("empty PARENT_IDS returns gracefully", async () => {
    const result = await runFigmaScript(overlapCheckScript, mock({}));
    assert.equal(result.ok, true);
    assert.equal(result.overlapPairs, 0);
    assert.deepEqual(result.overlaps, []);
  });

  test("detects overlapping children", async () => {
    const a = n({
      id: "2:1",
      name: "A",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
    });
    const b = n({
      id: "2:2",
      name: "B",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      absoluteBoundingBox: { x: 50, y: 50, width: 100, height: 100 },
    });
    const parent = n({ id: "1:1", children: [a, b] });
    const result = await runFigmaScript(
      overlapCheckScript,
      mock({ "1:1": parent }),
      { PARENT_IDS: ["1:1"] },
    );

    assert.equal(result.ok, true);
    assert.equal(result.overlapPairs, 1);
    assert.equal(result.overlaps[0].parentId, "1:1");
  });

  test("edge-touching is NOT overlap (strict inequality)", async () => {
    const a = n({ id: "2:1", name: "A", x: 0, y: 0, width: 100, height: 100 });
    const b = n({
      id: "2:2",
      name: "B",
      x: 100,
      y: 0,
      width: 100,
      height: 100,
    });
    const parent = n({ id: "1:1", children: [a, b] });
    const result = await runFigmaScript(
      overlapCheckScript,
      mock({ "1:1": parent }),
      { PARENT_IDS: ["1:1"] },
    );

    assert.equal(result.overlapPairs, 0);
  });

  test("falls back to local geometry with limitation issue", async () => {
    const a = n({
      id: "2:1",
      name: "A",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      absoluteBoundingBox: null,
    });
    const b = n({
      id: "2:2",
      name: "B",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      absoluteBoundingBox: null,
    });
    const parent = n({ id: "1:1", children: [a, b] });
    const result = await runFigmaScript(
      overlapCheckScript,
      mock({ "1:1": parent }),
      { PARENT_IDS: ["1:1"] },
    );

    assert.equal(result.ok, true);
    assert.equal(result.overlapPairs, 1);
    const limitations = result.issues.filter(
      (i) => i.severity === "limitation",
    );
    assert.ok(limitations.length >= 1);
  });

  test("uses absoluteBoundingBox when available (no limitation issues)", async () => {
    const a = n({
      id: "2:1",
      name: "A",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
    });
    const b = n({
      id: "2:2",
      name: "B",
      x: 50,
      y: 0,
      width: 100,
      height: 100,
      absoluteBoundingBox: { x: 50, y: 0, width: 100, height: 100 },
    });
    const parent = n({ id: "1:1", children: [a, b] });
    const result = await runFigmaScript(
      overlapCheckScript,
      mock({ "1:1": parent }),
      { PARENT_IDS: ["1:1"] },
    );

    assert.equal(result.overlapPairs, 1);
    const limitations = result.issues.filter(
      (i) => i.severity === "limitation",
    );
    assert.equal(limitations.length, 0);
  });

  test("handles multiple parents independently", async () => {
    const p1a = n({
      id: "2:1",
      name: "P1A",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const p1b = n({
      id: "2:2",
      name: "P1B",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    });
    const parent1 = n({ id: "1:1", children: [p1a, p1b] });

    const p2a = n({
      id: "3:1",
      name: "P2A",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const parent2 = n({ id: "1:2", children: [p2a] });

    const result = await runFigmaScript(
      overlapCheckScript,
      mock({ "1:1": parent1, "1:2": parent2 }),
      { PARENT_IDS: ["1:1", "1:2"] },
    );

    assert.equal(result.ok, true);
    assert.equal(result.overlapPairs, 1);
    assert.equal(result.overlaps[0].parentId, "1:1");
  });

  test("reports missing parent as issue", async () => {
    const result = await runFigmaScript(
      overlapCheckScript,
      mock({}),
      { PARENT_IDS: ["missing:1"] },
    );
    assert.equal(result.ok, true);
    assert.equal(result.overlapPairs, 0);
    const errors = result.issues.filter((i) => i.severity === "error");
    assert.ok(errors.length >= 1);
    assert.ok(errors[0].message.includes("missing:1"));
  });
});

// ---- inspect-geometry.mjs --------------------------------------------------

describe("inspect-geometry.mjs", () => {
  test("empty NODE_ID returns error envelope", async () => {
    const result = await runFigmaScript(inspectGeometryScript, mock({}));
    assert.equal(result.ok, false);
    assert.equal(result.code, "EMPTY_NODE_ID");
  });

  test("missing node returns error envelope", async () => {
    const result = await runFigmaScript(inspectGeometryScript, mock({}), {
      NODE_ID: "999:999",
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "NODE_NOT_FOUND");
  });

  test("returns detailed geometry for valid node", async () => {
    const node = n({
      id: "2:1",
      name: "TestFrame",
      type: "FRAME",
      x: 10,
      y: 20,
      width: 200,
      height: 150,
      absoluteBoundingBox: { x: 100, y: 200, width: 200, height: 150 },
      parent: { id: "1:1" },
      layoutMode: "VERTICAL",
      primaryAxisSizingMode: "AUTO",
      counterAxisSizingMode: "FIXED",
      constraints: { horizontal: "MIN", vertical: "MIN" },
      layoutAlign: "STRETCH",
      layoutGrow: 1,
      layoutPositioning: "ABSOLUTE",
    });
    const result = await runFigmaScript(
      inspectGeometryScript,
      mock({ "2:1": node }),
      { NODE_ID: "2:1" },
    );

    assert.equal(result.ok, true);
    assert.equal(result.code, "OK");
    assert.equal(result.identity.id, "2:1");
    assert.equal(result.identity.name, "TestFrame");
    assert.equal(result.identity.parentId, "1:1");
    assert.deepEqual(result.localGeometry, {
      x: 10,
      y: 20,
      width: 200,
      height: 150,
      right: 210,
      bottom: 170,
    });
    assert.equal(result.absoluteBoundingBoxAvailable, true);
    assert.ok(result.absoluteBoundingBox !== null);
    assert.equal(result.layout.layoutMode, "VERTICAL");
    assert.equal(result.layout.primaryAxisSizingMode, "AUTO");
    assert.equal(result.layout.counterAxisSizingMode, "FIXED");
    assert.deepEqual(result.constraints, {
      horizontal: "MIN",
      vertical: "MIN",
    });
  });

  test("emits limitation when absoluteBoundingBox unavailable", async () => {
    const node = n({
      id: "2:1",
      name: "No BBox",
      absoluteBoundingBox: null,
    });
    const result = await runFigmaScript(
      inspectGeometryScript,
      mock({ "2:1": node }),
      { NODE_ID: "2:1" },
    );

    assert.equal(result.ok, true);
    assert.equal(result.absoluteBoundingBoxAvailable, false);
    assert.equal(result.absoluteBoundingBox, null);
    const limitations = result.issues.filter(
      (i) => i.severity === "limitation",
    );
    assert.equal(limitations.length, 1);
  });
});

// ---- page-overlap-check.mjs ------------------------------------------------

describe("page-overlap-check.mjs", () => {
  test("detects overlapping page children", async () => {
    const a = n({
      id: "1:1",
      name: "Frame A",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const b = n({
      id: "1:2",
      name: "Frame B",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    });
    const result = await runFigmaScript(
      pageOverlapCheckScript,
      mock({}, [a, b]),
    );

    assert.equal(result.ok, true);
    assert.equal(result.overlapPairs, 1);
    assert.equal(result.total, 2);
  });

  test("touching page children does not overlap", async () => {
    const a = n({
      id: "1:1",
      name: "Frame A",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const b = n({
      id: "1:2",
      name: "Frame B",
      x: 100,
      y: 0,
      width: 100,
      height: 100,
    });
    const result = await runFigmaScript(
      pageOverlapCheckScript,
      mock({}, [a, b]),
    );

    assert.equal(result.overlapPairs, 0);
  });

  test("emits limitation for nodes without absoluteBoundingBox", async () => {
    const a = n({
      id: "1:1",
      name: "A",
      absoluteBoundingBox: null,
    });
    const b = n({
      id: "1:2",
      name: "B",
      absoluteBoundingBox: { x: 50, y: 0, width: 100, height: 100 },
    });
    const result = await runFigmaScript(
      pageOverlapCheckScript,
      mock({}, [a, b]),
    );

    const limitations = result.issues.filter(
      (i) => i.severity === "limitation",
    );
    assert.ok(limitations.length >= 1);
  });

  test("observedAt is null", async () => {
    const result = await runFigmaScript(
      pageOverlapCheckScript,
      mock({}, []),
    );
    assert.equal(result.observedAt, null);
  });
});

// ---- envelope structure sanity ---------------------------------------------

describe("common envelope contract", () => {
  test("list-children success has legacy fields", async () => {
    const c = n({ id: "2:1", name: "C" });
    const p = n({ id: "1:1", children: [c] });
    const r = await runFigmaScript(listChildrenScript, mock({ "1:1": p }), {
      PARENT_ID: "1:1",
    });
    assert.equal(r.ok, true);
    assert.equal(r.code, "OK");
    assert.ok(typeof r.summary === "object");
    assert.ok(Array.isArray(r.issues));
    assert.ok("observedAt" in r);
    assert.equal(typeof r.parent, "string");
    assert.equal(typeof r.count, "number");
    assert.ok(Array.isArray(r.items));
  });

  test("overlap-check success has legacy fields", async () => {
    const r = await runFigmaScript(overlapCheckScript, mock({}));
    assert.equal(r.ok, true);
    assert.equal(r.code, "OK");
    assert.ok(typeof r.summary === "object");
    assert.ok(Array.isArray(r.issues));
    assert.ok("observedAt" in r);
    assert.equal(typeof r.total, "number");
    assert.equal(typeof r.overlapPairs, "number");
    assert.ok(Array.isArray(r.overlaps));
  });
});
