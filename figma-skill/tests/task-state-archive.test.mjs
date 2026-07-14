/**
 * task-state-archive.test.mjs — Archive and close workflow tests.
 *
 * Covers:
 *   - Isolation: terminal task A screenshots deleted, active task B intact
 *   - Terminal matrix: COMPLETED / FAILED / CANCELLED / SUPERSEDED
 *   - Non-terminal rejection: BLOCKED / STALE / NEEDS_REPLAN
 *   - Failure modes: injected unlink failure, unreviewed screenshot, missing visual summary
 *   - close command behavior
 */

import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { spawnSync } from "node:child_process";

import { TaskStateError } from "../scripts/lib/task-state/errors.mjs";
import { archiveTask, closeTask, fsAdapter } from "../scripts/lib/task-state/archive.mjs";
import { checkpointTask } from "../scripts/lib/task-state/checkpoint.mjs";
import { acquireLease } from "../scripts/lib/task-state/lease.mjs";
import { readTask, readProject, resolveInsideProject, PROJECT_DIRNAME, SCREENSHOT_DIRNAME, TASKS_DIRNAME } from "../scripts/lib/task-state/store.mjs";
import { registerScreenshot } from "../scripts/lib/task-state/evidence.mjs";

const REPO_ROOT = resolve(join(import.meta.dirname, "..", ".."));
const T0 = "2026-07-14T10:00:00+08:00";

function freshProject() {
  const project = mkdtempSync(join(tmpdir(), "figma-task-state-archive-"));
  return { project, cleanup: () => { try { rmSync(project, { recursive: true, force: true }); } catch {} } };
}

function initProject(project) {
  const SCRIPT = join(REPO_ROOT, "figma-skill", "scripts", "figma-task-state.mjs");
  const result = spawnSync(process.execPath, [SCRIPT, "--project", project, "init-project", "--default-branch", "main", "--json"], {
    encoding: "utf8",
    env: { ...process.env, FIGMA_TASK_STATE_NO_DAEMON: "1" },
  });
  assert.equal(result.status, 0, `init failed: ${result.stderr}`);
}

function runCreate(project, overrides = {}) {
  const SCRIPT = join(REPO_ROOT, "figma-skill", "scripts", "figma-task-state.mjs");
  const taskId = overrides.taskId ?? "20260714-archive-test";
  const result = spawnSync(process.execPath, [
    SCRIPT, "--project", project,
    "create",
    "--task", taskId,
    "--title", overrides.title ?? "Archive test task",
    "--type", overrides.type ?? "Modify",
    "--write-required", overrides.writeRequired ?? "true",
    "--json",
  ], {
    encoding: "utf8",
    env: { ...process.env, FIGMA_TASK_STATE_NO_DAEMON: "1" },
  });
  assert.equal(result.status, 0, `create failed: ${result.stderr}`);
  return JSON.parse(result.stdout).data.state;
}

function runToCompletion(project, state, now, session) {
  const holder = session || "session-a";
  // Walk task from DRAFT through to COMPLETED via checkpoints.
  let s = state;

  // DRAFT -> READY
  const cp1 = checkpointTask(project, {
    taskId: s.taskId,
    session: holder,
    expectedRevision: s.revision,
    now,
    event: { type: "APPROVAL_RECORDED", details: { gate: "EnvironmentGate", gateStatus: "PASS" } },
    nextState: { status: "READY", currentWorkflow: "4G", gate: "EnvironmentGate", gateStatus: "PASS", approval: { designSystem: "NOT_REQUIRED", figmaWrite: "PENDING" } },
    recovery: { nextAction: "Approved", lastCheckpoint: "approved" },
  });
  assert.equal(cp1.ok, true, JSON.stringify(cp1.error));
  s = cp1.state;

  // READY -> ACTIVE
  const cp2 = checkpointTask(project, {
    taskId: s.taskId,
    session: holder,
    expectedRevision: s.revision,
    now,
    event: { type: "WORKFLOW_ENTERED" },
    nextState: { status: "ACTIVE", currentWorkflow: "8" },
    recovery: { nextAction: "Active work", lastCheckpoint: "wf-8" },
  });
  assert.equal(cp2.ok, true, JSON.stringify(cp2.error));
  s = cp2.state;

  // ACTIVE -> COMPLETED with evidence
  const cp3 = checkpointTask(project, {
    taskId: s.taskId,
    session: holder,
    expectedRevision: s.revision,
    now,
    event: { type: "TASK_COMPLETED", evidence: ["EV-0001"] },
    nextState: { status: "COMPLETED", currentWorkflow: "11" },
  });
  assert.equal(cp3.ok, true, JSON.stringify(cp3.error));
  return cp3.state;
}

