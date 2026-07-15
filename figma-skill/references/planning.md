# Planning and Approval Gates

`planning.md` is the single authority for Workflow 0A / 0B discovery, the Workflow 6 write plan template, both approval gates, and Todo construction.

## Bounded Discovery (Workflow 0A)

任何写入前必须通过 `figma-cli` 只读获取当前任务需要的最小上下文：

- 当前打开文件和目标文件；
- 目标 page、Section、Frame 与直接层级；
- 相关 variables、styles、components、Component Sets、variants、instances 和 reuse handles；
- 当前尺寸、布局行为和绑定；
- 目标区域基线截图（写入到 `.figma/screenshot/<task-id>/`）。

搜索必须限定 page、parent 或 name。局部查询足够时禁止扫描整份大型文件。此阶段禁止 Figma 写入。

## Task Classification (Workflow 0B)

每个新需求先按以下规则分类，确定 task 类型：

1. 从零产出 UI → `Create`；
2. 修改已有结构 → `Modify`；
3. 只读问题排查 → `Audit`；
4. 跨文件或跨结构搬迁 → `Migrate`；
5. 仅产出 PNG / Spec 之类资产 → `Export`；
6. 选择唯一类目后必须 init `.figma/` 并 create 一个 task ledger（写入 `state.json`, `plan.md`, `todo.md`, `recovery.md`）。

`readRequired` 任务在分类阶段就标记 `writeRequired=false`，后续 Workflow 6/8/10 必须被转换校验拒绝。

## Reuse Decision

使用第一条适用路径：

1. 已有组件或 reuse handle：先 `spec`，再 `instantiate`。
2. 跨页、多状态或需要统一演进：Component 或 Component Set。
3. 同页结构相同、内容不同：先完成一份，`duplicate`，重新读取 NodeId，再逐份修改。
4. 多个完全相同且独立的节点：`render-batch`。
5. 确认没有可复用结构后才允许新建。

用户要求 N 个同类对象时必须得到 N 个独立节点。禁止把 wrapper 升级成一个组件冒充多个对象。

## Approval Gates

### Gate 1 — Design System (Workflow 2)

文档缺失或缺少当前任务规则时，必须先提出最小必要规范，说明依据、影响和范围外冲突，并等待明确批准。批准后才允许写入 Markdown。该批准禁止授权任何 Figma 写入。

### Gate 2 — Figma Write Plan (Workflow 6)

设计系统确定后，必须提交：

- 目标文件、页面、Frame 和明确边界；
- 将复用、实例化、duplicate、修改或创建的结构；
- 将修改的组件和 variables；
- 布局与响应式行为；
- 文档冲突和修正边界；
- 基线记录与批次顺序；
- 每个 `eval/run` 降级的原生命令缺失证据、代码范围和目标 NodeId；
- 验证对象与验收标准。

设计系统审批禁止满足此门禁。结构、设计系统、范围、共享组件或降级方法变化时，原批准失效。

## Workflow 6 Write Plan Template

```text
Task
  taskId
  title
  taskType
  writeRequired
  status
  currentWorkflow

Figma Write Plan
  targetFile
  page
  parent
  scope

Reuse / Create
  spec / instantiate
  duplicate / set
  render-batch

Variables / Styles
  collections
  bindings

Layout / Responsive
  layoutMode
  sizing
  breakpoints

Conflict and Scope
  in-scope fixes
  out-of-scope report

Baseline
  Workflow 7 source
  batch order

EvalRunFallback (optional)
  NativeHelpChecked
  MissingNativeCapability
  TargetNodeIds
  FallbackCodeScope
  FallbackImpact
  GeometryReaudit

Approval
  designSystem
  figmaWrite
```

`Cmd` 段仅允许引用 `references/execution.md` 已批准的入口常量；不允许在 `Cmd` 段塞入项目预设助手脚本未公开的脚本。

## Todo Construction (Workflow 4I/6)

`todo.md` 使用规范 4 行 Markdown：

```markdown
- [ ] T-001 Re-read target Section children
  - workflow: 7
  - blockedBy: []
  - evidence: []
```

- `T-001` 不可变 ID；同一 task 内 ID 唯一。
- `workflow` 字段必须对应 Workflow 1–11 数字。
- `blockedBy` 必须是同 task 内已存在的 `T-###` ID；解析器检测环并拒绝。
- `evidence` 在 Todo 完成前必须包含至少一条证据 ID（如 `EV-####`）或事件 ID（如 `E-####`）。
- 完成 Todo 必须经 `figma-task-state.mjs checkpoint` 写入 `TODO_UPDATED` 事件并更新 `state.validation` 或 `state.evidenceRefs`。

