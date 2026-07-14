/**
 * evidence.mjs — Todo parsing, evidence registration, redaction, screenshot
 * management, and project-level validation for figma-skill v2 task state.
 *
 * This module never writes outside `.figma/` and never copies screenshot
 * bytes into long-term evidence.
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { TaskStateError } from "./errors.mjs";
import {
  PROJECT_DIRNAME,
  TASKS_DIRNAME,
  SCREENSHOT_DIRNAME,
  EVIDENCE_DIRNAME,
  EVIDENCE_MANIFEST_FILENAME,
  EVENTS_FILENAME,
  STATE_FILENAME,
  readProject,
  readTask,
  resolveInsideProject,
  SCHEMA_VERSION,
} from "./store.mjs";
import {
  TASK_STATUSES,
  TERMINAL_STATUSES,
  EVENT_TYPES,
} from "./model.mjs";
import {
  assertValidConfig,
  assertValidEvent,
  assertValidIndex,
  assertValidTaskState,
} from "./validate.mjs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TODO_ID_PATTERN = /^T-\d{3}$/;
const EVIDENCE_ID_PATTERN = /^EV-(\d{4})$/;
const SCREENSHOT_ID_PATTERN = /^SS-(\d{4})$/;

const TODO_SECTIONS = ["Open", "In progress", "Done"];

const VALID_TODO_META = ["workflow", "blockedBy", "evidence"];

const EVIDENCE_MANIFEST_KEYS = [
  "id", "kind", "path", "command", "workflow", "sha256", "redacted",
];

const SCREENSHOT_MANIFEST_KEYS = [
  "id", "path", "Page", "nodeIds", "viewport", "created", "reviewed", "visualFinding",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stateError(code, message, details = {}) {
  throw new TaskStateError(code, message, details);
}

function ensureProject(projectRoot) {
  const projectDir = join(projectRoot, PROJECT_DIRNAME);
  if (!existsSync(join(projectDir, "config.json"))) {
    stateError(
      "PROJECT_NOT_INITIALIZED",
      "project is not initialized; run init-project first",
    );
  }
}

function taskEvidenceDir(projectRoot, taskId) {
  return resolveInsideProject(
    projectRoot,
    join(PROJECT_DIRNAME, TASKS_DIRNAME, taskId, EVIDENCE_DIRNAME),
  );
}

function taskEvidenceManifestPath(projectRoot, taskId) {
  return join(taskEvidenceDir(projectRoot, taskId), EVIDENCE_MANIFEST_FILENAME);
}

function taskScreenshotDir(projectRoot, taskId) {
  return resolveInsideProject(
    projectRoot,
    join(PROJECT_DIRNAME, SCREENSHOT_DIRNAME, taskId),
  );
}

function readEvidenceManifest(projectRoot, taskId) {
  const path = taskEvidenceManifestPath(projectRoot, taskId);
  if (!existsSync(path)) {
    return { entries: [] };
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function computeSha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function nextEvidenceId(entries) {
  let max = 0;
  for (const entry of entries) {
    const match = EVIDENCE_ID_PATTERN.exec(entry.id);
    if (match) {
      const num = Number.parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }
  return `EV-${String(max + 1).padStart(4, "0")}`;
}

function nextScreenshotId(entries) {
  let max = 0;
  for (const entry of entries) {
    const match = SCREENSHOT_ID_PATTERN.exec(entry.id);
    if (match) {
      const num = Number.parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }
  return `SS-${String(max + 1).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Todo document parsing
// ---------------------------------------------------------------------------

/**
 * Parse a todo.md document into an array of structured todo items.
 * Only handles the canonical 4-line form.
 *
 * Each item:
 *   - [ ] T-001 <text>
 *     - workflow: <string>
 *     - blockedBy: <JSON array>
 *     - evidence: <JSON array>
 */
