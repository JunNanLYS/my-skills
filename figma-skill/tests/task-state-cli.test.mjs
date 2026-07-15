import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const root = resolve(join(import.meta.dirname, "..", ".."));
const script = join(root, "figma-skill", "scripts", "figma-task-state.mjs");

function run(project, args) {
  return spawnSync(process.execPath, [script, "--project", project, ...args], {
    encoding: "utf8",
    env: { ...process.env, FIGMA_TASK_STATE_NO_DAEMON: "1" },
  });
}

function parseEnvelope(result) {
  // Success envelopes go to stdout; error envelopes go to stderr.
  const text = (result.stdout && result.stdout.trim().length > 0)
    ? result.stdout
    : result.stderr;
  return JSON.parse(text);
}

function freshProject() {
  const project = mkdtempSync(join(tmpdir(), "figma-task-state-"));
  return { project, cleanup: () => rmSync(project, { recursive: true, force: true }) };
}

test("init-project writes .figma tree, four schemas, and JSON envelope", () => {
  const { project, cleanup } = freshProject();
  try {
    const init = run(project, ["init-project", "--default-branch", "main", "--json"]);
    assert.equal(init.status, 0, init.stderr);
    const envelope = parseEnvelope(init);
    assert.equal(envelope.ok, true, JSON.stringify(envelope));
    assert.equal(envelope.command, "init-project");
    assert.ok(envelope.data && envelope.data.projectRoot);

    assert.ok(existsSync(join(project, ".figma", "schemas", "task-state.schema.json")));
    assert.ok(existsSync(join(project, ".figma", "schemas", "config.schema.json")));
    assert.ok(existsSync(join(project, ".figma", "schemas", "index.schema.json")));
    assert.ok(existsSync(join(project, ".figma", "schemas", "event.schema.json")));
    assert.ok(existsSync(join(project, ".figma", "tasks")));
    assert.ok(existsSync(join(project, ".figma", "screenshot")));

    const config = JSON.parse(
      readFileSync(join(project, ".figma", "config.json"), "utf8"),
    );
    assert.equal(config.defaultBranch, "main");
    assert.equal(config.schemaVersion, 1);
  } finally {
    cleanup();
  }
});

test("init-project is idempotent for an existing valid project", () => {
  const { project, cleanup } = freshProject();
  try {
    const first = run(project, ["init-project", "--default-branch", "main", "--json"]);
    assert.equal(first.status, 0, first.stderr);
    const indexPath = join(project, ".figma", "index.json");
    const before = readFileSync(indexPath, "utf8");
    const second = run(project, ["init-project", "--default-branch", "main", "--json"]);
    assert.equal(second.status, 0, second.stderr);
    const after = readFileSync(indexPath, "utf8");
    assert.equal(before, after, "init-project must not mutate an existing valid project");
  } finally {
    cleanup();
  }
});

test("init-project fails closed without repairing an incomplete existing project", () => {
  const { project, cleanup } = freshProject();
  try {
    const first = run(project, ["init-project", "--default-branch", "main", "--json"]);
    assert.equal(first.status, 0, first.stderr);
    const indexPath = join(project, ".figma", "index.json");
    const schemaPath = join(project, ".figma", "schemas", "task-state.schema.json");
    const screenshotPath = join(project, ".figma", "screenshot");
    const before = readFileSync(indexPath, "utf8");
    rmSync(schemaPath);
    rmSync(screenshotPath, { recursive: true });

    const result = run(project, ["init-project", "--default-branch", "main", "--json"]);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(parseEnvelope(result).error.code, "STATE_INVALID");
    assert.equal(existsSync(schemaPath), false, "idempotent validation must not repair files");
    assert.equal(existsSync(screenshotPath), false, "idempotent validation must not repair dirs");
    assert.equal(readFileSync(indexPath, "utf8"), before, "validation must not mutate index");
  } finally {
    cleanup();
  }
});

