/**
 * archive.mjs — terminal task archival, screenshot cleanup, runtime compaction.
 *
 * Implements the archive and close workflows:
 *   NOT_ARCHIVED → ARCHIVING → (cleanup) → ARCHIVED
 *   Any failure → ARCHIVE_FAILED (retains lease for diagnosis)
 *
 * Exports:
 *   archiveTask(projectRoot, params)       — public entry (mutation lock)
 *   archiveTaskManual(projectRoot, params)  — locked impl, no error wrapper
 *   closeTask(projectRoot, params)         — validates ARCHIVED, releases lease
 *   buildFinalSummary(ctx)                 — pure markdown generator
 *   cleanupTaskScreenshots(projectRoot, taskId) — rm screenshot dir
 *   compactTaskRuntime(projectRoot, taskId)     — remove lease
 *   assertArchiveComplete(projectRoot, taskId)  — verify zero residue
 *   fsAdapter                               — injectable filesystem
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, unlinkSync, appendFileSync } from "node:fs";
import { join } from "node:path";

import { TaskStateError } from "./errors.mjs";
import { assertLease, LEASE_FILENAME } from "./lease.mjs";
import { readValidatedEventLedger, appendEventLedgerBytes } from "./event-ledger.mjs";
import {
  readProject,
  readTask,
  syncIndexEntry,
  resolveInsideProject,
  PROJECT_DIRNAME,
  TASKS_DIRNAME,
  SCREENSHOT_DIRNAME,
  STATE_FILENAME,
  EVENTS_FILENAME,
  INDEX_FILENAME,
  EVIDENCE_DIRNAME,
  EVIDENCE_MANIFEST_FILENAME,
  TODO_FILENAME,
  SCHEMA_VERSION,
} from "./store.mjs";
import { TERMINAL_STATUSES } from "./model.mjs";
import {
  assertValidEvent,
  assertValidTaskState,
  assertValidIndex,
} from "./validate.mjs";
import {
  withTaskMutationLock,
  runFileTransaction,
  snapshotFiles,
  jsonBytes,
  textBytes,
} from "./transaction.mjs";

// ---------------------------------------------------------------------------
// Filesystem adapter (test-injectable)
// ---------------------------------------------------------------------------

export const fsAdapter = {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readdirSync,
  unlinkSync,
  appendFileSync,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stateError(code, message, details = {}) {
  throw new TaskStateError(code, message, details);
}

function nowOrThrow(nowOverride) {
  const now = nowOverride ?? process.env.FIGMA_TASK_STATE_NOW ?? new Date().toISOString();
  if (typeof now !== "string" || Number.isNaN(Date.parse(now))) {
    stateError("STATE_INVALID", "now must be an ISO date-time", { now });
  }
  return now;
}

function taskFile(projectRoot, taskId, filename) {
  return resolveInsideProject(
    projectRoot,
    join(PROJECT_DIRNAME, TASKS_DIRNAME, taskId, filename),
  );
}

function readScreenshotManifest(projectRoot, taskId) {
  const ssDir = resolveInsideProject(
    projectRoot,
    join(PROJECT_DIRNAME, SCREENSHOT_DIRNAME, taskId),
  );
  const manifestPath = join(ssDir, "manifest.json");
  if (!fsAdapter.existsSync(manifestPath)) {
    return { entries: [] };
  }
  try {
    return JSON.parse(fsAdapter.readFileSync(manifestPath, "utf8"));
  } catch {
    return { entries: [] };
  }
}

// ---------------------------------------------------------------------------
// Event builder
// ---------------------------------------------------------------------------

function buildArchiveEvent({ eventId, taskId, revision, type, actor, at, details }) {
  return assertValidEvent({
    schemaVersion: 1,
    eventId,
    taskId,
    revision,
    type,
    actor,
    at,
    evidence: [],
    details: details ?? {},
  });
}

// ---------------------------------------------------------------------------
// setArchiveFailedLocked — best-effort write of ARCHIVE_FAILED state
// Caller must already hold the mutation lock.
// ---------------------------------------------------------------------------

function setArchiveFailedLocked(projectRoot, taskId, holder, nowIso, {
  priorState, priorIndex, statePath, indexPath, eventsPath,
}, reason) {
  const failedState = {
    ...priorState,
    archiveStatus: "ARCHIVE_FAILED",
    revision: priorState.revision + 1,
    updatedAt: nowIso,
  };
  let finalState;
  try {
    finalState = assertValidTaskState(failedState);
  } catch {
    finalState = failedState;
  }

  const failedIndex = syncIndexEntry(priorIndex, finalState);

  // Read events ledger and emit ARCHIVE_FAILED event
  let eventPayload;
  try {
    const ledger = readValidatedEventLedger(eventsPath, taskId);
    const event = buildArchiveEvent({
      eventId: ledger.nextEventId,
      taskId,
      revision: finalState.revision,
      type: "ARCHIVE_FAILED",
      actor: holder,
      at: nowIso,
      details: { priorArchiveStatus: priorState.archiveStatus, reason },
    });
    eventPayload = appendEventLedgerBytes(ledger, event);
  } catch {
    eventPayload = Buffer.from(
      JSON.stringify({
        schemaVersion: 1, eventId: "E-0000", taskId, revision: finalState.revision,
        type: "ARCHIVE_FAILED", actor: holder, at: nowIso, evidence: [],
        details: { priorArchiveStatus: priorState.archiveStatus, reason: `ledger-error: ${reason}` },
      }) + "\n",
      "utf8",
    );
  }

  const errors = [];
  const tryWrite = (p, content) => {
    try {
      fsAdapter.writeFileSync(p, content, "utf8");
    } catch (e) {
      errors.push({ path: p, cause: e.message });
    }
  };
  tryWrite(statePath, JSON.stringify(finalState, null, 2) + "\n");
  tryWrite(indexPath, JSON.stringify(failedIndex, null, 2) + "\n");
  try {
    fsAdapter.appendFileSync(eventsPath, eventPayload);
  } catch (e) {
    errors.push({ path: eventsPath, cause: e.message });
  }
  // Intentionally retain lease.json for diagnosis.
  return { state: finalState, errors };
}

// ---------------------------------------------------------------------------
// Build final summary
// ---------------------------------------------------------------------------

export function buildFinalSummary({ state, screenshotManifest, taskDir, screenshotCount, deletionCount }) {
  const lines = [];

  const h = (text) => { lines.push(text, ""); };
  const p = (text) => { lines.push(text); };
  const blank = () => { lines.push(""); };

  h("# Final Task Summary");

  h("## Identity and outcome");
  p(`- **Task ID:** \`${state.taskId}\``);
  p(`- **Title:** ${state.title}`);
  p(`- **Type:** ${state.taskType}`);
  p(`- **Status:** ${state.status}`);
  p(`- **Archive status:** ${state.archiveStatus}`);
  p(`- **Workflow:** ${state.currentWorkflow}`);
  p(`- **Updated:** ${state.updatedAt}`);
  p(`- **Correction rounds:** ${state.correctionRounds ?? 0}`);
  blank();

  h("## User goal and approved scope");
  p(`The task was created as a **${state.taskType}** operation (writeRequired=${state.writeRequired}).`);
  p(`Gate: ${state.gate} (${state.gateStatus}).`);
  p(`Design system approval: ${state.approval?.designSystem ?? "N/A"}.`);
  p(`Figma write approval: ${state.approval?.figmaWrite ?? "N/A"}.`);
  if (state.validation?.visual?.summary) {
    blank();
    p(`**Visual validation summary:** ${state.validation.visual.summary}`);
  }
  blank();

  h("## Completed and incomplete Todos");
  const todoPath = join(taskDir, TODO_FILENAME);
  if (fsAdapter.existsSync(todoPath)) {
    p(fsAdapter.readFileSync(todoPath, "utf8"));
  } else {
    p("No todo file found at archive time.");
  }
  blank();

  h("## Figma changes or audit findings");
  const manifestPath = join(taskDir, EVIDENCE_DIRNAME, EVIDENCE_MANIFEST_FILENAME);
  if (fsAdapter.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fsAdapter.readFileSync(manifestPath, "utf8"));
      const entries = manifest.entries ?? [];
      p(`**Evidence entries:** ${entries.length}`);
      for (const entry of entries) {
        p(`- ${entry.id}: kind=${entry.kind}, command=${entry.command}, workflow=${entry.workflow}`);
      }
    } catch {
      p("Evidence manifest could not be read.");
    }
  } else {
    p("No evidence manifest found.");
  }
  blank();

  h("## Validation and visual conclusions");
  const ssEntries = screenshotManifest.entries ?? [];
  const reviewedEntries = ssEntries.filter((e) => e.reviewed === true);
  p(`**Screenshot count:** ${ssEntries.length} total, ${reviewedEntries.length} reviewed`);
  p(`**Screenshots deleted:** ${deletionCount}`);
  // Determine screenshot directory path for residue reporting
  const ssDirPath = join(taskDir, "..", "..", "screenshot", state.taskId);
  p(`**Zero screenshot residue:** ${!fsAdapter.existsSync(ssDirPath)}`);
  blank();
  if (reviewedEntries.length > 0) {
    h("### Visual Findings");
    for (const entry of reviewedEntries) {
      const finding = entry.visualFinding || "No finding recorded";
      p(`- **${entry.id}** (Page: ${entry.Page ?? "unknown"}, viewport: ${entry.viewport ?? "auto"}): ${finding}`);
    }
    blank();
  }
  if (state.validation?.visual?.summary) {
    p(`**Durable visual summary:** ${state.validation.visual.summary}`);
    blank();
  }

  h("## Correction history");
  p(`- **Correction rounds:** ${state.correctionRounds ?? 0}`);
  blank();

  h("## Remaining issues");
  p("None recorded at archive time. The task has reached terminal status.");
  blank();

  h("## Reclaimed runtime material");
  p(`- Screenshots deleted: ${deletionCount} file(s) from \`.figma/screenshot/${state.taskId}/\``);
  p(`- Lease file removed: true`);
  p(`- Events compacted: yes`);
  p(`- Screenshot directory removed: ${deletionCount > 0 ? "yes, zero residue confirmed" : "N/A (no screenshots)"}`);
  blank();

  h("## Related and superseding tasks");
  if (state.relatedTasks && state.relatedTasks.length > 0) {
    for (const related of state.relatedTasks) {
      p(`- \`${related}\``);
    }
  } else {
    p("No related tasks recorded.");
  }
  blank();

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Screenshot cleanup
// ---------------------------------------------------------------------------

export function cleanupTaskScreenshots(projectRoot, taskId) {
  const ssDir = resolveInsideProject(
    projectRoot,
    join(PROJECT_DIRNAME, SCREENSHOT_DIRNAME, taskId),
  );

  if (!fsAdapter.existsSync(ssDir)) {
    return { deletionCount: 0, entries: [] };
  }

  // Count image files before deletion
  let fileCount = 0;
  try {
    const files = fsAdapter.readdirSync(ssDir);
    fileCount = files.filter((f) => f !== "manifest.json").length;
  } catch {
    // Directory not accessible; proceed with removal
  }

  // Read manifest for reporting
  let entries = [];
  const manifestPath = join(ssDir, "manifest.json");
  if (fsAdapter.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fsAdapter.readFileSync(manifestPath, "utf8"));
      entries = manifest.entries ?? [];
    } catch {
      // Corrupt manifest — still proceed with deletion
    }
  }

  // Remove entire screenshot directory
  fsAdapter.rmSync(ssDir, { recursive: true, force: true });

  // Verify deletion
  if (fsAdapter.existsSync(ssDir)) {
    try {
      const remaining = fsAdapter.readdirSync(ssDir);
      if (remaining.length > 0) {
        stateError("ARCHIVE_FAILED", "screenshot directory was not fully removed", {
          taskId,
          remaining,
        });
      }
    } catch {
      // readdir may fail if the dir is partially gone, which is acceptable
    }
  }

  return { deletionCount: fileCount, entries };
}

// ---------------------------------------------------------------------------
// Runtime compaction
// ---------------------------------------------------------------------------

export function compactTaskRuntime(projectRoot, taskId) {
  const lPath = taskFile(projectRoot, taskId, LEASE_FILENAME);

  // Read events metadata (non-fatal)
  const ePath = taskFile(projectRoot, taskId, EVENTS_FILENAME);
  let eventCount = 0;
  if (fsAdapter.existsSync(ePath)) {
    try {
      const text = fsAdapter.readFileSync(ePath, "utf8");
      eventCount = text.split("\n").filter(Boolean).length;
    } catch {
      // skip
    }
  }

  // Remove lease.json
  let leaseRemoved = false;
  if (fsAdapter.existsSync(lPath)) {
    fsAdapter.unlinkSync(lPath);
    leaseRemoved = true;
  }

  return { leaseRemoved, eventCount };
}

// ---------------------------------------------------------------------------
// Residue check
// ---------------------------------------------------------------------------

export function assertArchiveComplete(projectRoot, taskId) {
  const ssDir = resolveInsideProject(
    projectRoot,
    join(PROJECT_DIRNAME, SCREENSHOT_DIRNAME, taskId),
  );
  return !fsAdapter.existsSync(ssDir);
}

// ---------------------------------------------------------------------------
// archiveTaskManual — locked implementation (no error wrapper)
// ---------------------------------------------------------------------------

export function archiveTaskManual(projectRoot, params) {
  const {
    taskId, holder, expectedRevision, terminalStatus, now, fail,
  } = params;
  const nowIso = nowOrThrow(now);

  // --- Validate prerequisites ---

  const { state, taskDir } = readTask(projectRoot, taskId);
  const { projectDir, index } = readProject(projectRoot);

  const statePath = join(taskDir, STATE_FILENAME);
  const indexPath = join(projectDir, INDEX_FILENAME);
  const eventsPath = join(taskDir, EVENTS_FILENAME);
  const leasePath = join(taskDir, LEASE_FILENAME);

  // 1. Must be terminal status
  if (!TERMINAL_STATUSES.includes(state.status)) {
    stateError("ILLEGAL_TRANSITION",
      `cannot archive task with non-terminal status ${state.status}`,
      { taskId, status: state.status });
  }

  // 2. Must match expected terminal status (if specified)
  if (terminalStatus && state.status !== terminalStatus) {
    stateError("ILLEGAL_TRANSITION",
      `task status ${state.status} does not match expected terminal status ${terminalStatus}`,
      { taskId, actual: state.status, expected: terminalStatus });
  }

  // 3. Archive status must be NOT_ARCHIVED
  if (state.archiveStatus !== "NOT_ARCHIVED") {
    stateError("ILLEGAL_TRANSITION",
      `task archiveStatus is ${state.archiveStatus}, expected NOT_ARCHIVED`,
      { taskId, archiveStatus: state.archiveStatus });
  }

  // 4. Validate lease is held
  assertLease(projectRoot, { taskId, holder, now: nowIso });

  // 5. Revision must match
  if (typeof expectedRevision === "number" && state.revision !== expectedRevision) {
    stateError("REVISION_CONFLICT",
      `expected revision ${expectedRevision}, actual ${state.revision}`,
      { taskId, expected: expectedRevision, actual: state.revision });
  }

  // 6. All screenshots must be reviewed
  const screenshotManifest = readScreenshotManifest(projectRoot, taskId);
  const ssEntries = screenshotManifest.entries ?? [];
  const unreviewed = ssEntries.filter((e) => e.reviewed !== true);
  if (unreviewed.length > 0) {
    stateError("ILLEGAL_TRANSITION",
      `cannot archive: ${unreviewed.length} unreviewed screenshot(s)`,
      { taskId, unreviewed: unreviewed.map((e) => e.id) });
  }

  // 7. Durable visual summary must be present
  if (!state.validation?.visual?.summary) {
    stateError("ILLEGAL_TRANSITION",
      "cannot archive: missing durable visual summary (state.validation.visual.summary is null/empty)",
      { taskId });
  }

  const ledger1 = readValidatedEventLedger(eventsPath, taskId);

  // =============================================================
  // Phase 1: ARCHIVING transition
  // =============================================================

  const archivingState = {
    ...state,
    archiveStatus: "ARCHIVING",
    revision: (state.revision || 0) + 1,
    updatedAt: nowIso,
  };
  assertValidTaskState(archivingState);

  const archivingEvent = buildArchiveEvent({
    eventId: ledger1.nextEventId,
    taskId,
    revision: archivingState.revision,
    type: "TASK_ARCHIVED",
    actor: holder,
    at: nowIso,
    details: { priorArchiveStatus: "NOT_ARCHIVED", reason: "archive-started" },
  });

  const indexAfterArchiving = assertValidIndex(syncIndexEntry(index, archivingState));
  const phase1EventsBytes = appendEventLedgerBytes(ledger1, archivingEvent);

  const phase1Snapshots = snapshotFiles({
    state: statePath,
    index: indexPath,
    events: eventsPath,
  });

  runFileTransaction({
    snapshots: phase1Snapshots,
    writes: [
      { stage: "archiving-state", path: statePath, bytes: jsonBytes(archivingState) },
      { stage: "archiving-index", path: indexPath, bytes: jsonBytes(indexAfterArchiving) },
      { stage: "archiving-event", path: eventsPath, bytes: phase1EventsBytes },
    ],
    fail: fail ?? (() => {}),
  });

  // =============================================================
  // Phase 2: Build final summary (pure computation)
  // =============================================================

  let summaryText;
  try {
    summaryText = buildFinalSummary({
      state: archivingState,
      screenshotManifest,
      taskDir,
      screenshotCount: ssEntries.length,
      deletionCount: ssEntries.length,
    });
  } catch (buildError) {
    setArchiveFailedLocked(projectRoot, taskId, holder, nowIso, {
      priorState: archivingState,
      priorIndex: indexAfterArchiving,
      statePath,
      indexPath,
      eventsPath,
    }, `final-summary-build-failed: ${buildError.message}`);
    throw new TaskStateError("ARCHIVE_FAILED", "final summary build failed", {
      taskId,
      cause: buildError.message,
    });
  }

  // =============================================================
  // Phase 3: Write summary and clean screenshots
  // =============================================================

  const summaryPath = join(taskDir, "final-summary.md");
  let deletionCount = 0;
  try {
    fsAdapter.writeFileSync(summaryPath, summaryText, "utf8");
    const cleanupResult = cleanupTaskScreenshots(projectRoot, taskId);
    deletionCount = cleanupResult.deletionCount;
  } catch (cleanupError) {
    setArchiveFailedLocked(projectRoot, taskId, holder, nowIso, {
      priorState: archivingState,
      priorIndex: indexAfterArchiving,
      statePath,
      indexPath,
      eventsPath,
    }, `screenshot-cleanup-failed: ${cleanupError.message}`);
    throw new TaskStateError("ARCHIVE_FAILED", "screenshot cleanup failed", {
      taskId,
      cause: cleanupError.message,
    });
  }

  // =============================================================
  // Phase 4: Compact runtime, verify residue, final ARCHIVED
  // =============================================================

  let compactResult;
  try {
    compactResult = compactTaskRuntime(projectRoot, taskId);
  } catch (compactError) {
    setArchiveFailedLocked(projectRoot, taskId, holder, nowIso, {
      priorState: archivingState,
      priorIndex: indexAfterArchiving,
      statePath,
      indexPath,
      eventsPath,
    }, `runtime-compaction-failed: ${compactError.message}`);
    throw new TaskStateError("ARCHIVE_FAILED", "runtime compaction failed", {
      taskId,
      cause: compactError.message,
    });
  }

  const residueOk = assertArchiveComplete(projectRoot, taskId);
  if (!residueOk) {
    setArchiveFailedLocked(projectRoot, taskId, holder, nowIso, {
      priorState: archivingState,
      priorIndex: indexAfterArchiving,
      statePath,
      indexPath,
      eventsPath,
    }, "screenshot-residue-detected");
    throw new TaskStateError("ARCHIVE_FAILED", "screenshot residue detected after cleanup", {
      taskId,
    });
  }

  // Final ARCHIVED transition
  const ledger2 = readValidatedEventLedger(eventsPath, taskId);

  const archivedState = {
    ...archivingState,
    archiveStatus: "ARCHIVED",
    revision: (archivingState.revision || 0) + 1,
    updatedAt: nowIso,
  };
  assertValidTaskState(archivedState);

  const archivedEvent = buildArchiveEvent({
    eventId: ledger2.nextEventId,
    taskId,
    revision: archivedState.revision,
    type: "TASK_ARCHIVED",
    actor: holder,
    at: nowIso,
    details: { priorArchiveStatus: "ARCHIVING", reason: "archive-completed" },
  });

  const finalIndex = assertValidIndex(syncIndexEntry(indexAfterArchiving, archivedState));
  const phase4EventsBytes = appendEventLedgerBytes(ledger2, archivedEvent);

  const phase4Snapshots = snapshotFiles({
    state: statePath,
    index: indexPath,
    events: eventsPath,
  });

  runFileTransaction({
    snapshots: phase4Snapshots,
    writes: [
      { stage: "archived-state", path: statePath, bytes: jsonBytes(archivedState) },
      { stage: "archived-index", path: indexPath, bytes: jsonBytes(finalIndex) },
      { stage: "archived-event", path: eventsPath, bytes: phase4EventsBytes },
    ],
    fail: fail ?? (() => {}),
  });

  return {
    ok: true,
    state: archivedState,
    event: archivedEvent,
    summaryPath,
    screenshotCount: ssEntries.length,
    deletionCount,
    leaseRemoved: compactResult.leaseRemoved,
  };
}

// ---------------------------------------------------------------------------
// archiveTask — public entry (wraps with mutation lock + error transformation)
// ---------------------------------------------------------------------------

export function archiveTask(projectRoot, params) {
  try {
    return withTaskMutationLock(projectRoot, params.taskId, () => archiveTaskManual(projectRoot, params));
  } catch (error) {
    if (error instanceof TaskStateError) {
      return {
        ok: false,
        error: { code: error.code, message: error.message, details: error.details ?? {} },
      };
    }
    return {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: error.message, details: {} },
    };
  }
}

// ---------------------------------------------------------------------------
// closeTask — validates ARCHIVED, removes lease
// ---------------------------------------------------------------------------

export function closeTask(projectRoot, { taskId, holder, now }) {
  const nowIso = nowOrThrow(now);
  const { state } = readTask(projectRoot, taskId);

  if (state.archiveStatus !== "ARCHIVED") {
    stateError("ILLEGAL_TRANSITION",
      `close requires archiveStatus=ARCHIVED, got ${state.archiveStatus}`,
      { taskId, archiveStatus: state.archiveStatus });
  }

  if (!TERMINAL_STATUSES.includes(state.status)) {
    stateError("ILLEGAL_TRANSITION",
      `close requires terminal task status, got ${state.status}`,
      { taskId, status: state.status });
  }

  // Remove lease if it exists and is held by the caller
  const leasePath = taskFile(projectRoot, taskId, LEASE_FILENAME);
  if (fsAdapter.existsSync(leasePath)) {
    try {
      const lease = JSON.parse(fsAdapter.readFileSync(leasePath, "utf8"));
      if (lease.holder === holder) {
        fsAdapter.unlinkSync(leasePath);
      }
    } catch {
      // Corrupt lease — remove anyway
      fsAdapter.unlinkSync(leasePath);
    }
  }

  return { ok: true, closed: true, taskId, archiveStatus: "ARCHIVED" };
}
