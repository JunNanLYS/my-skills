import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { spawnSync } from "node:child_process";

import { TaskStateError } from "../scripts/lib/task-state/errors.mjs";
import {
  redactText,
  registerEvidence,
  verifyEvidenceManifest,
  registerScreenshot,
} from "../scripts/lib/task-state/evidence.mjs";
import {
  PROJECT_DIRNAME,
  TASKS_DIRNAME,
  EVIDENCE_DIRNAME,
  EVIDENCE_MANIFEST_FILENAME,
  SCREENSHOT_DIRNAME,
  readTask,
} from "../scripts/lib/task-state/store.mjs";

const REPO_ROOT = resolve(join(import.meta.dirname, "..", ".."));
const SCRIPT = join(REPO_ROOT, "figma-skill", "scripts", "figma-task-state.mjs");

function runCli(project, args) {
  return spawnSync(process.execPath, [SCRIPT, "--project", project, ...args], {
    encoding: "utf8",
    env: { ...process.env, FIGMA_TASK_STATE_NO_DAEMON: "1" },
  });
}

function freshProject() {
  const project = mkdtempSync(join(tmpdir(), "figma-task-state-evidence-"));
  return { project, cleanup: () => rmSync(project, { recursive: true, force: true }) };
}

function initProject(project) {
  const result = runCli(project, ["init-project", "--default-branch", "main", "--json"]);
  assert.equal(result.status, 0, result.stderr);
}

function createTask(project, overrides = {}) {
  const taskId = overrides.taskId ?? "20260714-checkout-responsive";
  const result = runCli(project, [
    "create",
    "--task", taskId,
    "--title", overrides.title ?? "Checkout responsive states",
    "--type", overrides.type ?? "Modify",
    "--write-required", overrides.writeRequired ?? "true",
    "--json",
  ]);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout).data.state;
}

const T0 = "2026-07-14T10:00:00+08:00";

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

test("redactText removes Authorization header values", () => {
  const input = "Authorization: Bearer secret-token\nSome valid content\n";
  const result = redactText(input, {});
  assert.equal(result.includes("secret-token"), false);
  assert.ok(result.includes("[REDACTED]"));
  assert.ok(result.includes("Some valid content"));
});

test("redactText removes Daemon token values", () => {
  const input = "Daemon token: abc123\nMore content\n";
  const result = redactText(input, {});
  assert.equal(result.includes("abc123"), false);
  assert.ok(result.includes("[REDACTED]"));
});

test("redactText replaces home directory paths and does not leak the home prefix", () => {
  const projectRoot = "/home/alice/workspace/project";
  const homeDir = "/home/alice";
  const input = "C:\\Users\\alice\\workspace\\project\\output.json\nSome data\n/home/alice/.config\n";
  const result = redactText(input, { projectRoot, homeDir });

  assert.equal(result.includes("C:\\Users\\alice\\workspace\\project"), false, "must not contain home absolute path");
  assert.equal(result.includes("/home/alice"), false, "must not contain home dir prefix");
});

test("redactText preserves non-sensitive content", () => {
  const input = "Normal content line\nAnother line\nworkflow: 7\n";
  const result = redactText(input, {});
  assert.equal(result, input);
});

test("redactText rejects Base64-like values under sensitive keys", () => {
  const input = JSON.stringify({
    token: "dGVzdDpzZWNyZXQ=",
    secret: "QUJDREVGR0g=",
    name: "John",
  });
  const result = redactText(input, {});
  const parsed = JSON.parse(result);
  assert.equal(parsed.token, "[REDACTED]");
  assert.equal(parsed.secret, "[REDACTED]");
  assert.equal(parsed.name, "John");
});

// ---------------------------------------------------------------------------
// Evidence registration
// ---------------------------------------------------------------------------

