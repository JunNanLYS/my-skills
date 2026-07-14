import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { acquireLease, assertLease, takeoverLease, renewLease, releaseLease } from "../scripts/lib/task-state/lease.mjs";
import { assertTransition, checkpointTask } from "../scripts/lib/task-state/checkpoint.mjs";
import { readTask } from "../scripts/lib/task-state/store.mjs";
import { TaskStateError } from "../scripts/lib/task-state/errors.mjs";

const require = createRequire(import.meta.url);
const { spawnSync } = require("node:child_process");

const REPO_ROOT = resolve(join(import.meta.dirname, "..", ".."));
const SCRIPT = join(REPO_ROOT, "figma-skill", "scripts", "figma-task-state.mjs");

function runCli(project, args) {
  return spawnSync(process.execPath, [SCRIPT, "--project", project, ...args], {
    encoding: "utf8",
    env: { ...process.env, FIGMA_TASK_STATE_NO_DAEMON: "1" },
  });
}

function freshProject() {
  const project = mkdtempSync(join(tmpdir(), "figma-task-state-lease-"));
  return { project, cleanup: () => rmSync(project, { recursive: true, force: true }) };
}

function initProject(project) {
  const result = runCli(project, ["init-project", "--default-branch", "main", "--json"]);
  assert.equal(result.status, 0, result.stderr);
}

function createTask(project, overrides = {}) {
  const taskId = overrides.taskId ?? "20260714-checkout-responsive";
  const writeRequired = overrides.writeRequired ?? "true";
  const result = runCli(project, [
    "create",
    "--task",
    taskId,
    "--title",
    overrides.title ?? "Checkout responsive states",
    "--type",
    overrides.type ?? "Modify",
    "--write-required",
    writeRequired,
    "--json",
  ]);
  assert.equal(result.status, 0, result.stderr);
  const envelope = JSON.parse(result.stdout);
  return envelope.data.state;
}

function readState(project, taskId) {
  const { state } = readTask(project, taskId);
  return state;
}

function readEvents(project, taskId) {
  const path = join(project, ".figma", "tasks", taskId, "events.jsonl");
  return readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}

function lastEventOfType(events, type) {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].type === type) {
      return events[i];
    }
  }
  return null;
}

const T0 = "2026-07-14T10:00:00+08:00";
const T0_PLUS_15 = "2026-07-14T10:15:00+08:00";
const T0_PLUS_30 = "2026-07-14T10:30:00+08:00";
const T0_PLUS_31 = "2026-07-14T10:31:00+08:00";
const T0_PLUS_60 = "2026-07-14T11:00:00+08:00";

test("acquireLease grants a lease and rejects a concurrent acquisition", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project);

    const first = acquireLease(project, {
      taskId: "20260714-checkout-responsive",
      holder: "session-a",
      minutes: 30,
      now: T0,
    });
    assert.equal(first.holder, "session-a");
    assert.equal(first.taskId, "20260714-checkout-responsive");
    assert.equal(first.stateRevision, 0);
    assert.equal(first.acquiredAt, T0);
    assert.equal(first.heartbeatAt, T0);
    assert.equal(first.expiresAt, T0_PLUS_30);

    assert.throws(
      () =>
        acquireLease(project, {
          taskId: "20260714-checkout-responsive",
          holder: "session-b",
          minutes: 30,
          now: T0_PLUS_15,
        }),
      (error) =>
        error instanceof TaskStateError &&
        error.code === "LEASE_HELD" &&
        error.details.holder === "session-a",
    );
  } finally {
    cleanup();
  }
});

test("acquireLease succeeds after expiry without takeover approval", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project);

    acquireLease(project, {
      taskId: "20260714-checkout-responsive",
      holder: "session-a",
      minutes: 30,
      now: T0,
    });

    const second = acquireLease(project, {
      taskId: "20260714-checkout-responsive",
      holder: "session-b",
      minutes: 30,
      now: T0_PLUS_60,
    });
    assert.equal(second.holder, "session-b");
    assert.equal(second.acquiredAt, T0_PLUS_60);
    assert.equal(second.expiresAt, "2026-07-14T11:30:00+08:00");

    const events = readEvents(project, "20260714-checkout-responsive");
    const acq = lastEventOfType(events, "LEASE_ACQUIRED");
    assert.ok(acq, "LEASE_ACQUIRED must be appended after expiry takeback");
    assert.equal(acq.details.holder, "session-b");
    assert.equal(acq.details.priorHolder, "session-a");
    assert.equal(acq.details.expiry, T0_PLUS_30);
  } finally {
    cleanup();
  }
});

