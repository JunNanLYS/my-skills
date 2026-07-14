import { TaskStateError } from "./errors.mjs";
import {
  ARCHIVE_STATUSES,
  EVENT_TYPES,
  TASK_STATUSES,
  TERMINAL_STATUSES,
} from "./model.mjs";

const TASK_ID_PATTERN = /^[0-9]{8}-[a-z0-9]+(?:-[a-z0-9]+)*(?:-[0-9]{2})?$/;
const TASK_TYPES = Object.freeze(["Create", "Modify", "Audit", "Migrate", "Export"]);
const GATE_STATUSES = Object.freeze(["PENDING", "PASS", "FAIL", "BLOCKED", "NOT_REQUIRED"]);
const APPROVAL_STATUSES = Object.freeze(["PENDING", "APPROVED", "REJECTED", "NOT_REQUIRED"]);
const LIVE_REVALIDATION_STATUSES = Object.freeze(["REQUIRED", "PASS", "NOT_REQUIRED"]);

const CONFIG_KEYS = Object.freeze([
  "schemaVersion",
  "defaultBranch",
  "taskIdFormat",
  "leaseMinutes",
  "evidencePolicy",
  "redactionPolicy",
]);
const INDEX_KEYS = Object.freeze(["schemaVersion", "updatedAt", "tasks"]);
const INDEX_TASK_KEYS = Object.freeze([
  "taskId",
  "title",
  "taskType",
  "writeRequired",
  "status",
  "archiveStatus",
  "currentWorkflow",
  "updatedAt",
]);
const REQUIRED_INDEX_TASK_KEYS = Object.freeze([
  "taskId",
  "title",
  "status",
  "archiveStatus",
  "updatedAt",
]);
const TASK_STATE_KEYS = Object.freeze([
  "schemaVersion",
  "revision",
  "taskId",
  "title",
  "taskType",
  "writeRequired",
  "status",
  "archiveStatus",
  "currentWorkflow",
  "gate",
  "gateStatus",
  "approval",
  "batch",
  "correctionRounds",
  "resume",
  "observedContext",
  "validation",
  "evidenceRefs",
  "relatedTasks",
  "updatedAt",
]);
const APPROVAL_KEYS = Object.freeze(["designSystem", "figmaWrite"]);
const BATCH_KEYS = Object.freeze(["current", "lastCompleted"]);
const RESUME_KEYS = Object.freeze(["required", "lastCheckpoint", "liveRevalidation"]);
const OBSERVED_CONTEXT_KEYS = Object.freeze(["figmaFile", "page", "nodeIds"]);
const VALIDATION_KEYS = Object.freeze(["visual"]);
const VISUAL_VALIDATION_KEYS = Object.freeze(["required", "reviewed", "summary"]);
const EVENT_KEYS = Object.freeze([
  "schemaVersion",
  "eventId",
  "taskId",
  "revision",
  "type",
  "workflow",
  "actor",
  "at",
  "evidence",
  "details",
]);
const REQUIRED_EVENT_KEYS = Object.freeze([
  "schemaVersion",
  "eventId",
  "taskId",
  "revision",
  "type",
  "actor",
  "at",
  "evidence",
]);

const SENSITIVE_KEY_PATTERN = /(?:secret|token|password|api[_-]?key|apikey|auth|authorization|credential|private[_-]?key|access[_-]?key)/i;
const SENSITIVE_VALUE_PATTERN = /(?:secret|token|password|api[_-]?key|apikey|auth|authorization|credential|private[_-]?key|access[_-]?key)\s*[:=]/i;
const USER_HOME_PATTERN = /^(?:~[\\/]|[A-Za-z]:[\\/]Users[\\/]|[\\/]Users[\\/]|[\\/]home[\\/])/;
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function invalid(message, details = {}) {
  throw new TaskStateError("STATE_INVALID", message, details);
}

function sensitive(message, details = {}) {
  throw new TaskStateError("SENSITIVE_DATA_REJECTED", message, details);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertPlainObject(value, path) {
  if (!isPlainObject(value)) {
    invalid(`${path} must be an object`, { path });
  }
}

function assertKnownKeys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      invalid(`${path} has unknown property ${key}`, { path, key });
    }
  }
}

function assertRequiredKeys(value, required, path) {
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      invalid(`${path} is missing required property ${key}`, { path, key });
    }
  }
}

function assertSchemaVersion(value, path) {
  if (!Number.isInteger(value) || value !== 1) {
    invalid(`${path}.schemaVersion must be integer 1`, { path: `${path}.schemaVersion` });
  }
}

function assertNonNegativeInteger(value, path) {
  if (!Number.isInteger(value) || value < 0) {
    invalid(`${path} must be a non-negative integer`, { path });
  }
}

function assertPositiveInteger(value, path) {
  if (!Number.isInteger(value) || value < 1) {
    invalid(`${path} must be a positive integer`, { path });
  }
}

function assertBoolean(value, path) {
  if (typeof value !== "boolean") {
    invalid(`${path} must be a boolean`, { path });
  }
}

function assertString(value, path, { minLength = 0 } = {}) {
  if (typeof value !== "string" || value.length < minLength) {
    invalid(`${path} must be a string`, { path });
  }
}

