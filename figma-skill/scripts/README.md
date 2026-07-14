# scripts

`figma-skill` 自带的可执行脚本目录。每个脚本都通过 `figma-cli run <file>`
调用，配套 [figma-skill SKILL.md](../SKILL.md) 的 Workflow 4A / 4D /
4F / 7 / 8 / 9 阶段使用。

## 重要约定

`figma-cli run <file>` **不**透传 `--arg`，plugin sandbox 也没有
`process` / 环境变量访问。所以：

- 每个脚本的"调用入口"是文件顶部一个可编辑常量块（如
  `PARENT_ID = '1348:47'`）。
- 调用模式：**编辑常量 → run**。
- 这是 figma-cli 的事实约束，不是设计取舍。

## 脚本清单

| 脚本 | 入口常量 | 用途 | 典型 Workflow 阶段 |
|---|---|---|---|
| `list-children.mjs`     | `PARENT_ID`, `ONLY_TYPE` | 列出 parent 全部直接子节点 (id/name/type/x/y/w/h) | Workflow 7 (Baseline Capture) |
| `overlap-check.mjs`     | `PARENT_ID`, `OUTPUT_MODE` | AABB 相交矩阵，验证"0 overlap" | Workflow 9 / Workflow 10 |
| `apply-layout.mjs`      | `PLANS` 数组 | 把 `{id, x, y}[]` 移动计划应用到 Figma | Workflow 8 (Fixed-Order Execution) |
| `resize-section.mjs`    | `PARENT_ID`, `PAD_X`, `PAD_Y` | 收敛 Section / Frame 至 children bbox + padding | Workflow 8 末尾 / Workflow 9 |
| `figma-validate-bounds.mjs` | 命令行参数 | 离线 JSON 分析（无需 daemon），验证 bounds 合规 | Workflow 9 辅助 |
| `install-figma-cli.ps1` | — | Windows 安装 figma-cli | Workflow 1 |

## 用法速查

```bash
# Step 1: 读 baseline (PARENT_ID 默认为 1348:47, 顶部常量按需改)
figma-cli run scripts/list-children.mjs

# Step 2: 离线设计新排布, 生成 plan.json (人或 agent)

# Step 3: 把 plan 粘到 apply-layout.mjs 的 PLANS 常量
figma-cli run scripts/apply-layout.mjs

# Step 4: 验证零相交 (默认 JSON 输出)
figma-cli run scripts/overlap-check.mjs

# Step 5: 人读版 (顶部改 OUTPUT_MODE = 'summary')
figma-cli run scripts/overlap-check.mjs

# Step 6: 收敛 Section size (基于 children bbox + padding 80x200)
figma-cli run scripts/resize-section.mjs
```

## 输出格式速查

| 脚本 | 默认输出 | 备选 |
|---|---|---|
| `list-children.mjs`     | JSON `{parent, count, items[]}` | 改 `ONLY_TYPE` 只列特定 type |
| `overlap-check.mjs`     | JSON `{total, overlapPairs, overlaps[]}` | 顶部改 `OUTPUT_MODE = 'summary'` 走文本 |
| `apply-layout.mjs`      | JSON `{planned, applied, errors[]}` | — |
| `resize-section.mjs`    | JSON `{parent, previous, resized, padding}` 或 `error` 字段 | — |

## Plan 规模注意

`apply-layout.mjs` 的 `PLANS` 数组直接写在源文件里：

- 短 plan (≤30 节点)：直接粘到 `PLANS`，单次 run。
- 中等 plan (30-100)：分 2-3 个文件（例如 `apply-layout-batch-1.mjs`），连续 run。
- 长 plan (>100)：用同一个 `apply-layout.mjs` 模板生成多份，不要硬塞。

## 写入前硬约束（摘自 SKILL）

按 figma-skill SKILL.md §4A / §4D 几何硬性要求：