function createScreenshots(project, taskId, count) {
  const ssDir = join(project, PROJECT_DIRNAME, SCREENSHOT_DIRNAME, taskId);
  mkdirSync(ssDir, { recursive: true });
  const ids = [];
  for (let i = 0; i < count; i++) {
    const fname = `screenshot-${i}.png`;
    writeFileSync(join(ssDir, fname), `fake-image-${i}`);
    const entry = registerScreenshot(project, {
      taskId,
      filePath: join(ssDir, fname),
      page: "Page 1",
      nodeIds: ["1:2"],
      viewport: "1440x900",
      now: T0,
    });
    ids.push(entry.id);
  }
  return ids;
}

function markAllScreenshotsReviewed(project, taskId) {
  const ssDir = join(project, PROJECT_DIRNAME, SCREENSHOT_DIRNAME, taskId);
  const manifestPath = join(ssDir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const entry of manifest.entries) {
    entry.reviewed = true;
    entry.visualFinding = "Layout matches design spec, no overlaps detected.";
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

function setVisualSummary(project, taskId, summary) {
  const { state, taskDir } = readTask(project, taskId);
  state.validation.visual.summary = summary;
  writeFileSync(join(taskDir, "state.json"), JSON.stringify(state, null, 2) + "\n", "utf8");
}

// =========================================================================
// Isolation test
// =========================================================================

test("archive isolates screenshot cleanup to archived task only", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);

    // Create Task A (will be terminal)
    const stateA = runCreate(project, { taskId: "20260714-archive-task-a", title: "Task A" });
    acquireLease(project, { taskId: stateA.taskId, holder: "session-a", minutes: 30, now: T0 });

    // Walk to COMPLETED
    const completedA = runToCompletion(project, stateA, T0);

    // Create screenshots for A
    createScreenshots(project, stateA.taskId, 3);
    markAllScreenshotsReviewed(project, stateA.taskId);
    setVisualSummary(project, stateA.taskId, "All layouts verified against design spec.");

    // Create Task B (active, not terminal)
    const stateB = runCreate(project, { taskId: "20260714-archive-task-b", title: "Task B" });

    // Create screenshots for B
    createScreenshots(project, stateB.taskId, 6);

    // Verify screenshots exist before archive
    const ssDirA = join(project, PROJECT_DIRNAME, SCREENSHOT_DIRNAME, stateA.taskId);
    const ssDirB = join(project, PROJECT_DIRNAME, SCREENSHOT_DIRNAME, stateB.taskId);
    assert.equal(existsSync(ssDirA), true);
    assert.equal(existsSync(ssDirB), true);

    // Archive Task A
    const result = archiveTask(project, {
      taskId: stateA.taskId,
      holder: "session-a",
      expectedRevision: completedA.revision,
      terminalStatus: "COMPLETED",
      now: T0,
    });

    assert.equal(result.ok, true, `archive failed: ${JSON.stringify(result.error)}`);
    assert.equal(result.state.status, "COMPLETED");
    assert.equal(result.state.archiveStatus, "ARCHIVED");

    // A screenshots gone
    assert.equal(existsSync(ssDirA), false);

    // B screenshots intact
    assert.equal(existsSync(ssDirB), true);
    const bFiles = readdirSync(ssDirB);
    // 6 screenshots created + manifest.json
    assert.equal(bFiles.length, 7, `expected 7 files in B, got ${bFiles.length}: ${bFiles}`);

    // A lease removed
    const taskADir = resolveInsideProject(project, join(PROJECT_DIRNAME, TASKS_DIRNAME, stateA.taskId));
    assert.equal(existsSync(join(taskADir, "lease.json")), false);

    // A final-summary.md exists
    assert.equal(existsSync(join(taskADir, "final-summary.md")), true);

    // Verify state preserved status + new archiveStatus
    const { state: readBack } = readTask(project, stateA.taskId);
    assert.equal(readBack.status, "COMPLETED");
    assert.equal(readBack.archiveStatus, "ARCHIVED");
  } finally {
    cleanup();
  }
});

// =========================================================================
// Terminal state matrix
// =========================================================================