test("renewLease extends a valid lease and rejects renewal by another holder", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project);

    acquireLease(project, {
      taskId: "20260714-checkout-responsive",
      holder: "session-a",
      minutes: 30,
      now: T0,
    });

    const renewed = renewLease(project, {
      taskId: "20260714-checkout-responsive",
      holder: "session-a",
      minutes: 45,
      now: T0_PLUS_15,
    });
    assert.equal(renewed.holder, "session-a");
    assert.equal(renewed.heartbeatAt, T0_PLUS_15);
    assert.equal(renewed.expiresAt, "2026-07-14T11:00:00+08:00");

    assert.throws(
      () =>
        renewLease(project, {
          taskId: "20260714-checkout-responsive",
          holder: "session-b",
          minutes: 30,
          now: T0_PLUS_31,
        }),
      (error) =>
        error instanceof TaskStateError &&
        error.code === "LEASE_LOST" &&
        error.details.holder === "session-a",
    );
  } finally {
    cleanup();
  }
});

test("takeoverLease requires user-approved flag and emits LEASE_TAKEN_OVER", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project);

    acquireLease(project, {
      taskId: "20260714-checkout-responsive",
      holder: "session-a",
      minutes: 30,
      now: T0,
    });

    assert.throws(
      () =>
        takeoverLease(project, {
          taskId: "20260714-checkout-responsive",
          newHolder: "session-b",
          minutes: 30,
          now: T0_PLUS_15,
        }),
      (error) =>
        error instanceof TaskStateError &&
        error.code === "LEASE_HELD",
    );

    const taken = takeoverLease(project, {
      taskId: "20260714-checkout-responsive",
      newHolder: "session-b",
      minutes: 30,
      now: T0_PLUS_15,
      userApproved: true,
    });
    assert.equal(taken.holder, "session-b");
    assert.equal(taken.priorHolder, "session-a");

    const events = readEvents(project, "20260714-checkout-responsive");
    const takeover = lastEventOfType(events, "LEASE_TAKEN_OVER");
    assert.ok(takeover);
    assert.equal(takeover.details.priorHolder, "session-a");
    assert.equal(takeover.details.newHolder, "session-b");
    assert.equal(takeover.details.reason, "user-approved-takeover");
  } finally {
    cleanup();
  }
});

test("releaseLease emits LEASE_RELEASED for the holder and frees the lease", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project);

    acquireLease(project, {
      taskId: "20260714-checkout-responsive",
      holder: "session-a",
      minutes: 30,
      now: T0,
    });

    assert.throws(
      () =>
        releaseLease(project, {
          taskId: "20260714-checkout-responsive",
          holder: "session-b",
          now: T0_PLUS_15,
        }),
      (error) =>
        error instanceof TaskStateError &&
        error.code === "LEASE_LOST",
    );

    const released = releaseLease(project, {
      taskId: "20260714-checkout-responsive",
      holder: "session-a",
      now: T0_PLUS_15,
    });
    assert.equal(released.released, true);

    const events = readEvents(project, "20260714-checkout-responsive");
    const rel = lastEventOfType(events, "LEASE_RELEASED");
    assert.ok(rel);
    assert.equal(rel.details.holder, "session-a");

    const reacq = acquireLease(project, {
      taskId: "20260714-checkout-responsive",
      holder: "session-b",
      minutes: 30,
      now: T0_PLUS_31,
    });
    assert.equal(reacq.holder, "session-b");
  } finally {
    cleanup();
  }
});

test("assertLease throws LEASE_LOST for the prior holder after takeover", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project);

    acquireLease(project, {
      taskId: "20260714-checkout-responsive",
      holder: "session-a",
      minutes: 30,
      now: T0,
    });
    takeoverLease(project, {
      taskId: "20260714-checkout-responsive",
      newHolder: "session-b",
      minutes: 30,
      now: T0_PLUS_15,
      userApproved: true,
    });

    assert.throws(
      () =>
        assertLease(project, {
          taskId: "20260714-checkout-responsive",
          holder: "session-a",
          now: T0_PLUS_31,
        }),
      (error) =>
        error instanceof TaskStateError &&
        error.code === "LEASE_LOST",
    );
    assert.doesNotThrow(() =>
      assertLease(project, {
        taskId: "20260714-checkout-responsive",
        holder: "session-b",
        now: T0_PLUS_31,
      }),
    );
  } finally {
    cleanup();
  }
});

