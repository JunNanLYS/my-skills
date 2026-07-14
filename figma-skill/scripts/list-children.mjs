// figma-helpers/list-children.mjs
//
// Read-only helper: list all direct children of a Figma node with local
// geometry and (where available) absoluteBoundingBox.  Returns the common
// envelope { ok, code, summary, issues, observedAt, parent, count, items }.
//
// Usage:
//   1. Set PARENT_ID to the target parent node ID
//   2. figma-cli run scripts/list-children.mjs
//
// Optional: set ONLY_TYPE to a Figma node type string (e.g. 'FRAME') to
// filter results.

(async function () {
  // ===== 在这里改 =====
  const PARENT_ID = "";
  const ONLY_TYPE = null; // 例如 'FRAME' / 'COMPONENT' / 'TEXT' / null(全部)
  // ====================

  if (!PARENT_ID) {
    return JSON.stringify({
      ok: false,
      code: "EMPTY_PARENT_ID",
      summary: { parentId: PARENT_ID },
      issues: [{ severity: "error", message: "PARENT_ID is empty" }],
      observedAt: null,
      parent: PARENT_ID,
      count: 0,
      items: [],
    });
  }

  const parent = await figma.getNodeByIdAsync(PARENT_ID);
  if (!parent) {
    return JSON.stringify({
      ok: false,
      code: "NODE_NOT_FOUND",
      summary: { parentId: PARENT_ID },
      issues: [
        {
          severity: "error",
          message: "Parent node " + PARENT_ID + " not found",
        },
      ],
      observedAt: null,
      parent: PARENT_ID,
      count: 0,
      items: [],
    });
  }

  if (!("children" in parent)) {
    return JSON.stringify({
      ok: false,
      code: "NO_CHILDREN",
      summary: { parentId: PARENT_ID, type: parent.type },
      issues: [
        {
          severity: "error",
          message: "Node " + PARENT_ID + " (" + parent.type + ") has no children",
        },
      ],
      observedAt: null,
      parent: PARENT_ID,
      count: 0,
      items: [],
    });
  }

  const issues = [];
  const items = [];
  for (const c of parent.children) {
    if (ONLY_TYPE && c.type !== ONLY_TYPE) continue;

    const bbox = c.absoluteBoundingBox;
    let absBox = null;
    if (bbox) {
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
        message:
          "Node " +
          c.id +
          " (" +
          c.name +
          ") has no absoluteBoundingBox, using local geometry",
        nodeId: c.id,
      });
    }

    items.push({
      id: c.id,
      name: c.name,
      type: c.type,
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height,
      right: c.x + c.width,
      bottom: c.y + c.height,
      absoluteBoundingBox: absBox,
    });
  }

  return JSON.stringify(
    {
      ok: true,
      code: "OK",
      summary: {
        parentId: PARENT_ID,
        total: parent.children.length,
        returned: items.length,
      },
      issues: issues,
      observedAt: null,
      parent: PARENT_ID,
      count: items.length,
      items: items,
    },
    null,
    2,
  );
})();
