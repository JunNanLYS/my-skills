import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  assertValidConfig,
  assertValidEvent,
  assertValidIndex,
  assertValidTaskState,
} from "../scripts/lib/task-state/validate.mjs";
import {
  ARCHIVE_STATUSES,
  EVENT_TYPES,
  RESUMABLE_STATUSES,
  TASK_STATUSES,
  TERMINAL_STATUSES,
  TRANSITIONS,
} from "../scripts/lib/task-state/model.mjs";
import { ERROR_CODES, TaskStateError } from "../scripts/lib/task-state/errors.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const validState = Object.freeze({
  schemaVersion: 1,
  revision: 0,
  taskId: "20260714-checkout-responsive",
  title: "Checkout responsive states",
  taskType: "Modify",
  writeRequired: true,
  status: "DRAFT",
  archiveStatus: "NOT_ARCHIVED",
  currentWorkflow: "0B",
  gate: "TaskClassificationGate",
  gateStatus: "PENDING",
  approval: { designSystem: "NOT_REQUIRED", figmaWrite: "PENDING" },
  batch: { current: 0, lastCompleted: 0 },
  correctionRounds: 0,
  resume: { required: false, lastCheckpoint: "task-created", liveRevalidation: "REQUIRED" },
  observedContext: { figmaFile: null, page: null, nodeIds: [] },
  validation: { visual: { required: true, reviewed: false, summary: null } },
  evidenceRefs: [],
  relatedTasks: [],
  updatedAt: "2026-07-14T10:42:00+08:00",
});

const validConfig = Object.freeze({
  schemaVersion: 1,
  defaultBranch: "main",
  taskIdFormat: "YYYYMMDD-slug",
  leaseMinutes: 30,
  evidencePolicy: "tracked",
  redactionPolicy: "strict",
});

const validIndex = Object.freeze({
  schemaVersion: 1,
  updatedAt: "2026-07-14T10:42:00+08:00",
  tasks: [
    {
      taskId: "20260714-checkout-responsive",
      title: "Checkout responsive states",
      status: "DRAFT",
      archiveStatus: "NOT_ARCHIVED",
      updatedAt: "2026-07-14T10:42:00+08:00",
    },
    {
      taskId: "20260714-checkout-responsive-02",
      title: "Checkout responsive states follow-up",
      status: "COMPLETED",
      archiveStatus: "ARCHIVED",
      updatedAt: "2026-07-14T11:42:00+08:00",
    },
  ],
});

const validEvent = Object.freeze({
  schemaVersion: 1,
  eventId: "evt-20260714-104200-001",
  taskId: "20260714-checkout-responsive",
  revision: 0,
  type: "TASK_CREATED",
  actor: "claude",
  at: "2026-07-14T10:42:00+08:00",
  evidence: [],
});

