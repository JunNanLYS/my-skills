import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { spawnSync } from "node:child_process";

import { TaskStateError } from "../scripts/lib/task-state/errors.mjs";
import { checkpointTask } from "../scripts/lib/task-state/checkpoint.mjs";
import { acquireLease } from "../scripts/lib/task-state/lease.mjs";
import { readTask } from "../scripts/lib/task-state/store.mjs";
import {
  parseTodoDocument,
  renderTodoDocument,
} from "../scripts/lib/task-state/evidence.mjs";

const REPO_ROOT = resolve(join(import.meta.dirname, "..", ".."));
const SCRIPT = join(REPO_ROOT, "figma-skill", "scripts", "figma-task-state.mjs");

function runCli(project, args) {
  return spawnSync(process.execPath, [SCRIPT, "--project", project, ...args], {
    encoding: "utf8",
    env: { ...process.env, FIGMA_TASK_STATE_NO_DAEMON: "1" },
  });
}

function freshProject() {
  const project = mkdtempSync(join(tmpdir(), "figma-task-state-checkpoint-"));
  return { project, cleanup: () => rmSync(project, { recursive: true, force: true }) };
}

function initProject(project) {
  const result = runCli(project, ["init-project", "--default-branch", "main", "--json"]);
  assert.equal(result.status, 0, result.stderr);
}

function createTask(project, overrides = {}) {
  const taskId = overrides.taskId ?? "20260714-checkout-responsive";
  const result = runCli(project, [
    "create",
    "--task", taskId,
    "--title", overrides.title ?? "Checkout responsive states",
    "--type", overrides.type ?? "Modify",
    "--write-required", overrides.writeRequired ?? "true",
    "--json",
  ]);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout).data.state;
}

const T0 = "2026-07-14T10:00:00+08:00";
const T0_PLUS_15 = "2026-07-14T10:15:00+08:00";

// ---------------------------------------------------------------------------
// Todo document parsing and rendering
// ---------------------------------------------------------------------------

test("parseTodoDocument parses canonical 4-line todo items", () => {
  const doc = [
    "# Task todos",
    "",
    "Task id: `20260714-test-task`",
    "Updated: 2026-07-14T10:00:00+08:00",
    "",
    "## Open",
    "",
    '- [ ] T-001 Re-read target Section children',
    '  - workflow: 7',
    '  - blockedBy: []',
    '  - evidence: []',
    "",
    '- [ ] T-002 Add responsive breakpoints',
    '  - workflow: 8',
    '  - blockedBy: ["T-001"]',
    '  - evidence: []',
    "",
    "## In progress",
    "",
    "No item is in progress; T-001 is the next canonical action.",
    "",
    "## Done",
    "",
    '- [x] T-003 Task ledger created',
    '  - workflow: 0B',
    '  - blockedBy: []',
    '  - evidence: ["EV-0001"]',
    "",
  ].join("\n");

  const todos = parseTodoDocument(doc);
  assert.equal(todos.length, 3);

  // T-001 — open
  assert.equal(todos[0].id, "T-001");
  assert.equal(todos[0].text, "Re-read target Section children");
  assert.equal(todos[0].status, "open");
  assert.equal(todos[0].workflow, "7");
  assert.deepEqual(todos[0].blockedBy, []);
  assert.deepEqual(todos[0].evidence, []);

  // T-002 — open, blocked by T-001
  assert.equal(todos[1].id, "T-002");
  assert.equal(todos[1].text, "Add responsive breakpoints");
  assert.equal(todos[1].status, "open");
  assert.deepEqual(todos[1].blockedBy, ["T-001"]);

  // T-003 — done
  assert.equal(todos[2].id, "T-003");
  assert.equal(todos[2].status, "done");
  assert.deepEqual(todos[2].evidence, ["EV-0001"]);
});

test("parseTodoDocument rejects unknown metadata keys", () => {
  const doc = [
    "## Open",
    "",
    '- [ ] T-001 Some task',
    '  - workflow: 7',
    '  - blockedBy: []',
    '  - evidence: []',
    '  - unknownKey: "bad"',
    "",
  ].join("\n");

  assert.throws(
    () => parseTodoDocument(doc),
    (err) => err instanceof TaskStateError && err.code === "STATE_INVALID",
  );
});

test("parseTodoDocument rejects malformed indentation", () => {
  const doc = [
    "## Open",
    "",
    '- [ ] T-001 First task',
    '  - workflow: 7',
    '  - blockedBy: []',
    ' - evidence: []',
    "",
  ].join("\n");

  assert.throws(
    () => parseTodoDocument(doc),
    (err) => err instanceof TaskStateError,
  );
});

test("parseTodoDocument rejects malformed JSON in blockedBy or evidence", () => {
  const doc = [
    "## Open",
    "",
    '- [ ] T-001 First task',
    '  - workflow: 7',
    '  - blockedBy: [invalid',
    '  - evidence: []',
    "",
  ].join("\n");

  assert.throws(
    () => parseTodoDocument(doc),
    (err) => err instanceof TaskStateError,
  );
});