## Plan Versioning

每次审批失效（结构、规范、范围、共享组件或降级方式变化）必须创建新 plan 版本并在 `plan.md` 顶部追加：

```markdown
## Revisions
- v2 (2026-07-14T10:42:00+08:00) Replaced apply-layout.mjs path with new helper; old plan archived.
- v1 (2026-07-14T10:00:00+08:00) Initial approval.
```

旧版本不删除，新 plan 必须显式 supersede。

## Required Fields Quick Map

模板的"八段"对每段有不同最低信息密度要求。下面这张表把每个字段压成一行可被 Gate 2 / `figma-task-state.mjs validate` 一次性拒掉的最小颗粒度。任何字段缺失、含糊或与下方"缺漏时表现"匹配时，**Gate 2 一律打回**。这一节不是模板，是模板的二进制校验位。

| # | 字段 | 是否必填 | 缺漏时表现 | 修复示例 |
| --- | --- | --- | --- | --- |
| 1 | `Task.taskId` | 必填 | `figma-task-state.mjs create` 拒绝；状态无法恢复 | `T-2026-0715-001` |
| 2 | `Task.title` | 必填 | 任务账本拒绝 | `New component LoginCard with State variants` |
| 3 | `Task.taskType` | 必填，仅允许 `Create \| Modify \| Audit \| Migrate \| Export` | Workflow 6/8/10 写入校验失败 | `Create` |
| 4 | `Task.writeRequired` | 必填，`Audit \| Export` 必须 `false`，其余 `true` | 类型校验失败 | `true` |
| 5 | `Task.status` | 必填，仅枚举 `planned \| in_progress \| completed \| failed \| blocked \| needs_replan \| archived` | `validate` 拒绝 | **禁止** `APPROVED` / `PASS`，那是 Approval 段语义 |
| 6 | `Task.currentWorkflow` | 必填，整数 `1..12` | 状态机无法决定下一态 | `6` |
| 7 | `Figma Write Plan.targetFile` | 必填，绝对路径含文件名 + 文档锚（如有） | 不知道写到哪个文件 | `<Current workspace>/docs/FIGMA_DESIGN_SYSTEM.md#auth` |
| 8 | `Figma Write Plan.page` | 必填，仅 `01 Library \| 02 Screens \| 03 Flows` | 违反三页架构 | `01 Library` |
| 9 | `Figma Write Plan.parent` | 必填，Section id + name | Library 端不知道挂到哪个 Section；scope 重叠 | `10 Components / Forms (123:45)` |
| 10 | `Figma Write Plan.scope` | 必填，至少一句"做什么 + 不做什么" | 顺手改风险 | `仅新增 LoginCard Component Set；不触碰 Footer / Hover / Mobile。` |
| 11 | `Reuse / Create` 五条决策链 | 必填，给出 reason | Reuse 决策含糊；Red Flag"顺手改"命中 | `path=1, handle=Navigation/Desktop/TitleBar, reason=SubmitButton 已存在 Component` |
| 12 | `Variables / Styles.collections` | 必填，列出每个 collection 全名 | 不知道 token 来源 | `["color/brand", "spacing/semantic"]` |
| 13 | `Variables / Styles.bindings` | **对每个属性必填** | 变量绑定不可追溯；Audit 任务无法还原 | `- LoginCard.bg ← color/brand/surface` |
| 14 | `Layout / Responsive.layoutMode` | 必填，`VERTICAL \| HORIZONTAL \| NONE` | 几何闸门 fail | `VERTICAL` |
| 15 | `Layout / Responsive.sizing` | 必填，每条 axis 写出 `AUTO \| FIXED` | sizing mode 缺省 | `primaryAxisSizingMode: AUTO; counterAxisSizingMode: FIXED` |
| 16 | `Layout / Responsive.breakpoints` | 多断点组件必填；单断点允许写"only N" | 响应式行为未定义 | `Web 1280 only; mobile deferred to T-2026-0715-002.` |
| 17 | `Conflict and Scope.in-scope fixes` | 必填，至少 1 条具名修改 | Gate 2 拒绝 | `仅新增 LoginCard Component Set + 联动 PrimaryButton 实例化` |
| 18 | `Conflict and Scope.out-of-scope report` | **至少 3 条具名不修项** | Red Flag 第 1 条命中；"顺手改"风险 | `- Footer 对齐 — 属 T-2026-0715-009` |
| 19 | `Baseline.Workflow 7 source` | 必填，给出命令 + 目标 id | 历史快照替代实时读取（Red Flag 第 3 条） | `figma-cli run scripts/list-children.mjs → <section_id>` |
| 20 | `Baseline.batch order` | 必填，按可执行顺序逐条（**至少 3 步**） | 写入顺序不可控；orphan / overlap 风险 | `1. 新建 LoginCard frame → 2. figma-clone ... → 3. figma-combine-as-variants` |
| 21 | `EvalRunFallback` | 不降级也要显式留位 | 不知是"有意不降级"还是"忘了写" | `# 此任务全程 figma-cli 原生命令可达，本段留空。` |
| 22 | `Approval.designSystem` | 必填，给状态 + 时间戳 + 实体 | Gate 1 状态不可审计 | `PASS at 2026-07-15T10:00:00+08:00 (Gate 1)` |
| 23 | `Approval.figmaWrite` | 必填，给状态 | Gate 2 状态不可审计 | `PENDING — 提交本 plan 等用户批准` |