test("assertLease throws LEASE_EXPIRED when the active lease has lapsed", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project);

    acquireLease(project, {
      taskId: "20260714-checkout-responsive",
      holder: "session-a",
      minutes: 30,
      now: T0,
    });
    assert.throws(
      () =>
        assertLease(project, {
          taskId: "20260714-checkout-responsive",
          holder: "session-a",
          now: T0_PLUS_60,
        }),
      (error) =>
        error instanceof TaskStateError &&
        error.code === "LEASE_EXPIRED",
    );
  } finally {
    cleanup();
  }
});

test("assertTransition rejects Workflow 6/8/10 when writeRequired is false", () => {
  for (const workflow of ["6", "8", "10"]) {
    const priorWorkflow = workflow === "6" ? "5" : workflow === "8" ? "7" : "9";
    assert.throws(
      () =>
        assertTransition({
          state: { writeRequired: false, status: "ACTIVE", currentWorkflow: priorWorkflow },
          nextStatus: "ACTIVE",
          nextWorkflow: workflow,
          eventType: "WORKFLOW_ENTERED",
        }),
      (error) =>
        error instanceof TaskStateError &&
        error.code === "ILLEGAL_TRANSITION",
      `workflow ${workflow} must reject read-only task`,
    );
  }
});

test("assertTransition allows Workflow 6/8/10 when writeRequired is true", () => {
  const state = { writeRequired: true, status: "ACTIVE", currentWorkflow: "5" };
  // ACTIVE -> ACTIVE keeps the same status, which itself is permitted when
  // the new workflow is a write workflow and writeRequired is true.
  for (const workflow of ["6", "8", "10"]) {
    const nextState = { writeRequired: true, status: "ACTIVE", currentWorkflow: workflow };
    assert.doesNotThrow(
      () =>
        assertTransition({
          state: state,
          nextState,
          nextStatus: nextState.status,
          nextWorkflow: nextState.currentWorkflow,
          eventType: "WORKFLOW_ENTERED",
        }),
      `workflow ${workflow} must be allowed when writeRequired is true`,
    );
  }
});

test("assertTransition accepts a legal DRAFT to READY transition", () => {
  const state = { writeRequired: true, status: "DRAFT", currentWorkflow: "0B" };
  const nextState = { writeRequired: true, status: "READY", currentWorkflow: "4G" };
  assert.doesNotThrow(() =>
    assertTransition({
      state,
      nextState,
      nextStatus: nextState.status,
      nextWorkflow: nextState.currentWorkflow,
      eventType: "WORKFLOW_ENTERED",
    }),
  );
});

test("assertTransition rejects illegal transitions outside TRANSITIONS", () => {
  const state = { writeRequired: true, status: "DRAFT", currentWorkflow: "0B" };
  const nextState = { writeRequired: true, status: "COMPLETED", currentWorkflow: "11" };
  assert.throws(
    () =>
      assertTransition({
        state,
        nextState,
        nextStatus: nextState.status,
        nextWorkflow: nextState.currentWorkflow,
        eventType: "WORKFLOW_ENTERED",
      }),
    (error) =>
      error instanceof TaskStateError &&
      error.code === "ILLEGAL_TRANSITION",
  );
});

test("assertTransition rejects terminal-to-active transitions", () => {
  for (const terminal of ["FAILED", "CANCELLED", "COMPLETED", "SUPERSEDED"]) {
    const state = { writeRequired: true, status: terminal, currentWorkflow: "11" };
    const nextState = { writeRequired: true, status: "ACTIVE", currentWorkflow: "6" };
    assert.throws(
      () =>
        assertTransition({
          state,
          nextState,
          nextStatus: nextState.status,
          nextWorkflow: nextState.currentWorkflow,
          eventType: "WORKFLOW_ENTERED",
        }),
      (error) =>
        error instanceof TaskStateError &&
        error.code === "ILLEGAL_TRANSITION",
      `${terminal} must not transition to ACTIVE`,
    );
  }
});