function makeTerminalTask(project, taskId, title, targetStatus, now) {
  const state = runCreate(project, { taskId, title });

  // For FAILED: go through DRAFT -> READY -> ACTIVE -> FAILED
  if (targetStatus === "FAILED") {
    acquireLease(project, { taskId: state.taskId, holder: "session-b", minutes: 30, now });

    const cp1 = checkpointTask(project, {
      taskId: state.taskId, session: "session-b",
      expectedRevision: state.revision, now,
      event: { type: "APPROVAL_RECORDED", details: { gate: "EnvironmentGate", gateStatus: "PASS" } },
      nextState: { status: "READY", currentWorkflow: "4G", gate: "EnvironmentGate", gateStatus: "PASS", approval: { designSystem: "NOT_REQUIRED", figmaWrite: "PENDING" } },
      recovery: { nextAction: "Approved", lastCheckpoint: "approved" },
    });
    assert.equal(cp1.ok, true, JSON.stringify(cp1.error));

    const s2 = cp1.state;
    const cp2 = checkpointTask(project, {
      taskId: state.taskId, session: "session-b",
      expectedRevision: s2.revision, now,
      event: { type: "WORKFLOW_ENTERED" },
      nextState: { status: "ACTIVE", currentWorkflow: "8" },
      recovery: { nextAction: "Active work", lastCheckpoint: "wf-8" },
    });
    assert.equal(cp2.ok, true, JSON.stringify(cp2.error));

    const s3 = cp2.state;
    const cp3 = checkpointTask(project, {
      taskId: state.taskId, session: "session-b",
      expectedRevision: s3.revision, now,
      event: { type: "TASK_FAILED" },
      nextState: { status: "FAILED", currentWorkflow: "0" },
      recovery: { nextAction: "Diagnose and replan", lastCheckpoint: "failed" },
    });
    assert.equal(cp3.ok, true, JSON.stringify(cp3.error));
    return cp3.state;
  }

  // For others, go through DRAFT -> READY -> ACTIVE -> terminal
  acquireLease(project, { taskId: state.taskId, holder: "session-b", minutes: 30, now });

  const cp1 = checkpointTask(project, {
    taskId: state.taskId,
    session: "session-b",
    expectedRevision: state.revision,
    now,
    event: { type: "APPROVAL_RECORDED", details: { gate: "EnvironmentGate", gateStatus: "PASS" } },
    nextState: { status: "READY", currentWorkflow: "4G", gate: "EnvironmentGate", gateStatus: "PASS", approval: { designSystem: "NOT_REQUIRED", figmaWrite: "PENDING" } },
    recovery: { nextAction: "Approved", lastCheckpoint: "approved" },
  });
  assert.equal(cp1.ok, true, JSON.stringify(cp1.error));

  const s2 = cp1.state;
  const cp2 = checkpointTask(project, {
    taskId: state.taskId,
    session: "session-b",
    expectedRevision: s2.revision,
    now,
    event: { type: "WORKFLOW_ENTERED" },
    nextState: { status: "ACTIVE", currentWorkflow: "8" },
    recovery: { nextAction: "Active work", lastCheckpoint: "wf-8" },
  });
  assert.equal(cp2.ok, true, JSON.stringify(cp2.error));

  const s3 = cp2.state;
  // Provide evidence for all non-FAILED terminal transitions
  const events = targetStatus !== "FAILED" ? ["EV-0001"] : [];
  const eventType = targetStatus === "CANCELLED" ? "TASK_CANCELLED"
    : targetStatus === "SUPERSEDED" ? "TASK_SUPERSEDED"
    : `TASK_${targetStatus}`;
  const cp3 = checkpointTask(project, {
    taskId: state.taskId,
    session: "session-b",
    expectedRevision: s3.revision,
    now,
    event: { type: eventType, evidence: events },
    nextState: { status: targetStatus, currentWorkflow: "11" },
  });
  assert.equal(cp3.ok, true, JSON.stringify(cp3.error));
  return cp3.state;
}

