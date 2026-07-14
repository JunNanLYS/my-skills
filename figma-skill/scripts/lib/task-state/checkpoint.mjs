import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { TaskStateError } from "./errors.mjs";
import { appendEventLedgerBytes, readValidatedEventLedger } from "./event-ledger.mjs";
import {
  EVENT_TYPES,
  TERMINAL_STATUSES,
  TRANSITIONS,
  WRITE_REQUIRED_WORKFLOWS,
} from "./model.mjs";
import {
  PROJECT_DIRNAME,
  TASKS_DIRNAME,
  EVENTS_FILENAME,
  STATE_FILENAME,
  INDEX_FILENAME,
  RECOVERY_FILENAME,
  readProject,
  readTask,
  resolveInsideProject,
  syncIndexEntry,
} from "./store.mjs";
import {
  assertLease,
  LEASE_FILENAME,
  prepareRenewedLease,
} from "./lease.mjs";
import {
  jsonBytes,
  runFileTransaction,
  snapshotFiles,
  textBytes,
  withTaskMutationLock,
} from "./transaction.mjs";
import { assertValidEvent, assertValidIndex, assertValidTaskState } from "./validate.mjs";

function rejectTransition(message, details) {
  throw new TaskStateError("ILLEGAL_TRANSITION", message, details);
}

function ensurePlainObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    rejectTransition(`${name} must be an object`, { [name]: value });
  }
}

function ensureString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    rejectTransition(`${name} must be a non-empty string`, { [name]: value });
  }
}

function getTransitionRecord(state) {
  const record = TRANSITIONS[state.status];
  if (!record) rejectTransition(`unknown task status ${state.status}`, { status: state.status });
  return record;
}

export function assertTransition({ state, nextStatus, nextWorkflow, eventType, nextState }) {
  ensurePlainObject(state, "state");
  ensureString(nextStatus, "nextStatus");
  ensureString(nextWorkflow, "nextWorkflow");
  ensureString(eventType, "eventType");
  const record = getTransitionRecord(state);

  if (TERMINAL_STATUSES.includes(state.status)) {
    rejectTransition(`status ${state.status} is terminal; no transitions allowed`, {
      from: state.status,
      to: nextStatus,
    });
  }
  if (state.writeRequired === false && WRITE_REQUIRED_WORKFLOWS.includes(nextWorkflow)) {
    rejectTransition(`task with writeRequired=false cannot enter write workflow ${nextWorkflow}`, {
      workflow: nextWorkflow,
      writeRequired: false,
    });
  }
  if (state.status === "STALE" && nextStatus === "ACTIVE" && eventType !== "STALE_DETECTED") {
    rejectTransition("STALE -> ACTIVE requires STALE_DETECTED event", {
      from: "STALE",
      to: "ACTIVE",
      eventType,
    });
  }
  if (state.status === "NEEDS_REPLAN" && nextStatus === "ACTIVE") {
    rejectTransition("NEEDS_REPLAN cannot transition directly to ACTIVE", {
      from: "NEEDS_REPLAN",
      to: "ACTIVE",
      eventType,
    });
  }
  if (state.status !== nextStatus) {
    const bucket = state.writeRequired === false ? record.readOnly : record.write;
    if (!bucket.includes(nextStatus)) {
      rejectTransition(
        `illegal transition ${state.status} -> ${nextStatus} for writeRequired=${state.writeRequired}`,
        { from: state.status, to: nextStatus, writeRequired: state.writeRequired },
      );
    }
  }
  if (nextState !== undefined) {
    ensurePlainObject(nextState, "nextState");
    if (nextState.currentWorkflow !== nextWorkflow) {
      rejectTransition("nextState.currentWorkflow must match nextWorkflow", {
        nextWorkflow,
        stateWorkflow: nextState.currentWorkflow,
      });
    }
    if (nextState.status !== undefined && nextState.status !== nextStatus) {
      rejectTransition("nextState.status must match nextStatus", {
        nextStatus,
        stateStatus: nextState.status,
      });
    }
  }
  return { from: state.status, to: nextStatus, writeRequired: state.writeRequired };
}

function mergeCheckpointState(prior, next) {
  const merged = { ...prior, ...next };
  merged.revision = prior.revision + 1;
  merged.taskId = prior.taskId;
  merged.title = prior.title;
  merged.taskType = prior.taskType;
  merged.writeRequired = prior.writeRequired;
  merged.updatedAt = next.updatedAt ?? prior.updatedAt;
  return assertValidTaskState(merged);
}

function updateNextAction(recoveryText, nextAction) {
  if (typeof nextAction !== "string" || nextAction.trim().length === 0) {
    throw new TaskStateError("STATE_INVALID", "recovery.nextAction must be a non-empty string", {
      stage: "validation",
    });
  }
  const lines = recoveryText.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((line) => line === "## Next action");
  const replacement = ["## Next action", "", nextAction, ""];
  if (start === -1) {
    return `${recoveryText.replace(/\s+$/u, "")}\n\n${replacement.join("\n")}`;
  }
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith("## ")) end += 1;
  lines.splice(start, end - start, ...replacement);
  return lines.join("\n").replace(/\n*$/u, "\n");
}

function taskFile(projectRoot, taskId, filename) {
  return resolveInsideProject(
    projectRoot,
    join(PROJECT_DIRNAME, TASKS_DIRNAME, taskId, filename),
  );
}

function asErrorResult(error) {
  if (error instanceof TaskStateError) {
    return { ok: false, error: { code: error.code, message: error.message, details: error.details } };
  }
  return { ok: false, error: { code: "STATE_INVALID", message: error.message, details: {} } };
}

