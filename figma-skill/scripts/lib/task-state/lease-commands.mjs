import { TaskStateError } from "./errors.mjs";
import {
  acquireLease,
  renewLease,
  releaseLease,
  takeoverLease,
} from "./lease.mjs";

function requireString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TaskStateError("STATE_INVALID", `missing required flag --${name}`, {
      flag: name,
    });
  }
  return value;
}

function parsePositiveInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new TaskStateError(
      "STATE_INVALID",
      `flag --${name} must be a positive integer`,
      { flag: name, value },
    );
  }
  return parsed;
}

function optionalBoolean(value) {
  if (value === undefined || value === true) return false;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new TaskStateError(
    "STATE_INVALID",
    `boolean flag must be 'true' or 'false'`,
    { value },
  );
}

export function runAcquireLease({ projectRoot, flags, json }) {
  const taskId = requireString(flags.task, "task");
  const holder = requireString(flags.session, "session");
  const minutes = parsePositiveInteger(flags.minutes ?? "30", "minutes");
  const now = flags.now && flags.now !== true ? flags.now : null;
  const lease = acquireLease(projectRoot, {
    taskId,
    holder,
    minutes,
    now,
  });
  return {
    envelope: {
      ok: true,
      command: "acquire",
      data: { taskId, lease },
    },
    json,
  };
}

export function runRenewLease({ projectRoot, flags, json }) {
  const taskId = requireString(flags.task, "task");
  const holder = requireString(flags.session, "session");
  const minutes = parsePositiveInteger(flags.minutes ?? "30", "minutes");
  const now = flags.now && flags.now !== true ? flags.now : null;
  const lease = renewLease(projectRoot, {
    taskId,
    holder,
    minutes,
    now,
  });
  return {
    envelope: {
      ok: true,
      command: "renew",
      data: { taskId, lease },
    },
    json,
  };
}

export function runTakeoverLease({ projectRoot, flags, json }) {
  const taskId = requireString(flags.task, "task");
  const newHolder = requireString(flags.session, "session");
  const minutes = parsePositiveInteger(flags.minutes ?? "30", "minutes");
  const now = flags.now && flags.now !== true ? flags.now : null;
  const userApproved = optionalBoolean(flags["user-approved"]);
  if (!userApproved) {
    throw new TaskStateError(
      "LEASE_HELD",
      "takeover requires --user-approved true",
      { taskId },
    );
  }
  const lease = takeoverLease(projectRoot, {
    taskId,
    newHolder,
    minutes,
    now,
    userApproved: true,
  });
  return {
    envelope: {
      ok: true,
      command: "takeover",
      data: { taskId, lease },
    },
    json,
  };
}

export function runReleaseLease({ projectRoot, flags, json }) {
  const taskId = requireString(flags.task, "task");
  const holder = requireString(flags.session, "session");
  const now = flags.now && flags.now !== true ? flags.now : null;
  const result = releaseLease(projectRoot, {
    taskId,
    holder,
    now,
  });
  return {
    envelope: {
      ok: true,
      command: "release",
      data: result,
    },
    json,
  };
}
