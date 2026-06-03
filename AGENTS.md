# AGENTS.md

## YAML Front Matter Must Be First

Every SKILL.md file must begin with YAML front matter (`---` block containing `name`, `model`, `category`, `description`, `version`). This block must be the very first content in the file — no text, headings, or blank lines may appear before it. Codex will not recognize a skill if the YAML front matter is not at the top of the file.

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