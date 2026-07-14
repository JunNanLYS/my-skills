// figma-helpers/overlap-check.mjs
//
// AABB intersection matrix across one or more parent nodes.
// Checks all direct children pair-wise using absoluteBoundingBox when
// available, falling back to local geometry.  Uses strict inequalities so
// edge-touching is NOT considered overlap.  Returns the common envelope
// { ok, code, summary, issues, observedAt, total, overlapPairs, overlaps }.
//
// Usage:
//   1. Set PARENT_IDS (array of node IDs) to scope the check
//   2. figma-cli run scripts/overlap-check.mjs
//
// OUTPUT_MODE: 'json' (default, machine) | 'summary' (human-readable text)

(async function () {
  // ===== 在这里改 =====
  const PARENT_IDS = [];
  const OUTPUT_MODE = "json";
  // ====================

  const issues = [];
  const allItems = [];
  const allPairs = [];

  for (const parentId of PARENT_IDS) {
    const parent = await figma.getNodeByIdAsync(parentId);
    if (!parent) {
      issues.push({
        severity: "error",
        message: "Parent " + parentId + " not found",
        parentId: parentId,
      });
      continue;
    }
    if (!("children" in parent)) {
      issues.push({
        severity: "warning",
        message:
          "Node " + parentId + " (" + parent.type + ") has no children",
        parentId: parentId,
        type: parent.type,
      });
      continue;
    }

    const items = [];
    for (const c of parent.children) {
      const bbox = c.absoluteBoundingBox;
      if (bbox) {
        items.push({
          id: c.id,
          name: c.name,
          type: c.type,
          x: bbox.x,
          y: bbox.y,
          width: bbox.width,
          height: bbox.height,
          right: bbox.x + bbox.width,
          bottom: bbox.y + bbox.height,
          source: "absoluteBoundingBox",
          parentId: parentId,
        });
      } else {
        issues.push({
          severity: "limitation",
          message:
            "Node " +
            c.id +
            " (" +
            c.name +
            ") lacks absoluteBoundingBox, using local geometry",
          nodeId: c.id,
          parentId: parentId,
        });
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
          source: "local",
          parentId: parentId,
        });
      }
    }
    allItems.push(...items);

    // Pairwise intersection within this parent (strict inequalities)
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        if (
          a.x < b.right &&
          b.x < a.right &&
          a.y < b.bottom &&
          b.y < a.bottom
        ) {
          allPairs.push({
            parentId: parentId,
            a: a.name + " (" + a.id + ")",
            aBox: [a.x, a.y, a.right, a.bottom],
            aSource: a.source,
            b: b.name + " (" + b.id + ")",
            bBox: [b.x, b.y, b.right, b.bottom],
            bSource: b.source,
          });
        }
      }
    }
  }

  if (OUTPUT_MODE === "summary") {
    if (allPairs.length === 0) {
      return (
        "Total: " +
        allItems.length +
        " children across " +
        PARENT_IDS.length +
        " parents, 0 overlap pairs"
      );
    }
    const lines = [
      "Total: " +
        allItems.length +
        " children, " +
        allPairs.length +
        " overlap pairs",
    ];
    for (const ov of allPairs) {
      lines.push("--");
      lines.push("Parent: " + ov.parentId);
      lines.push("A: " + ov.a);
      lines.push(
        "   box: x=" +
          ov.aBox[0] +
          " y=" +
          ov.aBox[1] +
          " w=" +
          (ov.aBox[2] - ov.aBox[0]) +
          " h=" +
          (ov.aBox[3] - ov.aBox[1]),
      );
      lines.push("B: " + ov.b);
      lines.push(
        "   box: x=" +
          ov.bBox[0] +
          " y=" +
          ov.bBox[1] +
          " w=" +
          (ov.bBox[2] - ov.bBox[0]) +
          " h=" +
          (ov.bBox[3] - ov.bBox[1]),
      );
    }
    return lines.join("\n");
  }

  return JSON.stringify(
    {
      ok: true,
      code: "OK",
      summary: {
        parents: PARENT_IDS.length,
        totalItems: allItems.length,
        overlapPairs: allPairs.length,
      },
      issues: issues,
      observedAt: null,
      total: allItems.length,
      overlapPairs: allPairs.length,
      overlaps: allPairs,
    },
    null,
    2,
  );
})();
