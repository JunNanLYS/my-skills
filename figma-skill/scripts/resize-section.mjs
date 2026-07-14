// figma-helpers/resize-section.mjs
//
// Fail-closed section resizer.  Validates the container node, rejects
// negative child coordinates, computes the bounding box of all children,
// then applies approved padding.  Never silently catches resize errors.
//
// Usage:
//   1. Workflow 6 CommandPlan injects TASK_ID, BASELINE_REVISION,
//      PARENT_ID, EXPECTED_PARENT_TYPE, PAD_X, PAD_Y.
//   2. figma-cli run scripts/resize-section.mjs

(async function () {
  // ===== 常量 (Workflow 6 CommandPlan 注入) =====
  const TASK_ID = "";
  const BASELINE_REVISION = "";
  const PARENT_ID = "";
  const EXPECTED_PARENT_TYPE = "";
  const PAD_X = 0;
  const PAD_Y = 0;
  // ==============================================

  // ---------------------------------------------------------------------------
  // Envelope helper
  // ---------------------------------------------------------------------------
  function envelope(overrides) {
    const base = {
      ok: true,
      code: "OK",
      summary: {
        taskId: TASK_ID || null,
        baselineRevision: BASELINE_REVISION || null,
        parentId: PARENT_ID || null,
        parentType: null,
      },
      issues: [],
      observedAt: null,
      parent: PARENT_ID || null,
      previous: null,
      resized: null,
      padding: { x: PAD_X, y: PAD_Y },
    };
    return JSON.stringify({ ...base, ...overrides }, null, 2);
  }

  // ---------------------------------------------------------------------------
  // 1. Validate PARENT_ID
  // ---------------------------------------------------------------------------
  if (!PARENT_ID) {
    return envelope({
      ok: false,
      code: "EMPTY_PARENT_ID",
      parent: PARENT_ID,
      summary: {
        taskId: TASK_ID || null,
        baselineRevision: BASELINE_REVISION || null,
        parentId: PARENT_ID,
        parentType: null,
      },
      issues: [
        {
          severity: "error",
          message: "PARENT_ID is empty",
        },
      ],
    });
  }

  // ---------------------------------------------------------------------------
  // 2. Node lookup
  // ---------------------------------------------------------------------------
  const parent = await figma.getNodeByIdAsync(PARENT_ID);
  if (!parent) {
    return envelope({
      ok: false,
      code: "NODE_NOT_FOUND",
      summary: {
        taskId: TASK_ID || null,
        baselineRevision: BASELINE_REVISION || null,
        parentId: PARENT_ID,
        parentType: null,
      },
      issues: [
        {
          severity: "error",
          message: "Parent node " + PARENT_ID + " not found",
        },
      ],
    });
  }

  // Attach parent type to summary
  const baseSummaryWithType = {
    taskId: TASK_ID || null,
    baselineRevision: BASELINE_REVISION || null,
    parentId: PARENT_ID,
    parentType: parent.type,
  };

  // ---------------------------------------------------------------------------
  // 3. Container type check
  // ---------------------------------------------------------------------------
  if (EXPECTED_PARENT_TYPE && parent.type !== EXPECTED_PARENT_TYPE) {
    return envelope({
      ok: false,
      code: "WRONG_PARENT_TYPE",
      summary: baseSummaryWithType,
      issues: [
        {
          severity: "error",
          message:
            "Expected parent type " +
            EXPECTED_PARENT_TYPE +
            " but got " +
            parent.type,
        },
      ],
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Children check
  // ---------------------------------------------------------------------------
  const childNodes = parent.children;
  if (!childNodes || childNodes.length === 0) {
    return envelope({
      ok: false,
      code: "NO_CHILDREN",
      summary: baseSummaryWithType,
      parent: PARENT_ID,
      previous: { w: parent.width, h: parent.height },
      issues: [
        {
          severity: "error",
          message: "Parent " + PARENT_ID + " has no children",
        },
      ],
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Negative child coordinate check
  // ---------------------------------------------------------------------------
  for (const child of childNodes) {
    if (child.x < 0 || child.y < 0) {
      return envelope({
        ok: false,
        code: "NEGATIVE_CHILD_COORDINATE",
        summary: baseSummaryWithType,
        parent: PARENT_ID,
        previous: { w: parent.width, h: parent.height },
        padding: { x: PAD_X, y: PAD_Y },
        issues: [
          {
            severity: "error",
            message:
              "Child " +
              child.id +
              " (" +
              child.name +
              ") has negative coordinate x=" +
              child.x +
              " y=" +
              child.y,
          },
        ],
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Padding validation
  // ---------------------------------------------------------------------------
  if (
    typeof PAD_X !== "number" ||
    typeof PAD_Y !== "number" ||
    !Number.isFinite(PAD_X) ||
    !Number.isFinite(PAD_Y) ||
    PAD_X < 0 ||
    PAD_Y < 0
  ) {
    return envelope({
      ok: false,
      code: "INVALID_PADDING",
      summary: baseSummaryWithType,
      parent: PARENT_ID,
      previous: { w: parent.width, h: parent.height },
      padding: { x: PAD_X, y: PAD_Y },
      issues: [
        {
          severity: "error",
          message:
            "Invalid padding: PAD_X=" +
            PAD_X +
            " PAD_Y=" +
            PAD_Y +
            " (must be non-negative finite numbers)",
        },
      ],
    });
  }

  // ---------------------------------------------------------------------------
  // 7. Compute new dimensions
  // ---------------------------------------------------------------------------
  let maxR = 0;
  let maxB = 0;
  for (const child of childNodes) {
    const right = child.x + child.width;
    const bottom = child.y + child.height;
    if (right > maxR) maxR = right;
    if (bottom > maxB) maxB = bottom;
  }

  const newW = Math.ceil(maxR + PAD_X);
  const newH = Math.ceil(maxB + PAD_Y);
  const prev = { w: parent.width, h: parent.height };

  // ---------------------------------------------------------------------------
  // 8. Apply resize (fail-closed on exception)
  // ---------------------------------------------------------------------------
  try {
    parent.resize(newW, newH);
  } catch (e) {
    return envelope({
      ok: false,
      code: "RESIZE_FAILED",
      summary: baseSummaryWithType,
      parent: PARENT_ID,
      previous: prev,
      resized: null,
      issues: [
        {
          severity: "error",
          message: "resize failed: " + (e.message || String(e)),
        },
      ],
    });
  }

  return envelope({
    ok: true,
    summary: baseSummaryWithType,
    parent: PARENT_ID,
    previous: prev,
    resized: { w: newW, h: newH },
    padding: { x: PAD_X, y: PAD_Y },
  });
})();