export function parseTodoDocument(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const todos = [];
  let currentSection = null;
  let currentTodo = null;
  let metaLinesSeen = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    // Section header — finalize current todo before switching sections
    const sectionMatch = trimmed.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      if (currentTodo) {
        if (metaLinesSeen < 3) {
          stateError("STATE_INVALID", `todo ${currentTodo.id} is missing required metadata lines`);
        }
        todos.push(currentTodo);
      }
      if (TODO_SECTIONS.includes(sectionMatch[1])) {
        currentSection = sectionMatch[1];
      } else {
        currentSection = null;
      }
      currentTodo = null;
      continue;
    }

    // Skip empty lines and free text outside todo blocks
    if (!currentSection) {
      currentTodo = null;
      continue;
    }
    if (trimmed.length === 0) {
      // Don't reset currentTodo; the next line might be metadata or a new todo
      continue;
    }
    if (trimmed.startsWith("No item")) {
      currentTodo = null;
      continue;
    }

    // Check if this is a todo item line: `- [ ] T-001 Some task` or `- [x] T-001 Done task`
    const todoMatch = trimmed.match(/^- \[([ x])\] (T-\d{3}) (.+)$/);
    if (todoMatch) {
      // Finalize previous todo
      if (currentTodo) {
        if (metaLinesSeen < 3) {
          stateError("STATE_INVALID", `todo ${currentTodo.id} is missing required metadata lines`);
        }
        todos.push(currentTodo);
      }

      const id = todoMatch[2];
      const statusRaw = todoMatch[1];
      const text = todoMatch[3];

      // Detect duplicate IDs
      if (todos.some((t) => t.id === id)) {
        stateError("STATE_INVALID", `duplicate todo ID ${id}`);
      }

      currentTodo = {
        id,
        text,
        status: statusRaw === "x" ? "done" : currentSection === "In progress" ? "in_progress" : "open",
        section: currentSection,
        workflow: null,
        blockedBy: [],
        evidence: [],
      };
      metaLinesSeen = 0;
      continue;
    }

    // Metadata line
    if (currentTodo) {
      const metaMatch = trimmed.match(/^- (\w+): (.+)$/);
      if (metaMatch) {
        const key = metaMatch[1];
        const value = metaMatch[2].trim();

        // Validate indentation — metadata lines must be indented with at least 2 spaces
        const indent = line.length - line.trimStart().length;
        if (indent < 2) {
          stateError("STATE_INVALID", `todo ${currentTodo.id} metadata line ${key} is not indented`);
        }

        if (!VALID_TODO_META.includes(key)) {
          stateError("STATE_INVALID", `unknown todo metadata key: ${key}`, { key, todoId: currentTodo.id });
        }

        try {
          if (key === "workflow") {
            currentTodo.workflow = value;
          } else if (key === "blockedBy") {
            currentTodo.blockedBy = JSON.parse(value);
            if (!Array.isArray(currentTodo.blockedBy)) {
              stateError("STATE_INVALID", `todo ${currentTodo.id} blockedBy must be an array`);
            }
          } else if (key === "evidence") {
            currentTodo.evidence = JSON.parse(value);
            if (!Array.isArray(currentTodo.evidence)) {
              stateError("STATE_INVALID", `todo ${currentTodo.id} evidence must be an array`);
            }
          }
        } catch (parseError) {
          if (parseError instanceof TaskStateError) throw parseError;
          stateError("STATE_INVALID", `todo ${currentTodo.id} metadata ${key} contains invalid JSON`);
        }

        metaLinesSeen += 1;
        continue;
      }
    }

    // If we're in a todo but the line doesn't match any expected pattern, it's a stray line
    if (currentTodo) {
      // Allow empty lines but not other content
      if (trimmed.length > 0) {
        stateError("STATE_INVALID", `unexpected content in todo ${currentTodo.id} block: ${trimmed}`);
      }
    }
  }

  // Finalize last todo
  if (currentTodo) {
    if (metaLinesSeen < 3) {
      stateError("STATE_INVALID", `todo ${currentTodo.id} is missing required metadata lines`);
    }
    todos.push(currentTodo);
  }

  // Validate dependencies: all blockedBy references must exist
  const allIds = new Set(todos.map((t) => t.id));
  for (const todo of todos) {
    for (const dep of todo.blockedBy) {
      if (!allIds.has(dep)) {
        stateError("STATE_INVALID", `todo ${todo.id} references nonexistent dependency ${dep}`);
      }
    }
  }

  // Validate no dependency cycles
  const visiting = new Set();
  function hasCycle(id, visited) {
    if (visited.has(id)) return true;
    if (visiting.has(id)) return false;
    visiting.add(id);
    visited.add(id);
    const todo = todos.find((t) => t.id === id);
    if (todo) {
      for (const dep of todo.blockedBy) {
        if (hasCycle(dep, visited)) return true;
      }
    }
    visited.delete(id);
    return false;
  }
  for (const todo of todos) {
    if (hasCycle(todo.id, new Set())) {
      stateError("STATE_INVALID", `dependency cycle detected involving todo ${todo.id}`);
    }
  }

  return todos;
}