test("registerEvidence writes redacted payload and SHA-256 to manifest", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project);
    const taskId = "20260714-checkout-responsive";
    const taskDir = join(project, PROJECT_DIRNAME, TASKS_DIRNAME, taskId);

    const payload = "Authorization: Bearer secret-token\nValidation result: PASS\n";
    const result = registerEvidence(project, {
      taskId,
      kind: "validation",
      command: "figma-cli run scripts/overlap-check.mjs",
      workflow: "9",
      payload,
      filename: "validation/overlap-check-batch-1.json",
      now: T0,
    });

    assert.ok(result.id);
    assert.match(result.id, /^EV-\d{4}$/);
    assert.equal(result.kind, "validation");
    assert.equal(result.workflow, "9");
    assert.equal(result.redacted, true);
    assert.ok(result.sha256);
    assert.equal(result.sha256.length, 64);

    // Read the on-disk file — must be redacted
    const evPath = join(taskDir, EVIDENCE_DIRNAME, "validation/overlap-check-batch-1.json");
    assert.ok(existsSync(evPath), "evidence file must exist on disk");
    const onDisk = readFileSync(evPath, "utf8");
    assert.equal(onDisk.includes("secret-token"), false, "on-disk content must be redacted");
    assert.ok(onDisk.includes("[REDACTED]"), "on-disk content must contain [REDACTED]");

    // Manifest must have the entry
    const manifestPath = join(taskDir, EVIDENCE_DIRNAME, EVIDENCE_MANIFEST_FILENAME);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert.equal(manifest.entries.length, 1);
    assert.equal(manifest.entries[0].id, result.id);
    assert.equal(manifest.entries[0].sha256, result.sha256);
  } finally {
    cleanup();
  }
});

test("verifyEvidenceManifest detects SHA-256 mismatch", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project);
    const taskId = "20260714-checkout-responsive";
    const taskDir = join(project, PROJECT_DIRNAME, TASKS_DIRNAME, taskId);

    const payload = "Some evidence content\n";
    const ev = registerEvidence(project, {
      taskId,
      kind: "test",
      command: "test",
      workflow: "7",
      payload,
      filename: "test-file.txt",
      now: T0,
    });
    assert.ok(ev.sha256);

    // Tamper with the evidence file
    const evPath = join(taskDir, EVIDENCE_DIRNAME, "test-file.txt");
    writeFileSync(evPath, "Tampered content\n", "utf8");

    const issues = verifyEvidenceManifest(project, taskId);
    assert.ok(issues.length > 0);
    const shaIssue = issues.find((i) => i.code === "SHA256_MISMATCH");
    assert.ok(shaIssue, `expected SHA256_MISMATCH issue, got: ${JSON.stringify(issues)}`);
  } finally {
    cleanup();
  }
});

test("verifyEvidenceManifest reports missing evidence files", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project);
    const taskId = "20260714-checkout-responsive";

    // Manually add a manifest entry pointing to a nonexistent file
    const taskDir = join(project, PROJECT_DIRNAME, TASKS_DIRNAME, taskId);
    const manifestPath = join(taskDir, EVIDENCE_DIRNAME, EVIDENCE_MANIFEST_FILENAME);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.entries.push({
      id: "EV-0002",
      kind: "test",
      path: "nonexistent.json",
      command: "test",
      workflow: "7",
      sha256: "0000000000000000000000000000000000000000000000000000000000000000",
      redacted: false,
    });
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

    const issues = verifyEvidenceManifest(project, taskId);
    assert.ok(issues.length > 0);
    const missing = issues.find((i) => i.code === "EVIDENCE_FILE_MISSING");
    assert.ok(missing, `expected EVIDENCE_FILE_MISSING, got: ${JSON.stringify(issues)}`);
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// Evidence ID monotonic scheme
// ---------------------------------------------------------------------------