for (const terminalStatus of ["COMPLETED", "FAILED", "CANCELLED", "SUPERSEDED"]) {
  test(`archive accepts terminal status ${terminalStatus}`, () => {
    const { project, cleanup } = freshProject();
    try {
      initProject(project);
      const state = makeTerminalTask(project,
        `20260714-${terminalStatus.toLowerCase()}`,
        `${terminalStatus} task`,
        terminalStatus,
        T0,
      );

      createScreenshots(project, state.taskId, 2);
      markAllScreenshotsReviewed(project, state.taskId);
      setVisualSummary(project, state.taskId, `Verified ${terminalStatus.toLowerCase()} task.`);

      const result = archiveTask(project, {
        taskId: state.taskId,
        holder: "session-b",
        expectedRevision: state.revision,
        terminalStatus,
        now: T0,
      });

      assert.equal(result.ok, true, `expected archive of ${terminalStatus} to succeed: ${JSON.stringify(result.error)}`);
      assert.equal(result.state.status, terminalStatus);
      assert.equal(result.state.archiveStatus, "ARCHIVED");

      const ssDir = join(project, PROJECT_DIRNAME, SCREENSHOT_DIRNAME, state.taskId);
      assert.equal(existsSync(ssDir), false, `screenshots should be deleted for ${terminalStatus}`);

      // Other tasks unaffected
      const { index } = readProject(project);
      const archivedTask = index.tasks.find((t) => t.taskId === state.taskId);
      assert.equal(archivedTask.status, terminalStatus);
      assert.equal(archivedTask.archiveStatus, "ARCHIVED");
    } finally {
      cleanup();
    }
  });
}

// =========================================================================
// Non-terminal rejection
// =========================================================================

for (const nonTerminal of ["BLOCKED", "STALE", "NEEDS_REPLAN"]) {
  test(`archive rejects non-terminal status ${nonTerminal}`, () => {
    const { project, cleanup } = freshProject();
    try {
      initProject(project);
      const taskSlug = nonTerminal.toLowerCase().replace(/_/g, "-");
      const state = runCreate(project, { taskId: `20260714-${taskSlug}`, title: `${nonTerminal} task` });

      acquireLease(project, { taskId: state.taskId, holder: "session-c", minutes: 30, now: T0 });

      let s = state;
      if (nonTerminal === "BLOCKED") {
        // DRAFT -> BLOCKED is valid
        const cp = checkpointTask(project, {
          taskId: state.taskId, session: "session-c",
          expectedRevision: state.revision, now: T0,
          event: { type: "TASK_BLOCKED" },
          nextState: { status: "BLOCKED", currentWorkflow: "1" },
          recovery: { nextAction: "Resolve block", lastCheckpoint: "blocked" },
        });
        assert.equal(cp.ok, true, JSON.stringify(cp.error));
        s = cp.state;
      } else {
        // DRAFT -> READY, then READY -> STALE or NEEDS_REPLAN
        const cp1 = checkpointTask(project, {
          taskId: state.taskId, session: "session-c",
          expectedRevision: state.revision, now: T0,
          event: { type: "APPROVAL_RECORDED", details: { gate: "EnvironmentGate", gateStatus: "PASS" } },
          nextState: { status: "READY", currentWorkflow: "4G", gate: "EnvironmentGate", gateStatus: "PASS", approval: { designSystem: "NOT_REQUIRED", figmaWrite: "PENDING" } },
          recovery: { nextAction: "Approved", lastCheckpoint: "approved" },
        });
        assert.equal(cp1.ok, true, JSON.stringify(cp1.error));

        const eventType = nonTerminal === "STALE" ? "STALE_DETECTED" : "REPLAN_REQUIRED";
        const cp2 = checkpointTask(project, {
          taskId: state.taskId, session: "session-c",
          expectedRevision: cp1.state.revision, now: T0,
          event: { type: eventType },
          nextState: { status: nonTerminal, currentWorkflow: "1" },
          recovery: { nextAction: "Diagnose", lastCheckpoint: nonTerminal.toLowerCase() },
        });
        assert.equal(cp2.ok, true, JSON.stringify(cp2.error));
        s = cp2.state;
      }

      // Add screenshots for this task
      createScreenshots(project, state.taskId, 2);

      const result = archiveTask(project, {
        taskId: state.taskId,
        holder: "session-c",
        expectedRevision: s.revision,
        now: T0,
      });

      assert.equal(result.ok, false, `expected archive of ${nonTerminal} to fail`);
      assert.equal(result.error.code, "ILLEGAL_TRANSITION");

      // Screenshots must be intact
      const ssDir = join(project, PROJECT_DIRNAME, SCREENSHOT_DIRNAME, state.taskId);
      assert.equal(existsSync(ssDir), true, `screenshots should remain for ${nonTerminal}`);
    } finally {
      cleanup();
    }
  });
}

// =========================================================================
// Failure modes
// =========================================================================

