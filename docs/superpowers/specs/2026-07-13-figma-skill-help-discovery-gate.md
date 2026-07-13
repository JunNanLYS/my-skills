---
name: figma-skill help-discovery
model: sonnet
category: design
description: v1.2.3 patch forcing the agent to consult figma-cli --help (recursively to subcommands) on first use of each command, and forbidding bypass routes such as node scripts or other language runtimes.
version: 1.2.3
---

# `figma-skill` Help Discovery Gate (v1.2.3)

**Date:** 2026-07-13
**Status:** Awaiting written-spec user review
**Target version:** `figma-skill` 1.2.3 (patch bump)

This spec is a **patch on top of v1.2.2**. It does not change Workflows
0–11 ordering, naming grammar, three-page architecture, geometry
mandates, or approval gates. It introduces a **Help Discovery Gate**
so the agent consults `figma-cli --help` (recursively) on first use of
each command, and forbids bypass routes.

---

## 1. Background and Diagnosis

### 1.1 Observed behaviour

After v1.2.2 deployment, the user observed that the agent frequently
**writes its own scripts** (most often `node xxx.js`) instead of using
native `figma-cli` commands. Two root causes:

1. The agent treats `--help` output as optional reference material, not
   as a **gate trigger**. v1.2.1 already requires `--help` evidence for
   the eval/run gate, but only for the fallback path; routine commands
   can run without a fresh help lookup.
2. The agent does not realise that many `figma-cli` commands have
   **subcommands** (e.g. `figma-cli create frame` is one such pair).
   `figma-cli create --help` shows only the top-level intent; only
   `figma-cli create frame --help` reveals frame-specific flags. The
   agent gives up at the first level and falls back to writing a
   script.

### 1.2 Two bypass routes observed

- **A. Direct node script**: `node some-script.js` calling figma JSON
  files or low-level libraries.
- **B. Python / PowerShell / sh**: equivalent routes using other
  runtimes.

The agent frequently reaches for these routes when it **does not
realise** that `figma-cli` already exposes the operation as a native
command. Both routes can be legitimate when `figma-cli` genuinely
lacks the capability (e.g. complex transformations beyond CLI scope),
but they must be gated just like `eval/run`.

### 1.3 Real command shape (verified)

From `figma-cli --help` and `figma-cli create --help`:

```text
create [options] [command]
Commands:
  frame [options] <name>
  icon [options] <name>
  image [options] <url>
  rect|rectangle [options] [name]
```

The agent must run `figma-cli create frame --help` to learn
frame-specific flags. Top-level help alone is insufficient.

---

## 2. Goals and Non-Goals

### 2.1 Goals

1. Force the agent to consult `figma-cli <command> --help` (and
   `<command> <subcommand> --help` when applicable) on **first use of
   each command in a session**, before any execution.
2. Treat any non-`figma-cli` runtime (node / python / pwsh / sh /
   direct JSON read) **as a fall-through route subject to the same
   gate as `eval/run`**: requires the user-approved fallback evidence
   chain (NativeHelpChecked, MissingNativeCapability, TargetNodeIds,
   FallbackCodeScope, FallbackImpact, GeometryReaudit). This is **not
   a blanket prohibition** — it is a gate.
3. Allow `scripts/figma-validate-bounds.mjs` (offline JSON analysis
   on already-exported JSON) as the only no-gate runtime, because it
   never reaches the Figma daemon.
4. Make the help-evidence visible in the delivery report (no disk
   storage required; context only).
5. Add four new Red Flags to anchor the rule.

### 2.2 Non-goals

- No change to v1.2.2 verifier pipeline.
- No change to v1.2.1 status-first connect gate.
- No relaxation of eval/run gate semantics; this spec extends the
  same gate pattern to non-CLI runtimes.
- No disk persistence of help output.

---

## 3. New Non-Negotiable Rules (additions)

Append the following rules to `SKILL.md` `## Non-Negotiable Rules`,
placed adjacent to the existing eval/run rule.

