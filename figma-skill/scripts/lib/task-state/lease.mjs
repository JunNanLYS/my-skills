import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { TaskStateError } from "./errors.mjs";
import { appendEventLedgerBytes, readValidatedEventLedger } from "./event-ledger.mjs";
import {
  PROJECT_DIRNAME,
  TASKS_DIRNAME,
  EVENTS_FILENAME,
  readTask,
  resolveInsideProject,
} from "./store.mjs";
import {
  jsonBytes,
  runFileTransaction,
  snapshotFiles,
  withTaskMutationLock,
} from "./transaction.mjs";
import { assertValidEvent } from "./validate.mjs";

export const LEASE_FILENAME = "lease.json";

const LEASE_KEYS = Object.freeze([
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

function ensureNonEmptyString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    rejectLease("STATE_INVALID", `${name} must be a non-empty string`, { [name]: value });
  }
}

function ensurePositiveMinutes(minutes) {
  if (!Number.isInteger(minutes) || minutes <= 0) {
    rejectLease("STATE_INVALID", "minutes must be a positive integer", { minutes });
  }
}

function nowOrThrow(nowOverride) {
  const now = nowOverride ?? process.env.FIGMA_TASK_STATE_NOW ?? new Date().toISOString();
  if (typeof now !== "string" || Number.isNaN(parseIso(now))) {
    rejectLease("STATE_INVALID", "now must be an ISO date-time", { now });
  }
  return now;
}

function timezoneOffset(iso) {
  const match = /(Z|[+-]\d{2}:?\d{2})$/.exec(iso);
  return match ? match[1] : "Z";
}

function pad2(number) {
  return String(number).padStart(2, "0");
}

