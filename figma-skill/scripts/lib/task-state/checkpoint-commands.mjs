import { TaskStateError } from "./errors.mjs";
import { checkpointTask } from "./checkpoint.mjs";

const EVENT_DETAIL_WHITELIST = new Set([
  "holder",
  "priorHolder",
  "newHolder",
  "reason",
  "gate",
  "gateStatus",
  "priorStatus",
  "nextStatus",
  "priorWorkflow",
  "nextWorkflow",
  "todo",
  "batch",
  "evidence",
  "approval",
  "correction",
  "priorArchiveStatus",
  "deletion",
  "nextAction",
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
    if (!EVENT_DETAIL_WHITELIST.has(detailName)) {
      throw new TaskStateError(
        "STATE_INVALID",
        `unknown event detail key --${key}`,
        { key, allowed: Array.from(EVENT_DETAIL_WHITELIST) },
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
  const eventType = requireFlag(flags, "event-type");
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
