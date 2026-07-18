import { existsSync, readFileSync } from "node:fs";

import { TaskStateError } from "./errors.mjs";
import { assertValidEvent } from "./validate.mjs";

const EVENT_ID_PATTERN = /^E-(\d{4})$/;

function invalid(message, details = {}) {
  throw new TaskStateError("STATE_INVALID", message, details);
}

export function readValidatedEventLedger(path, taskId) {
  if (!existsSync(path)) {
    invalid("events ledger is missing", { path, taskId });
  }
  let bytes;
  try {
    bytes = readFileSync(path);
  } catch (error) {
    invalid("events ledger cannot be read", { path, taskId, cause: error.message });
  }
  const text = bytes.toString("utf8");
  const lines = text.split("\n").filter((line) => line.length > 0);
  const events = [];
  let expected = 1;
  for (const [index, line] of lines.entries()) {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      invalid("events ledger contains invalid JSON", {
        path,
        taskId,
        line: index + 1,
        cause: error.message,
      });
    }
    const event = assertValidEvent(parsed);
    if (event.taskId !== taskId) {
      invalid("events ledger contains a different taskId", {
        path,
        taskId,
        eventTaskId: event.taskId,
        line: index + 1,
      });
    }
    const match = EVENT_ID_PATTERN.exec(event.eventId);
    if (!match || Number.parseInt(match[1], 10) !== expected) {
      invalid("events ledger event IDs must be immutable monotonic E-#### values", {
        path,
        taskId,
        line: index + 1,
        expected: `E-${String(expected).padStart(4, "0")}`,
        actual: event.eventId,
      });
    }
    events.push(event);
    expected += 1;
  }
  return { bytes, events, nextEventId: `E-${String(expected).padStart(4, "0")}` };
}

export function appendEventLedgerBytes(ledger, event) {
  const line = Buffer.from(JSON.stringify(event) + "\n", "utf8");
  return Buffer.concat([ledger.bytes, line]);
}