function formatWithOffset(date, sourceIso) {
  const offset = timezoneOffset(sourceIso);
  if (offset === "Z") return date.toISOString();
  const match = /([+-])(\d{2}):?(\d{2})$/.exec(offset);
  if (!match) return date.toISOString();
  const sign = match[1] === "-" ? -1 : 1;
  const offsetMinutes = sign * (Number.parseInt(match[2], 10) * 60 + Number.parseInt(match[3], 10));
  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}` +
    `T${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}:${pad2(shifted.getUTCSeconds())}${offset}`;
}

function addMinutesIso(iso, minutes) {
  const milliseconds = parseIso(iso);
  if (Number.isNaN(milliseconds)) {
    rejectLease("STATE_INVALID", "now must be an ISO date-time", { now: iso });
  }
  return formatWithOffset(new Date(milliseconds + minutes * 60_000), iso);
}

function taskFile(projectRoot, taskId, filename) {
  return resolveInsideProject(
    projectRoot,
    join(PROJECT_DIRNAME, TASKS_DIRNAME, taskId, filename),
  );
}

export function assertLeaseShape(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    rejectLease("STATE_INVALID", "lease must be an object");
  }
  const extras = Object.keys(value).filter((key) => !LEASE_KEYS.includes(key));
  if (extras.length > 0) rejectLease("STATE_INVALID", "lease has unknown property", { extras });
  for (const key of LEASE_KEYS) {
    if (!Object.hasOwn(value, key)) {
      rejectLease("STATE_INVALID", `lease is missing required property ${key}`, { key });
    }
  }
  ensureNonEmptyString(value.taskId, "lease.taskId");
  ensureNonEmptyString(value.holder, "lease.holder");
  if (value.mode !== "WRITE") {
    rejectLease("STATE_INVALID", "lease.mode must be 'WRITE'", { mode: value.mode });
  }
  for (const stamp of ["acquiredAt", "heartbeatAt", "expiresAt"]) {
    if (typeof value[stamp] !== "string" || Number.isNaN(parseIso(value[stamp]))) {
      rejectLease("STATE_INVALID", `lease.${stamp} must be ISO date-time`, { [stamp]: value[stamp] });
    }
  }
  if (!Number.isInteger(value.stateRevision) || value.stateRevision < 0) {
    rejectLease("STATE_INVALID", "lease.stateRevision must be a non-negative integer", {
      stateRevision: value.stateRevision,
    });
  }
  return value;
}

export function readLease(projectRoot, taskId) {
  const path = taskFile(projectRoot, taskId, LEASE_FILENAME);
  if (!existsSync(path)) return null;
  let value;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    rejectLease("STATE_INVALID", "lease.json contains invalid JSON", { path, cause: error.message });
  }
  const lease = assertLeaseShape(value);
  if (lease.taskId !== taskId) {
    rejectLease("STATE_INVALID", "lease.taskId does not match task directory", {
      taskId,
      leaseTaskId: lease.taskId,
    });
  }
  return lease;
}

function buildLease({ taskId, holder, acquiredAt, heartbeatAt, expiresAt, stateRevision }) {
  return assertLeaseShape({
    taskId,
    holder,
    mode: "WRITE",
    acquiredAt,
    heartbeatAt,
    expiresAt,
    stateRevision,
  });
}

function buildLeaseEvent({ eventId, taskId, revision, type, actor, at, details }) {
  return assertValidEvent({
    schemaVersion: 1,
    eventId,
    taskId,
    revision,
    type,
    actor,
    at,
    evidence: [],
    details,
  });
}

function leaseTransaction(projectRoot, taskId, writes, fail) {
  const paths = {
    lease: taskFile(projectRoot, taskId, LEASE_FILENAME),
    events: taskFile(projectRoot, taskId, EVENTS_FILENAME),
  };
  runFileTransaction({ snapshots: snapshotFiles(paths), writes, fail });
}

export function assertLease(projectRoot, { taskId, holder, now }) {
  const nowIso = nowOrThrow(now);
  ensureNonEmptyString(taskId, "taskId");
  ensureNonEmptyString(holder, "holder");
  const lease = readLease(projectRoot, taskId);
  if (!lease) rejectLease("LEASE_LOST", "no lease is currently held for task", { taskId });
  if (lease.holder !== holder) {
    rejectLease("LEASE_LOST", "lease is held by a different session", { taskId, holder: lease.holder });
  }
  if (parseIso(nowIso) >= parseIso(lease.expiresAt)) {
    rejectLease("LEASE_EXPIRED", "lease has expired", { taskId, holder, expiresAt: lease.expiresAt });
  }
  return lease;
}

export function acquireLeaseLocked(projectRoot, { taskId, holder, minutes, now, fail }) {
  ensureNonEmptyString(taskId, "taskId");
  ensureNonEmptyString(holder, "holder");
  ensurePositiveMinutes(minutes);
  const nowIso = nowOrThrow(now);
  const { state } = readTask(projectRoot, taskId);
  const existing = readLease(projectRoot, taskId);
  if (existing && parseIso(nowIso) < parseIso(existing.expiresAt)) {
    rejectLease("LEASE_HELD", "lease is currently held", {
      taskId,
      holder: existing.holder,
      expiresAt: existing.expiresAt,
    });
  }

  const eventsPath = taskFile(projectRoot, taskId, EVENTS_FILENAME);
  const ledger = readValidatedEventLedger(eventsPath, taskId);
  const lease = buildLease({
    taskId,
    holder,
    acquiredAt: nowIso,
    heartbeatAt: nowIso,
    expiresAt: addMinutesIso(nowIso, minutes),
    stateRevision: state.revision,
  });
  const event = buildLeaseEvent({
    eventId: ledger.nextEventId,
    taskId,
    revision: state.revision,
    type: "LEASE_ACQUIRED",
    actor: holder,
    at: nowIso,
    details: existing
      ? { holder, priorHolder: existing.holder, expiry: existing.expiresAt }
      : { holder, expiry: lease.expiresAt },
  });
  leaseTransaction(projectRoot, taskId, [
    { stage: "lease", path: taskFile(projectRoot, taskId, LEASE_FILENAME), bytes: jsonBytes(lease) },
    { stage: "event", path: eventsPath, bytes: appendEventLedgerBytes(ledger, event) },
  ], fail);
  return { ...lease, priorHolder: existing?.holder ?? null, priorExpiry: existing?.expiresAt ?? null };
}

export function acquireLease(projectRoot, params) {
  return withTaskMutationLock(projectRoot, params.taskId, () => acquireLeaseLocked(projectRoot, params));
}

export function prepareRenewedLease(projectRoot, { taskId, holder, minutes, now, stateRevision }) {
  ensureNonEmptyString(taskId, "taskId");
  ensureNonEmptyString(holder, "holder");
  ensurePositiveMinutes(minutes);
  const nowIso = nowOrThrow(now);
  const existing = assertLease(projectRoot, { taskId, holder, now: nowIso });
  const { state } = readTask(projectRoot, taskId);
  const revision = stateRevision ?? state.revision;
  if (!Number.isInteger(revision) || revision < 0) {
    rejectLease("STATE_INVALID", "stateRevision must be a non-negative integer", { stateRevision });
  }
  return buildLease({
    taskId,
    holder,
    acquiredAt: existing.acquiredAt,
    heartbeatAt: nowIso,
    expiresAt: addMinutesIso(nowIso, minutes),
    stateRevision: revision,
  });
}

export function renewLeaseLocked(projectRoot, params) {
  const renewed = prepareRenewedLease(projectRoot, params);
  runFileTransaction({
    snapshots: snapshotFiles({ lease: taskFile(projectRoot, params.taskId, LEASE_FILENAME) }),
    writes: [{ stage: "heartbeat", path: taskFile(projectRoot, params.taskId, LEASE_FILENAME), bytes: jsonBytes(renewed) }],
    fail: params.fail,
  });
  return renewed;
}

export function renewLease(projectRoot, params) {
  return withTaskMutationLock(projectRoot, params.taskId, () => renewLeaseLocked(projectRoot, params));
}

export function takeoverLeaseLocked(projectRoot, { taskId, newHolder, minutes, now, userApproved, fail }) {
  ensureNonEmptyString(taskId, "taskId");
  ensureNonEmptyString(newHolder, "newHolder");
  ensurePositiveMinutes(minutes);
  const nowIso = nowOrThrow(now);
  if (userApproved !== true) rejectLease("LEASE_HELD", "takeover requires explicit user approval", { taskId });
  const existing = readLease(projectRoot, taskId);
  if (!existing) rejectLease("LEASE_HELD", "no active lease to take over", { taskId });
  if (existing.holder === newHolder) {
    rejectLease("LEASE_HELD", "new holder already owns the lease", { taskId, holder: existing.holder });
  }
  const { state } = readTask(projectRoot, taskId);
  const eventsPath = taskFile(projectRoot, taskId, EVENTS_FILENAME);
  const ledger = readValidatedEventLedger(eventsPath, taskId);
  const lease = buildLease({
    taskId,
    holder: newHolder,
    acquiredAt: nowIso,
    heartbeatAt: nowIso,
    expiresAt: addMinutesIso(nowIso, minutes),
    stateRevision: state.revision,
  });
  const event = buildLeaseEvent({
    eventId: ledger.nextEventId,
    taskId,
    revision: state.revision,
    type: "LEASE_TAKEN_OVER",
    actor: newHolder,
    at: nowIso,
    details: {
      priorHolder: existing.holder,
      newHolder,
      reason: "user-approved-takeover",
      expiry: lease.expiresAt,
    },
  });
  leaseTransaction(projectRoot, taskId, [
    { stage: "lease", path: taskFile(projectRoot, taskId, LEASE_FILENAME), bytes: jsonBytes(lease) },
    { stage: "event", path: eventsPath, bytes: appendEventLedgerBytes(ledger, event) },
  ], fail);
  return { ...lease, priorHolder: existing.holder };
}

export function takeoverLease(projectRoot, params) {
  return withTaskMutationLock(projectRoot, params.taskId, () => takeoverLeaseLocked(projectRoot, params));
}

export function releaseLeaseLocked(projectRoot, { taskId, holder, now, fail }) {
  ensureNonEmptyString(taskId, "taskId");
  ensureNonEmptyString(holder, "holder");
  const nowIso = nowOrThrow(now);
  const existing = assertLease(projectRoot, { taskId, holder, now: nowIso });
  const { state } = readTask(projectRoot, taskId);
  const eventsPath = taskFile(projectRoot, taskId, EVENTS_FILENAME);
  const ledger = readValidatedEventLedger(eventsPath, taskId);
  const event = buildLeaseEvent({
    eventId: ledger.nextEventId,
    taskId,
    revision: state.revision,
    type: "LEASE_RELEASED",
    actor: holder,
    at: nowIso,
    details: { holder, priorHolder: existing.holder, reason: "explicit-release" },
  });
  leaseTransaction(projectRoot, taskId, [
    { stage: "lease", path: taskFile(projectRoot, taskId, LEASE_FILENAME), remove: true },
    { stage: "event", path: eventsPath, bytes: appendEventLedgerBytes(ledger, event) },
  ], fail);
  return { released: true, taskId, holder, priorHolder: existing.holder, releasedAt: nowIso };
}

export function releaseLease(projectRoot, params) {
  return withTaskMutationLock(projectRoot, params.taskId, () => releaseLeaseLocked(projectRoot, params));
}