test("archive without lease returns LEASE_LOST", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    // Create a COMPLETED task via makeTerminalTask (which acquires lease internally)
    const state = makeTerminalTask(project,
      "20260714-no-lease", "No lease task", "COMPLETED", T0);

    // Remove the lease file to simulate lost lease
    const { taskDir } = readTask(project, state.taskId);
    const leasePath = join(taskDir, "lease.json");
    if (existsSync(leasePath)) {
      rmSync(leasePath);
    }

    createScreenshots(project, state.taskId, 1);
    markAllScreenshotsReviewed(project, state.taskId);
    setVisualSummary(project, state.taskId, "Verified.");

    const result = archiveTask(project, {
      taskId: state.taskId,
      holder: "session-b",
      expectedRevision: state.revision,
      terminalStatus: "COMPLETED",
      now: T0,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "LEASE_LOST");
  } finally {
    cleanup();
  }
});

test("archive with unreviewed screenshots is rejected", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    const state = runCreate(project, { taskId: "20260714-unreviewed" });
    acquireLease(project, { taskId: state.taskId, holder: "session-e", minutes: 30, now: T0 });

    const completed = runToCompletion(project, state, T0, "session-e");

    // Create screenshots (not reviewed)
    createScreenshots(project, state.taskId, 2);

    const result = archiveTask(project, {
      taskId: state.taskId,
      holder: "session-e",
      expectedRevision: completed.revision,
      terminalStatus: "COMPLETED",
      now: T0,
    });

    assert.equal(result.ok, false);
    assert.equal(result.error.code, "ILLEGAL_TRANSITION");
    assert.match(result.error.message, /unreviewed/);
  } finally {
    cleanup();
  }
});

test("archive without visual summary is rejected", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    const state = runCreate(project, { taskId: "20260714-no-summary" });
    acquireLease(project, { taskId: state.taskId, holder: "session-f", minutes: 30, now: T0 });

    const completed = runToCompletion(project, state, T0, "session-f");
    createScreenshots(project, state.taskId, 1);
    markAllScreenshotsReviewed(project, state.taskId);

    const result = archiveTask(project, {
      taskId: state.taskId,
      holder: "session-f",
      expectedRevision: completed.revision,
      terminalStatus: "COMPLETED",
      now: T0,
    });

    assert.equal(result.ok, false);
    assert.equal(result.error.code, "ILLEGAL_TRANSITION");
    assert.match(result.error.message, /visual summary/);
  } finally {
    cleanup();
  }
});

test("archive failure sets ARCHIVE_FAILED and retains lease", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    const state = runCreate(project, { taskId: "20260714-fail-inject" });
    acquireLease(project, { taskId: state.taskId, holder: "session-g", minutes: 30, now: T0 });

    const completed = runToCompletion(project, state, T0, "session-g");
    createScreenshots(project, state.taskId, 2);
    markAllScreenshotsReviewed(project, state.taskId);
    setVisualSummary(project, state.taskId, "Verified content.");

    // Inject unlink failure via fsAdapter for screenshot cleanup
    const originalRmSync = fsAdapter.rmSync;
    fsAdapter.rmSync = () => { throw new Error("injected-rm-failure"); };
    try {
      const result = archiveTask(project, {
        taskId: state.taskId,
        holder: "session-g",
        expectedRevision: completed.revision,
        terminalStatus: "COMPLETED",
        now: T0,
      });
      assert.equal(result.ok, false);
      assert.equal(result.error.code, "ARCHIVE_FAILED");
    } finally {
      fsAdapter.rmSync = originalRmSync;
    }

    // State should be ARCHIVE_FAILED
    const { state: readBack } = readTask(project, state.taskId);
    assert.equal(readBack.archiveStatus, "ARCHIVE_FAILED");

    // Lease should be retained for diagnosis
    const taskDir = join(project, PROJECT_DIRNAME, TASKS_DIRNAME, state.taskId);
    assert.equal(existsSync(join(taskDir, "lease.json")), true);

    // No TASK_ARCHIVED event should exist in final state
    const eventsText = readFileSync(join(taskDir, "events.jsonl"), "utf8");
    assert.equal(eventsText.includes('"ARCHIVE_FAILED"'), true,
      "should contain ARCHIVE_FAILED event");
  } finally {
    cleanup();
  }
});

// =========================================================================
// close command behavior
// =========================================================================