判定规则：

- **必填字段全填齐** + **结构正确** ⇒ 才能进入 Gate 2 审阅；
- 任一字段缺漏或与上表"修复示例"形式偏差超过 1 处 ⇒ **直接打回**，禁止"差不多就行"；
- `EvalRunFallback` 即便不留字段也**必须**有 `# 此任务全程 figma-cli 原生命令可达，本段留空` 一行；
- `Todo`（`workflow: 7` 等）属于 Workflow 4I/6 独立交付，不在本节强制约束之内，但**第 19/20 行若缺席则 Todo 也无法正确编排**，必须先修 19/20。

## Examples

以下两节是**教学示例**（Good vs Anti），用于回答"模板字段到底要填到什么粒度才算通过 Gate 2"。它们**不是**已审批的真实 plan，**不进入 `.figma/` 任务账本**，**不**替代 `figma-task-state.mjs create` 产出的 `plan.md`。任何实际任务仍必须按上一节模板走完整 8 段，并通过用户审批。

### Good Example — Create: LoginCard with variants

任务：在 `01 Library / 10 Components / Forms` Section 下新建 `LoginCard` Component Set，含 `State=Default | Error | Disabled` 三个 variant。Web 桌面端断点 1280。

```markdown
Task
  taskId: T-2026-0715-001
  title: New component LoginCard with State variants
  taskType: Create
  writeRequired: true
  status: planned
  currentWorkflow: 6

Figma Write Plan
  targetFile: <Current workspace>/docs/FIGMA_DESIGN_SYSTEM.md#auth
  page: 01 Library
  parent: 10 Components / Forms (Section)
  scope: One Component Set on existing Section; no existing component touched.

Reuse / Create
  spec: reuse handle "Button / Primary" (existing Component) for submit button
  instantiate: drop one PrimaryButton instance into the LoginCard frame
  duplicate: not used
  render-batch: not used
  reason: SubmitButton 已存在 Component；其余 Card / TextField / ErrorText 均为新建。
          走"spec → instantiate"路径 1，不再新建按钮。

Variables / Styles
  collections: ["color/brand", "color/state-error", "spacing/semantic"]
  bindings:
    - LoginCard.bg           ← color/brand/surface
    - LoginCard.border.error ← color/state-error/600
    - Title.text             ← text-style/H3
    - ErrorText.text         ← text-style/Caption + color/state-error/700
    - SubmitButton           ← 已绑定 PrimaryButton styles（无新增）

Layout / Responsive
  layoutMode: VERTICAL
  sizing:
    primaryAxisSizingMode: AUTO   (按内容高度)
    counterAxisSizingMode: FIXED  (锁宽 360)
  itemSpacing: 16
  padding: { top: 24, right: 24, bottom: 24, left: 24 }
  breakpoints: Web 1280 only this iteration; mobile deferred to T-2026-0715-002.
  variantBehavior: variant prop "State" 切换 ErrorText 显隐、边框颜色、SubmitButton.enabled。

Conflict and Scope
  in-scope fixes: 仅新增 LoginCard Component Set；联动 PrimaryButton 的实例化。
  out-of-scope report:
    - 顺手把 Footer 也对齐——不修（属于 T-2026-0715-009）。
    - 提交按钮 hover 态颜色——不修（无对应 Token 缺失）。
    - 移动端断点——不修（已安排到 T-2026-0715-002）。

Baseline
  Workflow 7 source: figma-cli run scripts/list-children.mjs
                      → 抓 10 Components / Forms 的 child ids、type、AABB
                      → figma-cli inspect --json <section_id> 拉 Section 当前尺寸
  batch order:
    1. 新建 LoginCard frame（含三个 state 子节点，作为 variant 模板）
    2. figma-clone → State=Default 副本 → 改 Error 文案与边框颜色
    3. figma-clone → State=Disabled 副本 → set SubmitButton.enabled=false
    4. figma-combine-as-variants 合并三个 component
    5. list-children 再读一次 NodeId，验证三个 variant child ids 已生成

EvalRunFallback
  # 此任务全程 figma-cli 原生命令可达，本段留空。
  # 若后续发现 textAutoResize 需调整，会另开 T-2026-0715-003 并补六字段。

Approval
  designSystem: APPROVED at 2026-07-15T10:00:00+08:00 (Gate 1)
  figmaWrite:   PENDING — 提交本 plan 等用户批准 (Gate 2)
```

