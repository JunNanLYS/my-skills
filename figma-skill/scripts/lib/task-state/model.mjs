export const TASK_STATUSES = Object.freeze([
  "DRAFT",
  "WAITING_DESIGN_APPROVAL",
  "WAITING_WRITE_APPROVAL",
  "READY",
  "ACTIVE",
  "BLOCKED",
  "STALE",
  "NEEDS_REPLAN",
  "FAILED",
  "CANCELLED",
  "COMPLETED",
  "SUPERSEDED",
]);

export const TERMINAL_STATUSES = Object.freeze([
  "FAILED",
  "CANCELLED",
  "COMPLETED",
  "SUPERSEDED",
]);

export const RESUMABLE_STATUSES = Object.freeze([
  "DRAFT",
  "WAITING_DESIGN_APPROVAL",
  "WAITING_WRITE_APPROVAL",
  "READY",
  "ACTIVE",
  "BLOCKED",
  "STALE",
  "NEEDS_REPLAN",
]);

export const ARCHIVE_STATUSES = Object.freeze([
  "NOT_ARCHIVED",
  "ARCHIVING",
  "ARCHIVED",
  "ARCHIVE_FAILED",
]);

export const EVENT_TYPES = Object.freeze([
  "TASK_CREATED",
  "LEASE_ACQUIRED",
  "LEASE_TAKEN_OVER",
  "APPROVAL_RECORDED",
  "WORKFLOW_ENTERED",
  "TODO_UPDATED",
  "BATCH_STARTED",
  "BATCH_COMPLETED",
  "VALIDATION_RECORDED",
  "STALE_DETECTED",
  "REPLAN_REQUIRED",
  "TASK_BLOCKED",
  "TASK_FAILED",
  "TASK_CANCELLED",
  "TASK_COMPLETED",
  "SCREENSHOTS_CLEANED",
  "TASK_ARCHIVED",
  "ARCHIVE_FAILED",
  "LEASE_RELEASED",
]);

const freezeTransition = (transition) => Object.freeze({
  write: Object.freeze(transition.write),
  readOnly: Object.freeze(transition.readOnly),
});

export const TRANSITIONS = Object.freeze({
  DRAFT: freezeTransition({
    write: ["WAITING_DESIGN_APPROVAL", "WAITING_WRITE_APPROVAL", "READY", "BLOCKED", "CANCELLED"],
    readOnly: ["READY", "BLOCKED", "CANCELLED"],
  }),
  WAITING_DESIGN_APPROVAL: freezeTransition({
    write: ["WAITING_WRITE_APPROVAL", "READY", "NEEDS_REPLAN", "BLOCKED", "CANCELLED"],
    readOnly: ["READY", "NEEDS_REPLAN", "BLOCKED", "CANCELLED"],
  }),
  WAITING_WRITE_APPROVAL: freezeTransition({
    write: ["READY", "NEEDS_REPLAN", "BLOCKED", "CANCELLED"],
    readOnly: ["READY", "NEEDS_REPLAN", "BLOCKED", "CANCELLED"],
  }),
  READY: freezeTransition({
    write: ["ACTIVE", "STALE", "NEEDS_REPLAN", "BLOCKED", "CANCELLED"],
    readOnly: ["ACTIVE", "STALE", "NEEDS_REPLAN", "BLOCKED", "CANCELLED"],
  }),
  ACTIVE: freezeTransition({
    write: ["READY", "BLOCKED", "STALE", "NEEDS_REPLAN", "FAILED", "COMPLETED", "SUPERSEDED", "CANCELLED"],
    readOnly: ["READY", "BLOCKED", "STALE", "NEEDS_REPLAN", "FAILED", "COMPLETED", "SUPERSEDED", "CANCELLED"],
  }),
  BLOCKED: freezeTransition({
    write: ["READY", "ACTIVE", "STALE", "NEEDS_REPLAN", "FAILED", "SUPERSEDED", "CANCELLED"],
    readOnly: ["READY", "ACTIVE", "STALE", "NEEDS_REPLAN", "FAILED", "SUPERSEDED", "CANCELLED"],
  }),
  STALE: freezeTransition({
    write: ["READY", "ACTIVE", "NEEDS_REPLAN", "BLOCKED", "FAILED", "SUPERSEDED", "CANCELLED"],
    readOnly: ["READY", "ACTIVE", "NEEDS_REPLAN", "BLOCKED", "FAILED", "SUPERSEDED", "CANCELLED"],
  }),
  NEEDS_REPLAN: freezeTransition({
    write: ["DRAFT", "WAITING_DESIGN_APPROVAL", "WAITING_WRITE_APPROVAL", "READY", "BLOCKED", "SUPERSEDED", "CANCELLED"],
    readOnly: ["DRAFT", "READY", "BLOCKED", "SUPERSEDED", "CANCELLED"],
  }),
  FAILED: freezeTransition({ write: [], readOnly: [] }),
  CANCELLED: freezeTransition({ write: [], readOnly: [] }),
  COMPLETED: freezeTransition({ write: [], readOnly: [] }),
  SUPERSEDED: freezeTransition({ write: [], readOnly: [] }),
});
