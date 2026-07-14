import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { TaskStateError } from "./errors.mjs";
import {
  EVENT_TYPES,
  TERMINAL_STATUSES,
  TRANSITIONS,
  WRITE_REQUIRED_WORKFLOWS,
} from "./model.mjs";
import { assertValidEvent, assertValidIndex, assertValidTaskState } from "./validate.mjs";
import {
  SCHEMA_VERSION,
  PROJECT_DIRNAME,
  TASKS_DIRNAME,
  EVENTS_FILENAME,
  STATE_FILENAME,
  INDEX_FILENAME,
  atomicWriteJson,
  readProject,
  readTask,
  resolveInsideProject,
  syncIndexEntry,
} from "./store.mjs";
import { assertLease, renewLease } from "./lease.mjs";

const WRITE_WORKFLOW_TRANSITION_EVENTS = new Set([
  "WORKFLOW_ENTERED",
  "STALE_DETECTED",
  "REPLAN_REQUIRED",
]);

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
  if (!record) {
    rejectTransition(`unknown task status ${state.status}`, {
      status: state.status,
    });
  }
  return record;
}

export function assertTransition({
  state,
  nextStatus,
  nextWorkflow,
  eventType,
  nextState,
}) {
  ensurePlainObject(state, "state");
  ensureString(nextStatus, "nextStatus");
  ensureString(nextWorkflow, "nextWorkflow");
  ensureString(eventType, "eventType");

  const record = getTransitionRecord(state);

  // Terminal statuses are unconditionally final: nothing leaves them.
  if (TERMINAL_STATUSES.includes(state.status)) {
    rejectTransition(`status ${state.status} is terminal; no transitions allowed`, {
      from: state.status,
      to: nextStatus,
    });
  }

  // WRITE_REQUIRED: Workflow 6 / 8 / 10 perform actual Figma writes, so a
  // read-only task (writeRequired === false) must never enter them.
  if (state.writeRequired === false && WRITE_REQUIRED_WORKFLOWS.includes(nextWorkflow)) {
    rejectTransition(
      `task with writeRequired=false cannot enter write workflow ${nextWorkflow}`,
      { workflow: nextWorkflow, writeRequired: false },
    );
  }

  // STALE / NEEDS_REPLAN return to active only through their explicit
  // recovery / replan transitions; WORKFLOW_ENTERED alone is insufficient.
  if (state.status === "STALE" && nextStatus === "ACTIVE") {
    if (eventType !== "STALE_DETECTED") {
      rejectTransition("STALE -> ACTIVE requires STALE_DETECTED event", {
        from: "STALE",
        to: "ACTIVE",
        eventType,
      });
    }
  }
  if (state.status === "NEEDS_REPLAN" && nextStatus === "ACTIVE") {
    rejectTransition("NEEDS_REPLAN cannot transition directly to ACTIVE", {
      from: "NEEDS_REPLAN",
      to: "ACTIVE",
      eventType,
    });
  }

  // When status does not change, validate just the writeRequired rule
  // (already enforced above) and event-type-specific overrides; otherwise
  // the published status change must appear in the bucket.
  if (state.status !== nextStatus) {
    const bucket = state.writeRequired === false ? record.readOnly : record.write;
    if (!bucket.includes(nextStatus)) {
      rejectTransition(
        `illegal transition ${state.status} -> ${nextStatus} for writeRequired=${state.writeRequired}`,
        { from: state.status, to: nextStatus, writeRequired: state.writeRequired },
      );
    }
  }

  // nextState is optional metadata. When provided, validate that the
  // caller's claimed workflow matches the requested nextWorkflow.
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

function makeEventId(taskId, updatedAt) {
  const stamp = updatedAt.replace(/[^0-9]/g, "").slice(0, 14) || Date.now().toString();
  return `evt-${taskId}-${stamp}-${Math.floor(Math.random() * 900 + 100)}`;
}

function buildCheckpointEvent({
  taskId,
  revision,
  type,
  workflow,
  actor,
  at,
  evidence,
  details,
}) {
  const event = {
    schemaVersion: SCHEMA_VERSION,
    eventId: makeEventId(taskId, at),
    taskId,
    revision,
    type,
    actor,
    at,
    evidence: evidence ?? [],
  };
  if (workflow !== undefined && workflow !== null) {
    event.workflow = workflow;
  }
  if (details !== undefined && Object.keys(details).length > 0) {
    event.details = details;
  }
  return assertValidEvent(event);
}

function mergeCheckpointState(prior, next) {
  const merged = { ...prior };
  for (const key of Object.keys(next)) {
    merged[key] = next[key];
  }
  merged.revision = prior.revision + 1;
  merged.taskId = prior.taskId;
  merged.title = prior.title;
  merged.taskType = prior.taskType;
  merged.writeRequired = prior.writeRequired;
  merged.updatedAt = next.updatedAt ?? prior.updatedAt;
  return assertValidTaskState(merged);
}

function appendEventFile(projectRoot, taskId, event) {
  const path = join(
    projectRoot,
    PROJECT_DIRNAME,
    TASKS_DIRNAME,
    taskId,
    EVENTS_FILENAME,
  );
  appendFileSync(path, JSON.stringify(event) + "\n");
}

function renewLeaseIfValid(projectRoot, taskId, holder, now) {
  const leasePath = join(
    projectRoot,
    PROJECT_DIRNAME,
    TASKS_DIRNAME,
    taskId,
    "lease.json",
  );
  if (!existsSync(leasePath)) {
    return null;
  }
  try {
    renewLease(projectRoot, {
      taskId,
      holder,
      minutes: 30,
      now,
    });
  } catch {
    // Renewal failures must not fail the checkpoint; the lease will
    // simply expire naturally.
  }
  return { renewed: true };
}

export function checkpointTask(projectRoot, params) {
  if (!params || typeof params !== "object") {
    return {
      ok: false,
      error: { code: "STATE_INVALID", message: "params required" },
    };
  }
  const {
    taskId,
    session,
    expectedRevision,
    now,
    event,
    nextState,
    recovery,
  } = params;

  if (typeof taskId !== "string" || taskId.length === 0) {
    return {
      ok: false,
      error: { code: "STATE_INVALID", message: "taskId required" },
    };
  }
  if (typeof session !== "string" || session.length === 0) {
    return {
      ok: false,
      error: { code: "STATE_INVALID", message: "session required" },
    };
  }
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    return {
      ok: false,
      error: { code: "STATE_INVALID", message: "expectedRevision required" },
    };
  }
  if (!event || typeof event !== "object") {
    return {
      ok: false,
      error: { code: "STATE_INVALID", message: "event required" },
    };
  }
  if (!Array.isArray(EVENT_TYPES) || !EVENT_TYPES.includes(event.type)) {
    return {
      ok: false,
      error: {
        code: "STATE_INVALID",
        message: `event.type must be one of ${EVENT_TYPES.join(", ")}`,
      },
    };
  }

  // 1. Validate the lease holder and liveness before any state mutation.
  const { state: current, taskDir } = readTask(projectRoot, taskId);
  let leaseCheck;
  try {
    leaseCheck = assertLease(projectRoot, {
      taskId,
      holder: session,
      now,
    });
  } catch (error) {
    if (error instanceof TaskStateError) {
      return { ok: false, error: { code: error.code, message: error.message, details: error.details } };
    }
    return { ok: false, error: { code: "INTERNAL_ERROR", message: error.message } };
  }

  // 2. Validate the expected revision matches the on-disk state.
  if (current.revision !== expectedRevision) {
    return {
      ok: false,
      error: {
        code: "REVISION_CONFLICT",
        message: "expected revision does not match current state",
        details: { expected: expectedRevision, current: current.revision },
      },
    };
  }

  // 3. Apply the requested transition.
  let nextStatus = current.status;
  let nextWorkflow = current.currentWorkflow;
  if (nextState && typeof nextState === "object") {
    if (typeof nextState.status === "string") nextStatus = nextState.status;
    if (typeof nextState.currentWorkflow === "string") {
      nextWorkflow = nextState.currentWorkflow;
    }
  }

  let transition;
  try {
    transition = assertTransition({
      state: current,
      nextStatus,
      nextWorkflow,
      eventType: event.type,
      nextState,
    });
  } catch (error) {
    if (error instanceof TaskStateError) {
      return { ok: false, error: { code: error.code, message: error.message, details: error.details } };
    }
    return { ok: false, error: { code: "INTERNAL_ERROR", message: error.message } };
  }

  // 4. Validate the event object before staging.
  let validatedEvent;
  try {
    const stampIso = now ?? new Date().toISOString();
    const eventDetails = {
      ...(event.details ?? {}),
      priorStatus: current.status,
      nextStatus,
      priorWorkflow: current.currentWorkflow,
      nextWorkflow,
    };
    validatedEvent = buildCheckpointEvent({
      taskId,
      revision: current.revision + 1,
      type: event.type,
      workflow: nextWorkflow,
      actor: session,
      at: stampIso,
      evidence: event.evidence ?? [],
      details: eventDetails,
    });
  } catch (error) {
    if (error instanceof TaskStateError) {
      return { ok: false, error: { code: error.code, message: error.message, details: error.details } };
    }
    return { ok: false, error: { code: "INTERNAL_ERROR", message: error.message } };
  }

  // 5. Build the merged next state.
  const stampIso = now ?? new Date().toISOString();
  const recoveryPatch = {};
  if (recovery && typeof recovery === "object") {
    if (typeof recovery.nextAction === "string" && recovery.nextAction.length > 0) {
      recoveryPatch.resume = {
        ...current.resume,
        required: false,
        lastCheckpoint:
          typeof recovery.lastCheckpoint === "string" && recovery.lastCheckpoint.length > 0
            ? recovery.lastCheckpoint
            : `${nextStatus.toLowerCase()}-${nextWorkflow}`,
      };
    }
  }

  const merged = mergeCheckpointState(current, {
    ...nextState,
    ...recoveryPatch,
    updatedAt: stampIso,
  });

  // Validate the merged state before writing.
  let validatedState;
  try {
    validatedState = assertValidTaskState(merged);
  } catch (error) {
    if (error instanceof TaskStateError) {
      return { ok: false, error: { code: error.code, message: error.message, details: error.details } };
    }
    return { ok: false, error: { code: "INTERNAL_ERROR", message: error.message } };
  }

  // 6. Stage all writes: append event, write state.json, then update index.
  try {
    appendEventFile(projectRoot, taskId, validatedEvent);
    const statePath = join(taskDir, STATE_FILENAME);
    atomicWriteJson(statePath, validatedState);
  } catch (error) {
    if (error instanceof TaskStateError) {
      return { ok: false, error: { code: error.code, message: error.message, details: error.details } };
    }
    return { ok: false, error: { code: "ARCHIVE_FAILED", message: error.message } };
  }

  // 7. Update the project index last so a torn write leaves the prior
  // index consistent with the prior state.
  try {
    const { config, index } = readProject(projectRoot);
    const nextIndex = assertValidIndex(syncIndexEntry(index, validatedState));
    const indexPath = resolveInsideProject(
      projectRoot,
      join(PROJECT_DIRNAME, INDEX_FILENAME),
    );
    atomicWriteJson(indexPath, nextIndex);
    // Mark config as used so a future eviction doesn't break the build.
    void config;
  } catch (error) {
    if (error instanceof TaskStateError) {
      return { ok: false, error: { code: error.code, message: error.message, details: error.details } };
    }
    return { ok: false, error: { code: "ARCHIVE_FAILED", message: error.message } };
  }

  // 8. Renew the lease (best-effort; do not fail the checkpoint on
  // heartbeat-related rejections).
  renewLeaseIfValid(projectRoot, taskId, session, stampIso);

  return {
    ok: true,
    state: validatedState,
    event: validatedEvent,
    transition,
    lease: leaseCheck,
  };
}