test("registerEvidence creates monotonically increasing EV-#### IDs", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project);
    const taskId = "20260714-checkout-responsive";

    const ev1 = registerEvidence(project, {
      taskId, kind: "test", command: "test", workflow: "1",
      payload: "first", filename: "first.txt", now: T0,
    });
    assert.match(ev1.id, /^EV-\d{4}$/);

    const ev2 = registerEvidence(project, {
      taskId, kind: "test", command: "test", workflow: "2",
      payload: "second", filename: "second.txt", now: T0,
    });
    assert.match(ev2.id, /^EV-\d{4}$/);
    assert.ok(ev2.id > ev1.id, `second id ${ev2.id} must be > first id ${ev1.id}`);
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// Path validation
// ---------------------------------------------------------------------------

test("registerEvidence rejects path traversal in filename", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project);
    assert.throws(
      () => registerEvidence(project, {
        taskId: "20260714-checkout-responsive",
        kind: "test",
        command: "test",
        workflow: "7",
        payload: "content",
        filename: "../../../etc/passwd",
        now: T0,
      }),
      (err) => err instanceof TaskStateError && err.code === "PATH_OUTSIDE_PROJECT",
    );
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// Screenshot registration
// ---------------------------------------------------------------------------

test("registerScreenshot rejects file outside .figma/screenshot/<task-id>/", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project);

    assert.throws(
      () => registerScreenshot(project, {
        taskId: "20260714-checkout-responsive",
        filePath: "/etc/passwd.png",
        page: "Home",
        nodeIds: ["1:2"],
        viewport: "375x812",
        now: T0,
      }),
      (err) => err instanceof TaskStateError && err.code === "PATH_OUTSIDE_PROJECT",
    );
  } finally {
    cleanup();
  }
});

test("registerScreenshot writes task-local screenshot manifest", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project);
    const taskId = "20260714-checkout-responsive";
    const screenshotDir = join(project, PROJECT_DIRNAME, SCREENSHOT_DIRNAME, taskId);

    const result = registerScreenshot(project, {
      taskId,
      filePath: join(screenshotDir, "home-page.png"),
      page: "Home",
      nodeIds: ["1:2", "3:4"],
      viewport: "375x812",
      now: T0,
    });
    assert.ok(result.id);
    assert.match(result.id, /^SS-\d{4}$/);
    assert.equal(result.Page, "Home");
    assert.equal(result.reviewed, false);

    // Manifest exists
    const manifestPath = join(screenshotDir, "manifest.json");
    assert.ok(existsSync(manifestPath), "screenshot manifest must exist");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert.equal(manifest.entries.length, 1);
    assert.equal(manifest.entries[0].id, result.id);
  } finally {
    cleanup();
  }
});

test("registerScreenshot never copies bytes to long-term evidence", () => {
  const { project, cleanup } = freshProject();
  try {
    initProject(project);
    createTask(project);
    const taskId = "20260714-checkout-responsive";
    const taskDir = join(project, PROJECT_DIRNAME, TASKS_DIRNAME, taskId);
    const screenshotDir = join(project, PROJECT_DIRNAME, SCREENSHOT_DIRNAME, taskId);

    // Create a fake screenshot file
    mkdirSync(screenshotDir, { recursive: true });
    writeFileSync(join(screenshotDir, "home-page.png"), "fake-image-bytes", "utf8");

    const result = registerScreenshot(project, {
      taskId,
      filePath: join(screenshotDir, "home-page.png"),
      page: "Home",
      nodeIds: ["1:2"],
      viewport: "375x812",
      now: T0,
    });

    // Evidence directory must NOT have the screenshot
    const evidencePath = join(taskDir, EVIDENCE_DIRNAME, "home-page.png");
    assert.equal(existsSync(evidencePath), false, "screenshot must not be copied to evidence");

    // Screenshot manifest must exist
    const ssManifest = join(screenshotDir, "manifest.json");
    assert.ok(existsSync(ssManifest));
    const manifest = JSON.parse(readFileSync(ssManifest, "utf8"));
    assert.equal(manifest.entries.length, 1);
    assert.equal(manifest.entries[0].id, result.id);
  } finally {
    cleanup();
  }
});