test("renderTodoDocument produces deterministic output for stable git diffs", () => {
  const todos = [
    { id: "T-001", text: "Re-read target Section children", status: "open", section: "Open", workflow: "7", blockedBy: [], evidence: [] },
    { id: "T-002", text: "Add responsive breakpoints", status: "open", section: "Open", workflow: "8", blockedBy: ["T-001"], evidence: [] },
    { id: "T-003", text: "Task ledger created", status: "done", section: "Done", workflow: "0B", blockedBy: [], evidence: ["EV-0001"] },
  ];

  const rendered = renderTodoDocument(todos, { taskId: "20260714-test", updatedAt: "2026-07-14T10:00:00+08:00" });
  const reparsed = parseTodoDocument(rendered);
  assert.equal(reparsed.length, 3);
  assert.equal(reparsed[0].id, "T-001");
  assert.equal(reparsed[0].workflow, "7");
  assert.equal(reparsed[1].id, "T-002");
  assert.deepEqual(reparsed[1].blockedBy, ["T-001"]);
  assert.equal(reparsed[2].status, "done");
  assert.deepEqual(reparsed[2].evidence, ["EV-0001"]);

  // Deterministic
  const second = renderTodoDocument(todos, { taskId: "20260714-test", updatedAt: "2026-07-14T10:00:00+08:00" });
  assert.equal(rendered, second);
});

test("parseTodoDocument rejects duplicate todo IDs", () => {
  const doc = [
    "## Open",
    "",
    '- [ ] T-001 First task',
    '  - workflow: 7',
    '  - blockedBy: []',
    '  - evidence: []',
    "",
    '- [ ] T-001 Duplicate ID',
    '  - workflow: 8',
    '  - blockedBy: []',
    '  - evidence: []',
    "",
  ].join("\n");

  assert.throws(
    () => parseTodoDocument(doc),
    (err) => err instanceof TaskStateError && err.code === "STATE_INVALID",
  );
});

// ---------------------------------------------------------------------------
// Todo dependency validation
// ---------------------------------------------------------------------------

test("parseTodoDocument rejects missing blockedBy dependency", () => {
  const doc = [
    "## Open",
    "",
    '- [ ] T-001 Depends on nonexistent',
    '  - workflow: 7',
    '  - blockedBy: ["T-999"]',
    '  - evidence: []',
    "",
  ].join("\n");

  assert.throws(
    () => parseTodoDocument(doc),
    (err) => err instanceof TaskStateError && err.message.includes("T-999"),
  );
});

test("parseTodoDocument rejects blockedBy dependency cycle", () => {
  const doc = [
    "## Open",
    "",
    '- [ ] T-001 First task',
    '  - workflow: 7',
    '  - blockedBy: ["T-002"]',
    '  - evidence: []',
    "",
    '- [ ] T-002 Second task',
    '  - workflow: 8',
    '  - blockedBy: ["T-001"]',
    '  - evidence: []',
    "",
  ].join("\n");

  assert.throws(
    () => parseTodoDocument(doc),
    (err) => err instanceof TaskStateError && err.code === "STATE_INVALID",
  );
});

// ---------------------------------------------------------------------------
// Checkpoint evidence validation: reject terminal transitions without evidence
// ---------------------------------------------------------------------------

test("checkpoint rejects COMPLETED transition without evidence", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    const state = createTask(project);
    acquireLease(project, { taskId: state.taskId, holder: "session-a", minutes: 30, now: T0 });

    // DRAFT -> READY (WF 4G)
    const cp1 = checkpointTask(project, {
      taskId: state.taskId,
      session: "session-a",
      expectedRevision: 0,
      now: T0,
      event: { type: "APPROVAL_RECORDED", details: { gate: "EnvironmentGate", gateStatus: "PASS" } },
      nextState: { status: "READY", currentWorkflow: "4G", gate: "EnvironmentGate", gateStatus: "PASS", approval: { designSystem: "NOT_REQUIRED", figmaWrite: "PENDING" } },
      recovery: { nextAction: "Approved for active work", lastCheckpoint: "approved" },
    });
    assert.equal(cp1.ok, true, JSON.stringify(cp1.error));
    assert.equal(cp1.state.revision, 1);

    // READY -> ACTIVE (WF 8)
    const cp2 = checkpointTask(project, {
      taskId: state.taskId,
      session: "session-a",
      expectedRevision: 1,
      now: T0,
      event: { type: "WORKFLOW_ENTERED" },
      nextState: { status: "ACTIVE", currentWorkflow: "8" },
      recovery: { nextAction: "Active work", lastCheckpoint: "wf-8" },
    });
    assert.equal(cp2.ok, true, JSON.stringify(cp2.error));
    assert.equal(cp2.state.revision, 2);

    // COMPLETED without evidence
    const withoutEvidence = checkpointTask(project, {
      taskId: state.taskId,
      session: "session-a",
      expectedRevision: 2,
      now: T0_PLUS_15,
      event: { type: "TASK_COMPLETED", evidence: [] },
      nextState: { status: "COMPLETED", currentWorkflow: "11" },
    });
    assert.equal(withoutEvidence.ok, false);
    assert.equal(withoutEvidence.error.code, "EVIDENCE_MISSING");
  } finally {
    cleanup();
  }
});

