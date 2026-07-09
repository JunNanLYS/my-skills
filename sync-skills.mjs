#!/usr/bin/env node
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { createHash } from "node:crypto";
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
    failFast: false,
    onlyChanged: false,
    prune: true,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--include-hidden") options.includeHidden = true;
    else if (arg === "--verbose" || arg === "-v") options.verbose = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--fail-fast") options.failFast = true;
    else if (arg === "--only-changed") options.onlyChanged = true;
    else if (arg === "--no-prune") options.prune = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printUsage() {
  console.log(`Usage: node sync-skills.mjs [--dry-run] [--include-hidden] [--verbose] [--only-changed] [--no-prune] [--fail-fast]

Synchronizes every top-level skill directory that contains a SKILL.md file into:
  - ~/.claude/skills
  - ~/.codex/skills

Options:
  --dry-run        Show what would be synchronized without changing files
  --include-hidden Include top-level directories that start with a dot
  --verbose, -v    Print one line per skill copy, skip, or prune
  --only-changed   Skip skills whose source and destination fingerprints match
  --no-prune       Do not remove destination directories that no longer have a source
  --fail-fast      Stop on the first copy failure

Same-named destinations are overwritten via a safe temporary replacement.
Destination directories that are themselves skills (have a SKILL.md) but have no
matching source are deleted, mirroring a removed source skill on disk.`);
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

function updateDirectoryFingerprint(hash, rootPath, relativePrefix = "") {
  const entries = readdirSync(rootPath, { withFileTypes: true })
    .map((entry) => ({
      name: entry.name,
      path: join(rootPath, entry.name),
      relativePath: relativePrefix ? join(relativePrefix, entry.name) : entry.name,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const stats = statSync(entry.path);

    if (stats.isDirectory()) {
      hash.update(`${entry.relativePath}|dir\n`);
      updateDirectoryFingerprint(hash, entry.path, entry.relativePath);
      continue;
    }

    hash.update(`${entry.relativePath}|file|${stats.size}|`);
    hash.update(readFileSync(entry.path));
    hash.update("\n");
  }
}

function directoryFingerprint(pathname) {
  if (!existsSync(pathname)) {
    return null;
  }

  const stats = lstatSync(pathname);
  if (!stats.isDirectory()) {
    return `non-directory|${stats.size}`;
  }

  const hash = createHash("sha256");
  updateDirectoryFingerprint(hash, pathname);
  return hash.digest("hex");
}

function shouldSkipSkill(sourcePath, targetPath, onlyChanged) {
  if (!onlyChanged) {
    return false;
  }

  const sourceFingerprint = directoryFingerprint(sourcePath);
  const targetFingerprint = directoryFingerprint(targetPath);
  return sourceFingerprint !== null && sourceFingerprint === targetFingerprint;
}

function replaceDirectorySafely(sourcePath, targetPath) {
  const tempPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
  const backupPath = `${targetPath}.bak-${process.pid}-${Date.now()}`;
  let targetRenamed = false;

  try {
    cpSync(sourcePath, tempPath, { recursive: true, force: true, dereference: true, preserveTimestamps: true });

    if (existsSync(targetPath)) {
      renameSync(targetPath, backupPath);
      targetRenamed = true;
    }

    renameSync(tempPath, targetPath);

    if (targetRenamed && existsSync(backupPath)) {
      rmSync(backupPath, { recursive: true, force: true });
    }
  } catch (error) {
    if (existsSync(tempPath)) {
      rmSync(tempPath, { recursive: true, force: true });
    }

    if (targetRenamed && existsSync(backupPath) && !existsSync(targetPath)) {
      renameSync(backupPath, targetPath);
    }

    throw error;
  }
}

function syncSkillDirectory(skillName, targetRoot, options) {
  const sourcePath = join(sourceRoot, skillName);
  const targetPath = join(targetRoot, skillName);

  if (shouldSkipSkill(sourcePath, targetPath, options.onlyChanged)) {
    if (options.verbose || options.dryRun) {
      console.log(`[skip] ${sourcePath} -> ${targetPath}`);
    }
    return { status: "skipped", skillName, targetRoot };
  }

  if (options.verbose || options.dryRun) {
    console.log(`${options.dryRun ? "[dry-run]" : "[sync]"} ${sourcePath} -> ${targetPath}`);
  }

  if (options.dryRun) {
    return { status: "planned", skillName, targetRoot };
  }

  replaceDirectorySafely(sourcePath, targetPath);
  return { status: "synced", skillName, targetRoot };
}

function listTargetSkillDirectories(targetRoot, includeHidden) {
  if (!existsSync(targetRoot)) {
    return [];
  }

  return readdirSync(targetRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => includeHidden || !name.startsWith("."))
    .filter((name) => existsSync(join(targetRoot, name, "SKILL.md")))
    .sort((left, right) => left.localeCompare(right));
}

function pruneStaleSkillDirectory(targetPath, dryRun) {
  if (dryRun) {
    return;
  }
  rmSync(targetPath, { recursive: true, force: true });
}

function pruneStaleSkillDirectories(skillNames, targetRoot, options) {
  if (!options.prune) {
    return [];
  }

  const targetSkills = listTargetSkillDirectories(targetRoot, options.includeHidden);
  const sourceNames = new Set(skillNames);
  const results = [];

  for (const targetSkill of targetSkills) {
    if (sourceNames.has(targetSkill)) {
      continue;
    }

    const targetPath = join(targetRoot, targetSkill);

    if (options.verbose || options.dryRun) {
      console.log(`${options.dryRun ? "[dry-run-prune]" : "[prune]"} ${targetPath} (no matching source)`);
    }

    if (options.dryRun) {
      results.push({ status: "planned-prune", skillName: targetSkill, targetRoot });
      continue;
    }

    try {
      pruneStaleSkillDirectory(targetPath, options.dryRun);
      results.push({ status: "pruned", skillName: targetSkill, targetRoot });
    } catch (error) {
      results.push({ status: "failed", skillName: targetSkill, targetRoot, error });
      console.error(`[error] ${targetPath}: ${error.message}`);
    }
  }

  return results;
}

function summarizeResults(results, dryRun) {
  const summary = {
    synced: 0,
    skipped: 0,
    planned: 0,
    pruned: 0,
    plannedPrune: 0,
    failed: 0,
  };

  for (const result of results) {
    if (result.status === "planned-prune") {
      summary.plannedPrune += 1;
    } else if (result.status === "pruned") {
      summary.pruned += 1;
    } else {
      summary[result.status] += 1;
    }
  }

  const parts = dryRun
    ? [
        `planned ${summary.planned}`,
        `planned-prune ${summary.plannedPrune}`,
        `skipped ${summary.skipped}`,
        `failed ${summary.failed}`,
      ]
    : [
        `synced ${summary.synced}`,
        `pruned ${summary.pruned}`,
        `skipped ${summary.skipped}`,
        `failed ${summary.failed}`,
      ];

  return parts.join(", ");
}

function run() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return 0;
  }

  const skillDirectories = listSkillDirectories(options.includeHidden);
  if (skillDirectories.length === 0) {
    console.log("No skill directories found.");
    return 0;
  }

  const results = [];

  for (const targetRoot of targetRoots) {
    ensureDirectory(targetRoot, options.dryRun);

    for (const skillName of skillDirectories) {
      try {
        results.push(syncSkillDirectory(skillName, targetRoot, options));
      } catch (error) {
        const result = {
          status: "failed",
          skillName,
          targetRoot,
          error,
        };
        results.push(result);
        console.error(`[error] ${join(targetRoot, skillName)}: ${error.message}`);

        if (options.failFast) {
          console.error(`Stopped early because --fail-fast is enabled.`);
          console.log(`${options.dryRun ? "Dry run" : "Sync"} completed: ${summarizeResults(results, options.dryRun)}`);
          return 1;
        }
      }
    }

    for (const pruneResult of pruneStaleSkillDirectories(skillDirectories, targetRoot, options)) {
      results.push(pruneResult);
      if (pruneResult.status === "failed" && options.failFast) {
        console.error(`Stopped early because --fail-fast is enabled.`);
        console.log(`${options.dryRun ? "Dry run" : "Sync"} completed: ${summarizeResults(results, options.dryRun)}`);
        return 1;
      }
    }
  }

  console.log(`${options.dryRun ? "Dry run" : "Sync"} completed: ${summarizeResults(results, options.dryRun)}`);
  return results.some((result) => result.status === "failed") ? 1 : 0;
}

try {
  process.exitCode = run();
} catch (error) {
  console.error(`Error: ${error.message}`);
  printUsage();
  process.exitCode = 1;
}
