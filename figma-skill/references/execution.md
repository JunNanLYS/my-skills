# Approved Execution (Workflow 6 / 7 / 8)

## Pre-Write Baseline (Workflow 7)

修改或扩展前必须记录目标及直接依赖的 NodeId、name/type/parent、位置与尺寸、Auto Layout、约束、关键绑定、目标区域截图和当前批次节点清单。所有数据来自 `figma-cli read list`（Page 全量 flat snapshot）、`figma-cli read tree <id>`（Parent 子树）、`figma-cli read nodes --nodes <id1,id2,...>`（按 ID 拉快照），不得使用历史快照替代实时读取。

## Singular Environment Order (Workflow 1)

每个新 figma-cli 会话必须按下列顺序执行：

```text
figma-cli --version
figma-cli --help
figma-cli daemon status
  若 connected-to-figma 且 daemon-running → 直接进入下一步
  否则 figma-cli connect (不传 --safe / --no-restart / --no-patch，除非用户明确批准) 后再 daemon status 一次
```

任何后续 `figma-cli <command> --help` 或 `figma-cli <group> <verb> --help` 输出必须保留到 Workflow 11 交付报告。

## Command Truth

每个 figma-cli 会话首次使用某命令时必须按下列顺序查询，且 help 输出必须保留至会话结束：

1. `figma-cli --help`（顶层）
2. `figma-cli <group> --help`（子命令组，如 `read`、`create`、`design`）
3. `figma-cli <command> [<subcommand>] --help`（具体动作，如 `figma-cli read inspect --help`、`figma-cli create autolayout --help`）
4. 上面三步未覆盖目标动作时，禁止执行；禁止凭旧记忆执行。

非 figma-cli 运行时（node / python / pwsh / sh / 直接读 JSON / 直接调 Figma REST API）必须按 eval gate 同等处理：必须先证明 figma-cli 无原生能力，并取得用户批准。唯一无需 gate 的非 CLI 路径是 `node scripts/figma-validate-bounds.mjs`（离线 JSON 分析）和 `node scripts/figma-task-state.mjs`（离线任务账本）。

## Unified `eval` Contract

只有当 CommandPlan 的 `EvalRunFallback` 段提供六个事实字段且用户批准时才允许使用 `figma-cli eval <CODE>`：

1. `NativeHelpChecked` —— 已检查的 figma-cli 顶层 / 子命令帮助文本；
2. `MissingNativeCapability` —— 已检查的最接近意图子命令帮助及其确实缺少该能力；
3. `TargetNodeIds` —— 降级影响的 NodeId 列表；
4. `FallbackCodeScope` —— 降级代码的精确范围；
5. `FallbackImpact` —— 影响半径；
6. `GeometryReaudit` —— 几何再校验方式（必须重新执行对应 Geometry-aware Commands 闸门）。

`figma-cli eval <CODE>` 禁止跨任务共享临时变量；完成后必须重读受影响节点并完整验证。

## Geometry-aware Commands

> **v3 当前命令面（按 `bin/figma-cli.exe --help` 实际输出为准）**：native 命令仅 `read {find,get,inspect,tree,list,select,arrange,canvas,nodes}` 与 `pos / size / scale / rotation / name / fill / stroke / radius / shadow / blur / corners / stroke-weight / constraints / opacity / effect / blend-mode / text`；`create {frame,rect,ellipse,text,line,group,autolayout,component,instance,slot,icon,image,shape,to-component,preset,prop,instantiate}`；`design {collections,variables,tokens,bind,bind-batch,bindings,sizing}`；`eval <CODE>`；`daemon {status,start,stop,restart,reconnect,diagnose,restart-figma}`；`connect / disconnect / patch / unpatch / batch / export`。命令面仍在迭代，使用前**必须**先 `figma-cli <group> --help` 与 `figma-cli <group> <verb> --help`。