```text
- 禁止凭旧记忆、第三方文档或示例代码推断 figma-cli 命令是否存在、
  参数或行为。每个 figma-cli 会话首次使用某命令时，必须运行
  `figma-cli <command> --help`；当命令含子命令时，必须继续运行
  `figma-cli <command> <subcommand> --help`。Help 输出必须保留
  在当前会话上下文中，直至 Workflow 11 交付报告。

- 任何 figma-cli 之外的运行时（node / python / pwsh / sh / 直接
  读写 .figma JSON / 直接调用 Figma REST API 等）必须按 eval/run
  gate 同等处理：必须先在 Workflow 6 计划的
  `EvalRunFallback` 字段中提供 NativeHelpChecked、
  MissingNativeCapability、TargetNodeIds、FallbackCodeScope、
  FallbackImpact、GeometryReaudit 完整事实链，并获得用户明确批准。
  唯一无需此 gate 的运行时是 scripts/figma-validate-bounds.mjs
  （离线 JSON 分析，不与 Figma daemon 通信）。
```

Rationale for the runtime exception: the bounds verifier (introduced
in v1.2) operates on already-exported JSON and never reaches the
Figma daemon. It is the only approved non-figma-cli runtime path.

---

## 4. New `## Help Discovery Gate` Chapter

Insert in `SKILL.md` between `## Mandatory Lookups by Phase` and
`## Workflows 0–11`:

```text
## Help Discovery Gate

执行任何 figma-cli 命令前必须满足下列门禁：

1. 首次使用该命令：必须运行 `figma-cli <command> --help`，把输出
   保留在当前会话上下文；命令失败或输出含未知 flag 时必须再运行
   `figma-cli <command> <subcommand> --help` 直到定位到目标子命令。
2. 命令族升级：当 `--help` 输出与上次会话记录存在以下任一差异时
   必须重查：(a) 子命令集合变化；(b) flag 集合变化；(c) flag
   默认值变化。命令族升级后禁止沿用旧记忆。
3. 失败重查：当某命令退出码非 0 或输出包含 "unknown option" /
   "deprecated" 时，必须重查 `--help` 后再决定下一步。
4. 证据链：Workflow 11 交付报告的 HelpEvidence 字段必须列出每个
   实际执行的命令及其 `--help` 摘要（不强制落盘；上下文 + 报告
   摘录即可）。

禁止：用 docs / blog / 训练记忆作为命令语法来源；figma-cli --help
是唯一命令真相。
禁止：把"上次用过"作为不重查 help 的理由。
禁止：在执行前未查 help 时使用 eval/run 替代。
```

---

## 5. Workflow 8 — Help-Evidence Insertion

Append to Workflow 8 batch loop body:

```text
每批：读 → 写 → 重读 → 检查 → 通过则下一批。

如果本批首次引入某命令，必须在该批"读"步骤之前执行：
  - figma-cli <command> --help（顶层）
  - 必要时 figma-cli <command> <subcommand> --help（子命令）

Help 输出必须保留至当前会话结束；不得丢弃。
```

---

## 6. Workflow 11 — HelpEvidence Field

Append to the delivery report template:

```text
HelpEvidence:
  - <command>: <one-line excerpt from --help, e.g. "Usage: figma-ds-cli inspect [options] <nodeId>">
  - <command> <subcommand>: <one-line excerpt>
```

The field is mandatory. Empty `HelpEvidence` for any actual write
command is a delivery-fail.

---

## 7. New Red Flags (Four Items)

Add to `SKILL.md` `## Red Flags — Stop`:

- "上次用过这个命令，不用再查 help。"
- "参数我背得出来。"
- "这个命令很常见。"
- "figma-cli 没这个能力，写个脚本就行。"

The fourth flag targets the bypass-by-script behaviour without claiming
that scripts are always forbidden — it surfaces the missing CLI
evidence that must be supplied before the fallback is allowed.

---

## 8. `references/execution.md` Command Truth Update

Replace the v1.2 Command Truth section to align with SKILL.md:

```text
## Command Truth

每个 figma-cli 会话首次使用某命令时必须按下列顺序查询，且 help
输出必须保留至会话结束：

1. figma-cli <command> --help（顶层）
2. 当命令含子命令时，figma-cli <command> <subcommand> --help
3. 当上面两步未覆盖目标子命令时，禁止执行；禁止凭旧记忆执行。

| 意图 | 必须查 help 的命令族 |
|---|---|
| 发现 | figma-cli files / canvas / find / get / inspect / spec |
| 创建 | figma-cli create / create frame / create icon / create image / create rect |
| 复用 | figma-cli instantiate / duplicate / dup / component / variants |
| 修改 | figma-cli set / set-batch / padding / gap / align / sizing / pin |
| 结构 | figma-cli node / slot / section / grid / unwrap |
| 变量 | figma-cli variables / var / collections / col / tokens / bind / theme |
| 验证 | figma-cli verify / export / lint / a11y / spec --check / inspect --json / unstack --dry-run |
| 恢复 | figma-cli undo |
| 几何 | figma-cli canvas info / canvas next |

子命令必须二次查 help（如 figma-cli create frame --help）。

非 figma-cli 运行时（node / python / pwsh / sh / 直接读 JSON / 直接
调 Figma REST API）必须按 eval/run gate 同等处理：必须先证明
figma-cli 无原生能力，并取得用户批准。唯一无需 gate 的非 CLI 路径
是 scripts/figma-validate-bounds.mjs（离线 JSON 分析）。
```