对照模板的 8 段检查项：

| 模板字段 | 示例里出现的位置 | 通过原因 |
| --- | --- | --- |
| targetFile/page/parent/scope | Figma Write Plan | 全部给出，无歧义 |
| Reuse 五条决策链 | Reuse / Create → reason | 显式选了路径 1（spec+instantiate），未新建按钮 |
| Collections + Bindings | Variables / Styles | 列出每个颜色 token 和 text style 的来源 collection |
| Layout/Responsive | Layout / Responsive | layoutMode、sizing、padding、breakpoints 全部显式 |
| in-scope / out-of-scope | Conflict and Scope | 三条不修项都点名（顺手改 footer / hover 色 / mobile）|
| Baseline + batch order | Baseline | Workflow 7 用哪个命令 + 5 步批次顺序写出 |
| EvalRunFallback | （留空 + 说明） | 显式声明本任务不降级；后续若降级另开任务 |
| Approval 两段 | Approval | Gate 1 / Gate 2 分别给出状态，未串批 |

### Anti-Example — same task, four common plan bugs

下面这份"plan"乍看齐了 8 段标题，但每一段都至少有一个违反 Red Flag 或模板硬约束的错。逐段标红并给出修正方向。

```markdown
Task
  taskId: T-logincard-001               ← OK
  title: add login card                 ← 语义弱，但未违规

Figma Write Plan
  targetFile: 当前打开的文件           ← 模糊，禁止
  page: Library                          ← 01 Library 必须带前缀
  parent: 顶部                           ← 没指明 Section，违反 scope 边界
  scope: 整个 Library Page                ← Red Flag:超出 scope 顺手改

Reuse / Create
  spec: 用现有的组件                     ← 没指明哪个组件，没走 5 条决策链
  instantiate: 嗯，按需                  ← "按需"是主观判断；必须给具体 node id

Variables / Styles
  collections: 主题相关                   ← 没有 collection 名字
  bindings: 颜色和间距                   ← 没列具体 token 名 → Variables 模糊

Layout / Responsive
  layoutMode: auto                        ← 禁止用弱措辞；必须 HORIZONTAL/VERTICAL/NONE
  sizing: 自适应                          ← sizing 模式未指定，违反 geometry-verifier 闸门
  breakpoints: 看看                       ← 无具体断点值

Conflict and Scope
  in-scope fixes: 所有我能看到的         ← 主观判断 = 顺手改
  out-of-scope report: 反正先不管         ← 必须列出具体不修项

Baseline
  Workflow 7 source: 上次看到的位置       ← 历史快照替代实时读取（Red Flag）
  batch order: 先做完再说                ← 顺序未写

EvalRunFallback
  # 我打算跑一段 node 来加 token         ← 违反 hard rule
                                          （缺 NativeHelpChecked / MissingNativeCapability）
                                          Red Flag: 凭旧记忆推断命令

Approval
  designSystem: 应该没问题                ← 未实际审批
  figmaWrite: 等用户审                    ← OK
```

每个错对应的修正方向：

