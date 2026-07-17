# CLAUDE.md

## 项目结构

本仓库是一个 skill 集合仓库。**每个顶层目录都是一个独立的 skill**，目录名即 skill 名。每个 skill 目录内**至少包含一个 `SKILL.md`**（带 YAML frontmatter，定义 `name` / `description` / `version`），部分 skill 还会带 `references/` 子目录存放按需加载的参考文档。

AI 在接到任务时，先按顶层目录名定位 skill，再读该目录下的 `SKILL.md`；不要把整个仓库当成一个项目去逐目录扫描。

## YAML Front Matter Must Be First

Every SKILL.md file must begin with YAML front matter (`---` block containing at minimum `name`, `description`, `version`). This block must be the very first content in the file — no text, headings, or blank lines may appear before it. Codex will not recognize a skill if the YAML front matter is not at the top of the file.

Other fields such as `model` or `category` are optional. Imported upstream skills may omit them; only `name` / `description` / `version` are required.

### Versioning Rules

Every time a SKILL.md or any reference file under the skill directory is modified, increment the `version` field in the YAML front matter:

- **Minor updates** (typo fixes, wording tweaks, small additions, formatting): increment the decimal part (e.g., `1.0` → `1.1`, `1.9` → `1.10`).
- **Major updates** (new sections, restructured content, changed logic or instructions): increment the integer part (e.g., `1.10` → `2.0`).

Always update the version before committing.

---

## Push After Every Task

After completing any task that modifies files in this repository, stage all changes, commit with a meaningful message, and push to `origin main`:

```bash
git add -A
git commit -m "<brief description of what was changed>"
git push origin main
```

Do not leave uncommitted or unpushed changes in the working tree. Every task ends with a clean, pushed state.

## Auto Sync After Push

This repository includes a project hook in `.claude/settings.json` that runs after a successful Claude Code `Bash` tool call matching `git push *`.

The hook executes:

```bash
node sync-skills.mjs --only-changed -v
```

Behavior notes:
- It synchronizes top-level skill directories into `~/.claude/skills` and `~/.codex/skills`.
- It only runs for pushes initiated through Claude Code's `Bash` tool in this repository.
- Pushes performed outside Claude Code do not trigger the hook.
- The hook is best-effort and non-blocking; sync failures do not cancel the completed push.
