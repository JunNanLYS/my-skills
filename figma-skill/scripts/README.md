# scripts

`figma-skill` 自带的可执行脚本目录。**v3 起所有脚本必须用 `node scripts/<name>.mjs ...` 直接调用；`figma-cli run <file>` 通道不存在。**

## v3 状态总览

| 类别 | 数量 | 调用方式 |
| --- | --- | --- |
| **Active — 安装与离线分析** | 3 | `node scripts/<name>.mjs ...` 或 `node scripts/<name>.ps1 ...` |
| **DEPRECATED in v3（archived, do not invoke）** | 6 | 保留以备历史归档回放；禁止在 v3 任务中调用 |

## Active — 安装与离线分析工具

| 脚本 | 调用 | 用途 | 典型 Workflow |
| --- | --- | --- | --- |
| `install-figma-cli.ps1` | `node scripts/install-figma-cli.ps1` 或 `pwsh -NoProfile -File scripts/install-figma-cli.ps1` | v3 安装脚本：把 `figma-skill/bin/{figma-cli,figma-daemon}.exe` 复制到 `%LOCALAPPDATA%\figma-cli\bin\` 并写入 user PATH。幂等（SHA-256 校验），多 agent 共用同一规范化路径。 | 安装 / 升级 / 卸载 figma-cli |
| `figma-task-state.mjs` | `node scripts/figma-task-state.mjs --project <root> <subcommand>` | v2/v3 跨会话任务账本 CLI（init-project / create / checkpoint / archive / close / reflect / …）。**不**与 Figma daemon 通信、**不**调用 git。 | Workflow 0B / 7 / 11 / 12 |
| `figma-validate-bounds.mjs` | `node scripts/figma-validate-bounds.mjs <args>` | 离线 JSON 分析（无需 daemon），验证 bounds 合规 | Workflow 9 辅助 |

详见 `references/installation.md`（install 流程）、`references/state-and-recovery.md`（任务账本）、`references/validation.md`（Bounds Audit）。

### 用法速查

```bash
# 项目初始化（首次或在已有 v3 项目上重跑都安全）
node figma-skill/scripts/figma-task-state.mjs \
  --project "$PWD" init-project --default-branch main --json

# 新建任务账本
node figma-skill/scripts/figma-task-state.mjs \
  --project "$PWD" create \
  --task 20260719-checkout-responsive \
  --title "Checkout responsive states" \
  --type Modify --write-required true --json

# 检查点
node figma-skill/scripts/figma-task-state.mjs \
  --project "$PWD" checkpoint \
  --task 20260719-checkout-responsive \
  --holder session-a --json

# 归档（终态后）
node figma-skill/scripts/figma-task-state.mjs \
  --project "$PWD" archive \
  --task 20260719-checkout-responsive \
  --holder session-a \
  --expected-revision 2 \
  --terminal-status COMPLETED --json

# 关闭（ARCHIVED 后释放 lease）
node figma-skill/scripts/figma-task-state.mjs \
  --project "$PWD" close \
  --task 20260719-checkout-responsive \
  --holder session-a --json

# 自省
node figma-skill/scripts/figma-task-state.mjs \
  --project "$PWD" reflect --skill-version 3.0 \
  --output .figma/feedback/2026-07-19T22-00-00.md --json
```

### 离线 bounds 分析

```bash
node figma-skill/scripts/figma-validate-bounds.mjs \
  --parent <section_id> \
  --input <baseline.json>
```

## DEPRECATED in v3 — 历史归档回放

| 脚本 | 原用途 | v3 替代 |
| --- | --- | --- |
| `list-children.mjs` | 列出 parent 全部直接子节点 | `figma-cli read tree <id> --depth <n>` 或 `figma-cli read list`（Page 全量） |
| `inspect-geometry.mjs` | 单节点 layout / sizing / constraints | `figma-cli read nodes --nodes <id1,id2,...>`（stub：`read inspect <id>`） |
| `overlap-check.mjs` | AABB 相交矩阵（Section 级） | `figma-cli read arrange --apply`（同一 Page 上下文）+ 人工/脚本比对 |
| `page-overlap-check.mjs` | Page 直系子节点 AABB 相交矩阵 | `figma-cli read arrange --apply`（top-level 模式） |
| `apply-layout.mjs` | 两阶段 `{id, x, y}[]` 移动计划执行 | `figma-cli pos <id> --x <x> --y <y>` + `figma-cli batch ...` |
| `resize-section.mjs` | 容错收敛 Section 至 children bbox + padding | `figma-cli size <id> --width <w> --height <h>` |

> **DEPRECATED 警告**：以上脚本在 v3 任务中**禁止 invoke**。它们在 v2 依赖 `figma-cli run <file>` 通道（v3 已移除），无法工作。文件保留仅用于历史归档回放与回滚演练。

## 与 v3 主路径的关系

- v3 **主路径** = `figma-cli <group> <verb> ...`（读、写、验证、归档门禁）。
- 离线 `node scripts/<name>.mjs ...` 是补充：账本、bounds 审计、归档、自省。
- scripts/DEPRECATED 列表仅供归档回放与诊断历史 v2 任务用。

## 子目录

- `lib/` —— v2 离线账本的内部库（errors / model / validate / store 等），`figma-task-state.mjs` 依赖。

## 注意

- scripts/ 在 v3 是**支持工具**集合，不激活任何 v3 运行时行为；v3 SKILL.md 的 Workflow 0–12 仍然只通过 `figma-cli` 完成 Figma 写入。
- 数据结构、错误码、命名格式受 `figma-skill/schemas/*.schema.json` 与 `scripts/lib/task-state/{errors,model,validate}.mjs` 约束。
- 完整命令列表、`acquire` / `takeover` / `release` / `checkpoint` / `todo-add` / `todo-update` / `evidence-add` / `screenshot-add` / `validate` 等子命令行为在 `references/state-and-recovery.md` 与各自 fallback 文档中；本 README 不再展开逐子命令说明。