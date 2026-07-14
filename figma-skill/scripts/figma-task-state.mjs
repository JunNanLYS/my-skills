#!/usr/bin/env node
/**
 * figma-task-state.mjs — persistent task ledger CLI for figma-skill v2.
 *
 * This is an offline, project-local tool. It performs no Figma daemon
 * calls and no Git commands. It only writes files under
 * `<project>/.figma/` and reads the four published schemas that ship
 * with the skill.
 *
 * Usage (every command supports --project <root> and --json):
 *   node figma-task-state.mjs init-project --default-branch main --json
 *   node figma-task-state.mjs create --task 20260714-slug --title "..." --type Modify --write-required true --json
 *   node figma-task-state.mjs list --json
 *   node figma-task-state.mjs show --task 20260714-slug --json
 *
 * Exit codes:
 *   0  success
 *   1  valid command that cannot complete (e.g. filesystem error)
 *   2  invalid input or state
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { TaskStateError } from "./lib/task-state/errors.mjs";
import {
  atomicWriteJson,
  atomicWriteText,
  resolveInsideProject,
  resolveProjectRoot,
  readProject,
  readTask,
  syncIndexEntry,
  SCHEMA_FILES,
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
} from "./lib/task-state/store.mjs";
import {
  assertValidConfig,
  assertValidIndex,
  assertValidTaskState,
  assertValidEvent,
} from "./lib/task-state/validate.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SKILL_ROOT = resolve(__dirname, "..");
const SKILL_SCHEMAS_DIR = join(SKILL_ROOT, "schemas");
const TASK_TYPES = ["Create", "Modify", "Audit", "Migrate", "Export"];

function emit(envelope) {
  if (envelope.ok) {
    process.stdout.write(JSON.stringify(envelope, null, 2) + "\n");
  } else {
    process.stderr.write(JSON.stringify(envelope, null, 2) + "\n");
  }
}

function fail(envelope, code) {
  emit(envelope);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { positional: [], flags: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        args.flags[key] = true;
      } else {
        args.flags[key] = next;
        i += 1;
      }
    } else {
      args.positional.push(token);
    }
  }
  return args;
}

function requireFlag(flags, name) {
  const value = flags[name];
  if (value === undefined || value === true) {
    throw new TaskStateError("STATE_INVALID", `missing required flag --${name}`, { flag: name });
  }
  return value;
}

function requireProject(flags) {
  const raw = flags.project;
  if (raw === undefined || raw === true) {
    throw new TaskStateError(
      "STATE_INVALID",
      "missing required flag --project <path>",
      { flag: "project" },
    );
  }
  return resolveProjectRoot(raw);
}

function nowIso() {
  return new Date().toISOString();
}

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function todayStamp() {
  const now = new Date();
  return `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}`;
}

// Highest -NN counter that any ID under today's date prefix currently uses
// in the index. The "omitted --task" generator uses this to assign globally
// unique -NN suffixes across all auto-generated task ids for the same date.
function highestAutoCounter(index, datePrefix) {
  let max = 0;
  for (const t of index.tasks) {
    const id = t.taskId;
    // Only consider ids that exactly equal the date prefix + -NN.
    if (!id.startsWith(`${datePrefix}-`)) continue;
    const tail = id.slice(datePrefix.length + 1);
    const m = tail.match(/^(\d{2})$/);
    if (m) {
      max = Math.max(max, Number(m[1]));
    }
  }
  return max;
}

function buildProjectConfig({ defaultBranch }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    defaultBranch,
    taskIdFormat: "YYYYMMDD-slug",
    leaseMinutes: 30,
    evidencePolicy: "tracked",
    redactionPolicy: "strict",
  };
}

function buildEmptyIndex(updatedAt) {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt,
    tasks: [],
  };
}

function buildProjectReadme() {
  return [
    "# Figma task state project",
    "",
    "This directory holds the persistent task ledgers for a figma-skill v2 project.",
    "",
    "Layout:",
    "",
    "- `config.json` — project configuration (branch, lease, evidence, redaction policies).",
    "- `index.json` — ordered summary of every known task.",
    "- `schemas/` — frozen copies of the four v2 schema documents.",
    "- `tasks/<task-id>/` — per-task ledger: `state.json`, `events.jsonl`, `plan.md`, `todo.md`, `recovery.md`, and `evidence/`.",
    "- `screenshot/` — per-task evidence screenshots.",
    "",
    "Manage this directory with `figma-task-state.mjs`; do not edit files by hand.",
    "",
  ].join("\n");
}

function planTemplate(taskState) {
  return [
    `# ${taskState.title}`,
    "",
    `Task id: \`${taskState.taskId}\``,
    `Type: ${taskState.taskType}`,
    `Status: ${taskState.status} (workflow ${taskState.currentWorkflow})`,
    `Updated: ${taskState.updatedAt}`,
    "",
    "## Goal",
    "",
    "Describe the goal of this task in 1-3 sentences. Update this section as the plan evolves.",
    "",
    "## Steps",
    "",
    "1. ",
    "2. ",
    "3. ",
    "",
    "## Approval",
    "",
    "- Design system approval: PENDING",
    "- Figma write approval: PENDING",
    "",
    "## Notes",
    "",
    "- ",
    "",
  ].join("\n");
}

function todoTemplate(taskState) {
  return [
    `# ${taskState.title} — todo`,
    "",
    `Task id: \`${taskState.taskId}\``,
    `Updated: ${taskState.updatedAt}`,
    "",
    "## Open",
    "",
    "- [ ] ",
    "",
    "## In progress",
    "",
    "- [ ] ",
    "",
    "## Done",
    "",
    "- [x] Task created",
    "",
  ].join("\n");
}

function recoveryTemplate(taskState) {
  return [
    `# ${taskState.title} — recovery`,
    "",
    `Task id: \`${taskState.taskId}\``,
    `Status: ${taskState.status}`,
    `Workflow: ${taskState.currentWorkflow}`,
    `Last checkpoint: ${taskState.resume.lastCheckpoint}`,
    `Updated: ${taskState.updatedAt}`,
    "",
    "## How to resume",
    "",
    "1. Read `.figma/tasks/<task-id>/state.json` for the current status and gate.",
    "2. Read `.figma/tasks/<task-id>/events.jsonl` to inspect prior transitions.",
    "3. Re-acquire the lease (LEASES are tracked separately in v2) before any Figma write.",
    "4. Re-read live Figma context before applying plan.md.",
    "5. Update this file with the new checkpoint and bump `state.json` `updatedAt`.",
    "",
    "## Recovery block",
    "",
    "Set this section to BLOCKED if the task must be replanned or re-validated before continuing.",
    "",
    "- [ ] Replan",
    "- [ ] Re-validate",
    "- [ ] Re-acquire lease",
    "",
  ].join("\n");
}

function buildTaskState({
  taskId,
  title,
  taskType,
  writeRequired,
  updatedAt,
  eventId,
  actor,
}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    revision: 0,
    taskId,
    title,
    taskType,
    writeRequired,
    status: "DRAFT",
    archiveStatus: "NOT_ARCHIVED",
    currentWorkflow: "0B",
    gate: "TaskClassificationGate",
    gateStatus: "PENDING",
    approval: { designSystem: "NOT_REQUIRED", figmaWrite: "PENDING" },
    batch: { current: 0, lastCompleted: 0 },
    correctionRounds: 0,
    resume: { required: false, lastCheckpoint: "task-created", liveRevalidation: "REQUIRED" },
    observedContext: { figmaFile: null, page: null, nodeIds: [] },
    validation: { visual: { required: true, reviewed: false, summary: null } },
    evidenceRefs: [],
    relatedTasks: [],
    updatedAt,
  };
}

function buildCreatedEvent({ taskId, revision, updatedAt, eventId, actor }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    eventId,
    taskId,
    revision,
    type: "TASK_CREATED",
    actor,
    at: updatedAt,
    evidence: [],
    details: { reason: "initial-creation" },
  };
}

function buildEvidenceManifest(taskId, updatedAt) {
  return {
    schemaVersion: SCHEMA_VERSION,
    taskId,
    updatedAt,
    entries: [],
  };
}

function schemaSourceDir() {
  return SKILL_SCHEMAS_DIR;
}

function loadSchemaFiles() {
  const dir = schemaSourceDir();
  const out = {};
  for (const filename of SCHEMA_FILES) {
    const full = join(dir, filename);
    if (!existsSync(full)) {
      throw new TaskStateError(
        "SCHEMA_UNSUPPORTED",
        `schema file not found: ${filename}`,
        { schema: filename },
      );
    }
    out[filename] = readFileSync(full, "utf8");
  }
  return out;
}

function initProject({ projectRoot, defaultBranch, schemaVersionRequested, json }) {
  if (schemaVersionRequested !== undefined && Number(schemaVersionRequested) !== SCHEMA_VERSION) {
    throw new TaskStateError(
      "SCHEMA_UNSUPPORTED",
      `unsupported schema version: ${schemaVersionRequested} (expected ${SCHEMA_VERSION})`,
      { requested: Number(schemaVersionRequested), expected: SCHEMA_VERSION },
    );
  }
  const projectDir = resolveInsideProject(projectRoot, PROJECT_DIRNAME);
  const configPath = join(projectDir, CONFIG_FILENAME);
  const indexPath = join(projectDir, INDEX_FILENAME);
  const schemasDest = join(projectDir, SCHEMAS_DIRNAME);
  const tasksDest = join(projectDir, TASKS_DIRNAME);
  const screenshotDest = join(projectDir, SCREENSHOT_DIRNAME);
  // Ensure directories exist so the first task creation does not need to
  // create a parent that was never initialised.
  mkdirSync(tasksDest, { recursive: true });
  mkdirSync(screenshotDest, { recursive: true });
  const readmePath = join(projectDir, README_FILENAME);

  const alreadyInitialized = existsSync(configPath) && existsSync(indexPath);
  const updatedAt = nowIso();

  if (alreadyInitialized) {
    const config = assertValidConfig(JSON.parse(readFileSync(configPath, "utf8")));
    const index = assertValidIndex(JSON.parse(readFileSync(indexPath, "utf8")));
    return {
      envelope: {
        ok: true,
        command: "init-project",
        data: {
          projectRoot,
          idempotent: true,
          config,
          index,
        },
      },
      json,
    };
  }

  const config = buildProjectConfig({ defaultBranch });
  const index = buildEmptyIndex(updatedAt);
  const schemas = loadSchemaFiles();

  // Validate before writing to fail fast.
  assertValidConfig(config);
  assertValidIndex(index);

  atomicWriteText(readmePath, buildProjectReadme());
  atomicWriteJson(configPath, config);
  atomicWriteJson(indexPath, index);
  for (const [filename, body] of Object.entries(schemas)) {
    atomicWriteText(join(schemasDest, filename), body);
  }

  return {
    envelope: {
      ok: true,
      command: "init-project",
      data: { projectRoot, idempotent: false, config, index },
    },
    json,
  };
}

function makeEventId(taskId, updatedAt) {
  const stamp = updatedAt.replace(/[^0-9]/g, "").slice(0, 14) || Date.now().toString();
  return `evt-${taskId}-${stamp}-001`;
}

function createTask({ projectRoot, flags, json, dryRun }) {
  const { projectDir, index } = readProject(projectRoot);

  const title = requireFlag(flags, "title");
  const typeRaw = requireFlag(flags, "type");
  const writeRaw = requireFlag(flags, "write-required");

  if (!TASK_TYPES.includes(typeRaw)) {
    throw new TaskStateError(
      "STATE_INVALID",
      `task type must be one of: ${TASK_TYPES.join(", ")}`,
      { path: "taskState.taskType", value: typeRaw, allowed: TASK_TYPES },
    );
  }

  let writeRequired;
  if (writeRaw === "true") {
    writeRequired = true;
  } else if (writeRaw === "false") {
    writeRequired = false;
  } else {
    throw new TaskStateError(
      "STATE_INVALID",
      "write-required must be 'true' or 'false'",
      { path: "taskState.writeRequired", value: writeRaw },
    );
  }

  let taskId;
  if (flags.task && flags.task !== true) {
    taskId = flags.task;
  } else {
    // When --task is omitted, derive a globally unique -NN id for today's
    // date so each created ledger is stable across runs and inspectable.
    const datePrefix = todayStamp();
    const counter = highestAutoCounter(index, datePrefix) + 1;
    taskId = `${datePrefix}-${counter.toString().padStart(2, "0")}`;
  }
  if (index.tasks.some((t) => t.taskId === taskId)) {
    throw new TaskStateError("TASK_NOT_FOUND", `task ${taskId} already exists`, { taskId });
  }

  const updatedAt = nowIso();
  const actor = flags.actor && flags.actor !== true ? flags.actor : "claude";
  const state = buildTaskState({
    taskId,
    title,
    taskType: typeRaw,
    writeRequired,
    updatedAt,
    eventId: makeEventId(taskId, updatedAt),
    actor,
  });
  const event = buildCreatedEvent({
    taskId,
    revision: state.revision,
    updatedAt,
    eventId: makeEventId(taskId, updatedAt),
    actor,
  });

  const validatedState = assertValidTaskState(state);
  const validatedEvent = assertValidEvent(event);
  const nextIndex = assertValidIndex(syncIndexEntry(index, validatedState));

  if (dryRun) {
    return {
      envelope: {
        ok: true,
        command: "create",
        data: { state: validatedState, event: validatedEvent, index: nextIndex, dryRun: true },
      },
      json,
    };
  }

  const taskDir = resolveInsideProject(projectRoot, join(PROJECT_DIRNAME, TASKS_DIRNAME, taskId));
  atomicWriteJson(join(taskDir, STATE_FILENAME), validatedState);
  atomicWriteText(join(taskDir, PLAN_FILENAME), planTemplate(validatedState));
  atomicWriteText(join(taskDir, TODO_FILENAME), todoTemplate(validatedState));
  atomicWriteText(join(taskDir, RECOVERY_FILENAME), recoveryTemplate(validatedState));
  atomicWriteText(join(taskDir, EVENTS_FILENAME), JSON.stringify(validatedEvent) + "\n");
  atomicWriteJson(
    join(taskDir, EVIDENCE_DIRNAME, EVIDENCE_MANIFEST_FILENAME),
    buildEvidenceManifest(taskId, updatedAt),
  );
  atomicWriteJson(join(projectDir, INDEX_FILENAME), nextIndex);

  return {
    envelope: {
      ok: true,
      command: "create",
      data: { state: validatedState, event: validatedEvent, index: nextIndex, dryRun: false },
    },
    json,
  };
}

function listTasks({ projectRoot, json }) {
  const { index } = readProject(projectRoot);
  const tasks = [...index.tasks].sort((a, b) => {
    if (a.updatedAt === b.updatedAt) {
      return a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0;
    }
    return a.updatedAt < b.updatedAt ? -1 : 1;
  });
  return {
    envelope: {
      ok: true,
      command: "list",
      data: { tasks },
    },
    json,
  };
}

function showTask({ projectRoot, flags, json }) {
  const taskId = requireFlag(flags, "task");
  const { state, taskDir } = readTask(projectRoot, taskId);
  const recovery = readFileSync(join(taskDir, RECOVERY_FILENAME), "utf8");
  return {
    envelope: {
      ok: true,
      command: "show",
      data: { state, recovery },
    },
    json,
  };
}

function runCommand(name, runner) {
  const args = parseArgs(process.argv.slice(2));
  const json = args.flags.json === true;
  try {
    const projectRoot = requireProject(args.flags);
    const result = runner({
      projectRoot,
      flags: args.flags,
      json,
      dryRun: args.flags["dry-run"] === true,
    });
    if (result.json) {
      emit(result.envelope);
    } else {
      humanOutput(result.envelope);
    }
    process.exit(0);
  } catch (error) {
    handleError(error, name, json);
  }
}

function handleError(error, command, json) {
  if (error instanceof TaskStateError) {
    const envelope = {
      ok: false,
      command,
      error: { code: error.code, message: error.message, details: error.details || {} },
    };
    if (json) {
      emit(envelope);
    } else {
      process.stderr.write(`${error.code}: ${error.message}\n`);
    }
    const inputErrorCodes = [
      "PATH_OUTSIDE_PROJECT",
      "STATE_INVALID",
      "SCHEMA_UNSUPPORTED",
      "TASK_NOT_FOUND",
      "SENSITIVE_DATA_REJECTED",
      "PROJECT_NOT_INITIALIZED",
      "REVISION_CONFLICT",
      "LEASE_HELD",
      "LEASE_EXPIRED",
      "LEASE_LOST",
      "ILLEGAL_TRANSITION",
      "PLAN_NOT_APPROVED",
      "LIVE_REVALIDATION_REQUIRED",
      "EVIDENCE_MISSING",
      "ARCHIVE_FAILED",
    ];
    if (inputErrorCodes.includes(error.code)) {
      process.exit(2);
    }
    process.exit(1);
  }
  const envelope = {
    ok: false,
    command,
    error: { code: "INTERNAL_ERROR", message: error.message, details: {} },
  };
  if (json) {
    emit(envelope);
  } else {
    process.stderr.write(`INTERNAL_ERROR: ${error.message}\n`);
  }
  process.exit(1);
}

function humanOutput(envelope) {
  if (!envelope.ok) {
    return;
  }
  const data = envelope.data || {};
  if (envelope.command === "init-project") {
    process.stdout.write(`initialized ${data.projectRoot} (idempotent=${data.idempotent})\n`);
    return;
  }
  if (envelope.command === "create") {
    const s = data.state;
    process.stdout.write(`created ${s.taskId} status=${s.status} revision=${s.revision}\n`);
    return;
  }
  if (envelope.command === "list") {
    if (!data.tasks || data.tasks.length === 0) {
      process.stdout.write("no tasks\n");
      return;
    }
    for (const t of data.tasks) {
      process.stdout.write(`${t.taskId}\t${t.status}\t${t.title}\n`);
    }
    return;
  }
  if (envelope.command === "show") {
    const s = data.state;
    process.stdout.write(`${s.taskId}\t${s.status}\t${s.title}\n`);
    process.stdout.write("\n--- recovery ---\n");
    process.stdout.write(data.recovery);
    return;
  }
  process.stdout.write(JSON.stringify(envelope, null, 2) + "\n");
}

function dispatch(args) {
  const command = args.positional[0];
  switch (command) {
    case "init-project":
      runCommand("init-project", ({ projectRoot, flags, json }) => {
        return initProject({
          projectRoot,
          defaultBranch: flags["default-branch"] && flags["default-branch"] !== true
            ? flags["default-branch"]
            : "main",
          schemaVersionRequested: flags["schema-version"],
          json,
        });
      });
      return;
    case "create":
      runCommand("create", ({ projectRoot, flags, json, dryRun }) => {
        return createTask({ projectRoot, flags, json, dryRun });
      });
      return;
    case "list":
      runCommand("list", ({ projectRoot, json }) => listTasks({ projectRoot, json }));
      return;
    case "show":
      runCommand("show", ({ projectRoot, flags, json }) => showTask({ projectRoot, flags, json }));
      return;
    default:
      process.stderr.write(
        `usage: figma-task-state.mjs <init-project|create|list|show> --project <root> [--json]\n`,
      );
      process.exit(2);
  }
}

dispatch(parseArgs(process.argv.slice(2)));
