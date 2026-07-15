import { execFileSync } from "node:child_process";
import { rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STUB = join(__dirname, "helpers", "stub-figma-cli.mjs");
const STATE = join(__dirname, "helpers", ".figma-stub-state.json");

function resetState() {
  if (existsSync(STATE)) rmSync(STATE);
}

function runStub(args) {
  return execFileSync("node", [STUB, ...args], { encoding: "utf8" });
}

beforeEach(() => resetState());

test("--check-exists + no existing → exit 0, new id", () => {
  resetState();
  const out = runStub(["create", "section", "--name", "News", "--parent", "P1", "--check-exists"]);
  const result = JSON.parse(out);
  assert.equal(result.created, true);
  assert.ok(result.id);
});

test("--check-exists + existing → exit 3, DUPLICATE payload", () => {
  resetState();
  runStub(["create", "section", "--name", "News", "--parent", "P1"]);
  let exitCode = 0;
  let out = "";
  try {
    out = runStub(["create", "section", "--name", "News", "--parent", "P1", "--check-exists"]);
  } catch (e) {
    exitCode = e.status;
    out = e.stdout.toString();
  }
  assert.equal(exitCode, 3);
  const result = JSON.parse(out);
  assert.equal(result.status, "DUPLICATE");
  assert.equal(result.code, "DUPLICATE_NODE");
  assert.ok(result.existingId);
});

test("--check-exists --reuse + existing → exit 0, reused:true", () => {
  resetState();
  const first = JSON.parse(runStub(["create", "section", "--name", "News", "--parent", "P1"]));
  const out = runStub(["create", "section", "--name", "News", "--parent", "P1", "--check-exists", "--reuse"]);
  const result = JSON.parse(out);
  assert.equal(result.reused, true);
  assert.equal(result.existingId, first.id);
});

test("--check-exists --strict + existing → exit 4", () => {
  resetState();
  runStub(["create", "section", "--name", "News", "--parent", "P1"]);
  let exitCode = 0;
  try {
    runStub(["create", "section", "--name", "News", "--parent", "P1", "--check-exists", "--strict"]);
  } catch (e) {
    exitCode = e.status;
  }
  assert.equal(exitCode, 4);
});