function validateParams(params) {
  if (!params || typeof params !== "object") {
    throw new TaskStateError("STATE_INVALID", "params required");
  }
  if (typeof params.taskId !== "string" || params.taskId.length === 0) {
    throw new TaskStateError("STATE_INVALID", "taskId required");
  }
  if (typeof params.session !== "string" || params.session.length === 0) {
    throw new TaskStateError("STATE_INVALID", "session required");
  }
  if (!Number.isInteger(params.expectedRevision) || params.expectedRevision < 0) {
    throw new TaskStateError("STATE_INVALID", "expectedRevision required");
  }
  if (!params.event || typeof params.event !== "object") {
    throw new TaskStateError("STATE_INVALID", "event required");
  }
  if (!EVENT_TYPES.includes(params.event.type)) {
    throw new TaskStateError(
      "STATE_INVALID",
      `event.type must be one of ${EVENT_TYPES.join(", ")}`,
    );
  }
}

function checkpointLocked(projectRoot, params) {
  const { taskId, session, expectedRevision, event, nextState, recovery, fail } = params;
  const stampIso = params.now ?? process.env.FIGMA_TASK_STATE_NOW ?? new Date().toISOString();
  const { state: current } = readTask(projectRoot, taskId);
  assertLease(projectRoot, { taskId, holder: session, now: stampIso });

  if (current.revision !== expectedRevision) {
    throw new TaskStateError("REVISION_CONFLICT", "expected revision does not match current state", {
      expected: expectedRevision,
      current: current.revision,
    });
  }

  const nextStatus = typeof nextState?.status === "string" ? nextState.status : current.status;
  const nextWorkflow = typeof nextState?.currentWorkflow === "string"
    ? nextState.currentWorkflow
    : current.currentWorkflow;
  const transition = assertTransition({
    state: current,
    nextStatus,
    nextWorkflow,
    eventType: event.type,
    nextState,
  });

  // Require evidence for terminal status transitions (except TASK_FAILED).
  if (TERMINAL_STATUSES.includes(nextStatus) && event.type !== "TASK_FAILED") {
    const hasEvidence = Array.isArray(event.evidence) && event.evidence.length > 0;
    if (!hasEvidence) {
      throw new TaskStateError(
        "EVIDENCE_MISSING",
        `terminal status transition to ${nextStatus} requires at least one evidence reference`,
        { nextStatus, eventType: event.type },
      );
    }
  }

  const recoveryPatch = recovery?.nextAction
    ? {
        resume: {
          ...current.resume,
          required: false,
          lastCheckpoint: typeof recovery.lastCheckpoint === "string" && recovery.lastCheckpoint.length > 0
            ? recovery.lastCheckpoint
            : `${nextStatus.toLowerCase()}-${nextWorkflow}`,
        },
      }
    : {};
  const validatedState = mergeCheckpointState(current, {
    ...nextState,
    ...recoveryPatch,
    updatedAt: stampIso,
  });
  const { index } = readProject(projectRoot);
  const nextIndex = assertValidIndex(syncIndexEntry(index, validatedState));

  const paths = {
    events: taskFile(projectRoot, taskId, EVENTS_FILENAME),
    recovery: taskFile(projectRoot, taskId, RECOVERY_FILENAME),
    state: taskFile(projectRoot, taskId, STATE_FILENAME),
    index: resolveInsideProject(projectRoot, join(PROJECT_DIRNAME, INDEX_FILENAME)),
    lease: taskFile(projectRoot, taskId, LEASE_FILENAME),
  };
  for (const [name, path] of Object.entries(paths)) {
    if (!existsSync(path)) {
      throw new TaskStateError("STATE_INVALID", `${name} file is missing`, { stage: "validation", path });
    }
  }
  const snapshots = snapshotFiles(paths);
  const ledger = readValidatedEventLedger(paths.events, taskId);
  const validatedEvent = assertValidEvent({
    schemaVersion: 1,
    eventId: ledger.nextEventId,
    taskId,
    revision: validatedState.revision,
    type: event.type,
    ...(nextWorkflow ? { workflow: nextWorkflow } : {}),
    actor: session,
    at: stampIso,
    evidence: event.evidence ?? [],
    details: {
      ...(event.details ?? {}),
      priorStatus: current.status,
      nextStatus,
      priorWorkflow: current.currentWorkflow,
      nextWorkflow,
    },
  });
  const nextRecovery = recovery?.nextAction
    ? updateNextAction(snapshots.recovery.bytes.toString("utf8"), recovery.nextAction)
    : null;
  const renewedLease = prepareRenewedLease(projectRoot, {
    taskId,
    holder: session,
    minutes: 30,
    now: stampIso,
    stateRevision: validatedState.revision,
  });

  const writes = [
    { stage: "event", path: paths.events, bytes: appendEventLedgerBytes(ledger, validatedEvent) },
  ];
  if (nextRecovery !== null) {
    writes.push({ stage: "recovery", path: paths.recovery, bytes: textBytes(nextRecovery) });
  }
  writes.push(
    { stage: "state", path: paths.state, bytes: jsonBytes(validatedState) },
    { stage: "index", path: paths.index, bytes: jsonBytes(nextIndex) },
    { stage: "heartbeat", path: paths.lease, bytes: jsonBytes(renewedLease) },
  );
  runFileTransaction({ snapshots, writes, fail });

  return {
    ok: true,
    state: validatedState,
    event: validatedEvent,
    transition,
    lease: renewedLease,
  };
}

export function checkpointTask(projectRoot, params) {
  try {
    validateParams(params);
    return withTaskMutationLock(projectRoot, params.taskId, () => checkpointLocked(projectRoot, params));
  } catch (error) {
    return asErrorResult(error);
  }
}