test("init-project rejects corrupt or mismatched persisted schemas without mutation", () => {
  for (const [name, contents] of [
    ["structurally invalid", "{}\n"],
    ["mismatched", JSON.stringify({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion"],
      properties: { schemaVersion: { const: 1 } },
    }, null, 2) + "\n"],
  ]) {
    const { project, cleanup } = freshProject();
    try {
      const first = run(project, ["init-project", "--default-branch", "main", "--json"]);
      assert.equal(first.status, 0, `${name}: ${first.stderr}`);
      const schemaPath = join(project, ".figma", "schemas", "event.schema.json");
      writeFileSync(schemaPath, contents, "utf8");

      const result = run(project, ["init-project", "--default-branch", "main", "--json"]);
      assert.equal(result.status, 2, `${name}: ${result.stderr}`);
      assert.equal(parseEnvelope(result).error.code, "STATE_INVALID", name);
      assert.equal(readFileSync(schemaPath, "utf8"), contents, name);
    } finally {
      cleanup();
    }
  }
});

test("init-project rejects an unknown schema argument with SCHEMA_UNSUPPORTED", () => {
  const { project, cleanup } = freshProject();
  try {
    const result = run(project, [
      "init-project",
      "--default-branch",
      "main",
      "--schema-version",
      "9",
      "--json",
    ]);
    assert.equal(result.status, 2, result.stderr);
    const envelope = parseEnvelope(result);
    assert.equal(envelope.ok, false);
    assert.equal(envelope.error.code, "SCHEMA_UNSUPPORTED");
    assert.equal(existsSync(join(project, ".figma")), false, ".figma must not be created");
  } finally {
    cleanup();
  }
});

test("create writes the persistent ledger and returns revision 0", () => {
  const { project, cleanup } = freshProject();
  try {
    const init = run(project, ["init-project", "--default-branch", "main", "--json"]);
    assert.equal(init.status, 0, init.stderr);

    const create = run(project, [
      "create",
      "--task",
      "20260714-checkout-responsive",
      "--title",
      "Checkout responsive states",
      "--type",
      "Modify",
      "--write-required",
      "true",
      "--json",
    ]);
    assert.equal(create.status, 0, create.stderr);
    const envelope = parseEnvelope(create);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.state.revision, 0);
    assert.equal(envelope.data.state.status, "DRAFT");

    const taskDir = join(project, ".figma", "tasks", "20260714-checkout-responsive");
    assert.ok(existsSync(join(taskDir, "state.json")));
    assert.ok(existsSync(join(taskDir, "plan.md")));
    assert.ok(existsSync(join(taskDir, "todo.md")));
    assert.ok(existsSync(join(taskDir, "recovery.md")));
    assert.ok(existsSync(join(taskDir, "events.jsonl")));
    assert.ok(existsSync(join(taskDir, "evidence", "manifest.json")));

    const plan = readFileSync(join(taskDir, "plan.md"), "utf8");
    const todo = readFileSync(join(taskDir, "todo.md"), "utf8");
    assert.match(plan, /Workflow 0B/);
    assert.match(plan, /scope awaits discovery and classification/i);
    assert.doesNotMatch(plan, /^\d+\.\s*$/m, "plan must not contain empty numbered steps");
    assert.doesNotMatch(plan, /^-\s*$/m, "plan must not contain empty bullets");
    assert.match(todo, /T-001/);
    assert.match(todo, /Workflow 0B discovery and task classification/);
    assert.doesNotMatch(todo, /^- \[[ x]\]\s*$/m, "todo must not contain empty checklist items");

    const events = readFileSync(join(taskDir, "events.jsonl"), "utf8").trim().split("\n");
    assert.equal(events.length, 1);
    const created = JSON.parse(events[0]);
    assert.equal(created.type, "TASK_CREATED");
    assert.equal(created.revision, 0);
  } finally {
    cleanup();
  }
});

