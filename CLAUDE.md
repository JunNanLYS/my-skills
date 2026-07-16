# CLAUDE.md

## 项目结构

本仓库是一个 skill 集合仓库。**每个顶层目录都是一个独立的 skill**，目录名即 skill 名。每个 skill 目录内**至少包含一个 `SKILL.md`**（带 YAML frontmatter，定义 `name` / `model` / `category` / `description` / `version`），部分 skill 还会带 `references/` 子目录存放按需加载的参考文档。

AI 在接到任务时，先按顶层目录名定位 skill，再读该目录下的 `SKILL.md`；不要把整个仓库当成一个项目去逐目录扫描。

## YAML Front Matter Must Be First

Every SKILL.md file must begin with YAML front matter (`---` block containing `name`, `category`, `description`, `version`). This block must be the very first content in the file — no text, headings, or blank lines may appear before it. Codex will not recognize a skill if the YAML front matter is not at the top of the file.

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

---

## Rust 端口状态(Phase 0)

本仓库外的 `D:\temp\figma-cli-rust\` 是一个**独立 fork**,不在本仓库 git 跟踪范围。它 Rust 重写 figma-ds-cli,Phase 0 仅完成骨架 + CDP eval 路径。

**未实现 / 不工作**:

- **Plugin 模式未实现** — Rust daemon 的 `WS /plugin` 端点只接受连接 + 响应 `pong`;**Figma 沙箱侧的 `plugin/code.js` 和 `plugin/ui.html` 没移植**。这意味着 `DAEMON_MODE=plugin` 路径完全不可用;只支持 CDP/Yolo 模式。如果 figma-skill 的任何 workflow 需要 Plugin 模式,必须使用 `~/.claude/skills/figma-skill` 或 `~/.codex/skills/figma-skill`(Node 版本),**不要**让 rustcli 走 plugin 路径。
- **49 个 `daemonExec('eval', ...)` 业务命令全部 stub** — `set fill`、`create frame`、`move`、`clone`、`align`、`bind variable` 等在 Rust 版都返回 "not yet implemented in rustcli (Phase 0)" 并 exit 1。Rust CLI 唯一能跑通的 eval 是 `figma-cli eval "return 42"` 这种直接表达式。
- **`run <file>` 未实现** — figma-skill 在 sandbox 里跑的脚本通道,Node 版有,Rust 版没有。
- **JSX 解析器未移植** — 1500 行 `parseJSX` / `parseJSXBatch`,`render` / `render-batch` 命令依赖。

**对 AI 的硬约束**:在涉及 figma-skill / figma-to-react / figma-cli 的任务里,**默认使用 Node 版本**(`figma-cli` 命令 on PATH,源是 `~/.claude/skills/figma-skill` 或 npm 安装的 `figma-ds-cli`)。**不要建议、推荐、调用或集成 `D:\temp\figma-cli-rust\`** 下的 rustcli 二进制,除非用户明确说"用 Rust 版"。