test("assertTransition allows STALE recovery to READY but rejects STALE to ACTIVE", () => {
  const stale = { writeRequired: true, status: "STALE", currentWorkflow: "10" };
  const recovered = { writeRequired: true, status: "READY", currentWorkflow: "5" };
  assert.doesNotThrow(() =>
    assertTransition({
      state: stale,
      nextState: recovered,
      nextStatus: recovered.status,
      nextWorkflow: recovered.currentWorkflow,
      eventType: "STALE_DETECTED",
    }),
  );
  const backToActive = { writeRequired: true, status: "ACTIVE", currentWorkflow: "6" };
  assert.throws(
    () =>
      assertTransition({
        state: stale,
        nextState: backToActive,
        nextStatus: backToActive.status,
        nextWorkflow: backToActive.currentWorkflow,
        eventType: "WORKFLOW_ENTERED",
      }),
    (error) =>
      error instanceof TaskStateError &&
      error.code === "ILLEGAL_TRANSITION",
  );
});

test("assertTransition allows NEEDS_REPLAN to DRAFT but rejects NEEDS_REPLAN to ACTIVE", () => {
  const replan = { writeRequired: true, status: "NEEDS_REPLAN", currentWorkflow: "4" };
  const replanned = { writeRequired: true, status: "DRAFT", currentWorkflow: "0B" };
  assert.doesNotThrow(() =>
    assertTransition({
      state: replan,
      nextState: replanned,
      nextStatus: replanned.status,
      nextWorkflow: replanned.currentWorkflow,
      eventType: "REPLAN_REQUIRED",
    }),
  );
  const toActive = { writeRequired: true, status: "ACTIVE", currentWorkflow: "6" };
  assert.throws(
    () =>
      assertTransition({
        state: replan,
        nextState: toActive,
        nextStatus: toActive.status,
        nextWorkflow: toActive.currentWorkflow,
        eventType: "WORKFLOW_ENTERED",
      }),
    (error) =>
      error instanceof TaskStateError &&
      error.code === "ILLEGAL_TRANSITION",
  );
});

test("checkpointTask fails with REVISION_CONFLICT when expected-revision is stale", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project);
    acquireLease(project, {
      taskId: "20260714-checkout-responsive",
      holder: "session-a",
      minutes: 30,
      now: T0,
    });

    const result = checkpointTask(project, {
      taskId: "20260714-checkout-responsive",
      session: "session-a",
      expectedRevision: 99,
      now: T0_PLUS_15,
      event: {
        type: "WORKFLOW_ENTERED",
        details: { priorWorkflow: "0B", nextWorkflow: "1" },
      },
      nextState: { status: "ACTIVE", currentWorkflow: "1" },
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "REVISION_CONFLICT");
  } finally {
    cleanup();
  }
});

test("checkpointTask succeeds once, increments revision exactly once, and rejects a replay", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project);
    acquireLease(project, {
      taskId: "20260714-checkout-responsive",
      holder: "session-a",
      minutes: 30,
      now: T0,
    });

    const ok = checkpointTask(project, {
      taskId: "20260714-checkout-responsive",
      session: "session-a",
      expectedRevision: 0,
      now: T0_PLUS_15,
      event: {
        type: "WORKFLOW_ENTERED",
        details: { priorWorkflow: "0B", nextWorkflow: "1" },
      },
      nextState: { status: "READY", currentWorkflow: "1" },
      recovery: {
        nextAction: "Run current figma-cli help and status checks",
        lastCheckpoint: "wf-1-entered",
      },
    });
    assert.equal(ok.ok, true);
    assert.equal(ok.state.revision, 1);
    assert.equal(ok.state.currentWorkflow, "1");
    assert.equal(ok.state.status, "READY");
    assert.equal(ok.state.resume.lastCheckpoint, "wf-1-entered");

    const replay = checkpointTask(project, {
      taskId: "20260714-checkout-responsive",
      session: "session-a",
      expectedRevision: 0,
      now: T0_PLUS_31,
      event: {
        type: "WORKFLOW_ENTERED",
        details: { priorWorkflow: "0B", nextWorkflow: "1" },
      },
      nextState: { status: "READY", currentWorkflow: "1" },
    });
    assert.equal(replay.ok, false);
    assert.equal(replay.error.code, "REVISION_CONFLICT");
  } finally {
    cleanup();
  }
});

