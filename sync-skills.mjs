#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import process from "node:process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const sourceRoot = scriptDir;
const targetRoots = [join(homedir(), ".claude", "skills"), join(homedir(), ".codex", "skills")];

function parseArgs(argv) {
  const options = {
    dryRun: false,
    includeHidden: false,
    verbose: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--include-hidden") options.includeHidden = true;
    else if (arg === "--verbose" || arg === "-v") options.verbose = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printUsage() {
  console.log(`Usage: node sync-skills.mjs [--dry-run] [--include-hidden] [--verbose]

Synchronizes every top-level skill directory that contains a SKILL.md file into:
  - ~/.claude/skills
  - ~/.codex/skills

Same-named destinations are overwritten.`);
}

function isSkillDirectory(entryName) {
  return existsSync(join(sourceRoot, entryName, "SKILL.md"));
}

function listSkillDirectories(includeHidden) {
  return readdirSync(sourceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => includeHidden || !name.startsWith("."))
    .filter((name) => isSkillDirectory(name))
    .sort((left, right) => left.localeCompare(right));
}

function ensureDirectory(pathname, dryRun) {
  if (!dryRun) {
    mkdirSync(pathname, { recursive: true });
  }
}

function copySkillDirectory(skillName, targetRoot, dryRun, verbose) {
  const sourcePath = join(sourceRoot, skillName);
  const targetPath = join(targetRoot, skillName);

  if (verbose || dryRun) {
    console.log(`${dryRun ? "[dry-run]" : "[sync]"} ${sourcePath} -> ${targetPath}`);
  }

  if (dryRun) {
    return;
  }

  if (existsSync(targetPath)) {
    rmSync(targetPath, { recursive: true, force: true });
  }

  cpSync(sourcePath, targetPath, { recursive: true, force: true, dereference: true });
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  const skillDirectories = listSkillDirectories(options.includeHidden);
  if (skillDirectories.length === 0) {
    console.log("No skill directories found.");
    return;
  }

  for (const targetRoot of targetRoots) {
    ensureDirectory(targetRoot, options.dryRun);
    for (const skillName of skillDirectories) {
      copySkillDirectory(skillName, targetRoot, options.dryRun, options.verbose);
    }
  }

  console.log(`${options.dryRun ? "Dry run completed" : "Sync completed"}: ${skillDirectories.length} skills -> ${targetRoots.length} targets`);
}

main();
