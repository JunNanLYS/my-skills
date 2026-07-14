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
| `apply-layout.mjs`      | `PLANS`, `TASK_ID`, `BASELINE_REVISION` | 两阶段（preflight + apply with rollback）`{id, x, y}[]` 移动计划执行器。常量由 Workflow 6 CommandPlan 注入。返回 `{ok, code, summary, issues, observedAt, planned, applied, errors}` | Workflow 8 (Fixed-Order Execution) |
| `resize-section.mjs`    | `PARENT_ID`, `EXPECTED_PARENT_TYPE`, `PAD_X`, `PAD_Y`, `TASK_ID`, `BASELINE_REVISION` | 容错收敛 Section / Frame 至 children bbox + padding。校验容器类型、拒绝负坐标。返回 `{ok, code, summary, issues, observedAt, parent, previous, resized, padding}` | Workflow 8 末尾 / Workflow 9 |
| `inspect-geometry.mjs` | `NODE_ID` | 单节点 layout / sizing / constraints / absoluteBoundingBox | Workflow 7 |
| `page-overlap-check.mjs` | `PAGE_ID` | 当前 Page 直系子节点 AABB 相交矩阵 | Workflow 9 |
| `figma-validate-bounds.mjs` | 命令行参数 | 离线 JSON 分析（无需 daemon），验证 bounds 合规 | Workflow 9 辅助 |
| `install-figma-cli.ps1` | — | Windows 安装 figma-cli（含 InstallRoot 与 SHA-256 校验） | Workflow 1 |
| `figma-task-state.mjs` | `--project`, `--task`, `--session` 等 | v2 离线任务账本 CLI | Workflow 0B / 2 / 7 / 11 |

## Workflow 6 CommandPlan 注入 (apply-layout / resize-section)

`apply-layout.mjs` 和 `resize-section.mjs` 顶部的常量块包含空默认值：

| 常量 | 脚本 | 用途 |
|---|---|---|
| `TASK_ID` | 两者 | 任务标识，Workflow 6 注入 |
| `BASELINE_REVISION` | 两者 | baseline 版本戳，Workflow 6 注入 |
| `PARENT_ID` | `resize-section.mjs` | 待调整的容器节点 ID |
| `EXPECTED_PARENT_TYPE` | `resize-section.mjs` | 容器类型校验 (如 `"SECTION"`) |
| `PAD_X`, `PAD_Y` | `resize-section.mjs` | 收缩 padding (px) |
| `PLANS` | `apply-layout.mjs` | `[{id, expectedParentId?, expectedX?, expectedY?, x, y}]` |

Workflow 6 的 CommandPlan 阶段负责注入这些值并在用户审批后执行。**审批未通过则不执行写入。**

## 用法速查

```bash
# Step 1: 读 baseline
figma-cli run scripts/list-children.mjs

# Step 2: 离线设计新排布 (人或 agent)

# Step 3: Workflow 6 CommandPlan 注入 PLANS 后执行
figma-cli run scripts/apply-layout.mjs

# Step 4: 验证零相交
figma-cli run scripts/overlap-check.mjs

# Step 5: 人读版 (顶部改 OUTPUT_MODE = 'summary')
figma-cli run scripts/overlap-check.mjs

# Step 6: Workflow 6 注入 PARENT_ID / PAD_X / PAD_Y 后收敛 Section size
figma-cli run scripts/resize-section.mjs
```

## 输出格式速查

| 脚本 | 默认输出 | 备选 |
|---|---|---|
| `list-children.mjs`     | JSON 信封 `{ok, code, summary, issues, observedAt, parent, count, items[]}` | 改 `ONLY_TYPE` 只列特定 type |
| `overlap-check.mjs`     | JSON 信封 `{ok, code, summary, issues, observedAt, total, overlapPairs, overlaps[]}` | 顶部改 `OUTPUT_MODE = 'summary'` 走文本 |
| `apply-layout.mjs`      | JSON 信封 `{ok, code, summary, issues, observedAt, planned, applied, errors[]}` | — |
| `resize-section.mjs`    | JSON 信封 `{ok, code, summary, issues, observedAt, parent, previous, resized, padding}` | — |

## 通用信封结构

**所有 Figma 侧脚本** (read + write) 返回统一的 JSON 信封：

| 字段 | 类型 | 说明 |
|---|---|---|
| `ok` | boolean | 操作是否成功。`false` 表示 preflight / apply / resize 任一失败 |
| `code` | string | 机器可读的状态码（如 `OK`, `EMPTY_PLANS`, `NODE_NOT_FOUND`） |
| `summary` | object | 摘要信息，含 `taskId`, `baselineRevision` 等 |
| `issues` | array | `{severity, message, nodeId?}` 结构，含 error / warning / limitation |
| `observedAt` | null | 保留字段，始终为 `null`（plugin 环境无 `Date.now()`） |

此外各脚本保留自己的**传统兼容字段**（见上表 "默认输出"）。

