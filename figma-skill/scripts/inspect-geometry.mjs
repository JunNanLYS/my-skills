// figma-helpers/inspect-geometry.mjs
//
// Read-only helper: inspect a single Figma node's detailed geometry.
// Returns identity, local geometry, absoluteBoundingBox, layout mode,
// sizing strategy, constraints, and auto-layout child properties.
//
// Usage:
//   1. Set NODE_ID to the target node ID
//   2. figma-cli run scripts/inspect-geometry.mjs

(async function () {
  // ===== 在这里改 =====
  const NODE_ID = "";
  // ====================

  if (!NODE_ID) {
    return JSON.stringify({
      ok: false,
      code: "EMPTY_NODE_ID",
      summary: {},
      issues: [{ severity: "error", message: "NODE_ID is empty" }],
      observedAt: null,
    });
  }

  const node = await figma.getNodeByIdAsync(NODE_ID);
  if (!node) {
    return JSON.stringify({
      ok: false,
      code: "NODE_NOT_FOUND",
      summary: { nodeId: NODE_ID },
      issues: [
        { severity: "error", message: "Node " + NODE_ID + " not found" },
      ],
      observedAt: null,
    });
  }

  const issues = [];
  const bbox = node.absoluteBoundingBox;
  let absBox = null;
  let absAvailable = false;
  if (bbox) {
    absAvailable = true;
    absBox = {
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
      right: bbox.x + bbox.width,
      bottom: bbox.y + bbox.height,
    };
  } else {
    issues.push({
      severity: "limitation",
      message: "Node " + NODE_ID + " has no absoluteBoundingBox",
    });
  }

  return JSON.stringify(
    {
      ok: true,
      code: "OK",
      summary: {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
      },
      issues: issues,
      observedAt: null,
      identity: {
        id: node.id,
        name: node.name,
        type: node.type,
        parentId: node.parent ? node.parent.id : null,
      },
      localGeometry: {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        right: node.x + node.width,
        bottom: node.y + node.height,
      },
      absoluteBoundingBox: absBox,
      absoluteBoundingBoxAvailable: absAvailable,
      layout: {
        layoutMode: node.layoutMode || "NONE",
        primaryAxisSizingMode: node.primaryAxisSizingMode || "FIXED",
        counterAxisSizingMode: node.counterAxisSizingMode || "FIXED",
      },
      constraints: node.constraints
        ? {
            horizontal: node.constraints.horizontal,
            vertical: node.constraints.vertical,
          }
        : null,
      autoLayoutChild: {
        layoutAlign: node.layoutAlign != null ? node.layoutAlign : null,
        layoutGrow: node.layoutGrow != null ? node.layoutGrow : null,
        layoutPositioning:
          node.layoutPositioning != null ? node.layoutPositioning : null,
      },
    },
    null,
    2,
  );
})();
