import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { runFigmaScript } from "./helpers/run-figma-script.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ---- paths ----------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const applyLayoutScript = join(root, "scripts", "apply-layout.mjs");
const resizeSectionScript = join(root, "scripts", "resize-section.mjs");

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
    parent: null,
    resize(w, h) {
      this.width = w;
      this.height = h;
    },
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

/**
 * Create a node whose x setter always throws.
 */
function throwingNode(id = "throw:1") {
  const node = {
    id,
    name: "Throwing",
    type: "FRAME",
    _x: 50,
    _y: 50,
    width: 100,
    height: 100,
    children: [],
    parent: { id: "parent:1" },
  };
  Object.defineProperty(node, "x", {
    get() {
      return node._x;
    },
    set(v) {
      throw new Error("set x failed");
    },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(node, "y", {
    get() {
      return node._y;
    },
    set(v) {
      node._y = v;
    },
    enumerable: true,
    configurable: true,
  });
  return node;
}

/**
 * Create a node whose x setter works on the first call (apply)
 * but throws on the second call (rollback).
 */
function rollbackFailNode() {
  let xSetCount = 0;
  const node = {
    id: "rb-fail-a",
    name: "RollbackFailA",
    type: "FRAME",
    _x: 10,
    _y: 20,
    width: 100,
    height: 100,
    children: [],
    parent: { id: "parent:1" },
  };
  Object.defineProperty(node, "x", {
    get() {
      return node._x;
    },
    set(v) {
      xSetCount++;
      if (xSetCount >= 2) throw new Error("Rollback x set failed");
      node._x = v;
    },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(node, "y", {
    get() {
      return node._y;
    },
    set(v) {
      node._y = v;
    },
    enumerable: true,
    configurable: true,
  });
  return node;
}

// ===========================================================================
// apply-layout.mjs tests
// ===========================================================================

describe("apply-layout.mjs", () => {
  test("empty PLANS returns ok=false with EMPTY_PLANS code", async () => {
    const result = await runFigmaScript(applyLayoutScript, mock({}));
    assert.equal(result.ok, false);
    assert.equal(result.code, "EMPTY_PLANS");
    assert.equal(result.planned, 0);
    assert.equal(result.applied, 0);
    assert.deepEqual(result.errors, []);
  });

  test("duplicate plan IDs rejected in preflight with zero writes", async () => {
    const node = n({ id: "2:1", x: 0, y: 0, parent: { id: "parent:1" } });
    const result = await runFigmaScript(
      applyLayoutScript,
      mock({ "2:1": node }),
      {
        PLANS: [
          { id: "2:1", x: 100, y: 100 },
          { id: "2:1", x: 200, y: 200 },
        ],
      },
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, "DUPLICATE_PLAN_ID");
    // Node position should be unchanged (preflight, zero writes)
    assert.equal(node.x, 0);
    assert.equal(node.y, 0);
  });

  test("non-finite coordinates rejected in preflight", async () => {
    const node = n({ id: "2:1", x: 0, y: 0, parent: { id: "parent:1" } });
    const result = await runFigmaScript(
      applyLayoutScript,
      mock({ "2:1": node }),
      {
        PLANS: [{ id: "2:1", x: NaN, y: 100 }],
      },
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, "NON_FINITE_COORDINATE");
    assert.equal(node.x, 0);
  });

  test("missing node rejected in preflight", async () => {
    const result = await runFigmaScript(applyLayoutScript, mock({}), {
      PLANS: [{ id: "nonexistent", x: 100, y: 100 }],
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "NODE_NOT_FOUND");
  });

  test("wrong parent rejected in preflight", async () => {
    const node = n({ id: "2:1", x: 0, y: 0, parent: { id: "actual:1" } });
    const result = await runFigmaScript(
      applyLayoutScript,
      mock({ "2:1": node }),
      {
        PLANS: [
          { id: "2:1", expectedParentId: "expected:1", x: 100, y: 100 },
        ],
      },
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, "WRONG_PARENT");
    assert.equal(node.x, 0);
  });

  test("stale expectedX rejected in preflight", async () => {
    const node = n({ id: "2:1", x: 10, y: 10, parent: { id: "parent:1" } });
    const result = await runFigmaScript(
      applyLayoutScript,
      mock({ "2:1": node }),
      {
        PLANS: [
          { id: "2:1", expectedX: 0, expectedY: 10, x: 100, y: 100 },
        ],
      },
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, "STALE_EXPECTED_X");
    assert.equal(node.x, 10);
  });

  test("stale expectedY rejected in preflight", async () => {
    const node = n({ id: "2:1", x: 0, y: 5, parent: { id: "parent:1" } });
    const result = await runFigmaScript(
      applyLayoutScript,
      mock({ "2:1": node }),
      {
        PLANS: [
          { id: "2:1", expectedX: 0, expectedY: 0, x: 100, y: 100 },
        ],
      },
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, "STALE_EXPECTED_Y");
    assert.equal(node.y, 5);
  });

  test("valid batch applies all plans and returns ok=true", async () => {
    const a = n({ id: "a:1", x: 0, y: 0, parent: { id: "parent:1" } });
    const b = n({ id: "b:1", x: 10, y: 20, parent: { id: "parent:1" } });
    const result = await runFigmaScript(
      applyLayoutScript,
      mock({ "a:1": a, "b:1": b }),
      {
        PLANS: [
          { id: "a:1", x: 100, y: 200 },
          { id: "b:1", x: 300, y: 400 },
        ],
      },
    );
    assert.equal(result.ok, true);
    assert.equal(result.applied, 2);
    assert.equal(a.x, 100);
    assert.equal(a.y, 200);
    assert.equal(b.x, 300);
    assert.equal(b.y, 400);
  });

  test("mutation error triggers rollback and restores previous coordinates", async () => {
    const a = n({ id: "a:1", x: 0, y: 0, parent: { id: "parent:1" } });
    const b = throwingNode("throw:1");
    const nodes = { "a:1": a, "throw:1": b };
    const result = await runFigmaScript(
      applyLayoutScript,
      mock(nodes),
      {
        PLANS: [
          { id: "a:1", x: 999, y: 999 },
          { id: "throw:1", x: 200, y: 200 },
        ],
      },
    );
    assert.equal(result.ok, false);
    // After rollback, a:1 should be back at original position
    assert.equal(a.x, 0);
    assert.equal(a.y, 0);
  });

  test("rollback failure reports APPLY_ROLLBACK_FAILED", async () => {
    const a = rollbackFailNode();
    const b = throwingNode("throw:1");
    const nodes = { "rb-fail-a": a, "throw:1": b };
    const result = await runFigmaScript(
      applyLayoutScript,
      mock(nodes),
      {
        PLANS: [
          { id: "rb-fail-a", x: 999, y: 999 },
          { id: "throw:1", x: 200, y: 200 },
        ],
      },
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, "APPLY_ROLLBACK_FAILED");
    assert.ok(result.errors.some((e) => e.includes("rollback")));
  });

  test("envelope includes common fields and legacy planned/applied/errors", async () => {
    const result = await runFigmaScript(applyLayoutScript, mock({}));
    assert.ok("ok" in result);
    assert.ok("code" in result);
    assert.ok("summary" in result);
    assert.ok(Array.isArray(result.issues));
    assert.ok("observedAt" in result);
    assert.ok("planned" in result);
    assert.ok("applied" in result);
    assert.ok(Array.isArray(result.errors));
  });
});

// ===========================================================================
// resize-section.mjs tests
// ===========================================================================

describe("resize-section.mjs", () => {
  test("empty PARENT_ID returns ok=false", async () => {
    const result = await runFigmaScript(resizeSectionScript, mock({}));
    assert.equal(result.ok, false);
    assert.equal(result.code, "EMPTY_PARENT_ID");
  });

  test("wrong parent type returns ok=false with WRONG_PARENT_TYPE", async () => {
    const textNode = n({ id: "text:1", type: "TEXT" });
    const result = await runFigmaScript(
      resizeSectionScript,
      mock({ "text:1": textNode }),
      {
        PARENT_ID: "text:1",
        EXPECTED_PARENT_TYPE: "SECTION",
        PAD_X: 80,
        PAD_Y: 200,
      },
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, "WRONG_PARENT_TYPE");
  });

  test("parent with no children returns ok=false with NO_CHILDREN", async () => {
    const emptySection = n({
      id: "section:1",
      type: "SECTION",
      children: [],
    });
    const result = await runFigmaScript(
      resizeSectionScript,
      mock({ "section:1": emptySection }),
      {
        PARENT_ID: "section:1",
        EXPECTED_PARENT_TYPE: "SECTION",
        PAD_X: 80,
        PAD_Y: 200,
      },
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, "NO_CHILDREN");
  });

  test("negative child x coordinate rejected with NEGATIVE_CHILD_COORDINATE", async () => {
    const child = n({ id: "c:1", x: -1, y: 0 });
    const section = n({
      id: "section:1",
      type: "SECTION",
      children: [child],
    });
    const result = await runFigmaScript(
      resizeSectionScript,
      mock({ "section:1": section }),
      {
        PARENT_ID: "section:1",
        EXPECTED_PARENT_TYPE: "SECTION",
        PAD_X: 80,
        PAD_Y: 200,
      },
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, "NEGATIVE_CHILD_COORDINATE");
  });

  test("negative child y coordinate rejected with NEGATIVE_CHILD_COORDINATE", async () => {
    const child = n({ id: "c:1", x: 0, y: -5 });
    const section = n({
      id: "section:1",
      type: "SECTION",
      children: [child],
    });
    const result = await runFigmaScript(
      resizeSectionScript,
      mock({ "section:1": section }),
      {
        PARENT_ID: "section:1",
        EXPECTED_PARENT_TYPE: "SECTION",
        PAD_X: 80,
        PAD_Y: 200,
      },
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, "NEGATIVE_CHILD_COORDINATE");
  });

  test("calculates right/bottom size plus padding correctly", async () => {
    const c1 = n({ id: "c:1", x: 10, y: 20, width: 100, height: 50 });
    const c2 = n({ id: "c:2", x: 200, y: 100, width: 80, height: 60 });
    const section = n({
      id: "section:1",
      type: "SECTION",
      width: 500,
      height: 300,
      children: [c1, c2],
    });
    const result = await runFigmaScript(
      resizeSectionScript,
      mock({ "section:1": section }),
      {
        PARENT_ID: "section:1",
        EXPECTED_PARENT_TYPE: "SECTION",
        PAD_X: 40,
        PAD_Y: 100,
      },
    );
    assert.equal(result.ok, true);
    assert.equal(result.code, "OK");
    // c2 right = 200+80=280, c2 bottom = 100+60=160
    // c1 right = 10+100=110, c1 bottom = 20+50=70
    // maxR = 280, maxB = 160
    // newW = ceil(280+40) = 320
    // newH = ceil(160+100) = 260
    assert.equal(result.resized.w, 320);
    assert.equal(result.resized.h, 260);
    assert.equal(section.width, 320);
    assert.equal(section.height, 260);
  });

  test("invalid (negative) PAD_X rejected with INVALID_PADDING", async () => {
    const child = n({ id: "c:1", x: 10, y: 10 });
    const section = n({
      id: "section:1",
      type: "SECTION",
      children: [child],
    });
    const result = await runFigmaScript(
      resizeSectionScript,
      mock({ "section:1": section }),
      {
        PARENT_ID: "section:1",
        EXPECTED_PARENT_TYPE: "SECTION",
        PAD_X: -10,
        PAD_Y: 100,
      },
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, "INVALID_PADDING");
  });

  test("invalid (negative) PAD_Y rejected with INVALID_PADDING", async () => {
    const child = n({ id: "c:1", x: 10, y: 10 });
    const section = n({
      id: "section:1",
      type: "SECTION",
      children: [child],
    });
    const result = await runFigmaScript(
      resizeSectionScript,
      mock({ "section:1": section }),
      {
        PARENT_ID: "section:1",
        EXPECTED_PARENT_TYPE: "SECTION",
        PAD_X: 80,
        PAD_Y: -5,
      },
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, "INVALID_PADDING");
  });

  test("resize exception returns ok=false with RESIZE_FAILED", async () => {
    const child = n({ id: "c:1", x: 10, y: 10 });
    const throwingSection = n({
      id: "section:1",
      type: "SECTION",
      children: [child],
      resize() {
        throw new Error("Simulated resize failure");
      },
    });
    const result = await runFigmaScript(
      resizeSectionScript,
      mock({ "section:1": throwingSection }),
      {
        PARENT_ID: "section:1",
        EXPECTED_PARENT_TYPE: "SECTION",
        PAD_X: 80,
        PAD_Y: 200,
      },
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, "RESIZE_FAILED");
    // Previous dimensions should still be reported
    assert.ok(result.previous !== null);
  });

  test("envelope includes common fields and legacy parent/previous/resized/padding", async () => {
    const result = await runFigmaScript(resizeSectionScript, mock({}));
    assert.ok("ok" in result);
    assert.ok("code" in result);
    assert.ok("summary" in result);
    assert.ok(Array.isArray(result.issues));
    assert.ok("observedAt" in result);
    assert.ok("parent" in result);
    assert.ok("padding" in result);
    assert.ok("previous" in result);
    assert.ok("resized" in result);
  });
});