1. 写入前必须用 `list-children.mjs` 重读 parent children + 邻居 bounding box。
2. 写入后必须用 `overlap-check.mjs` 做 AABB 相交矩阵，0 相交才能进入下一批。
3. 非空 Section 禁止把 `(0, 0)` 作为默认起点（从 known baseline 起算，不要"凭印象"）。
4. 与邻居相交时按 Workflow 10 处理（≤3 修正轮）。
5. Workflow 9 必须按顺序运行 `figma-cli lint --json` → `figma-cli unstack --dry-run` → `overlap-check.mjs`，任一 FAIL 立即停止验收。

`overlap-check.mjs` 是这套硬约束的快速兑现工具，每次批量移动后必跑。

## Persistent task state helper (v2 support)

`figma-task-state.mjs` 是 v2 引入的**离线、纯本地**项目状态工具。它**不**与 Figma daemon 通信，**不**执行任何 Git 命令，也**不**触碰 `<project>/.figma/` 之外的目录。所有读写都通过 Node 标准库完成，可独立于 `figma-cli` 运行。

### 命令

| 子命令 | 作用 |
|---|---|
| `init-project` | 在 `<project>` 下创建 `.figma/`、写入 `config.json`、`index.json`、README、复制四份 schema。对完整有效的已有项目幂等；缺失或损坏文件时失败关闭且不自动修复。 |
| `create` | 新建任务账本：`.figma/tasks/<task-id>/{state.json, plan.md, todo.md, recovery.md, events.jsonl, evidence/manifest.json}`。省略 `--task` 时从标题生成 `YYYYMMDD-<title-slug>`；同标题冲突依次追加 `-02`、`-03`。 |
| `list`   | 从 `index.json` 读取任务摘要，按 `updatedAt` 升序排序（同时间则按 `taskId`）。 |
| `show`   | 返回指定 `taskId` 的 `state.json` 与 `recovery.md` 内容。 |

### 公共约定

- 每个子命令都支持 `--project <root>`（必填）和 `--json`（可选）。
- 成功时 JSON 走 stdout，错误时 JSON 走 stderr。
- `config.json`、`index.json` 和任务 `state.json` 在每次读取时均重新校验；JSON 损坏或 schema 不合法统一以 `STATE_INVALID` 失败关闭。
- 显式 `taskId` 重复属于 `STATE_INVALID`；`TASK_NOT_FOUND` 只用于 `show` 等读取不存在任务的情况。
- 退出码：`0` 成功；`2` 输入或状态非法（`STATE_INVALID` / `TASK_NOT_FOUND` / `PROJECT_NOT_INITIALIZED` / `PATH_OUTSIDE_PROJECT` / `SCHEMA_UNSUPPORTED` / `SENSITIVE_DATA_REJECTED` 等）；`1` 有效命令在执行过程中失败（`internal error`）。
- 默认输出是紧凑的纯文本（人读）；`--json` 输出 `{ ok, command, data? , error? }` 信封。
- 不打印 token、cookie、用户环境变量，只暴露任务账本内容。

### 用法速查

```bash
# 项目初始化（首次或在已有 v2 项目上重跑都安全）
node figma-skill/scripts/figma-task-state.mjs \
  --project "$PWD" init-project --default-branch main --json

# 新建任务账本
node figma-skill/scripts/figma-task-state.mjs \
  --project "$PWD" create \
  --task 20260714-checkout-responsive \
  --title "Checkout responsive states" \
  --type Modify --write-required true --json

# 列出任务
node figma-skill/scripts/figma-task-state.mjs --project "$PWD" list --json

# 查看单个任务
node figma-skill/scripts/figma-task-state.mjs \
  --project "$PWD" show --task 20260714-checkout-responsive --json
```

### 注意

- 这是 v2 **支持工具**，不是 SKILL.md 描述的运行路径的一部分，因此**不**激活任何 v2 运行时行为；v1.2.4 SKILL.md 的 Workflow 0–11 仍然只通过 `figma-cli` 完成 Figma 写入。
- 数据结构、错误码、命名格式受 `figma-skill/schemas/*.schema.json` 与 `scripts/lib/task-state/{errors,model,validate}.mjs` 约束。
