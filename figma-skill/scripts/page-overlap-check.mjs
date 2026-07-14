// figma-helpers/page-overlap-check.mjs
//
// Read-only helper: check all direct children of the current page for AABB
// overlap.  Uses absoluteBoundingBox when available with strict inequality
// edge test.  Returns the common envelope
// { ok, code, summary, issues, observedAt, total, overlapPairs, overlaps }.
//
// Usage:
//   figma-cli run scripts/page-overlap-check.mjs
//
// OUTPUT_MODE: 'json' (default, machine) | 'summary' (human-readable text)

(async function () {
  // ===== 在这里改 =====
  const OUTPUT_MODE = "json";
  // ====================

  const issues = [];
  const children = figma.currentPage.children;
  const items = [];

  for (const c of children) {
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
      });
    }
  }

  const pairs = [];
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
        pairs.push({
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

  if (OUTPUT_MODE === "summary") {
    if (pairs.length === 0) {
      return (
        "Total: " + items.length + " page children, 0 overlap pairs"
      );
    }
    const lines = [
      "Total: " +
        items.length +
        " page children, " +
        pairs.length +
        " overlap pairs",
    ];
    for (const ov of pairs) {
      lines.push("--");
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
        totalItems: items.length,
        overlapPairs: pairs.length,
      },
      issues: issues,
      observedAt: null,
      total: items.length,
      overlapPairs: pairs.length,
      overlaps: pairs,
    },
    null,
    2,
  );
})();