test("create rejects duplicate task IDs and leaves the prior ledger intact", () => {
  const { project, cleanup } = freshProject();
  try {
    run(project, ["init-project", "--default-branch", "main", "--json"]);
    const first = run(project, [
      "create",
      "--task",
      "20260714-checkout-responsive",
      "--title",
      "Checkout responsive states",
      "--type",
      "Modify",
      "--write-required",
      "true",
      "--json",
    ]);
    assert.equal(first.status, 0, first.stderr);

    const dup = run(project, [
      "create",
      "--task",
      "20260714-checkout-responsive",
      "--title",
      "Dup",
      "--type",
      "Modify",
      "--write-required",
      "true",
      "--json",
    ]);
    assert.equal(dup.status, 2, dup.stderr);
    const envelope = parseEnvelope(dup);
    assert.equal(envelope.ok, false);
    assert.equal(envelope.error.code, "STATE_INVALID");
    assert.equal(envelope.error.details.taskId, "20260714-checkout-responsive");
  } finally {
    cleanup();
  }
});

test("create derives title slugs and adds -02/-03 only for same-title collisions", () => {
  const { project, cleanup } = freshProject();
  try {
    run(project, ["init-project", "--default-branch", "main", "--json"]);
    const createAuto = (title) => run(project, [
      "create",
      "--title",
      title,
      "--type",
      "Modify",
      "--write-required",
      "true",
      "--json",
    ]);

    const first = createAuto("Checkout Responsive States");
    assert.equal(first.status, 0, first.stderr);
    const firstId = parseEnvelope(first).data.state.taskId;
    assert.match(firstId, /^\d{8}-checkout-responsive-states$/);

    const different = createAuto("Account Settings");
    assert.equal(different.status, 0, different.stderr);
    const differentId = parseEnvelope(different).data.state.taskId;
    assert.match(differentId, /^\d{8}-account-settings$/);

    const second = createAuto("Checkout   Responsive---States");
    assert.equal(second.status, 0, second.stderr);
    const secondId = parseEnvelope(second).data.state.taskId;
    assert.equal(secondId, `${firstId}-02`);

    const third = createAuto("checkout responsive states");
    assert.equal(third.status, 0, third.stderr);
    assert.equal(parseEnvelope(third).data.state.taskId, `${firstId}-03`);

    const fallback = createAuto("!!!");
    assert.equal(fallback.status, 0, fallback.stderr);
    assert.match(parseEnvelope(fallback).data.state.taskId, /^\d{8}-task$/);
  } finally {
    cleanup();
  }
});

test("create rejects a conceptual invalid type with STATE_INVALID", () => {
  const { project, cleanup } = freshProject();
  try {
    run(project, ["init-project", "--default-branch", "main", "--json"]);
    const result = run(project, [
      "create",
      "--task",
      "20260714-checkout-responsive",
      "--title",
      "Checkout responsive states",
      "--type",
      "Bogus",
      "--write-required",
      "true",
      "--json",
    ]);
    assert.equal(result.status, 2, result.stderr);
    const envelope = parseEnvelope(result);
    assert.equal(envelope.ok, false);
    assert.equal(envelope.error.code, "STATE_INVALID");
  } finally {
    cleanup();
  }
});

test("list rejects malformed and schema-invalid persisted project files", () => {
  const cases = [
    ["malformed index", "index.json", "{not-json\n"],
    ["schema-invalid index", "index.json", JSON.stringify({ schemaVersion: 1, updatedAt: "bad", tasks: [] }) + "\n"],
    ["schema-invalid config", "config.json", JSON.stringify({ schemaVersion: 1 }) + "\n"],
  ];

  for (const [name, filename, contents] of cases) {
    const { project, cleanup } = freshProject();
    try {
      const init = run(project, ["init-project", "--default-branch", "main", "--json"]);
      assert.equal(init.status, 0, `${name}: ${init.stderr}`);
      writeFileSync(join(project, ".figma", filename), contents, "utf8");

      const result = run(project, ["list", "--json"]);
      assert.equal(result.status, 2, `${name}: ${result.stderr}`);
      assert.equal(parseEnvelope(result).error.code, "STATE_INVALID", name);
    } finally {
      cleanup();
    }
  }
});