function assertNullableString(value, path) {
  if (value !== null && typeof value !== "string") {
    invalid(`${path} must be a string or null`, { path });
  }
}

function assertEnum(value, allowed, path) {
  if (!allowed.includes(value)) {
    invalid(`${path} must be one of: ${allowed.join(", ")}`, { path, value, allowed });
  }
}

function assertTaskId(value, path) {
  assertString(value, path, { minLength: 1 });
  if (!TASK_ID_PATTERN.test(value)) {
    invalid(`${path} must match YYYYMMDD-slug`, { path, value });
  }
}

function assertDateTime(value, path) {
  assertString(value, path, { minLength: 1 });
  if (!DATE_TIME_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    invalid(`${path} must be an ISO date-time string`, { path, value });
  }
}

function assertStringArray(value, path, { taskIds = false } = {}) {
  if (!Array.isArray(value)) {
    invalid(`${path} must be an array`, { path });
  }
  value.forEach((item, index) => {
    if (taskIds) {
      assertTaskId(item, `${path}[${index}]`);
    } else {
      assertString(item, `${path}[${index}]`);
    }
  });
}

function assertArchiveStatusAllowed(status, archiveStatus, path) {
  assertEnum(archiveStatus, ARCHIVE_STATUSES, `${path}.archiveStatus`);
  if (archiveStatus !== "NOT_ARCHIVED" && !TERMINAL_STATUSES.includes(status)) {
    invalid(`${path}.archiveStatus requires a terminal status`, {
      path: `${path}.archiveStatus`,
      status,
      archiveStatus,
    });
  }
}

function scanConfigForSensitiveData(value, path = "config") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanConfigForSensitiveData(item, `${path}[${index}]`));
    return;
  }

  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        sensitive(`${childPath} appears to contain sensitive data`, { path: childPath });
      }
      scanConfigForSensitiveData(child, childPath);
    }
    return;
  }

  if (typeof value === "string") {
    if (SENSITIVE_VALUE_PATTERN.test(value)) {
      sensitive(`${path} appears to contain sensitive data`, { path });
    }
    if (USER_HOME_PATTERN.test(value)) {
      sensitive(`${path} must not contain a user-home absolute path`, { path });
    }
  }
}

export function assertValidConfig(value) {
  scanConfigForSensitiveData(value);
  assertPlainObject(value, "config");
  assertKnownKeys(value, CONFIG_KEYS, "config");
  assertRequiredKeys(value, CONFIG_KEYS, "config");
  assertSchemaVersion(value.schemaVersion, "config");
  assertString(value.defaultBranch, "config.defaultBranch", { minLength: 1 });
  if (value.taskIdFormat !== "YYYYMMDD-slug") {
    invalid("config.taskIdFormat must be YYYYMMDD-slug", { path: "config.taskIdFormat" });
  }
  assertPositiveInteger(value.leaseMinutes, "config.leaseMinutes");
  assertEnum(value.evidencePolicy, ["tracked"], "config.evidencePolicy");
  assertEnum(value.redactionPolicy, ["strict"], "config.redactionPolicy");
  return value;
}

export function assertValidIndex(value) {
  assertPlainObject(value, "index");
  assertKnownKeys(value, INDEX_KEYS, "index");
  assertRequiredKeys(value, INDEX_KEYS, "index");
  assertSchemaVersion(value.schemaVersion, "index");
  assertDateTime(value.updatedAt, "index.updatedAt");
  if (!Array.isArray(value.tasks)) {
    invalid("index.tasks must be an array", { path: "index.tasks" });
  }

  const seenTaskIds = new Set();
  value.tasks.forEach((task, index) => {
    const path = `index.tasks[${index}]`;
    assertPlainObject(task, path);
    assertKnownKeys(task, INDEX_TASK_KEYS, path);
    assertRequiredKeys(task, REQUIRED_INDEX_TASK_KEYS, path);
    assertTaskId(task.taskId, `${path}.taskId`);
    if (seenTaskIds.has(task.taskId)) {
      invalid(`${path}.taskId duplicates another task`, { path: `${path}.taskId`, taskId: task.taskId });
    }
    seenTaskIds.add(task.taskId);
    assertString(task.title, `${path}.title`, { minLength: 1 });
    if (Object.hasOwn(task, "taskType")) {
      assertEnum(task.taskType, TASK_TYPES, `${path}.taskType`);
    }
    if (Object.hasOwn(task, "writeRequired")) {
      assertBoolean(task.writeRequired, `${path}.writeRequired`);
    }
    assertEnum(task.status, TASK_STATUSES, `${path}.status`);
    assertArchiveStatusAllowed(task.status, task.archiveStatus, path);
    if (Object.hasOwn(task, "currentWorkflow")) {
      assertString(task.currentWorkflow, `${path}.currentWorkflow`, { minLength: 1 });
    }
    assertDateTime(task.updatedAt, `${path}.updatedAt`);
  });

  return value;
}

