export const ERROR_CODES = Object.freeze([
  "PROJECT_NOT_INITIALIZED",
  "SCHEMA_UNSUPPORTED",
  "STATE_INVALID",
  "REVISION_CONFLICT",
  "LEASE_HELD",
  "LEASE_EXPIRED",
  "LEASE_LOST",
  "TASK_NOT_FOUND",
  "ILLEGAL_TRANSITION",
  "PLAN_NOT_APPROVED",
  "LIVE_REVALIDATION_REQUIRED",
  "EVIDENCE_MISSING",
  "SENSITIVE_DATA_REJECTED",
  "PATH_OUTSIDE_PROJECT",
  "ARCHIVE_FAILED",
  "SELF_REFLECTION_FAILED",
  "SKILL_VERSION_MISMATCH",
]);

export class TaskStateError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "TaskStateError";
    this.code = code;
    this.details = details;
  }
}