test("close succeeds only when archiveStatus is ARCHIVED", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    const state = runCreate(project, { taskId: "20260714-close-test" });
    acquireLease(project, { taskId: state.taskId, holder: "session-h", minutes: 30, now: T0 });

    const completed = runToCompletion(project, state, T0, "session-h");

    // close before archive should fail
    assert.throws(
      () => closeTask(project, { taskId: state.taskId, holder: "session-h", now: T0 }),
      (err) => err instanceof TaskStateError && err.code === "ILLEGAL_TRANSITION",
    );

    // Setup screenshots and archive
    createScreenshots(project, state.taskId, 1);
    markAllScreenshotsReviewed(project, state.taskId);
    setVisualSummary(project, state.taskId, "Verified layout.");

    const archiveResult = archiveTask(project, {
      taskId: state.taskId,
      holder: "session-h",
      expectedRevision: completed.revision,
      terminalStatus: "COMPLETED",
      now: T0,
    });
    assert.equal(archiveResult.ok, true, JSON.stringify(archiveResult.error));

    // Now close should succeed
    const closeResult = closeTask(project, { taskId: state.taskId, holder: "session-h", now: T0 });
    assert.equal(closeResult.ok, true);
    assert.equal(closeResult.archiveStatus, "ARCHIVED");
    assert.equal(closeResult.closed, true);

    // Lease should be removed by close
    const taskDir = join(project, PROJECT_DIRNAME, TASKS_DIRNAME, state.taskId);
    assert.equal(existsSync(join(taskDir, "lease.json")), false,
      "lease should be removed by close");
  } finally {
    cleanup();
  }
});

// =========================================================================
// Revision conflict
// =========================================================================

test("archive rejects revision conflict", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    const state = runCreate(project, { taskId: "20260714-rev-conflict" });
    acquireLease(project, { taskId: state.taskId, holder: "session-i", minutes: 30, now: T0 });

    const completed = runToCompletion(project, state, T0, "session-i");
    createScreenshots(project, state.taskId, 1);
    markAllScreenshotsReviewed(project, state.taskId);
    setVisualSummary(project, state.taskId, "Done.");

    const result = archiveTask(project, {
      taskId: state.taskId,
      holder: "session-i",
      expectedRevision: 999,
      terminalStatus: "COMPLETED",
      now: T0,
    });

    assert.equal(result.ok, false);
    assert.equal(result.error.code, "REVISION_CONFLICT");
  } finally {
    cleanup();
  }
});

// =========================================================================
// Idempotent — re-archive of already archived returns error
// =========================================================================

test("archive of already archived task is rejected", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    const state = runCreate(project, { taskId: "20260714-rearchive" });
    acquireLease(project, { taskId: state.taskId, holder: "session-j", minutes: 30, now: T0 });

    const completed = runToCompletion(project, state, T0, "session-j");
    createScreenshots(project, state.taskId, 1);
    markAllScreenshotsReviewed(project, state.taskId);
    setVisualSummary(project, state.taskId, "Verified.");

    const r1 = archiveTask(project, {
      taskId: state.taskId,
      holder: "session-j",
      expectedRevision: completed.revision,
      terminalStatus: "COMPLETED",
      now: T0,
    });
    assert.equal(r1.ok, true, JSON.stringify(r1.error));

    // Second archive should fail
    const r2 = archiveTask(project, {
      taskId: state.taskId,
      holder: "session-j",
      expectedRevision: r1.state.revision,
      terminalStatus: "COMPLETED",
      now: T0,
    });
    assert.equal(r2.ok, false);
    assert.equal(r2.error.code, "ILLEGAL_TRANSITION");
    assert.match(r2.error.message, /archiveStatus/);
  } finally {
    cleanup();
  }
});

// =========================================================================
// Terminal status mismatch
// =========================================================================

test("archive rejects status mismatch", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    const state = runCreate(project, { taskId: "20260714-mismatch" });
    acquireLease(project, { taskId: state.taskId, holder: "session-k", minutes: 30, now: T0 });

    const completed = runToCompletion(project, state, T0, "session-k");
    createScreenshots(project, state.taskId, 1);
    markAllScreenshotsReviewed(project, state.taskId);
    setVisualSummary(project, state.taskId, "Done.");

    const result = archiveTask(project, {
      taskId: state.taskId,
      holder: "session-k",
      expectedRevision: completed.revision,
      terminalStatus: "FAILED",  // task is actually COMPLETED
      now: T0,
    });

    assert.equal(result.ok, false);
    assert.equal(result.error.code, "ILLEGAL_TRANSITION");
    assert.match(result.error.message, /does not match/);
  } finally {
    cleanup();
  }
});
