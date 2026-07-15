import assert from "node:assert/strict";
import { test } from "node:test";
import { assertValidPlan } from "../scripts/lib/task-state/validate.mjs";
import { TaskStateError } from "../scripts/lib/task-state/errors.mjs";

const goodPlan = {
  clipWhitelist: [
    { nodeId: "1741:439", rationale: "Library preview card — internal scroll is intentional" },
  ],
  writeOrder: [
    { step: 1, command: 'figma-cli create section --name "News" --parent P1 --check-exists' },
  ],
};

test("accepts plan with valid clipWhitelist and writeOrder", () => {
  assert.doesNotThrow(() => assertValidPlan(goodPlan));
});

test("accepts plan with empty clipWhitelist and writeOrder (default-deny)", () => {
  assert.doesNotThrow(() => assertValidPlan({ clipWhitelist: [], writeOrder: [] }));
});

test("accepts plan with absent clipWhitelist and writeOrder (treated as empty)", () => {
  assert.doesNotThrow(() => assertValidPlan({}));
});

test("rejects clipWhitelist entry with rationale shorter than 5 chars", () => {
  assert.throws(
    () => assertValidPlan({ clipWhitelist: [{ nodeId: "1:2", rationale: "no" }], writeOrder: [] }),
    (err) => err instanceof TaskStateError && err.code === "PLAN_INVALID",
  );
});

test("rejects clipWhitelist entry with missing nodeId", () => {
  assert.throws(
    () => assertValidPlan({ clipWhitelist: [{ rationale: "scroll container" }], writeOrder: [] }),
    (err) => err instanceof TaskStateError && err.code === "PLAN_INVALID",
  );
});