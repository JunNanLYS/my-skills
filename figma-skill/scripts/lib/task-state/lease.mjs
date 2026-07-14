import { appendFileSync, existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import { TaskStateError } from "./errors.mjs";
import {
  SCHEMA_VERSION,
  PROJECT_DIRNAME,
  TASKS_DIRNAME,
  EVENTS_FILENAME,
  STATE_FILENAME,
  atomicWriteJson,
  readTask,
  resolveInsideProject,
} from "./store.mjs";
import { assertValidEvent } from "./validate.mjs";

const LEASE_FILENAME = "lease.json";

const LEASE_KEYS = Object.freeze([
  "schemaVersion",
  "taskId",
  "holder",
  "mode",
  "acquiredAt",
  "heartbeatAt",
  "expiresAt",
  "stateRevision",
]);

function rejectLease(code, message, details = {}) {
  throw new TaskStateError(code, message, details);
}

function parseIso(value) {
  return Date.parse(value);
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function addMinutesIso(iso, minutes) {
  const ms = parseIso(iso);
  if (Number.isNaN(ms)) {
    rejectLease("STATE_INVALID", "now must be ISO date-time", { now: iso });
  }
  // The target ISO must keep the source's timezone offset. JavaScript's
  // built-in toISOString always emits UTC ('Z'), so we re-emit with the
  // source's offset to satisfy the validator (which accepts both UTC and
  // explicit offset forms).
  return formatWithOffset(new Date(ms + minutes * 60_000), iso);
}

function tzOffsetFor(iso) {
  const match = /(Z|[+-]\d{2}:?\d{2})$/.exec(iso);
  if (!match) return "Z";
  return match[1];
}

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatWithOffset(date, sourceIso) {
  const offset = tzOffsetFor(sourceIso);
  if (offset === "Z") {
    return date.toISOString();
  }
  // Render the source's wall clock for `date` (an instant). The wall-clock
  // time for a UTC instant at offset +HH:MM equals instant + HH:MM.
  const match = /([+-])(\d{2}):?(\d{2})$/.exec(offset);
  if (!match) return date.toISOString();
  const sign = match[1] === "-" ? -1 : 1;
  const minutes = sign * (parseInt(match[2], 10) * 60 + parseInt(match[3], 10));
  const wallInstant = date.getTime() + minutes * 60_000;
  const shifted = new Date(wallInstant);
  const y = shifted.getUTCFullYear();
  const m = pad2(shifted.getUTCMonth() + 1);
  const d = pad2(shifted.getUTCDate());
  const hh = pad2(shifted.getUTCHours());
  const mm = pad2(shifted.getUTCMinutes());
  const ss = pad2(shifted.getUTCSeconds());
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}${offset}`;
}

function resolveTaskDir(projectRoot, taskId) {
  return join(projectRoot, PROJECT_DIRNAME, TASKS_DIRNAME, taskId);
}

function resolveLeasePath(projectRoot, taskId) {
  return join(resolveTaskDir(projectRoot, taskId), LEASE_FILENAME);
}

function buildLeaseRecord({
  taskId,
  holder,
  mode,
  acquiredAt,
  heartbeatAt,
  expiresAt,
  stateRevision,
}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    taskId,
    holder,
    mode,
    acquiredAt,
    heartbeatAt,
    expiresAt,
    stateRevision,
  };
}

function assertLeaseShape(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    rejectLease("STATE_INVALID", "lease must be an object");
  }
  const keys = Object.keys(value);
  if (keys.some((key) => !LEASE_KEYS.includes(key))) {
    const extras = keys.filter((key) => !LEASE_KEYS.includes(key));
    rejectLease("STATE_INVALID", "lease has unknown property", { extras });
  }
  for (const key of LEASE_KEYS) {
    if (!Object.hasOwn(value, key)) {
      rejectLease("STATE_INVALID", `lease is missing required property ${key}`, {
        key,
      });
    }
  }
  if (value.schemaVersion !== SCHEMA_VERSION) {
    rejectLease("STATE_INVALID", "lease.schemaVersion must equal 1", {
      schemaVersion: value.schemaVersion,
    });
  }
  if (typeof value.taskId !== "string" || value.taskId.length === 0) {
    rejectLease("STATE_INVALID", "lease.taskId must be a non-empty string");
  }
  if (typeof value.holder !== "string" || value.holder.length === 0) {
    rejectLease("STATE_INVALID", "lease.holder must be a non-empty string");
  }
  if (value.mode !== "active") {
    rejectLease("STATE_INVALID", "lease.mode must be 'active'", { mode: value.mode });
  }
  for (const stamp of ["acquiredAt", "heartbeatAt", "expiresAt"]) {
    if (typeof value[stamp] !== "string" || Number.isNaN(parseIso(value[stamp]))) {
      rejectLease("STATE_INVALID", `lease.${stamp} must be ISO date-time`, {
        [stamp]: value[stamp],
      });
    }
  }
  if (!isNonNegativeInteger(value.stateRevision)) {
    rejectLease("STATE_INVALID", "lease.stateRevision must be a non-negative integer", {
      stateRevision: value.stateRevision,
    });
  }
  return value;
}

function readLeaseFile(projectRoot, taskId) {
  const leasePath = resolveLeasePath(projectRoot, taskId);
  if (!existsSync(leasePath)) {
    return null;
  }
  let raw;
  try {
    raw = readFileSync(leasePath, "utf8");
  } catch (error) {
    rejectLease("STATE_INVALID", "lease file cannot be read", {
      path: leasePath,
      cause: error.message,
    });
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    rejectLease("STATE_INVALID", "lease.json contains invalid JSON", {
      path: leasePath,
      cause: error.message,
    });
  }
  return assertLeaseShape(parsed);
}

function writeLeaseFile(projectRoot, lease) {
  const target = resolveInsideProject(
    projectRoot,
    join(PROJECT_DIRNAME, TASKS_DIRNAME, lease.taskId, LEASE_FILENAME),
  );
  atomicWriteJson(target, assertLeaseShape(lease));
}

function appendEvent(projectRoot, taskId, event) {
  const path = join(
    projectRoot,
    PROJECT_DIRNAME,
    TASKS_DIRNAME,
    taskId,
    EVENTS_FILENAME,
  );
  appendFileSync(path, JSON.stringify(event) + "\n");
}

function buildLeaseEvent({ taskId, revision, type, holder, at, details }) {
  const event = {
    schemaVersion: SCHEMA_VERSION,
    eventId: `evt-${taskId}-lease-${at.replace(/[^0-9]/g, "").slice(0, 14)}`,
    taskId,
    revision,
    type,
    actor: holder,
    at,
    evidence: [],
    details,
  };
  return assertValidEvent(event);
}

function readStateRevision(projectRoot, taskId) {
  // Read the state.json revision so the event records the right revision.
  // If the task has been checkpointed, lease events must reflect the
  // current revision, but lease events themselves do not change it.
  const statePath = join(
    projectRoot,
    PROJECT_DIRNAME,
    TASKS_DIRNAME,
    taskId,
    STATE_FILENAME,
  );
  if (!existsSync(statePath)) {
    return 0;
  }
  try {
    const parsed = JSON.parse(readFileSync(statePath, "utf8"));
    return typeof parsed.revision === "number" ? parsed.revision : 0;
  } catch {
    return 0;
  }
}

function requireTask(projectRoot, taskId) {
  const { state } = readTask(projectRoot, taskId);
  return state;
}

function ensurePositiveMinutes(minutes) {
  if (!isPositiveInteger(minutes)) {
    rejectLease("STATE_INVALID", "minutes must be a positive integer", {
      minutes,
    });
  }
}

function ensureNonEmptyString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    rejectLease("STATE_INVALID", `${name} must be a non-empty string`, {
      [name]: value,
    });
  }
}

function nowOrThrow(nowOverride) {
  const now = nowOverride ?? process.env.FIGMA_TASK_STATE_NOW;
  if (typeof now !== "string" || Number.isNaN(parseIso(now))) {
    rejectLease("STATE_INVALID", "now must be an ISO date-time", { now });
  }
  return now;
}

export function assertLease(projectRoot, { taskId, holder, now }) {
  const nowIso = nowOrThrow(now);
  ensureNonEmptyString(taskId, "taskId");
  ensureNonEmptyString(holder, "holder");

  const lease = readLeaseFile(projectRoot, taskId);
  if (lease === null) {
    rejectLease("LEASE_LOST", "no lease is currently held for task", {
      taskId,
    });
  }
  if (lease.holder !== holder) {
    rejectLease("LEASE_LOST", "lease is held by a different session", {
      taskId,
      holder: lease.holder,
    });
  }
  if (parseIso(nowIso) >= parseIso(lease.expiresAt)) {
    rejectLease("LEASE_EXPIRED", "lease has expired", {
      taskId,
      holder,
      expiresAt: lease.expiresAt,
    });
  }
  return lease;
}

export function acquireLease(projectRoot, { taskId, holder, minutes, now }) {
  ensureNonEmptyString(taskId, "taskId");
  ensureNonEmptyString(holder, "holder");
  ensurePositiveMinutes(minutes);

  const nowIso = nowOrThrow(now);
  // Validate the task and refresh the state revision so the lease tracks
  // the latest revision at acquisition time.
  const task = requireTask(projectRoot, taskId);

  const existing = readLeaseFile(projectRoot, taskId);
  let priorHolder = null;
  let priorExpiry = null;
  let mode = "active";

  if (existing !== null) {
    const stillLive = parseIso(nowIso) < parseIso(existing.expiresAt);
    if (stillLive && existing.holder !== holder) {
      rejectLease("LEASE_HELD", "lease is currently held by another holder", {
        taskId,
        holder: existing.holder,
        expiresAt: existing.expiresAt,
      });
    }
    if (stillLive) {
      // Same holder re-acquiring after a release must always run through
      // releaseLease first; re-acquire is therefore treated as held.
      rejectLease("LEASE_HELD", "lease is currently held", {
        taskId,
        holder: existing.holder,
      });
    }
    // Expired lease: allow takeover without user approval, but record the
    // prior holder in the event details.
    priorHolder = existing.holder;
    priorExpiry = existing.expiresAt;
    mode = "active";
  }

  const lease = buildLeaseRecord({
    taskId,
    holder,
    mode,
    acquiredAt: nowIso,
    heartbeatAt: nowIso,
    expiresAt: addMinutesIso(nowIso, minutes),
    stateRevision: task.revision,
  });
  writeLeaseFile(projectRoot, lease);

  // Append a LEASE_ACQUIRED event. For first acquisition the holder and
  // current expiry belong to the new lease; for an expired takeback the
  // brief mandates recording the prior expiry, so we put it under
  // `expiry` together with `priorHolder` to leave no room for ambiguity.
  const details = { holder };
  if (priorHolder !== null && priorExpiry !== null) {
    details.priorHolder = priorHolder;
    details.expiry = priorExpiry;
  } else {
    details.expiry = lease.expiresAt;
  }
  const eventRevision = readStateRevision(projectRoot, taskId);
  const event = buildLeaseEvent({
    taskId,
    revision: eventRevision,
    type: "LEASE_ACQUIRED",
    holder,
    at: nowIso,
    details,
  });
  appendEvent(projectRoot, taskId, event);

  return { ...lease, priorHolder, priorExpiry };
}

export function renewLease(projectRoot, { taskId, holder, minutes, now }) {
  ensureNonEmptyString(taskId, "taskId");
  ensureNonEmptyString(holder, "holder");
  ensurePositiveMinutes(minutes);
  const nowIso = nowOrThrow(now);
  const existing = readLeaseFile(projectRoot, taskId);
  if (existing === null) {
    rejectLease("LEASE_LOST", "no lease to renew", { taskId });
  }
  if (existing.holder !== holder) {
    rejectLease("LEASE_LOST", "lease is held by a different session", {
      taskId,
      holder: existing.holder,
    });
  }
  if (parseIso(nowIso) >= parseIso(existing.expiresAt)) {
    rejectLease("LEASE_EXPIRED", "lease has expired", {
      taskId,
      holder,
      expiresAt: existing.expiresAt,
    });
  }
  const renewed = buildLeaseRecord({
    taskId,
    holder,
    mode: "active",
    acquiredAt: existing.acquiredAt,
    heartbeatAt: nowIso,
    expiresAt: addMinutesIso(nowIso, minutes),
    stateRevision: existing.stateRevision,
  });
  writeLeaseFile(projectRoot, renewed);
  return renewed;
}

export function takeoverLease(projectRoot, { taskId, newHolder, minutes, now, userApproved }) {
  ensureNonEmptyString(taskId, "taskId");
  ensureNonEmptyString(newHolder, "newHolder");
  ensurePositiveMinutes(minutes);
  const nowIso = nowOrThrow(now);
  if (userApproved !== true) {
    rejectLease("LEASE_HELD", "takeover requires explicit user approval", {
      taskId,
    });
  }
  const existing = readLeaseFile(projectRoot, taskId);
  if (existing === null) {
    // No prior lease: a takeover without an active lease is illegal; the
    // caller should use acquireLease instead.
    rejectLease("LEASE_HELD", "no active lease to take over", { taskId });
  }
  if (existing.holder === newHolder) {
    rejectLease("LEASE_HELD", "new holder already owns the lease", {
      taskId,
      holder: existing.holder,
    });
  }
  const task = requireTask(projectRoot, taskId);
  const lease = buildLeaseRecord({
    taskId,
    holder: newHolder,
    mode: "active",
    acquiredAt: nowIso,
    heartbeatAt: nowIso,
    expiresAt: addMinutesIso(nowIso, minutes),
    stateRevision: task.revision,
  });
  writeLeaseFile(projectRoot, lease);

  const eventRevision = readStateRevision(projectRoot, taskId);
  const event = buildLeaseEvent({
    taskId,
    revision: eventRevision,
    type: "LEASE_TAKEN_OVER",
    holder: newHolder,
    at: nowIso,
    details: {
      priorHolder: existing.holder,
      newHolder,
      reason: "user-approved-takeover",
      expiry: lease.expiresAt,
    },
  });
  appendEvent(projectRoot, taskId, event);

  return { ...lease, priorHolder: existing.holder };
}

export function releaseLease(projectRoot, { taskId, holder, now }) {
  ensureNonEmptyString(taskId, "taskId");
  ensureNonEmptyString(holder, "holder");
  const nowIso = nowOrThrow(now);
  const existing = readLeaseFile(projectRoot, taskId);
  if (existing === null) {
    rejectLease("LEASE_LOST", "no lease to release", { taskId });
  }
  if (existing.holder !== holder) {
    rejectLease("LEASE_LOST", "lease is held by a different session", {
      taskId,
      holder: existing.holder,
    });
  }
  const leasePath = resolveLeasePath(projectRoot, taskId);
  let removed = false;
  if (existsSync(leasePath)) {
    try {
      unlinkSync(leasePath);
      removed = true;
    } catch (error) {
      rejectLease("STATE_INVALID", "failed to remove lease file", {
        path: leasePath,
        cause: error.message,
      });
    }
  }

  const eventRevision = readStateRevision(projectRoot, taskId);
  const event = buildLeaseEvent({
    taskId,
    revision: eventRevision,
    type: "LEASE_RELEASED",
    holder,
    at: nowIso,
    details: {
      holder,
      priorHolder: existing.holder,
      reason: "explicit-release",
    },
  });
  appendEvent(projectRoot, taskId, event);

  return {
    released: removed,
    taskId,
    holder,
    priorHolder: existing.holder,
    releasedAt: nowIso,
  };
}