test("checkpointTask rejects a different holder with LEASE_LOST", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project);
    acquireLease(project, {
      taskId: "20260714-checkout-responsive",
      holder: "session-a",
      minutes: 30,
      now: T0,
    });
    const result = checkpointTask(project, {
      taskId: "20260714-checkout-responsive",
      session: "session-b",
      expectedRevision: 0,
      now: T0_PLUS_15,
      event: {
        type: "WORKFLOW_ENTERED",
        details: { priorWorkflow: "0B", nextWorkflow: "1" },
      },
      nextState: { status: "ACTIVE", currentWorkflow: "1" },
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "LEASE_LOST");
  } finally {
    cleanup();
  }
});

test("checkpointTask rejects an illegal transition with ILLEGAL_TRANSITION", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project);
    acquireLease(project, {
      taskId: "20260714-checkout-responsive",
      holder: "session-a",
      minutes: 30,
      now: T0,
    });
    const result = checkpointTask(project, {
      taskId: "20260714-checkout-responsive",
      session: "session-a",
      expectedRevision: 0,
      now: T0_PLUS_15,
      event: {
        type: "WORKFLOW_ENTERED",
        details: { priorWorkflow: "0B", nextWorkflow: "11" },
      },
      nextState: { status: "COMPLETED", currentWorkflow: "11" },
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "ILLEGAL_TRANSITION");
  } finally {
    cleanup();
  }
});

test("checkpointTask rejects a read-only task entering Workflow 6/8/10", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project, { writeRequired: "false" });
    acquireLease(project, {
      taskId: "20260714-checkout-responsive",
      holder: "session-a",
      minutes: 30,
      now: T0,
    });
    const result = checkpointTask(project, {
      taskId: "20260714-checkout-responsive",
      session: "session-a",
      expectedRevision: 0,
      now: T0_PLUS_15,
      event: {
        type: "WORKFLOW_ENTERED",
        details: { priorWorkflow: "5", nextWorkflow: "6" },
      },
      nextState: { status: "ACTIVE", currentWorkflow: "6" },
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "ILLEGAL_TRANSITION");
  } finally {
    cleanup();
  }
});

test("checkpointTask persists state, index, and event atomically", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project);
    acquireLease(project, {
      taskId: "20260714-checkout-responsive",
      holder: "session-a",
      minutes: 30,
      now: T0,
    });

    const ok = checkpointTask(project, {
      taskId: "20260714-checkout-responsive",
      session: "session-a",
      expectedRevision: 0,
      now: T0_PLUS_15,
      event: {
        type: "APPROVAL_RECORDED",
        details: {
          gate: "EnvironmentGate",
          gateStatus: "PASS",
          priorStatus: "DRAFT",
          nextStatus: "READY",
        },
      },
      nextState: {
        status: "READY",
        currentWorkflow: "4G",
        gate: "EnvironmentGate",
        gateStatus: "PASS",
        approval: { designSystem: "NOT_REQUIRED", figmaWrite: "PENDING" },
      },
    });
    assert.equal(ok.ok, true);
    assert.equal(ok.state.revision, 1);
    assert.equal(ok.state.status, "READY");

    const onDisk = readState(project, "20260714-checkout-responsive");
    assert.equal(onDisk.revision, 1);
    assert.equal(onDisk.status, "READY");
    assert.equal(onDisk.currentWorkflow, "4G");

    const index = JSON.parse(
      require("node:fs").readFileSync(
        join(project, ".figma", "index.json"),
        "utf8",
      ),
    );
    const summary = index.tasks.find(
      (t) => t.taskId === "20260714-checkout-responsive",
    );
    assert.equal(summary.status, "READY");
    assert.equal(summary.currentWorkflow, "4G");

    const events = readEvents(project, "20260714-checkout-responsive");
    const approval = lastEventOfType(events, "APPROVAL_RECORDED");
    assert.ok(approval);
    assert.equal(approval.revision, 1);
    assert.equal(approval.details.gateStatus, "PASS");
  } finally {
    cleanup();
  }
});

test("CLI acquire grants a lease and emits JSON envelope", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project);
    const result = runCli(project, [
      "acquire",
      "--task",
      "20260714-checkout-responsive",
      "--session",
      "session-a",
      "--minutes",
      "30",
      "--now",
      T0,
      "--json",
    ]);
    assert.equal(result.status, 0, result.stderr);
    const envelope = JSON.parse(result.stdout);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.lease.holder, "session-a");
    assert.equal(envelope.data.lease.stateRevision, 0);
  } finally {
    cleanup();
  }
});