1. **targetFile / page / parent / scope 模糊** → 全部用绝对路径 + 已存在的 Section id；scope 限定到"仅新增 LoginCard Component Set，不动 Footer / Hover / Mobile"。
2. **复用决策含糊** → 按 Reuse Decision 五条决策链选一条，给出具体 handle 名（`Button/Primary`）和 node id（`123:45`）。
3. **Variables / 布局描述含糊** → collections 必须用 `color/brand` 这种斜杠命名；binding 必须 `LoginCard.bg ← color/brand/surface` 这种「属性 ← token」格式；layoutMode 不允许 `auto`。
4. **超出 scope 顺手改** → in-scope 列具体节点集；out-of-scope 至少 3 条命名的"不修项"，包括顺手改 footer 的诱惑。
5. **EvalRunFallback 缺六字段直接上 node** → 不允许；必须先 `figma-cli <command> --help` 列 `NativeHelpChecked`，再列 `MissingNativeCapability`，然后才填 `TargetNodeIds / FallbackCodeScope / FallbackImpact / GeometryReaudit`；否则改用原生命令或拒绝执行。
6. **Baseline 来源是历史快照** → 必须在 Workflow 7 用 `figma-cli run scripts/list-children.mjs` 或 `figma-cli inspect --json <id>` 实时拉；Red Flag 第 3 条同等适用。

把 Good Example 视为可审批的最低信息量；只要任何一段接近 Anti Example 的措辞，Gate 2 直接打回。

### Anti-Example — Real News Screen 1 期 (CREATE, 1 屏 + 13 组件)

下面这份是真实任务规划原文（已通过用户批准但缺失模板字段）。保留它作为 P0 级别反例：在一个看起来完整的 Plan 后面隐藏了 17 个违反模板字段的硬缺漏。

```markdown
Task id: 20260715-news-screen-overview
Type: Create
writeRequired: true
Status: APPROVED (Workflow 6)
Updated: 2026-07-15T12:36:12.753Z

## Goal
…（略，意图完整）……
## 范围
- Section "News" at (3440, 80), 1480×980
…
- 13 News Library 组件
## 设计基线
- 全部遵守 docs/FIGMA_DESIGN_SYSTEM.md v1.5
…
## 复用决策
- REUSE: TitleBar, NavItem
- BUILD: 13 News 专用组件
## 降级
- 不使用 eval/run
- 不引入新 Design Tokens
## 验证
- overlap-check.mjs (Section 内 0 overlap)
…
## Approval
- DesignSystemGate: PASS
- WritePlanGate: PASS
```

逐条对照"必填字段清单"标记：

| # | 字段 | 缺失/错误 | 严重度 |
| --- | --- | --- | --- |
| 5 | `Task.status` | 写了 `APPROVED`（不是枚举值） | P0 |
| 6 | `Task.currentWorkflow` | 没写 `Workflow 6` 是叙述，不是字段值 | P0 |
| 7 | `Figma Write Plan.targetFile` | **缺失**——多个 figma 文件并存时无法定位 | P0 |
| 9 | `Figma Write Plan.parent` | Library 端未指明 Section 父节点，只说"全套新建" | P0 |
| 11 | Reuse 五条决策链 | 只写"REUSE/BUILD"，未选哪条路径、reason | P0 |
| 12-13 | Variables.collections + bindings | **整段缺失** | P0 |
| 14-16 | Layout/Responsive 粒度 | 仅 Section/Screen 级，13 个组件的 `layoutMode/sizing/breakpoints` 全部缺失 | P0 |
| 18 | out-of-scope | 暗示"不续屏"，但无具名不修项 | P0 |
| 19-20 | Baseline.source + batch order | **整段缺失** | P0 |
| 21 | EvalRunFallback | 写到"降级"段，没按模板留位或六字段 | P0 |
| 23 | Approval.figmaWrite | 写了"PASS"，但无时间戳 | P1 |
| - | `Todo` 工单 T-### | **整段缺失** | P0 |

软不足（P1）：

- 复用组件 `TitleBar / NavItem` 没给节点 id，`figma-cli run scripts/list-children.mjs` 时无法瞬时定位 instance source。
- `AISummaryHero` 列"3 状态"但 Plan 未说明是 Component Set 还是 3 个独立 Component；`NewsTabs` 同理。
- `NewsListItem` 与 `NewsCard` 关系未说明（行卡 vs Hero 卡）——靠执行员临场判定违反"决策必须在 Plan 里做完"原则。
- `NewsList × N` 缺 N 实际取值。
- `NewsContent` 自创术语"主 Composite"——Figma 原生是 Frame / Component Set，需明确。
- `Status: APPROVED` 用了 UTC（`Z`），模板示例用 `+08:00` 偏移；非致命但跨任务聚合易出错。

