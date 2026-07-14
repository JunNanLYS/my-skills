import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { TaskStateError } from "./errors.mjs";

const SCHEMA_VERSION = 1;
const PROJECT_DIRNAME = ".figma";
const SCHEMAS_DIRNAME = "schemas";
const TASKS_DIRNAME = "tasks";
const SCREENSHOT_DIRNAME = "screenshot";
const INDEX_FILENAME = "index.json";
const CONFIG_FILENAME = "config.json";
const README_FILENAME = "README.md";
const STATE_FILENAME = "state.json";
const EVENTS_FILENAME = "events.jsonl";
const PLAN_FILENAME = "plan.md";
const TODO_FILENAME = "todo.md";
const RECOVERY_FILENAME = "recovery.md";
const EVIDENCE_DIRNAME = "evidence";
const EVIDENCE_MANIFEST_FILENAME = "manifest.json";
const SCHEMA_FILES = Object.freeze([
  "config.schema.json",
  "event.schema.json",
  "index.schema.json",
  "task-state.schema.json",
]);

function rejectOutside(reason) {
  throw new TaskStateError("PATH_OUTSIDE_PROJECT", reason, { reason });
}

export function resolveProjectRoot(input) {
  if (typeof input !== "string" || input.length === 0) {
    rejectOutside("project root must be a non-empty string");
  }
  // Reject clear containment escape attempts before normalization.
  const trimmed = input.trim();
  if (trimmed === ".." || trimmed.startsWith(`..${sep}`) || trimmed.startsWith("../") || trimmed.startsWith(`..${"/"}`)) {
    rejectOutside(`project root escapes its container: ${input}`);
  }
  const resolved = resolve(input);
  if (resolved === "" || resolved === sep) {
    rejectOutside("project root is empty or filesystem root");
  }
  return resolved;
}

export function resolveInsideProject(projectRoot, relativePath) {
  const root = resolveProjectRoot(projectRoot);
  if (relativePath === null || relativePath === undefined) {
    rejectOutside("relative path is required");
  }
  if (typeof relativePath !== "string") {
    rejectOutside("relative path must be a string");
  }
  if (relativePath.length === 0) {
    rejectOutside("relative path is empty");
  }
  if (isAbsolute(relativePath)) {
    rejectOutside("relative path must not be absolute");
  }
  const normalized = relativePath.split(/[\\/]+/).join(sep);
  const resolved = resolve(root, normalized);
  const rel = relative(root, resolved);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    rejectOutside(`path escapes project root: ${relativePath}`);
  }
  return resolved;
}

export function atomicWriteText(filePath, text) {
  const target = resolve(filePath);
  const targetDir = dirname(target);
  mkdirSync(targetDir, { recursive: true });
  const base = target.split(/[\\/]/).pop();
  const tempPath = join(targetDir, `.${base}.${process.pid}.tmp`);
  let handle = null;
  try {
    handle = openSync(tempPath, "w");
    writeSync(handle, text);
    fsyncSync(handle);
  } catch (error) {
    if (handle !== null) {
      try {
        closeSync(handle);
      } catch {
        // ignore secondary close errors
      }
    }
    try {
      unlinkSync(tempPath);
    } catch {
      // ignore cleanup failures
    }
    throw error;
  }
  closeSync(handle);
  try {
    renameSync(tempPath, target);
  } catch (error) {
    try {
      unlinkSync(tempPath);
    } catch {
      // ignore cleanup failures
    }
    throw error;
  }
}

export function atomicWriteJson(filePath, value) {
  const text = JSON.stringify(value, null, 2) + "\n";
  atomicWriteText(filePath, text);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function ensureInitialized(root) {
  const configPath = join(root, PROJECT_DIRNAME, CONFIG_FILENAME);
  if (!existsSync(configPath)) {
    throw new TaskStateError(
      "PROJECT_NOT_INITIALIZED",
      "project is not initialized; run init-project first",
      { projectRoot: root },
    );
  }
}

function readProject(root) {
  ensureInitialized(root);
  const projectDir = join(root, PROJECT_DIRNAME);
  const config = readJson(join(projectDir, CONFIG_FILENAME));
  const index = readJson(join(projectDir, INDEX_FILENAME));
  return { projectRoot: root, projectDir, config, index };
}

function readTask(root, taskId) {
  const taskDir = resolveInsideProject(root, join(PROJECT_DIRNAME, TASKS_DIRNAME, taskId));
  if (!existsSync(join(taskDir, STATE_FILENAME))) {
    throw new TaskStateError("TASK_NOT_FOUND", `task ${taskId} does not exist`, { taskId });
  }
  const state = readJson(join(taskDir, STATE_FILENAME));
  return { taskDir, state };
}

function syncIndexEntry(index, taskState) {
  const summary = {
    taskId: taskState.taskId,
    title: taskState.title,
    status: taskState.status,
    archiveStatus: taskState.archiveStatus,
    updatedAt: taskState.updatedAt,
  };
  if (Object.hasOwn(taskState, "taskType")) {
    summary.taskType = taskState.taskType;
  }
  if (Object.hasOwn(taskState, "writeRequired")) {
    summary.writeRequired = taskState.writeRequired;
  }
  if (Object.hasOwn(taskState, "currentWorkflow")) {
    summary.currentWorkflow = taskState.currentWorkflow;
  }
  const nextTasks = index.tasks.filter((t) => t.taskId !== taskState.taskId);
  nextTasks.push(summary);
  nextTasks.sort((a, b) => {
    if (a.updatedAt === b.updatedAt) {
      return a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0;
    }
    return a.updatedAt < b.updatedAt ? -1 : 1;
  });
  const next = { ...index, updatedAt: taskState.updatedAt, tasks: nextTasks };
  return next;
}

export {
  readProject,
  readTask,
  syncIndexEntry,
  SCHEMA_VERSION,
  PROJECT_DIRNAME,
  SCHEMAS_DIRNAME,
  TASKS_DIRNAME,
  SCREENSHOT_DIRNAME,
  INDEX_FILENAME,
  CONFIG_FILENAME,
  README_FILENAME,
  STATE_FILENAME,
  EVENTS_FILENAME,
  PLAN_FILENAME,
  TODO_FILENAME,
  RECOVERY_FILENAME,
  EVIDENCE_DIRNAME,
  EVIDENCE_MANIFEST_FILENAME,
  SCHEMA_FILES,
};