test("CLI takeover requires --user-approved true", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project);
    runCli(project, [
      "acquire",
      "--task",
      "20260714-checkout-responsive",
      "--session",
      "session-a",
      "--minutes",
      "30",
      "--now",
      T0,
      "--json",
    ]);

    const denied = runCli(project, [
      "takeover",
      "--task",
      "20260714-checkout-responsive",
      "--session",
      "session-b",
      "--minutes",
      "30",
      "--now",
      T0_PLUS_15,
      "--json",
    ]);
    assert.equal(denied.status, 2, denied.stderr);
    const deniedEnvelope = JSON.parse(denied.stderr);
    assert.equal(deniedEnvelope.error.code, "LEASE_HELD");

    const ok = runCli(project, [
      "takeover",
      "--task",
      "20260714-checkout-responsive",
      "--session",
      "session-b",
      "--minutes",
      "30",
      "--now",
      T0_PLUS_15,
      "--user-approved",
      "true",
      "--json",
    ]);
    assert.equal(ok.status, 0, ok.stderr);
    const env = JSON.parse(ok.stdout);
    assert.equal(env.ok, true);
    assert.equal(env.data.lease.holder, "session-b");
    assert.equal(env.data.lease.priorHolder, "session-a");
  } finally {
    cleanup();
  }
});

test("CLI checkpoint bumps revision once and rejects replays", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project);
    runCli(project, [
      "acquire",
      "--task",
      "20260714-checkout-responsive",
      "--session",
      "session-a",
      "--minutes",
      "30",
      "--now",
      T0,
      "--json",
    ]);

    const ok = runCli(project, [
      "checkpoint",
      "--task",
      "20260714-checkout-responsive",
      "--session",
      "session-a",
      "--expected-revision",
      "0",
      "--now",
      T0_PLUS_15,
      "--event-type",
      "WORKFLOW_ENTERED",
      "--workflow",
      "1",
      "--status",
      "READY",
      "--next-action",
      "Run current figma-cli help and status checks",
      "--last-checkpoint",
      "wf-1-entered",
      "--json",
    ]);
    assert.equal(ok.status, 0, ok.stderr);
    const env = JSON.parse(ok.stdout);
    assert.equal(env.ok, true);
    assert.equal(env.data.state.revision, 1);
    assert.equal(env.data.state.currentWorkflow, "1");
    assert.equal(env.data.state.resume.lastCheckpoint, "wf-1-entered");

    const replay = runCli(project, [
      "checkpoint",
      "--task",
      "20260714-checkout-responsive",
      "--session",
      "session-a",
      "--expected-revision",
      "0",
      "--now",
      T0_PLUS_31,
      "--event-type",
      "WORKFLOW_ENTERED",
      "--workflow",
      "1",
      "--status",
      "READY",
      "--next-action",
      "Replay attempt",
      "--json",
    ]);
    assert.equal(replay.status, 2, replay.stderr);
    const replayEnv = JSON.parse(replay.stderr);
    assert.equal(replayEnv.error.code, "REVISION_CONFLICT");
  } finally {
    cleanup();
  }
});

test("CLI release emits LEASE_RELEASED and frees the lease", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project);
    runCli(project, [
      "acquire",
      "--task",
      "20260714-checkout-responsive",
      "--session",
      "session-a",
      "--minutes",
      "30",
      "--now",
      T0,
      "--json",
    ]);

    const rel = runCli(project, [
      "release",
      "--task",
      "20260714-checkout-responsive",
      "--session",
      "session-a",
      "--now",
      T0_PLUS_15,
      "--json",
    ]);
    assert.equal(rel.status, 0, rel.stderr);
    const env = JSON.parse(rel.stdout);
    assert.equal(env.ok, true);
    assert.equal(env.data.released, true);

    const reacq = runCli(project, [
      "acquire",
      "--task",
      "20260714-checkout-responsive",
      "--session",
      "session-b",
      "--minutes",
      "30",
      "--now",
      T0_PLUS_31,
      "--json",
    ]);
    assert.equal(reacq.status, 0, reacq.stderr);
  } finally {
    cleanup();
  }
});