test("checkpoint accepts COMPLETED transition with evidence", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    const state = createTask(project);
    acquireLease(project, { taskId: state.taskId, holder: "session-a", minutes: 30, now: T0 });

    // DRAFT -> READY (WF 4G)
    const cp1 = checkpointTask(project, {
      taskId: state.taskId,
      session: "session-a",
      expectedRevision: 0,
      now: T0,
      event: { type: "APPROVAL_RECORDED", details: { gate: "EnvironmentGate", gateStatus: "PASS" } },
      nextState: { status: "READY", currentWorkflow: "4G", gate: "EnvironmentGate", gateStatus: "PASS", approval: { designSystem: "NOT_REQUIRED", figmaWrite: "PENDING" } },
      recovery: { nextAction: "Approved", lastCheckpoint: "approved" },
    });
    assert.equal(cp1.ok, true, JSON.stringify(cp1.error));

    // READY -> ACTIVE (WF 8)
    const cp2 = checkpointTask(project, {
      taskId: state.taskId,
      session: "session-a",
      expectedRevision: 1,
      now: T0,
      event: { type: "WORKFLOW_ENTERED" },
      nextState: { status: "ACTIVE", currentWorkflow: "8" },
      recovery: { nextAction: "Active work", lastCheckpoint: "wf-8" },
    });
    assert.equal(cp2.ok, true, JSON.stringify(cp2.error));

    // COMPLETED with evidence
    const withEvidence = checkpointTask(project, {
      taskId: state.taskId,
      session: "session-a",
      expectedRevision: 2,
      now: T0_PLUS_15,
      event: { type: "TASK_COMPLETED", evidence: ["EV-0002"] },
      nextState: { status: "COMPLETED", currentWorkflow: "11" },
    });
    assert.equal(withEvidence.ok, true, JSON.stringify(withEvidence.error));
    assert.equal(withEvidence.state.status, "COMPLETED");
    assert.equal(withEvidence.state.revision, 3);
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// Checkpoint event revision matching
// ---------------------------------------------------------------------------

test("checkpoint event revision matches state revision after checkpoint", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    const state = createTask(project);
    acquireLease(project, { taskId: state.taskId, holder: "session-a", minutes: 30, now: T0 });

    // DRAFT -> READY
    const result = checkpointTask(project, {
      taskId: state.taskId,
      session: "session-a",
      expectedRevision: 0,
      now: T0,
      event: { type: "APPROVAL_RECORDED", details: { gate: "EnvironmentGate", gateStatus: "PASS" } },
      nextState: { status: "READY", currentWorkflow: "4G", gate: "EnvironmentGate", gateStatus: "PASS", approval: { designSystem: "NOT_REQUIRED", figmaWrite: "PENDING" } },
      recovery: { nextAction: "Proceed", lastCheckpoint: "approved" },
    });
    assert.equal(result.ok, true, JSON.stringify(result.error));
    assert.equal(result.event.revision, result.state.revision);
    assert.equal(result.state.revision, 1);

    const eventsPath = join(project, ".figma", "tasks", state.taskId, "events.jsonl");
    const events = readFileSync(eventsPath, "utf8").trim().split("\n").filter(Boolean);
    const lastEvent = JSON.parse(events[events.length - 1]);
    assert.equal(lastEvent.revision, 1);
  } finally {
    cleanup();
  }
});

test("checkpoint without lease returns LEASE_LOST", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    const state = createTask(project);

    const result = checkpointTask(project, {
      taskId: state.taskId,
      session: "session-a",
      expectedRevision: 0,
      now: T0,
      event: { type: "WORKFLOW_ENTERED" },
      nextState: { status: "ACTIVE", currentWorkflow: "1" },
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "LEASE_LOST");
  } finally {
    cleanup();
  }
});

test("TODO_UPDATED event type is recognized by checkpoint", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    const state = createTask(project);
    acquireLease(project, { taskId: state.taskId, holder: "session-a", minutes: 30, now: T0 });

    const result = checkpointTask(project, {
      taskId: state.taskId,
      session: "session-a",
      expectedRevision: 0,
      now: T0,
      event: { type: "TODO_UPDATED", details: { todo: ["T-001"] } },
      nextState: { status: "DRAFT", currentWorkflow: "0B" },
    });
    assert.equal(result.ok, true, JSON.stringify(result.error));
    assert.equal(result.event.type, "TODO_UPDATED");
    assert.equal(result.state.revision, 1);
  } finally {
    cleanup();
  }
});