| 需要 | 命令 |
| --- | --- |
| Page 全量 flat snapshot | `figma-cli read list` |
| Page 当前 canvas summary | `figma-cli read canvas` |
| 按 name 查找节点 | `figma-cli read find <PATTERN>` |
| Parent 子树遍历（stub, 关注实现进度） | `figma-cli read tree <id> --depth <n>` |
| 单节点 curated property | `figma-cli read get <id> <property>` |
| 单节点完整快照（per-id snapshot） | `figma-cli read nodes --nodes <id1,id2,...>` |
| 单节点 inspect（stub, PR4 实现） | `figma-cli read inspect <id>` |
| Top-level 同位坐标检测 | `figma-cli read arrange --dry-run` |
| Top-level / 当前 Page AABB 整理（apply 模式） | `figma-cli read arrange --apply` |
| Section / Frame 内 AABB 整理（apply 模式） | `figma-cli read arrange --apply`（在同一 Page 上下文下运行） |
| 单节点定位 / 尺寸 / 重命名 / 旋转 | `figma-cli pos\|size\|scale\|rotation\|name <id> --...` |
| 单节点填充 / 描边 / 圆角 / 阴影 / 模糊 | `figma-cli fill\|stroke\|radius\|shadow\|blur <id> --...` |
| Component / Variant / Instance | `figma-cli create component create\|property` + `figma-cli create instance` |
| Design tokens / variables | `figma-cli design variables list\|find\|create\|set\|show` |
| Variable 绑定 | `figma-cli design bind <ref> --to <node>` |
| Auto layout sizing | `figma-cli design sizing hug\|fill\|fixed <id> --axis h\|v` |
| 批量写入 / 撤销（如暴露） | `figma-cli batch ...` |
| **Gate 1 文件级 lint（v3 暂未原生实现）** | 用 `figma-cli read canvas` + `figma-cli read list` + `figma-cli read nodes --nodes <id1,...>` 收集页面与目标节点状态，人工/工具审查；待后续 PR 提供 `figma-cli lint` 后替换。**禁止**捏造 lint 子命令。 |
| **画布下个非重叠坐标（v3 暂未原生实现）** | 由执行者基于 `figma-cli read list` 输出 AABB 自行计算 next 坐标；待后续 PR 提供 `canvas next` 后替换。 |

调用项目预设助手脚本的旧通道 `figma-cli run <file>` 已不存在；scripts/ 下 .mjs 仅两个离线分析工具可调：

- `node scripts/figma-task-state.mjs ...`（离线任务账本，详见后文）；
- `node scripts/figma-validate-bounds.mjs ...`（离线 JSON 分析，详见 `references/validation.md`）。

其余 `scripts/{list-children,overlap-check,page-overlap-check,inspect-geometry,apply-layout,resize-section}.mjs` 在 v3 已退役；物理保留以备历史归档回放，**禁止在 v3 任务中 invoke**。

## Offline State Helper

`scripts/figma-task-state.mjs` 是 v2 引入、v3 沿用的**离线、纯本地**项目状态工具。它**不**与 Figma daemon 通信，**不**执行任何 Git 命令，也**不**触碰 `<project>/.figma/` 之外的目录。所有读写都通过 Node 标准库完成，可独立于 `figma-cli` 运行（`node scripts/figma-task-state.mjs ...`）。CommandPlan 的 `Cmd` 段可以引用以下子命令，调用前必须先 `init-project` 并 create 对应 task：

| 子命令 | 用途 |
| --- | --- |
| `init-project` | 创建 `.figma/`，写入 `config.json` / `index.json`，复制 schema |
| `create` | 新建 task ledger（state.json / plan.md / todo.md / recovery.md / events.jsonl / evidence/manifest.json） |
| `list` | 从 index 读摘要 |
| `show` | 输出 `state.json` + `recovery.md` |
| `acquire` / `renew` / `takeover` / `release` | 任务 WRITE 租约 |
| `checkpoint` | 修订号校验 + 状态/事件/state/index/recovery/lease 事务 |
| `todo-add` / `todo-update` | 解析 4 行 Markdown Todo 并写 `TODO_UPDATED` |
| `evidence-add` | SHA-256 + redaction + manifest 写入 |
| `screenshot-add` | `.figma/screenshot/<task-id>/` 截图元数据 |
| `validate` | 全 `.figma/` 只读一致性验证 |
| `archive` | 终态压缩归档（删除截图、压缩 evidence、生成 final-summary.md） |
| `close` | 仅在 `ARCHIVED` 时释放租约 |

## Small-Batch Loop

每批固定执行：

1. 用 `figma-cli read ...` 读取目标状态；
2. 用 `figma-cli pos / size / fill / stroke / ...` 或 `figma-cli batch` 完成最小相关写入；
3. 用 `figma-cli read inspect / read list` 重新读取受影响节点；
4. 用 `figma-cli read arrange --apply` 与 `figma-cli read canvas` / `read nodes --nodes <id1,...>` 检查结果；
5. 正确后才进入下一批。

在 duplicate、reparent、unwrap、组件化、组合 variants、删除重建或大幅层级调整后，必须重新读取 NodeId 和几何再写入。通用定义必须放在组件或 Library page，UI page 消费实例或批准的 duplicate。禁止凭记忆重画已有组件。

## Failure and Recovery

部分成功或严重偏差必须停止后续批次。Rust CLI 的写入动作（`pos` / `size` / `fill` 等）目前**不**暴露 `undo`；partial-failure 时保留现场并报告。`figma-task-state.mjs` 不替代 undo；它只能记录审批痕迹与事件，撤销仍由人工 + Figma 版本历史处理。