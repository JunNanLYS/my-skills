#!/usr/bin/env node
// tests/helpers/stub-figma-cli.mjs
//
// Stub figma-cli for idempotency contract tests. Records calls to
// .figma-stub-state.json so successive invocations can simulate "node already exists".
//
// Usage: node tests/helpers/stub-figma-cli.mjs create section --name "X" --parent Y [--check-exists] [--reuse] [--strict] [--rename Z]
//
// State file: tests/helpers/.figma-stub-state.json
//   { nodes: [{ id, name, parent }] }
//
// Exit codes:
//   0 — created or reused
//   3 — DUPLICATE (default with --check-exists, no --reuse)
//   4 — STRICT_ABORT (--strict + duplicate)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(__dirname, ".figma-stub-state.json");

function loadState() {
  if (!existsSync(STATE_PATH)) return { nodes: [] };
  return JSON.parse(readFileSync(STATE_PATH, "utf8"));
}

function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}

const [, , cmd, subCmd, ...rest] = process.argv;

if (cmd !== "create") {
  console.error("stub-figma-cli: only `create` subcommand supported in stub");
  process.exit(2);
}

if (subCmd !== "section" && subCmd !== "frame" && subCmd !== "component") {
  console.error("stub-figma-cli: only section/frame/component subcommands supported");
  process.exit(2);
}

const flags = parseFlags(rest);
const { name, parent, checkExists, reuse, strict, rename } = {
  name: flags.name,
  parent: flags.parent,
  checkExists: !!flags["check-exists"],
  reuse: !!flags.reuse,
  strict: !!flags.strict,
  rename: flags.rename,
};

if (!name || !parent) {
  console.error("stub-figma-cli: --name and --parent required");
  process.exit(2);
}

const state = loadState();
const existing = state.nodes.find((n) => n.name === name && n.parent === parent);

if (checkExists && existing) {
  if (strict) {
    console.error("STRICT_ABORT: duplicate detected under strict mode");
    process.exit(4);
  }
  if (reuse) {
    process.stdout.write(JSON.stringify({ reused: true, existingId: existing.id }, null, 2));
    process.exit(0);
  }
  process.stdout.write(JSON.stringify({
    status: "DUPLICATE",
    code: "DUPLICATE_NODE",
    existingId: existing.id,
    existingName: existing.name,
    parent: existing.parent,
    message: "node already exists; pass --reuse to bind, --rename <name> to create, or remove the existing one first",
  }, null, 2));
  process.exit(3);
}

// Either no check-exists, or check-exists but no existing node.
if (rename && checkExists) {
  // Retry with new name.
  const newName = rename;
  const newExisting = state.nodes.find((n) => n.name === newName && n.parent === parent);
  if (newExisting) {
    process.stdout.write(JSON.stringify({
      status: "DUPLICATE", code: "DUPLICATE_NODE",
      existingId: newExisting.id, existingName: newExisting.name, parent,
      message: "renamed target also exists",
    }, null, 2));
    process.exit(3);
  }
  const id = "stub-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
  state.nodes.push({ id, name: newName, parent });
  saveState(state);
  process.stdout.write(JSON.stringify({ created: true, id, name: newName, parent }, null, 2));
  process.exit(0);
}

const id = "stub-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
state.nodes.push({ id, name, parent });
saveState(state);
process.stdout.write(JSON.stringify({ created: true, id, name, parent }, null, 2));
process.exit(0);