function assertStateInvalid(fn) {
  assert.throws(
    fn,
    (error) => error instanceof TaskStateError && error.code === "STATE_INVALID",
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("exports stable task-state error codes and constants", () => {
  assert.deepEqual(ERROR_CODES, [
    "PROJECT_NOT_INITIALIZED",
    "SCHEMA_UNSUPPORTED",
    "STATE_INVALID",
    "REVISION_CONFLICT",
    "LEASE_HELD",
    "LEASE_EXPIRED",
    "LEASE_LOST",
    "TASK_NOT_FOUND",
    "ILLEGAL_TRANSITION",
    "PLAN_NOT_APPROVED",
    "LIVE_REVALIDATION_REQUIRED",
    "EVIDENCE_MISSING",
    "SENSITIVE_DATA_REJECTED",
    "PATH_OUTSIDE_PROJECT",
    "ARCHIVE_FAILED",
  ]);
  assert.ok(Object.isFrozen(ERROR_CODES));
  assert.ok(Object.isFrozen(TASK_STATUSES));
  assert.ok(Object.isFrozen(TERMINAL_STATUSES));
  assert.ok(Object.isFrozen(RESUMABLE_STATUSES));
  assert.ok(Object.isFrozen(ARCHIVE_STATUSES));
  assert.ok(Object.isFrozen(EVENT_TYPES));
  assert.ok(Object.isFrozen(TRANSITIONS));
  assert.ok(TASK_STATUSES.includes("CANCELLED"));
  assert.ok(TERMINAL_STATUSES.includes("CANCELLED"));
  assert.ok(TRANSITIONS.CANCELLED);
  assert.equal(TRANSITIONS.DRAFT.readOnly.includes("WAITING_WRITE_APPROVAL"), false);
  assert.equal(TRANSITIONS.NEEDS_REPLAN.readOnly.includes("WAITING_WRITE_APPROVAL"), false);
});

test("accepts valid config, index, task state, and event without mutating them", () => {
  for (const [name, validator, value] of [
    ["config", assertValidConfig, validConfig],
    ["index", assertValidIndex, validIndex],
    ["task state", assertValidTaskState, validState],
    ["event", assertValidEvent, validEvent],
  ]) {
    const subject = clone(value);
    const before = JSON.stringify(subject);
    assert.equal(validator(subject), subject, name);
    assert.equal(JSON.stringify(subject), before, `${name} mutated`);
  }
});

test("rejects invalid task-state fields and relationships", () => {
  const cases = [
    ["negative revision", { revision: -1 }],
    ["unknown root property", { unexpected: true }],
    ["unknown nested property", { approval: { ...validState.approval, extra: true } }],
    ["unknown status", { status: "DONE" }],
    ["malformed task id", { taskId: "checkout-responsive" }],
    ["archived non-terminal", { status: "DRAFT", archiveStatus: "ARCHIVED" }],
    ["date-only updatedAt", { updatedAt: "2026-07-14" }],
    ["array where object expected", []],
  ];

  for (const [name, patch] of cases) {
    assertStateInvalid(() => {
      const subject = Array.isArray(patch) ? patch : { ...validState, ...patch };
      assertValidTaskState(subject);
    }, name);
  }
});

test("rejects invalid task index data", () => {
  assertStateInvalid(() =>
    assertValidIndex({
      ...validIndex,
      tasks: [validIndex.tasks[0], { ...validIndex.tasks[1], taskId: validIndex.tasks[0].taskId }],
    }),
  );
  assertStateInvalid(() => assertValidIndex({ ...validIndex, extra: true }));
  assertStateInvalid(() =>
    assertValidIndex({
      ...validIndex,
      tasks: [{ ...validIndex.tasks[0], taskId: "bad_id" }],
    }),
  );
  assertStateInvalid(() =>
    assertValidIndex({
      ...validIndex,
      tasks: [{ ...validIndex.tasks[0], status: "DRAFT", archiveStatus: "ARCHIVED" }],
    }),
  );
});

test("rejects unknown event types and malformed event fields", () => {
  assertStateInvalid(() => assertValidEvent({ ...validEvent, type: "UNKNOWN_EVENT" }));
  assertStateInvalid(() => assertValidEvent({ ...validEvent, evidence: "missing-array" }));
  assertStateInvalid(() => assertValidEvent({ ...validEvent, extra: true }));
});

test("accepts valid event.details with known typed keys", () => {
  const leaseAcquired = {
    ...validEvent,
    type: "LEASE_ACQUIRED",
    details: {
      holder: "claude",
      expiry: "2026-07-14T11:12:00+08:00",
    },
  };
  const leaseTakenOver = {
    ...validEvent,
    type: "LEASE_TAKEN_OVER",
    details: {
      priorHolder: "other-agent",
      newHolder: "claude",
      reason: "lease-expired",
    },
  };
  const approvalRecorded = {
    ...validEvent,
    type: "APPROVAL_RECORDED",
    details: {
      gate: "TaskClassificationGate",
      gateStatus: "PASS",
      priorStatus: "DRAFT",
      nextStatus: "READY",
    },
  };
  const workflowEntered = {
    ...validEvent,
    type: "WORKFLOW_ENTERED",
    details: {
      priorWorkflow: "0B",
      nextWorkflow: "4A",
    },
  };
  const todoUpdated = {
    ...validEvent,
    type: "TODO_UPDATED",
    details: {
      todo: ["node:123", "node:456"],
    },
  };
  const batchStarted = {
    ...validEvent,
    type: "BATCH_STARTED",
    details: {
      batch: 2,
    },
  };
  const batchCompleted = {
    ...validEvent,
    type: "BATCH_COMPLETED",
    details: {
      batch: 1,
    },
  };
  const validationRecorded = {
    ...validEvent,
    type: "VALIDATION_RECORDED",
    details: {
      evidence: ["screenshot-001.png"],
    },
  };
  const taskArchived = {
    ...validEvent,
    type: "TASK_ARCHIVED",
    details: {
      priorStatus: "COMPLETED",
      deletion: { ids: ["task-state.json"] },
    },
  };

  for (const [name, event] of [
    ["lease-acquired", leaseAcquired],
    ["lease-taken-over", leaseTakenOver],
    ["approval-recorded", approvalRecorded],
    ["workflow-entered", workflowEntered],
    ["todo-updated", todoUpdated],
    ["batch-started", batchStarted],
    ["batch-completed", batchCompleted],
    ["validation-recorded", validationRecorded],
    ["task-archived", taskArchived],
  ]) {
    assert.doesNotThrow(() => assertValidEvent(event), name);
  }
});

test("rejects event.details with unknown keys", () => {
  assertStateInvalid(() =>
    assertValidEvent({
      ...validEvent,
      type: "LEASE_ACQUIRED",
      details: { holder: "claude", unknownField: "bad" },
    }),
  );
  assertStateInvalid(() =>
    assertValidEvent({
      ...validEvent,
      type: "TASK_CREATED",
      details: { spurious: true },
    }),
  );
});

test("rejects event.details with wrong value types for known keys", () => {
  assertStateInvalid(() =>
    assertValidEvent({
      ...validEvent,
      type: "LEASE_ACQUIRED",
      details: { holder: 123 },
    }),
  );
  assertStateInvalid(() =>
    assertValidEvent({
      ...validEvent,
      type: "LEASE_ACQUIRED",
      details: { expiry: "not-a-datetime" },
    }),
  );
});

test("rejects sensitive values in config", () => {
  for (const secretish of [
    { apiKey: "figd_secret" },
    { token: "secret-token" },
    { auth: { password: "hunter2" } },
    { stateDir: ".claude/figma-task-state", note: "contains SECRET=abc" },
  ]) {
    assert.throws(
      () => assertValidConfig({ ...validConfig, ...secretish }),
      (error) => error instanceof TaskStateError && error.code === "SENSITIVE_DATA_REJECTED",
    );
  }
});

test("published JSON schemas declare strict draft 2020-12 object contracts", () => {
  for (const filename of [
    "config.schema.json",
    "index.schema.json",
    "task-state.schema.json",
    "event.schema.json",
  ]) {
    const schema = JSON.parse(readFileSync(join(root, "schemas", filename), "utf8"));
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema", filename);
    assert.equal(schema.type, "object", filename);
    assert.equal(schema.additionalProperties, false, filename);
    assert.ok(Array.isArray(schema.required), filename);
    assert.equal(schema.properties.schemaVersion.const, 1, filename);
  }
});

test("event.schema.json priorStatus and nextStatus expose exactly TASK_STATUSES", () => {
  const schema = JSON.parse(readFileSync(join(root, "schemas", "event.schema.json"), "utf8"));
  const priorStatus = schema.$defs.eventDetails.properties.priorStatus;
  const nextStatus = schema.$defs.eventDetails.properties.nextStatus;

  // Both fields must be present and typed as string with enum
  assert.ok(priorStatus, "priorStatus must exist in $defs.eventDetails.properties");
  assert.ok(nextStatus, "nextStatus must exist in $defs.eventDetails.properties");
  assert.equal(priorStatus.type, "string", "priorStatus must be type string");
  assert.equal(nextStatus.type, "string", "nextStatus must be type string");

  // Enum must exist and contain exactly the TASK_STATUSES values
  assert.ok(Array.isArray(priorStatus.enum), "priorStatus must have enum array");
  assert.ok(Array.isArray(nextStatus.enum), "nextStatus must have enum array");

  // Set comparison: schema enum should match TASK_STATUSES exactly
  assert.deepEqual(
    new Set(priorStatus.enum),
    new Set(TASK_STATUSES),
    "priorStatus enum must match TASK_STATUSES exactly",
  );
  assert.deepEqual(
    new Set(nextStatus.enum),
    new Set(TASK_STATUSES),
    "nextStatus enum must match TASK_STATUSES exactly",
  );
});

test("runtime rejects invalid status values in event.details priorStatus and nextStatus", () => {
  const invalidStatuses = ["INVALID_STATUS", "done", "COMPLETE", "unknown"];

  for (const invalidStatus of invalidStatuses) {
    assertStateInvalid(() =>
      assertValidEvent({
        ...validEvent,
        type: "APPROVAL_RECORDED",
        details: { priorStatus: invalidStatus, nextStatus: "DRAFT" },
      }),
      `invalid priorStatus: ${invalidStatus}`,
    );

    assertStateInvalid(() =>
      assertValidEvent({
        ...validEvent,
        type: "APPROVAL_RECORDED",
        details: { priorStatus: "DRAFT", nextStatus: invalidStatus },
      }),
      `invalid nextStatus: ${invalidStatus}`,
    );
  }
});