// ---------------------------------------------------------------------------
// Todo document rendering
// ---------------------------------------------------------------------------

/**
 * Render a structured todo array into deterministic todo.md text.
 * Output is ordered: Open, In progress, Done. Within each section,
 * items are rendered in their input order.
 */
export function renderTodoDocument(todos, context = {}) {
  const { taskId, updatedAt } = context;
  const lines = [];

  lines.push("# Task todos", "");
  if (taskId) lines.push(`Task id: \`${taskId}\``);
  if (updatedAt) lines.push(`Updated: ${updatedAt}`);
  lines.push("");

  const sections = { Open: [], "In progress": [], Done: [] };
  let i = 0;
  for (const t of todos) {
    const section = t.section && sections[t.section] !== undefined ? t.section : "Open";
    sections[section].push({ ...t, _order: i });
    i += 1;
  }

  for (const sectionName of TODO_SECTIONS) {
    const items = sections[sectionName];
    items.sort((a, b) => a._order - b._order);

    lines.push(`## ${sectionName}`, "");
    if (items.length === 0) {
      lines.push(`No item is ${sectionName.toLowerCase()}; add a todo to start working.`);
      lines.push("");
      continue;
    }

    for (const todo of items) {
      const check = todo.status === "done" ? "x" : " ";
      lines.push(`- [${check}] ${todo.id} ${todo.text}`);
      lines.push(`  - workflow: ${todo.workflow ?? ""}`);
      lines.push(`  - blockedBy: ${JSON.stringify(todo.blockedBy)}`);
      lines.push(`  - evidence: ${JSON.stringify(todo.evidence)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

/**
 * Redact sensitive data from text.
 *
 * - Lines matching `Authorization:`, `Daemon token:`, or other sensitive
 *   header/value patterns are replaced with `[REDACTED]`.
 * - Home-directory absolute paths are replaced with project-relative paths
 *   (or `[REDACTED_HOME]` when projectRoot is unknown).
 * - Base64-like values under sensitive JSON keys are replaced with `"[REDACTED]"`.
 */
export function redactText(text, { projectRoot, homeDir } = {}) {
  let result = text;

  // Redact known sensitive header/value lines
  const sensitiveLineRe = /^.*?(?:secret|token|password|api[_-]?key|apikey|auth|authorization|credential|private[_-]?key|access[_-]?key)\s*[:=]\s*.+$/gim;
  result = result.replace(sensitiveLineRe, () => "[REDACTED]");

  // Home directory → project-relative paths
  if (homeDir && projectRoot) {
    // Normalize separators for matching
    const homeNorm = homeDir.replace(/\\/g, "/").replace(/\/+$/g, "");
    const projectNorm = projectRoot.replace(/\\/g, "/").replace(/\/+$/g, "");

    // Replace absolute home paths in the text
    const escapedHome = homeNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const homeRe = new RegExp(escapedHome.replace(/[\\/]/g, "[\\\\/]"), "gi");
    result = result.replace(homeRe, (match) => {
      // Compute relative path within project if applicable
      const normalizedMatch = match.replace(/\\/g, "/");
      if (normalizedMatch.startsWith(homeNorm)) {
        const rest = normalizedMatch.slice(homeNorm.length);
        if (rest.startsWith("/") || rest.startsWith("\\")) {
          // Try to make project-relative
          const fullPath = resolve(projectRoot, ".") + rest.replace(/\\/g, "/");
          try {
            const rel = relative(resolve(projectRoot, "."), fullPath);
            if (!rel.startsWith("..") && !isAbsolute(rel)) {
              return `<project>/${rel.replace(/\\/g, "/")}`;
            }
          } catch {
            // Fall through to redaction
          }
        }
      }
      return "[REDACTED_HOME]";
    });
  }

  // Generic home directory pattern redaction (fallback)
  result = result.replace(/[A-Za-z]:\\Users\\[^\\":\s<>|*?]+/g, "[REDACTED_HOME]");
  result = result.replace(/\/Users\/[^\/":\s<>|*?]+/g, "/[REDACTED_HOME]");
  result = result.replace(/\/home\/[^\/":\s<>|*?]+/g, "/[REDACTED_HOME]");

  // Redact Base64-like values under sensitive JSON keys
  const base64Re = /("[A-Za-z0-9_-]*(?:secret|token|password|key|auth|credential)[A-Za-z0-9_-]*"\s*:\s*")([A-Za-z0-9+/]{8,}={0,2})(")/gi;
  result = result.replace(base64Re, (match, prefix, _value, suffix) => {
    return `${prefix}[REDACTED]${suffix}`;
  });

  return result;
}

// ---------------------------------------------------------------------------
// Evidence registration
// ---------------------------------------------------------------------------

/**
 * Register an evidence payload for a task.
 *
 * 1. Redacts the payload.
 * 2. Writes to `<task-dir>/evidence/<filename>`.
 * 3. Computes SHA-256 of the on-disk redacted file.
 * 4. Atomically updates the evidence manifest.
 *
 * Returns the manifest record.
 */
export function registerEvidence(projectRoot, {
  taskId,
  kind,
  command,
  workflow,
  payload,
  filename,
  now,
}) {
  ensureProject(projectRoot);
  const { state } = readTask(projectRoot, taskId);
  const taskDir = resolveInsideProject(
    projectRoot,
    join(PROJECT_DIRNAME, TASKS_DIRNAME, taskId),
  );
  const evDir = join(taskDir, EVIDENCE_DIRNAME);
  const manifestPath = join(evDir, EVIDENCE_MANIFEST_FILENAME);

  // Resolve and validate filename
  const filenameNorm = filename.replace(/\\/g, "/");
  if (filenameNorm.startsWith("..") || filenameNorm.includes("../") || filenameNorm.includes("..\\")) {
    stateError("PATH_OUTSIDE_PROJECT", `evidence filename must not traverse: ${filename}`);
  }
  const resolvedPath = resolveInsideProject(projectRoot, join(
    PROJECT_DIRNAME, TASKS_DIRNAME, taskId, EVIDENCE_DIRNAME, filenameNorm,
  ));

  // Validate resolved path is within evidence dir
  const root = resolve(projectRoot);
  const evDirResolved = resolve(evDir);
  const fileRel = relative(evDirResolved, resolvedPath);
  if (fileRel.startsWith("..") || isAbsolute(fileRel)) {
    stateError("PATH_OUTSIDE_PROJECT", `evidence file escapes evidence directory: ${filename}`);
  }

  // Redact payload
  const redacted = redactText(payload, { projectRoot });
  const redactedBytes = Buffer.from(redacted, "utf8");

  // Write
  const stamp = now ?? new Date().toISOString();
  mkdirSync(dirname(resolvedPath), { recursive: true });
  writeFileSync(resolvedPath, redactedBytes);

  // Compute SHA-256 from on-disk bytes
  const sha256 = computeSha256(redacted);

  // Read and update manifest
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    manifest = {
      schemaVersion: SCHEMA_VERSION,
      taskId,
      updatedAt: stamp,
      entries: [],
    };
  }

  const entryId = nextEvidenceId(manifest.entries);
  const entry = {
    id: entryId,
    kind,
    path: filenameNorm,
    command,
    workflow,
    sha256,
    redacted: true,
  };
  manifest.entries.push(entry);
  manifest.updatedAt = stamp;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  // Update state evidenceRefs
  const statePath = join(taskDir, STATE_FILENAME);
  const taskState = JSON.parse(readFileSync(statePath, "utf8"));
  if (!taskState.evidenceRefs.includes(entryId)) {
    taskState.evidenceRefs.push(entryId);
    writeFileSync(statePath, JSON.stringify(taskState, null, 2) + "\n", "utf8");
  }

  return entry;
}

// ---------------------------------------------------------------------------
// Evidence verification
// ---------------------------------------------------------------------------

/**
 * Verify all entries in a task's evidence manifest against on-disk files.
 * Returns an array of issue objects. An empty array means everything is valid.
 */
export function verifyEvidenceManifest(projectRoot, taskId) {
  ensureProject(projectRoot);
  const evDir = taskEvidenceDir(projectRoot, taskId);
  const manifestPath = join(evDir, EVIDENCE_MANIFEST_FILENAME);
  const issues = [];

  if (!existsSync(manifestPath)) {
    issues.push({
      severity: "error",
      code: "EVIDENCE_MANIFEST_MISSING",
      path: manifestPath,
      message: "evidence manifest does not exist",
    });
    return issues;
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (err) {
    issues.push({
      severity: "error",
      code: "EVIDENCE_MANIFEST_INVALID",
      path: manifestPath,
      message: `evidence manifest contains invalid JSON: ${err.message}`,
    });
    return issues;
  }

  if (!Array.isArray(manifest.entries)) {
    issues.push({
      severity: "error",
      code: "EVIDENCE_MANIFEST_INVALID",
      path: manifestPath,
      message: "evidence manifest entries must be an array",
    });
    return issues;
  }

  for (const entry of manifest.entries) {
    const entryPath = join(evDir, entry.path.replace(/\\/g, "/"));

    if (!existsSync(entryPath)) {
      issues.push({
        severity: "error",
        code: "EVIDENCE_FILE_MISSING",
        path: entryPath,
        message: `evidence file for ${entry.id} is missing: ${entry.path}`,
      });
      continue;
    }

    const actualSha256 = computeSha256(readFileSync(entryPath, "utf8"));
    if (actualSha256 !== entry.sha256) {
      issues.push({
        severity: "error",
        code: "SHA256_MISMATCH",
        path: entryPath,
        message: `SHA-256 mismatch for ${entry.id}: expected ${entry.sha256}, got ${actualSha256}`,
        expected: entry.sha256,
        actual: actualSha256,
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Screenshot registration
// ---------------------------------------------------------------------------

/**
 * Register a screenshot reference.
 *
 * Screenshots live only under `.figma/screenshot/<task-id>/`. This function
 * never copies bytes into long-term evidence; it only records a manifest
 * entry with metadata.
 */
export function registerScreenshot(projectRoot, {
  taskId,
  filePath,
  page,
  nodeIds,
  viewport,
  now,
}) {
  ensureProject(projectRoot);

  // Validate file path is under .figma/screenshot/<task-id>/
  const screenshotDir = taskScreenshotDir(projectRoot, taskId);
  const resolvedPath = resolve(filePath);
  const screenshotDirResolved = resolve(screenshotDir);
  const rel = relative(screenshotDirResolved, resolvedPath);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    stateError(
      "PATH_OUTSIDE_PROJECT",
      `screenshot path must be under .figma/screenshot/${taskId}/`,
    );
  }

  // Ensure screenshot directory and manifest
  mkdirSync(screenshotDirResolved, { recursive: true });
  const manifestPath = join(screenshotDirResolved, "manifest.json");

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    manifest = {
      taskId,
      updatedAt: null,
      entries: [],
    };
  }

  const stamp = now ?? new Date().toISOString();
  const entryId = nextScreenshotId(manifest.entries);
  const entry = {
    id: entryId,
    path: rel.replace(/\\/g, "/"),
    Page: page ?? null,
    nodeIds: nodeIds ?? [],
    viewport: viewport ?? null,
    created: stamp,
    reviewed: false,
    visualFinding: null,
  };
  manifest.entries.push(entry);
  manifest.updatedAt = stamp;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  return entry;
}

// ---------------------------------------------------------------------------
// Project ledger validation (read-only)
// ---------------------------------------------------------------------------

/**
 * Validates the entire project ledger without mutating any files.
 * Returns a structured issues array.
 */
export function validateProjectLedger(projectRoot) {
  const issues = [];

  // Check project initialization
  const projectDir = join(projectRoot, PROJECT_DIRNAME);
  if (!existsSync(projectDir)) {
    issues.push({
      severity: "error",
      code: "PROJECT_NOT_INITIALIZED",
      path: projectDir,
      message: ".figma directory does not exist",
    });
    return issues;
  }

  // Validate config and index
  let config, index;
  try {
    const project = readProject(projectRoot);
    config = project.config;
    index = project.index;
  } catch (err) {
    issues.push({
      severity: "error",
      code: "PROJECT_INVALID",
      path: projectDir,
      message: `cannot read project: ${err.message}`,
    });
    return issues;
  }

  // Validate each task
  for (const taskSummary of index.tasks) {
    const taskId = taskSummary.taskId;
    const taskDir = join(projectDir, TASKS_DIRNAME, taskId);

    if (!existsSync(taskDir)) {
      issues.push({
        severity: "error",
        code: "TASK_DIR_MISSING",
        path: taskDir,
        message: `task directory for ${taskId} does not exist`,
      });
      continue;
    }

    // State
    const statePath = join(taskDir, STATE_FILENAME);
    if (!existsSync(statePath)) {
      issues.push({
        severity: "error",
        code: "STATE_MISSING",
        path: statePath,
        message: `state.json for ${taskId} is missing`,
      });
    } else {
      try {
        const state = JSON.parse(readFileSync(statePath, "utf8"));
        assertValidTaskState(state);
        // Check index/task consistency
        if (state.taskId !== taskSummary.taskId) {
          issues.push({
            severity: "error",
            code: "INDEX_STATE_MISMATCH",
            path: statePath,
            message: `state.taskId (${state.taskId}) does not match index entry`,
          });
        }
        if (state.status !== taskSummary.status) {
          issues.push({
            severity: "warning",
            code: "INDEX_STATE_MISMATCH",
            path: statePath,
            message: `state.status (${state.status}) does not match index entry (${taskSummary.status})`,
          });
        }
      } catch (err) {
        issues.push({
          severity: "error",
          code: "STATE_INVALID",
          path: statePath,
          message: `state.json for ${taskId} is invalid: ${err.message}`,
        });
      }
    }

    // Events ledger
    const eventsPath = join(taskDir, EVENTS_FILENAME);
    if (!existsSync(eventsPath)) {
      issues.push({
        severity: "error",
        code: "EVENTS_MISSING",
        path: eventsPath,
        message: `events.jsonl for ${taskId} is missing`,
      });
    } else {
      try {
        const eventsText = readFileSync(eventsPath, "utf8");
        const lines = eventsText.split("\n").filter((l) => l.length > 0);
        let expected = 1;
        for (const [idx, line] of lines.entries()) {
          const ev = JSON.parse(line);
          assertValidEvent(ev);
          if (ev.taskId !== taskId) {
            issues.push({
              severity: "error",
              code: "EVENT_TASK_ID_MISMATCH",
              path: eventsPath,
              message: `event on line ${idx + 1} references task ${ev.taskId} instead of ${taskId}`,
            });
          }
          const num = Number.parseInt(ev.eventId?.slice(2), 10);
          if (num !== expected) {
            issues.push({
              severity: "error",
              code: "EVENT_ID_GAP",
              path: eventsPath,
              message: `expected event ID E-${String(expected).padStart(4, "0")}, got ${ev.eventId}`,
            });
          }
          expected += 1;
        }
      } catch (err) {
        if (err instanceof TaskStateError) {
          issues.push({
            severity: "error",
            code: err.code,
            path: eventsPath,
            message: err.message,
          });
        } else {
          issues.push({
            severity: "error",
            code: "EVENTS_INVALID",
            path: eventsPath,
            message: `events.jsonl for ${taskId} is invalid: ${err.message}`,
          });
        }
      }
    }

    // Evidence verification
    const evIssues = verifyEvidenceManifest(projectRoot, taskId);
    issues.push(...evIssues);

    // Screenshot manifest
    const ssDir = taskScreenshotDir(projectRoot, taskId);
    const ssManifestPath = join(ssDir, "manifest.json");
    if (existsSync(ssManifestPath)) {
      try {
        const ssManifest = JSON.parse(readFileSync(ssManifestPath, "utf8"));
        if (!Array.isArray(ssManifest.entries)) {
          issues.push({
            severity: "error",
            code: "SCREENSHOT_MANIFEST_INVALID",
            path: ssManifestPath,
            message: "screenshot manifest entries must be an array",
          });
        }
        for (const entry of ssManifest.entries) {
          if (!entry.id || !entry.path) {
            issues.push({
              severity: "warning",
              code: "SCREENSHOT_ENTRY_INVALID",
              path: ssManifestPath,
              message: "screenshot entry missing required fields",
            });
          }
        }
      } catch (err) {
        issues.push({
          severity: "error",
          code: "SCREENSHOT_MANIFEST_INVALID",
          path: ssManifestPath,
          message: `invalid screenshot manifest JSON: ${err.message}`,
        });
      }
    }
  }

  // Archive invariants
  for (const taskSummary of index.tasks) {
    if (taskSummary.archiveStatus !== "NOT_ARCHIVED" && !TERMINAL_STATUSES.includes(taskSummary.status)) {
      issues.push({
        severity: "error",
        code: "ARCHIVE_INVARIANT",
        path: projectDir,
        message: `task ${taskSummary.taskId} has archiveStatus=${taskSummary.archiveStatus} but non-terminal status ${taskSummary.status}`,
      });
    }
  }

  return issues;
}