test("create rejects an invalid persisted index before writing a task", () => {
  const { project, cleanup } = freshProject();
  try {
    run(project, ["init-project", "--default-branch", "main", "--json"]);
    writeFileSync(join(project, ".figma", "index.json"), "{broken\n", "utf8");

    const result = run(project, [
      "create",
      "--task",
      "20260714-will-not-write",
      "--title",
      "Will not write",
      "--type",
      "Modify",
      "--write-required",
      "true",
      "--json",
    ]);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(parseEnvelope(result).error.code, "STATE_INVALID");
    assert.equal(
      existsSync(join(project, ".figma", "tasks", "20260714-will-not-write")),
      false,
    );
  } finally {
    cleanup();
  }
});

test("list returns summaries ordered by updatedAt then taskId", () => {
  const { project, cleanup } = freshProject();
  try {
    run(project, ["init-project", "--default-branch", "main", "--json"]);
    run(project, [
      "create",
      "--task",
      "20260714-aaa",
      "--title",
      "A",
      "--type",
      "Modify",
      "--write-required",
      "true",
      "--json",
    ]);
    // Bump index updatedAt deterministically by writing directly between
    // creates so the list-ordering rule is observable without sleeping.
    const indexPath = join(project, ".figma", "index.json");
    const indexData = JSON.parse(readFileSync(indexPath, "utf8"));
    indexData.updatedAt = "2026-07-14T10:00:00+08:00";
    writeFileSync(indexPath, JSON.stringify(indexData, null, 2) + "\n", "utf8");
    run(project, [
      "create",
      "--task",
      "20260714-zzz",
      "--title",
      "Z",
      "--type",
      "Modify",
      "--write-required",
      "true",
      "--json",
    ]);

    const list = run(project, ["list", "--json"]);
    assert.equal(list.status, 0, list.stderr);
    const envelope = parseEnvelope(list);
    assert.equal(envelope.ok, true);
    const ids = envelope.data.tasks.map((t) => t.taskId);
    assert.deepEqual(ids, ["20260714-aaa", "20260714-zzz"]);
  } finally {
    cleanup();
  }
});

test("show returns full task state and recovery text", () => {
  const { project, cleanup } = freshProject();
  try {
    run(project, ["init-project", "--default-branch", "main", "--json"]);
    run(project, [
      "create",
      "--task",
      "20260714-checkout-responsive",
      "--title",
      "Checkout responsive states",
      "--type",
      "Modify",
      "--write-required",
      "true",
      "--json",
    ]);
    const result = run(project, [
      "show",
      "--task",
      "20260714-checkout-responsive",
      "--json",
    ]);
    assert.equal(result.status, 0, result.stderr);
    const envelope = parseEnvelope(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.state.taskId, "20260714-checkout-responsive");
    assert.equal(envelope.data.recovery.length > 0, true);
  } finally {
    cleanup();
  }
});

test("show rejects malformed and schema-invalid task state", () => {
  for (const [name, stateContents] of [
    ["malformed", "{broken\n"],
    ["schema-invalid", JSON.stringify({ schemaVersion: 1, status: "INVALID" }) + "\n"],
  ]) {
    const { project, cleanup } = freshProject();
    try {
      run(project, ["init-project", "--default-branch", "main", "--json"]);
      run(project, [
        "create",
        "--task",
        "20260714-invalid-state",
        "--title",
        "Invalid state",
        "--type",
        "Modify",
        "--write-required",
        "true",
        "--json",
      ]);
      writeFileSync(
        join(project, ".figma", "tasks", "20260714-invalid-state", "state.json"),
        stateContents,
        "utf8",
      );

      const result = run(project, [
        "show",
        "--task",
        "20260714-invalid-state",
        "--json",
      ]);
      assert.equal(result.status, 2, `${name}: ${result.stderr}`);
      assert.equal(parseEnvelope(result).error.code, "STATE_INVALID", name);
    } finally {
      cleanup();
    }
  }
});

test("show reports TASK_NOT_FOUND for an unknown task id", () => {
  const { project, cleanup } = freshProject();
  try {
    run(project, ["init-project", "--default-branch", "main", "--json"]);
    const result = run(project, [
      "show",
      "--task",
      "20260714-does-not-exist",
      "--json",
    ]);
    assert.equal(result.status, 2, result.stderr);
    const envelope = parseEnvelope(result);
    assert.equal(envelope.ok, false);
    assert.equal(envelope.error.code, "TASK_NOT_FOUND");
  } finally {
    cleanup();
  }
});