export function assertValidTaskState(value) {
  assertPlainObject(value, "taskState");
  assertKnownKeys(value, TASK_STATE_KEYS, "taskState");
  assertRequiredKeys(value, TASK_STATE_KEYS, "taskState");
  assertSchemaVersion(value.schemaVersion, "taskState");
  assertNonNegativeInteger(value.revision, "taskState.revision");
  assertTaskId(value.taskId, "taskState.taskId");
  assertString(value.title, "taskState.title", { minLength: 1 });
  assertEnum(value.taskType, TASK_TYPES, "taskState.taskType");
  assertBoolean(value.writeRequired, "taskState.writeRequired");
  assertEnum(value.status, TASK_STATUSES, "taskState.status");
  assertArchiveStatusAllowed(value.status, value.archiveStatus, "taskState");
  assertString(value.currentWorkflow, "taskState.currentWorkflow", { minLength: 1 });
  assertString(value.gate, "taskState.gate", { minLength: 1 });
  assertEnum(value.gateStatus, GATE_STATUSES, "taskState.gateStatus");
  assertApproval(value.approval);
  assertBatch(value.batch);
  assertNonNegativeInteger(value.correctionRounds, "taskState.correctionRounds");
  assertResume(value.resume);
  assertObservedContext(value.observedContext);
  assertValidation(value.validation);
  assertStringArray(value.evidenceRefs, "taskState.evidenceRefs");
  assertStringArray(value.relatedTasks, "taskState.relatedTasks", { taskIds: true });
  assertDateTime(value.updatedAt, "taskState.updatedAt");
  return value;
}

export function assertValidEvent(value) {
  assertPlainObject(value, "event");
  assertKnownKeys(value, EVENT_KEYS, "event");
  assertRequiredKeys(value, REQUIRED_EVENT_KEYS, "event");
  assertSchemaVersion(value.schemaVersion, "event");
  assertString(value.eventId, "event.eventId", { minLength: 1 });
  assertTaskId(value.taskId, "event.taskId");
  assertNonNegativeInteger(value.revision, "event.revision");
  assertEnum(value.type, EVENT_TYPES, "event.type");
  if (Object.hasOwn(value, "workflow")) {
    assertString(value.workflow, "event.workflow", { minLength: 1 });
  }
  assertString(value.actor, "event.actor", { minLength: 1 });
  assertDateTime(value.at, "event.at");
  assertStringArray(value.evidence, "event.evidence");
  if (Object.hasOwn(value, "details")) {
    assertPlainObject(value.details, "event.details");
  }
  return value;
}

function assertApproval(value) {
  assertPlainObject(value, "taskState.approval");
  assertKnownKeys(value, APPROVAL_KEYS, "taskState.approval");
  assertRequiredKeys(value, APPROVAL_KEYS, "taskState.approval");
  assertEnum(value.designSystem, APPROVAL_STATUSES, "taskState.approval.designSystem");
  assertEnum(value.figmaWrite, APPROVAL_STATUSES, "taskState.approval.figmaWrite");
}

function assertBatch(value) {
  assertPlainObject(value, "taskState.batch");
  assertKnownKeys(value, BATCH_KEYS, "taskState.batch");
  assertRequiredKeys(value, BATCH_KEYS, "taskState.batch");
  assertNonNegativeInteger(value.current, "taskState.batch.current");
  assertNonNegativeInteger(value.lastCompleted, "taskState.batch.lastCompleted");
}

function assertResume(value) {
  assertPlainObject(value, "taskState.resume");
  assertKnownKeys(value, RESUME_KEYS, "taskState.resume");
  assertRequiredKeys(value, RESUME_KEYS, "taskState.resume");
  assertBoolean(value.required, "taskState.resume.required");
  assertString(value.lastCheckpoint, "taskState.resume.lastCheckpoint", { minLength: 1 });
  assertEnum(value.liveRevalidation, LIVE_REVALIDATION_STATUSES, "taskState.resume.liveRevalidation");
}

function assertObservedContext(value) {
  assertPlainObject(value, "taskState.observedContext");
  assertKnownKeys(value, OBSERVED_CONTEXT_KEYS, "taskState.observedContext");
  assertRequiredKeys(value, OBSERVED_CONTEXT_KEYS, "taskState.observedContext");
  assertNullableString(value.figmaFile, "taskState.observedContext.figmaFile");
  assertNullableString(value.page, "taskState.observedContext.page");
  assertStringArray(value.nodeIds, "taskState.observedContext.nodeIds");
}

function assertValidation(value) {
  assertPlainObject(value, "taskState.validation");
  assertKnownKeys(value, VALIDATION_KEYS, "taskState.validation");
  assertRequiredKeys(value, VALIDATION_KEYS, "taskState.validation");
  const visual = value.visual;
  assertPlainObject(visual, "taskState.validation.visual");
  assertKnownKeys(visual, VISUAL_VALIDATION_KEYS, "taskState.validation.visual");
  assertRequiredKeys(visual, VISUAL_VALIDATION_KEYS, "taskState.validation.visual");
  assertBoolean(visual.required, "taskState.validation.visual.required");
  assertBoolean(visual.reviewed, "taskState.validation.visual.reviewed");
  assertNullableString(visual.summary, "taskState.validation.visual.summary");
}