---

## 9. Validator Coverage

Add to `tests/validate-skill.mjs` a new function
`assertHelpDiscoveryGate(skill, runtimeMarkdown)`:

1. `SKILL.md` `## Non-Negotiable Rules` contains literal
   `禁止凭旧记忆、第三方文档或示例代码推断 figma-cli 命令` and
   `figma-cli 之外的运行时`.
2. `SKILL.md` contains the chapter heading `## Help Discovery Gate`.
3. `SKILL.md` Workflow 8 contains literal `figma-cli <command> --help`
   or the equivalent help-discovery phrasing.
4. `SKILL.md` Workflow 11 delivery report template contains
   `HelpEvidence`.
5. `SKILL.md` `## Red Flags — Stop` contains the literal flag
   `figma-cli 没这个能力，写个脚本就行`.
6. `references/execution.md` Command Truth decision table mentions
   subcommand second-pass (`figma-cli create frame --help` style).

---

## 10. Test Updates

No new scenarios. The behaviour is a rule-tightening that applies to
all 13 existing scenarios. The S15 variant-parity scenario from v1.2.2
inherits the help-discovery requirement at first inspect --json use.

In `tests/expected-behaviors.md` add one row to capture the help
requirement without inventing a new S14:

```text
| S2 | B | first-use help lookup confirmed for the chosen command |
```

This is added as an additional evidence cell to S2's existing row.

---

## 11. Completion Gate

PASS requires:

1. `SKILL.md` Non-Negotiable Rules appended per Section 3.
2. `SKILL.md` `## Help Discovery Gate` chapter added per Section 4.
3. `SKILL.md` Workflow 8 batch loop updated per Section 5.
4. `SKILL.md` Workflow 11 delivery report extended per Section 6.
5. `SKILL.md` `## Red Flags — Stop` extended per Section 7.
6. `references/execution.md` Command Truth rewritten per Section 8.
7. `tests/validate-skill.mjs` `assertHelpDiscoveryGate` added per
   Section 9 (6 assertions).
8. `tests/expected-behaviors.md` S2 evidence cell extended per
   Section 10.
9. `node --test tests/naming-and-workflow.test.mjs` still 10/10 PASS.
10. `node figma-skill/tests/validate-skill.mjs` PASS.
11. `tests/naming-results.md` updated to mark v1.2.3 rows.

---

## 12. Version Bump Justification

This is a **patch** (1.2.2 → 1.2.3) per the project's CLAUDE.md
minor-vs-patch rule:

- No new Workflows.
- No new mandatory fields beyond HelpEvidence (which is a delivery
  report field, not a state-machine field).
- One new chapter (`## Help Discovery Gate`).
- Existing rules tightened; no rule relaxed.

Patch is correct.

---

## 13. Out of Scope

- Caching help output across sessions (user chose context-only).
- Per-session pre-flight that auto-runs every command's --help.
- Replacing `figma-cli` with another tool.

---

## 14. Self-Review Checklist

- Section 3 wording uses `必须 / 禁止`, consistent with existing NNR.
- Section 3 second rule treats non-CLI runtimes as **gated fallbacks**
  (same gate as eval/run), not blanket prohibitions — consistent with
  the user's correction.
- Section 4 + 5 + 6 wire the rule into Workflow 8 and 11.
- Section 7 Red Flag 4 surfaces the missing CLI evidence instead of
  declaring scripts forbidden.
- Section 8 explicitly teaches recursive help discovery and the
  fall-through gate for non-CLI runtimes.
- Section 9 asserts are literal substrings — no false-positive risk.
- Section 10 reuses S2; no new scenario needed.
- Section 11 has 11 verifiable items, all runnable from this session.
- Version bump 1.2.2 → 1.2.3 justified per Section 12.
- Runtime exception for `scripts/figma-validate-bounds.mjs` is named
  in Non-Negotiable Rules and again in Section 8.