test("create --dry-run produces no files but still validates", () => {
  const { project, cleanup } = freshProject();
  try {
    run(project, ["init-project", "--default-branch", "main", "--json"]);
    const result = run(project, [
      "create",
      "--task",
      "20260714-checkout-responsive",
      "--title",
      "Checkout responsive states",
      "--type",
      "Modify",
      "--write-required",
      "true",
      "--dry-run",
      "--json",
    ]);
    assert.equal(result.status, 0, result.stderr);
    const envelope = parseEnvelope(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.dryRun, true);
    assert.equal(
      existsSync(join(project, ".figma", "tasks", "20260714-checkout-responsive")),
      false,
    );
  } finally {
    cleanup();
  }
});

test("--project with literal '..' is rejected as PATH_OUTSIDE_PROJECT", () => {
  const { project, cleanup } = freshProject();
  try {
    const result = run(project, ["--project", "..", "list", "--json"]);
    assert.equal(result.status, 2, result.stderr);
    const envelope = parseEnvelope(result);
    assert.equal(envelope.ok, false);
    assert.equal(envelope.error.code, "PATH_OUTSIDE_PROJECT");
  } finally {
    cleanup();
  }
});

test("human output prints a compact summary without JSON envelope", () => {
  const { project, cleanup } = freshProject();
  try {
    run(project, ["init-project", "--default-branch", "main"]);
    const create = run(project, [
      "create",
      "--task",
      "20260714-checkout-responsive",
      "--title",
      "Checkout responsive states",
      "--type",
      "Modify",
      "--write-required",
      "true",
    ]);
    assert.equal(create.status, 0, create.stderr);
    assert.ok(create.stdout.includes("20260714-checkout-responsive"));
    assert.equal(create.stdout.trim().startsWith("{"), false);
  } finally {
    cleanup();
  }
});

test("invalid args without --json exit with code 2 and a stderr message", () => {
  const { project, cleanup } = freshProject();
  try {
    const result = run(project, ["create", "--json"]);
    assert.equal(result.status, 2, result.stderr);
    assert.ok(result.stderr.length > 0);
  } finally {
    cleanup();
  }
});

test("usage banner advertises reflect along with other subcommands", () => {
  const { project, cleanup } = freshProject();
  try {
    const result = run(project, ["--help"]);
    assert.equal(result.status, 2);
    assert.ok(
      result.stderr.includes("reflect"),
      "usage banner must mention reflect",
    );
  } finally {
    cleanup();
  }
});

test("reflect writes .figma/feedback/<timestamp>.md with the two table headers", () => {
  const { project, cleanup } = freshProject();
  try {
    const result = run(project, [
      "reflect",
      "--now",
      "2026-07-15T20:00:00+08:00",
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes("reflect "), result.stdout);
    const expectedName = "2026-07-15T20-00-00.md";
    const feedbackPath = join(project, ".figma", "feedback", expectedName);
    assert.ok(existsSync(feedbackPath), `expected ${feedbackPath}`);
    const body = readFileSync(feedbackPath, "utf8");
    assert.ok(body.length > 0);
    assert.match(body, /^# figma-skill v2\.1 Self-Reflection/m);
    assert.match(body, /<!-- skill-version: 2\.1 -->/);
    assert.ok(body.includes("问题列表"), "must include 问题列表 header");
    assert.ok(body.includes("优化方向"), "must include 优化方向 header");
  } finally {
    cleanup();
  }
});

test("reflect rejects mismatching --skill-version with SKILL_VERSION_MISMATCH", () => {
  const { project, cleanup } = freshProject();
  try {
    const result = run(project, ["reflect", "--skill-version", "9.9"]);
    assert.equal(result.status, 2, result.stderr);
    assert.ok(
      result.stderr.includes("SKILL_VERSION_MISMATCH"),
      `stderr was: ${result.stderr}`,
    );
  } finally {
    cleanup();
  }
});
