// figma-helpers/apply-layout.mjs
//
// Two-phase layout plan executor.  Reads PLANS (array of {id, x, y} with
// optional expectedParentId / expectedX / expectedY), preflights every
// plan before any mutation, then applies with automatic rollback on
// failure.
//
// Usage:
//   1. Workflow 6 CommandPlan injects TASK_ID, BASELINE_REVISION, and
//      the PLANS array via source replacement.
//   2. figma-cli run scripts/apply-layout.mjs
//
// The script never silently claims success — any preflight or mutation
// error sets ok=false.

(async function () {
  // ===== 常量 (Workflow 6 CommandPlan 注入, 空则只用显式 PLANS) =====
  const TASK_ID = "";
  const BASELINE_REVISION = "";
  const PARENT_ID = "";
  const EXPECTED_PARENT_TYPE = "";
  const PAD_X = 0;
  const PAD_Y = 0;
  // ================================================================

  // PLANS: [{ id, expectedParentId?, expectedX?, expectedY?, x, y }]
  const PLANS = [];

  // ---------------------------------------------------------------------------
  // Envelope helper — produces the common envelope plus legacy fields
  // ---------------------------------------------------------------------------
  function envelope(overrides) {
    const base = {
      ok: true,
      code: "OK",
      summary: {
        taskId: TASK_ID || null,
        baselineRevision: BASELINE_REVISION || null,
        totalPlans: PLANS.length,
      },
      issues: [],
      observedAt: null,
      planned: PLANS.length,
      applied: 0,
      errors: [],
    };
    return JSON.stringify({ ...base, ...overrides }, null, 2);
  }

  // ---------------------------------------------------------------------------
  // Phase 1 — Preflight (zero writes)
  // ---------------------------------------------------------------------------
  if (!Array.isArray(PLANS)) {
    return envelope({
      ok: false,
      code: "PLANS_NOT_ARRAY",
      issues: [{ severity: "error", message: "PLANS is not an array" }],
      errors: ["PLANS is not an array"],
    });
  }

  if (PLANS.length === 0) {
    return envelope({
      ok: false,
      code: "EMPTY_PLANS",
      planned: 0,
      summary: {
        taskId: TASK_ID || null,
        baselineRevision: BASELINE_REVISION || null,
        totalPlans: 0,
      },
      issues: [{ severity: "error", message: "PLANS is empty" }],
    });
  }

  const seenIds = new Set();
  for (const plan of PLANS) {
    // Validate plan shape
    if (!plan || typeof plan.id !== "string") {
      return envelope({
        ok: false,
        code: "INVALID_PLAN",
        issues: [{ severity: "error", message: "Plan missing string id" }],
        errors: ["Plan missing string id"],
      });
    }

    // Duplicate ID
    if (seenIds.has(plan.id)) {
      return envelope({
        ok: false,
        code: "DUPLICATE_PLAN_ID",
        issues: [
          {
            severity: "error",
            message: "Duplicate plan id: " + plan.id,
          },
        ],
        errors: ["Duplicate plan id: " + plan.id],
      });
    }
    seenIds.add(plan.id);

    // Non-finite coordinates
    if (!Number.isFinite(plan.x) || !Number.isFinite(plan.y)) {
      return envelope({
        ok: false,
        code: "NON_FINITE_COORDINATE",
        issues: [
          {
            severity: "error",
            message:
              "Plan " +
              plan.id +
              " has non-finite coordinates: x=" +
              plan.x +
              " y=" +
              plan.y,
          },
        ],
        errors: [
          "Plan " +
            plan.id +
            " has non-finite coordinates",
        ],
      });
    }

    // Node existence
    const node = await figma.getNodeByIdAsync(plan.id);
    if (!node) {
      return envelope({
        ok: false,
        code: "NODE_NOT_FOUND",
        issues: [
          {
            severity: "error",
            message: "Node not found: " + plan.id,
          },
        ],
        errors: ["Node not found: " + plan.id],
      });
    }

    // Parent check
    if (plan.expectedParentId != null) {
      const actualParentId = node.parent ? node.parent.id : null;
      if (actualParentId !== plan.expectedParentId) {
        return envelope({
          ok: false,
          code: "WRONG_PARENT",
          issues: [
            {
              severity: "error",
              message:
                "Node " +
                plan.id +
                " expected parent " +
                plan.expectedParentId +
                " but got " +
                actualParentId,
            },
          ],
          errors: [
            "Node " +
              plan.id +
              " parent mismatch: expected " +
              plan.expectedParentId +
              " actual " +
              actualParentId,
          ],
        });
      }
    }

    // Stale coordinate checks
    if (typeof plan.expectedX === "number" && node.x !== plan.expectedX) {
      return envelope({
        ok: false,
        code: "STALE_EXPECTED_X",
        issues: [
          {
            severity: "error",
            message:
              "Node " +
              plan.id +
              " expected x=" +
              plan.expectedX +
              " but current x=" +
              node.x,
          },
        ],
        errors: [
          "Node " +
            plan.id +
            " stale expectedX: " +
            plan.expectedX +
            " != " +
            node.x,
        ],
      });
    }
    if (typeof plan.expectedY === "number" && node.y !== plan.expectedY) {
      return envelope({
        ok: false,
        code: "STALE_EXPECTED_Y",
        issues: [
          {
            severity: "error",
            message:
              "Node " +
              plan.id +
              " expected y=" +
              plan.expectedY +
              " but current y=" +
              node.y,
          },
        ],
        errors: [
          "Node " +
            plan.id +
            " stale expectedY: " +
            plan.expectedY +
            " != " +
            node.y,
        ],
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 2 — Apply with rollback
  // ---------------------------------------------------------------------------
  const previousCoords = [];
  const applied = [];
  const errors = [];

  for (const plan of PLANS) {
    const node = await figma.getNodeByIdAsync(plan.id);
    previousCoords.push({ id: plan.id, x: node.x, y: node.y });
    try {
      node.x = plan.x;
      node.y = plan.y;
      applied.push(plan.id);
    } catch (e) {
      errors.push(plan.id + ": " + (e.message || String(e)));

      // Rollback previously moved nodes in reverse order
      const rollbackErrors = [];
      for (let i = previousCoords.length - 1; i >= 0; i--) {
        const pc = previousCoords[i];
        const rbNode = await figma.getNodeByIdAsync(pc.id);
        if (rbNode) {
          try {
            rbNode.x = pc.x;
            rbNode.y = pc.y;
          } catch (rbE) {
            rollbackErrors.push(
              "rollback " + pc.id + ": " + (rbE.message || String(rbE)),
            );
          }
        } else {
          rollbackErrors.push("rollback " + pc.id + ": node vanished");
        }
      }

      return envelope({
        ok: false,
        code:
          rollbackErrors.length > 0 ? "APPLY_ROLLBACK_FAILED" : "APPLY_FAILED",
        applied: applied.length,
        issues: [
          {
            severity: "error",
            message:
              "Apply failed at " +
              plan.id +
              " with " +
              (rollbackErrors.length > 0
                ? rollbackErrors.length + " rollback error(s)"
                : "clean rollback"),
          },
        ],
        errors: errors.concat(rollbackErrors),
      });
    }
  }

  return envelope({
    ok: true,
    applied: applied.length,
    errors: errors,
  });
})();
