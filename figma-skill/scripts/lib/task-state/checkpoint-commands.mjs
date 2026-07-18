import { TaskStateError } from "./errors.mjs";
import { checkpointTask } from "./checkpoint.mjs";

const STRING_EVENT_DETAIL_KEYS = new Set([
  "holder",
  "priorHolder",
  "newHolder",
  "reason",
  "expiry",
  "gate",
  "gateStatus",
  "priorStatus",
  "nextStatus",
  "priorWorkflow",
  "nextWorkflow",
  "priorArchiveStatus",
]);

const NON_STRING_EVENT_DETAIL_KEYS = new Set([
  "todo",
  "batch",
  "evidence",
  "approval",
  "correction",
  "deletion",
]);

function requireFlag(flags, name) {
  const value = flags[name];
  if (value === undefined || value === true) {
    throw new TaskStateError("STATE_INVALID", `missing required flag --${name}`, {
      flag: name,
    });
  }
  return value;
}

function parseInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new TaskStateError(
      "STATE_INVALID",
      `flag --${name} must be a non-negative integer`,
      { flag: name, value },
    );
  }
  return parsed;
}

function buildEventDetails(flags) {
  const details = {};
  for (const key of Object.keys(flags)) {
    if (!key.startsWith("detail-")) continue;
    const detailName = key.slice("detail-".length);
    if (NON_STRING_EVENT_DETAIL_KEYS.has(detailName)) {
      throw new TaskStateError(
        "STATE_INVALID",
        `event detail --${key} cannot be represented safely by the string-only CLI`,
        { key, expected: "typed library event.details value" },
      );
    }
    if (!STRING_EVENT_DETAIL_KEYS.has(detailName)) {
      throw new TaskStateError(
        "STATE_INVALID",
        `unknown event detail key --${key}`,
        { key, allowed: Array.from(STRING_EVENT_DETAIL_KEYS) },
      );
    }
    details[detailName] = flags[key];
  }
  return details;
}

export function runCheckpoint({ projectRoot, flags, json }) {
  const taskId = requireFlag(flags, "task");
  const session = requireFlag(flags, "session");
  const expectedRevision = parseInteger(
    requireFlag(flags, "expected-revision"),
    "expected-revision",
  );
  const eventFlag = flags.event && flags.event !== true ? flags.event : null;
  const eventTypeFlag = flags["event-type"] && flags["event-type"] !== true
    ? flags["event-type"]
    : null;
  if (eventFlag !== null && eventTypeFlag !== null && eventFlag !== eventTypeFlag) {
    throw new TaskStateError(
      "STATE_INVALID",
      "--event and --event-type must match when both are supplied",
      { event: eventFlag, eventType: eventTypeFlag },
    );
  }
  const eventType = eventFlag ?? eventTypeFlag;
  if (eventType === null) {
    throw new TaskStateError(
      "STATE_INVALID",
      "missing required flag --event",
      { flag: "event" },
    );
  }
  const workflow = flags.workflow && flags.workflow !== true ? flags.workflow : null;
  const status = flags.status && flags.status !== true ? flags.status : null;
  const now = flags.now && flags.now !== true ? flags.now : null;
  const nextAction = flags["next-action"] && flags["next-action"] !== true
    ? flags["next-action"]
    : null;
  const lastCheckpoint = flags["last-checkpoint"] && flags["last-checkpoint"] !== true
    ? flags["last-checkpoint"]
    : null;

  const nextState = {};
  if (workflow !== null) {
    nextState.currentWorkflow = workflow;
  }
  if (status !== null) {
    nextState.status = status;
  }

  const event = { type: eventType, details: buildEventDetails(flags) };
  const recovery = {};
  if (nextAction !== null) recovery.nextAction = nextAction;
  if (lastCheckpoint !== null) recovery.lastCheckpoint = lastCheckpoint;

  const result = checkpointTask(projectRoot, {
    taskId,
    session,
    expectedRevision,
    now,
    event,
    nextState,
    recovery: Object.keys(recovery).length > 0 ? recovery : undefined,
  });
  if (!result.ok) {
    throw new TaskStateError(result.error.code, result.error.message, result.error.details || {});
  }

  return {
    envelope: {
      ok: true,
      command: "checkpoint",
      data: {
        state: result.state,
        event: result.event,
        transition: result.transition,
        lease: result.lease,
      },
    },
    json,
  };
}
