import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  writeSync,
  fsyncSync,
} from "node:fs";
import { dirname, join } from "node:path";

import { TaskStateError } from "./errors.mjs";
import {
  PROJECT_DIRNAME,
  TASKS_DIRNAME,
  resolveInsideProject,
} from "./store.mjs";

export const TASK_MUTATION_LOCK_FILENAME = ".task-state.lock";

let tempSequence = 0;

function stateError(message, details = {}) {
  return new TaskStateError("STATE_INVALID", message, details);
}

function lockPathFor(projectRoot, taskId) {
  return resolveInsideProject(
    projectRoot,
    join(PROJECT_DIRNAME, TASKS_DIRNAME, taskId, TASK_MUTATION_LOCK_FILENAME),
  );
}

export function withTaskMutationLock(projectRoot, taskId, operation) {
  if (typeof operation !== "function") {
    throw stateError("task mutation operation must be a function", { taskId });
  }
  const lockPath = lockPathFor(projectRoot, taskId);
  if (!existsSync(dirname(lockPath))) {
    throw new TaskStateError(
      "TASK_NOT_FOUND",
      `task ${taskId} does not exist`,
      { taskId },
    );
  }
  let handle;
  try {
    handle = openSync(lockPath, "wx");
  } catch (error) {
    if (error && error.code === "EEXIST") {
      throw new TaskStateError(
        "LEASE_HELD",
        `task ${taskId} is being mutated by another process`,
        { taskId, lockPath, stage: "lock" },
      );
    }
    throw stateError(`failed to acquire task mutation lock for ${taskId}`, {
      taskId,
      lockPath,
      stage: "lock",
      cause: error.message,
    });
  }

  let result;
  let primaryError = null;
  try {
    result = operation();
  } catch (error) {
    primaryError = error;
  }

  const cleanupFailures = [];
  try {
    closeSync(handle);
  } catch (error) {
    cleanupFailures.push({ action: "close", path: lockPath, cause: error.message });
  }
  try {
    unlinkSync(lockPath);
  } catch (error) {
    cleanupFailures.push({ action: "unlink", path: lockPath, cause: error.message });
  }

  if (cleanupFailures.length > 0) {
    throw stateError(`failed to clean up task mutation lock for ${taskId}`, {
      taskId,
      stage: "lock-cleanup",
      cleanupFailures,
      primaryError: primaryError
        ? { code: primaryError.code, message: primaryError.message }
        : null,
    });
  }
  if (primaryError) throw primaryError;
  return result;
}

export function snapshotFiles(entries) {
  const snapshots = {};
  for (const [name, path] of Object.entries(entries)) {
    snapshots[name] = {
      name,
      path,
      existed: existsSync(path),
      bytes: existsSync(path) ? readFileSync(path) : null,
    };
  }
  return snapshots;
}

function atomicReplaceBytes(path, bytes) {
  mkdirSync(dirname(path), { recursive: true });
  tempSequence += 1;
  const tempPath = join(
    dirname(path),
    `.${path.split(/[\\/]/).pop()}.${process.pid}.${tempSequence}.tmp`,
  );
  let handle = null;
  try {
    handle = openSync(tempPath, "wx");
    writeSync(handle, bytes);
    fsyncSync(handle);
    closeSync(handle);
    handle = null;
    renameSync(tempPath, path);
  } catch (error) {
    if (handle !== null) {
      try {
        closeSync(handle);
      } catch {
        // The transaction wrapper reports the primary stage and restores snapshots.
      }
    }
    try {
      unlinkSync(tempPath);
    } catch (cleanupError) {
      if (cleanupError.code !== "ENOENT") {
        error.tempCleanupFailure = cleanupError.message;
        error.tempPath = tempPath;
      }
    }
    throw error;
  }
}

function restoreSnapshot(snapshot, failedStage) {
  if (snapshot.existed) {
    atomicReplaceBytes(snapshot.path, snapshot.bytes);
    return null;
  }
  if (existsSync(snapshot.path)) {
    unlinkSync(snapshot.path);
  }
  return null;
}

function preserveRollbackDiagnostic(snapshot, failedStage, error) {
  const diagnosticPath = `${snapshot.path}.rollback-${failedStage}-${process.pid}.tmp`;
  try {
    if (snapshot.existed) {
      writeFileSync(diagnosticPath, snapshot.bytes);
    } else {
      writeFileSync(diagnosticPath, Buffer.alloc(0));
    }
    return diagnosticPath;
  } catch (diagnosticError) {
    return `diagnostic-write-failed: ${diagnosticError.message}`;
  }
}

export function runFileTransaction({ snapshots, writes, fail }) {
  let failedStage = "unknown";
  try {
    for (const write of writes) {
      failedStage = write.stage;
      if (typeof fail === "function") fail(write.stage);
      if (write.remove === true) {
        if (existsSync(write.path)) unlinkSync(write.path);
      } else {
        atomicReplaceBytes(write.path, write.bytes);
      }
    }
  } catch (error) {
    const rollbackFailures = [];
    for (const snapshot of Object.values(snapshots).reverse()) {
      try {
        restoreSnapshot(snapshot, failedStage);
      } catch (rollbackError) {
        rollbackFailures.push({
          file: snapshot.name,
          path: snapshot.path,
          cause: rollbackError.message,
          diagnostic: preserveRollbackDiagnostic(snapshot, failedStage, rollbackError),
        });
      }
    }
    throw stateError(`task-state transaction failed at ${failedStage}`, {
      stage: failedStage,
      cause: error.message,
      rollbackFailures,
      tempCleanupFailure: error.tempCleanupFailure,
      tempPath: error.tempPath,
    });
  }
}

export function jsonBytes(value) {
  return Buffer.from(JSON.stringify(value, null, 2) + "\n", "utf8");
}

export function textBytes(value) {
  return Buffer.from(value, "utf8");
}