## 重要：写入脚本的 fail-closed 语义

`apply-layout.mjs` 和 `resize-section.mjs` 遵循 "fail-closed" 原则：

- **`ok=true` 是唯一成功信号**。脚本执行完成（无异常 throw）**不**表示 `ok=true`。调用者必须检查 `ok` 字段，而不是依赖脚本是否返回或是否输出 JSON。
- **Preflight（apply-layout）**：写入前验证每一条 plan。任一验证失败立即返回 `ok=false`，**零写入**。
- **Preflight 检查项**：空 PLANS / 重复 ID / 非有限坐标 / 节点不存在 / parent 不匹配 / 预期坐标漂移。
- **Apply with rollback（apply-layout）**：按序写入。任一节点写入失败，反向回滚已写入的节点。回滚全部成功返回 `APPLY_FAILED`，回滚自身失败返回 `APPLY_ROLLBACK_FAILED`（此时部分节点可能处于已修改状态）。
- **Fail-closed（resize-section）**：校验 `PARENT_ID` 非空、节点存在、容器类型匹配、children 非空、无负坐标、padding 合法。任一校验失败立即返回 `ok=false`。`resize()` 异常不会被静默捕获为成功。
- **状态码 (`code`)** 反映具体失败原因，`errors[]` 包含人读的错误详情。`issues[]` 列出结构化问题条目。

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
| `archive` | 归档一个已到达终态的任务：写入 `final-summary.md`、删除 `.figma/screenshot/<task-id>/`、移除 lease。失败时设置 `ARCHIVE_FAILED` 并保留 lease 供诊断。 |
| `close`   | 关闭一个已归档（`archiveStatus=ARCHIVED`）的任务：移除 lease 文件。对非 `ARCHIVED` 状态返回 `ILLEGAL_TRANSITION`。 |

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

# 归档一个已完成的任务（需要 lease、已审查截图、可用的 visual summary）
node figma-skill/scripts/figma-task-state.mjs \
  --project "$PWD" archive \
  --task 20260714-checkout-responsive \
  --holder session-a \
  --expected-revision 2 \
  --terminal-status COMPLETED --json

# 关闭一个已归档的任务（移除 lease）
node figma-skill/scripts/figma-task-state.mjs \
  --project "$PWD" close \
  --task 20260714-checkout-responsive \
  --holder session-a --json
```

### archive 命令详情

`archive` 要求任务处于**终态**（`FAILED` / `CANCELLED` / `COMPLETED` / `SUPERSEDED`），且 `archiveStatus` 必须为 `NOT_ARCHIVED`。非终态（`BLOCKED` / `STALE` / `NEEDS_REPLAN` 等）返回 `ILLEGAL_TRANSITION`。

**前置条件：**
- 任务持有 lease（holder 参数匹配）
- `expectedRevision` 与当前 state revision 一致（否则返回 `REVISION_CONFLICT`）
- 所有截图已审查（`manifest.json` 中每个 entry 的 `reviewed` 必须为 `true`）
- `state.validation.visual.summary` 非空

**四阶段流程：**
1. `NOT_ARCHIVED` → `ARCHIVING`：原子写入状态 + index + 事件（file transaction + rollback）
2. 生成 `final-summary.md`（纯计算，不写盘）
3. 写入 summary + 删除 `screenshot/<task-id>/` 目录
4. `ARCHIVING` → `ARCHIVED`：原子写入终态 + index + 事件；移除 lease

**截图隔离：**
- 只删除 `.figma/screenshot/<task-id>/` 整个目录
- 其他任务的截图目录不受影响
- 删除后确认零残留

**失败恢复：**
- 阶段 2–4 的任意失败均设置 `archiveStatus=ARCHIVE_FAILED`，保留 lease 供诊断
- 发出 `ARCHIVE_FAILED` 事件
- 不会错误删除其他任务的数据
- 不产生 `TASK_ARCHIVED` 事件

### close 命令详情

`close` 必须在任务已归档（`archiveStatus=ARCHIVED`）时才能成功。成功时移除 lease 文件。对 `ARCHIVE_FAILED` 或 `ARCHIVING` 状态返回 `ILLEGAL_TRANSITION`。

## 注意

- 这是 v2 **支持工具**，不是 SKILL.md 描述的运行路径的一部分，因此**不**激活任何 v2 运行时行为；v2 SKILL.md 的 Workflow 0–11 仍然只通过 `figma-cli` 完成 Figma 写入。
- 数据结构、错误码、命名格式受 `figma-skill/schemas/*.schema.json` 与 `scripts/lib/task-state/{errors,model,validate}.mjs` 约束。
- 完整命令列表、acquire / takeover / release / checkpoint / todo-add / todo-update / evidence-add / screenshot-add / validate 等子命令行为在 `references/state-and-recovery.md` 与各自 fallback 文档中；本 README 不再展开逐子命令说明。
- 详见 `references/execution.md` 的 offline state helper 段。