按修复后的版本应补齐：

```markdown
Task
  taskId: T-2026-0715-news-001
  title: News 1 期 — 1 屏 + 13 组件
  taskType: Create
  writeRequired: true
  status: planned
  currentWorkflow: 6

Figma Write Plan
  targetFile: <Current workspace>/docs/FIGMA_DESIGN_SYSTEM.md#news
  page: 02 Screens
  parent: News Section (3440, 80, 1480×980)
  scope: 1 屏 + 13 News Library 组件；不续屏、不改 Footer、不动 Home/Portfolio。

Reuse / Create
  spec / instantiate: TitleBar (12:34), NavItem (12:35) → 实例化到 Screen 顶端
  Component Set: AISummaryHero = {Generating | Done | None}, NewsTabs = {Holdings | News | Earnings | Research}
  duplicate: 不使用（Screen 仅 1 个）
  reason: 顶部导航 + 侧栏已有完整 Component；其余内容组件为 News 一期专用。

Variables / Styles
  collections: ["color/brand", "color/state-error", "spacing/semantic", "text-style/default"]
  bindings:
    - NewsCard.bg         ← color/brand/surface
    - NewsCard.border     ← color/brand/divider
    - ErrorTopicTag.fg    ← color/state-error/700
    - AISummaryHero.text  ← text-style/H3
    …（每个属性至少一条）

Layout / Responsive
  - Section 1440×980 only this iteration.
  - Screen 1440×900, MainContent 1240×868, padding 32.
  - NewsListItem: VERTICAL AUTO, itemSpacing=12, primaryAxisSizingMode=AUTO, counterAxisSizingMode=FIXED, width=596.
  - NewsCard: HORIZONTAL FIXED 320, padding 16.
  - 13 个组件 layout/sizing 逐条列出。

Conflict and Scope
  in-scope: 1 屏 + 13 组件 + 顶部/侧栏实例化。
  out-of-scope:
    - Footer 对齐（T-2026-0715-009）。
    - Submit Button hover 态色（无 Token 缺失；保持现状）。
    - 移动端断点（已安排 T-2026-0715-002）。

Baseline
  Workflow 7 source: figma-cli run scripts/list-children.mjs → <section_id>; figma-cli canvas next 拉真实 (x,y)
  batch order:
    1. figma-cli canvas next → 拿 Section 放置坐标
    2. 在 01 Library / 10 Components / Forms 建 Content/News/* 13 个 component（按 data-display → input → feedback 顺序）
    3. figma-cli run scripts/list-children.mjs → 重新读新建 component 的 node ids
    4. 在 02 Screens / News Section 内建 Screen + 实例化 TitleBar / NavItem + 嵌入 Content/News/* 13 个
    5. figma-cli run scripts/inspect-geometry.mjs 校验 1240×868

EvalRunFallback
  # 此任务全程 figma-cli 原生命令可达，本段留空。

Todo（最简版）：
- [ ] T-001 Pull baseline geometry via list-children.mjs
  - workflow: 7
  - blockedBy: []
  - evidence: []
- [ ] T-002 Build 13 components in Library
  - workflow: 8
  - blockedBy: ["T-001"]
  - evidence: []
- [ ] T-003 Build Screen + assemble in News Section
  - workflow: 8
  - blockedBy: ["T-002"]
  - evidence: []
- [ ] T-004 Run overlap-check + page-overlap-check
  - workflow: 9
  - blockedBy: ["T-003"]
  - evidence: []
- [ ] T-005 Geometry audit 1240×868 + AISummaryHero 三态
  - workflow: 9
  - blockedBy: ["T-003"]
  - evidence: []
- [ ] T-006 Visual confirm screenshot
  - workflow: 10
  - blockedBy: ["T-004", "T-005"]
  - evidence: []

Approval
  designSystem: PASS at 2026-07-15T12:00:00+08:00 (Gate 1)
  figmaWrite:   PASS at 2026-07-15T12:36:12+08:00 — 用户在 AskUserQuestion 明确批准 (Gate 2)
```

教学结论：原文看起来"已经 APPROVED 通过"，但把 `Task.status=APPROVED` 这样的字段值混进 status 是 validate 直接拒的；变量绑定、Baseline、Todo、out-of-scope、targetFile、parent 全空——任何一个被 Gate 2 严格 review 都会打回。把这份反例 + "Required Fields Quick Map" 对照看，能避免下次再写 17 处硬缺漏。