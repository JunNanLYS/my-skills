# Figma Plan 编写规范

> 生效: 所有 Step7 Plan 编写必须遵循本规范
> 配套规范: `spec-template.md`(Plan 由已通过 Step6 自审的 Spec 派生)
> 版式参考: Superpowers `writing-plans`(task / step / checkpoint 单元)

---

## 1. 用途 / 适用阶段 / 读者

- **适用阶段**: Step7(写 Plan)
- **不适用**: Step5 写 Spec(由 `spec-template.md` 规范)、Step6 自审 Spec(由 `review-spec.md` 规范)
- **读者**: 执行 Figma 修改的 AI agent 或人工操作者
- **目的**: 把已通过自审的 Spec 拆解为可逐步执行、可逐步验证的任务序列

---

## 2. 核心原则(Non-Negotiable)

1. **Plan 必须从已通过自审的 Spec 派生**: Step7 启动条件 = Spec 已通过 Step6 SubAgent 自审(见 `review-spec.md` §5)。未通过自审的 Spec 不得进入 Plan。
2. **Plan 不重复 Spec 内容**: Spec 中已有的"目标 / 验收标准 / 设计规范来源"等不复制粘贴;Plan 只写 Spec 未覆盖的执行细节(命令、文件路径、Task 拆分)。
3. **任务最小可测试单元**: 每个 Task 必须产出可独立验证的产物(节点 / 截图),不允许"搭好骨架等下一阶段填"这种空任务。
4. **每步 2-5 分钟**: 单个 Step 是 2-5 分钟动作。超过 5 分钟的 Step 必须继续拆分。
5. **Plan 不允许占位符**: 不允许 TBD / TODO / "之后再说" / "fill in"。具体命令、文件路径、参数值必须写实。
6. **Plan 不引入 commit 节奏**: Figma 修改不存在源码导出步骤,不写 `git add` / `git commit`;Task 产物只到节点 / 截图层。
7. **Plan 引用 Spec 行号而非全文**: 引用 Spec 用 `spec §X.Y 第 N 条` 形式,不得复述 Spec 段落。

---

## 3. Plan 文档结构(必填)

每份 Plan 必须包含以下章节。章节顺序固定,不得调整。

```markdown
# <任务名> Implementation Plan

> 配套 Spec: <spec 文件路径>
> 配套前置: 已通过 Step6 SubAgent 自审(`<!-- self-reviewed-by: ... verdict: PASS -->`)

## 0. 元信息
- 任务名:
- Plan 派生自: <Spec 文件路径 + Spec 版本号>
- 计划开始日期: YYYY-MM-DD
- 任务类型: <Create Component | Modify Component | Create Screen | Modify Screen | Adjust Tokens | Create Flow | Modify Flow | 多选时全部列出>
- 三页位置: <Page/Section/具体节点路径>
- 复用决策: <列出本 Plan 复用的 Component / Screen / Token 及其 NodeId / 名称>
- 估时: <X 个 Task / Y 小时>

## 1. 全局约束(Global Constraints)
- 设计规范来源: docs/FIGMA_DESIGN_SYSTEM.md §<章节号>
- 命名规则: 引用 SKILL.md 第 36-43 行 — 以功能命名,首字母大写
- 占位符白名单: 仅允许 <FRAME_NODE_ID> / <TEXT_NODE_ID> / <COMPONENT_NODE_ID> / <VARIABLE_NODE_ID> / <TASK_ID> / <NEXT_X> / <NEXT_Y>
- 验证失败轮次: 无上限(主对话就地自主修复 + 新派 SubAgent 重审,见 review-plan.md §5)
- 禁止操作: Figma MCP(任何 figma_mcp_* 调用);非白名单占位符

## 2. 文件结构预览
- 新增文件: <路径 + 用途>
- 修改文件: <路径 + 改动概述>
- 不动文件: <列出与本任务相关但不修改的文件,显式声明>

## 3. 任务拆分

### Task 1: <任务名>
**Files**:
- Create: <精确路径>
- Modify: <精确路径:行号-行号>(如有)
- Reference: <spec 章节引用,如 `spec §3.8 操作步骤 第 2 条`>
- Atomic NodeId: <本 Task 原子节点的 NodeId,截图 / 命令验收均围绕此节点>
- Test / Verify: <截图路径 + 命令验收命令>

**Step 1.1**: <2-5 分钟动作:读基线 / 写入 / 重读几何>
```bash
<精确命令,带参数>
```
预期输出: <具体产物描述>

**Step 1.2**: 命令验收(verify)
```bash
figma-cli node check overlap --parents <parent-id> --fail-on-findings
figma-cli node check containment --parent <parent-id> --recursive --fail-on-findings
figma-cli read get --node <id> fills
figma-cli read get --node <id> corner-radius
```
预期输出: check 命令退出码 0;`read get` 返回值与 spec §3.7 设计规范来源一致(背景色 / 圆角等)。任一失败 → 计入修正轮次 +1,不进入截图。`containment --recursive` 遍历 parent 每个后代并对照最近 `clipsContent=true` 祖先的边界做嵌套裁剪检测;不加 `--recursive` 只查直接子节点,会漏掉深层嵌套溢出。

**Step 1.3**: 截图 + Read
```bash
figma-cli export node <ATOMIC_NODE_ID> --output .figma/screenshot/<task-id>/<name>.png --scale 2
```
`<ATOMIC_NODE_ID>` = 本 Task 原子节点 NodeId(Create Component → 新组件;Modify Component → 被改节点;Create Screen → 新 Screen Frame;Adjust Tokens → 承载 Token 的代表节点)。**禁止**以 Section / Page / 父级 Frame 作为截图对象,会带入无关内容,无法独立验收本 Task 改动。

然后用 Read 工具读取截图,报告视觉属性(背景色 / 字号 / 圆角 / 对齐)。

---

### Task 2: <任务名>
**Files**:
...

---

## 4. 失败处理流程
- 单 Task 失败: 立即停止 Plan,记录失败 Step 编号 + NodeId + 截图路径,思考如何修复然后执行修复,继续后续 Task
- Plan 自审 FAIL: 收到 SubAgent FAIL 报告后主对话就地自主修复 + 新派 SubAgent 重审,无轮次上限(详见 review-plan.md §5),禁止把红线/普通条目抛回用户裁定
- 红线情况: spec 含 TBD / Figma MCP / 单选任务类型 / 多选无执行顺序 → 不进入 Plan 阶段,直接打回 Spec

## 5. 自检清单(Plan 提交前)
- [ ] Plan 由已通过自审的 Spec 派生(见 Step7 启动条件)
- [ ] 每个 Task 都引用 spec 章节而非复述原文
- [ ] 每 Step 都是 2-5 分钟动作
- [ ] 占位符全部白名单化
- [ ] 全局约束章节已填 FIGMA_DESIGN_SYSTEM.md 引用
- [ ] 文件结构预览已列新增 / 修改 / 不动文件
- [ ] 未引入 v3 六字段
- [ ] 未含 TBD / TODO / 占位符
- [ ] 估时与 Task 数一致
```

---

## 4. Task 拆分粒度规则

| 维度 | 规则 | 反例(过粗) | 正例(合规) |
|------|------|------------|------------|
| 范围 | 一个 Task = 一个原子交付物(节点 / 截图) | "建组件 + 实例化 + 截图" | "建组件" / "实例化" / "截图" 三 Task |
| 时长 | 2-5 分钟 / Step | "配置颜色" 跨 20 个节点无中断 | 每个节点一次设置 + 立即 read |
| 验证 | 每个 Task 末尾必须命令验收 + 截图验收 | "改完看着对就行" | `node check overlap --fail-on-findings` 退出 0 + 截图 Read 报告视觉属性 |
| 失败隔离 | 一个 Task 失败不影响其他 Task | "Task 3 依赖 Task 2 全部跑通" | 失败即停止,后续 Task 不启动 |

---

## 5. Plan 与 Spec 的衔接检查

Plan 提交前必须按下表对照 Spec 的章节,确保 1:1 覆盖:

| Spec 章节 | Plan 章节 | 覆盖确认 |
|----------|----------|---------|
| §3.1 任务类型 + 执行顺序 | §3 Task 拆分顺序 | ✅ / ❌ |
| §3.4 三页结构位置 | §0 元信息 + §2 文件结构 | ✅ / ❌ |
| §3.5 复用审计 | §0 复用决策 + §3 各 Task `Reference` | ✅ / ❌ |
| §3.7 设计规范来源 | §1 全局约束 | ✅ / ❌ |
| §3.8 操作步骤 | §3 各 Task `Step X.Y` 命令 | ✅ / ❌ |
| §3.9 命令验收(新增) | §3 各 Task `Step X.Y` `verify` 步 | ✅ / ❌ |
| §3.9 截图验收 | §3 各 Task `Test / Verify` | ✅ / ❌ |
| §3.10 失败停止条件 | §4 失败处理流程 | ✅ / ❌ |

未覆盖的 Spec 章节禁止打勾。

---

## 6. Rationalization 表

| 误区 | 对应规范 | 正确做法 |
|------|---------|---------|
| "Plan 不需要自审,直接照 Spec 做就行" | §2 第 1 条 | Step8 强制加载 `review-plan.md` 自审 Plan |
| "把 Spec 全文复制到 Plan 里省事" | §2 第 2 条 | Plan 只写执行细节,引用 spec §X.Y |
| "Step 太细反而慢" | §2 第 4 条 | 2-5 分钟 Step 是粒度上限,不是下限 |
| "失败了下个 Task 继续做" | §4 失败处理 | 失败立即停止,记录 Step 编号 + NodeId |
| "Spec 没通过自审也能写 Plan" | §2 第 1 条 | Step7 启动条件 = Spec 自审 PASS |
| "用 TODO 标记待办" | §2 第 5 条 | Plan 不允许占位符 |
| "Plan 留到执行时再细化" | §2 第 3 条 | 提交前必须含具体命令 / 文件路径 |

---

## 8. Red Flags

Plan 存在以下任一情况,Step8 自审必须 FAIL:

1. **派生自未自审的 Spec**: Spec 文件首部无 `<!-- self-reviewed-by: SubAgent ... verdict: PASS -->`
2. **复述 Spec 原文**: Plan 章节中出现 ≥ 3 行连续复制 Spec 文本
3. **占位符**: Plan 含 TBD / TODO / "之后再说" / "fill in"
4. **非白名单占位符**: 示例含 `<背景色>` `<字号>` `<待补>` 等
5. **Step 超时**: 任一 Step 预估 > 5 分钟且未拆分
6. **未引用 spec 行号**: Plan 引用 Spec 时用"如 Spec 所述"或"见 Spec",无 `§X.Y 第 N 条` 形式
7. **未含 FIGMA_DESIGN_SYSTEM.md 引用**: §1 全局约束无 `docs/FIGMA_DESIGN_SYSTEM.md §<章节号>`
8. **任务类型与 Spec 不一致**: Spec 勾选 A,B,Plan 仅覆盖 A
9. **含已废弃六字段**: Plan 正文出现 `NativeHelpChecked` 等已废弃字段门禁语言
10. **无失败处理**: §4 失败处理章节为空或缺失
11. **命令验收缺失**: 任一 Task 的 Step 序列无 `node check overlap` / `containment --recursive` / `page-overlap` 验收步骤,或裁剪检测未带 `--recursive`(只查直接子节点会漏掉深层嵌套溢出)
12. **截图对象错位**: 任何 Task 的 Step 1.3 `figma-cli export node` 的 NODE_ID 不是该 Task 的 Atomic NodeId,而是 Section / Page / 父级 Frame

---

## 9. Plan 文档头部模板(可复制)

```markdown
# <任务名> Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` or `superpowers:subagent-driven-development` to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 配套 Spec: <spec 文件路径>(已通过 Step6 SubAgent 自审)
> 计划开始日期: YYYY-MM-DD

**Goal**: <一句话,与 Spec §3.2 目标一致>

**Architecture**: <2-3 句架构描述,与 Spec 设计对齐>

**Tech Stack**: Figma + figma-cli + docs/FIGMA_DESIGN_SYSTEM.md

## 0. 元信息
- 任务名:
- Plan 派生自:
- 任务类型:
- 三页位置:
- 复用决策:
- 估时:

## 1. 全局约束(Global Constraints)
- 设计规范来源: docs/FIGMA_DESIGN_SYSTEM.md §
- 命名规则: 引用 SKILL.md 第 36-43 行
- 占位符白名单:
- 验证失败轮次: 无上限(主对话自主修复 + 新派 SubAgent 重审,见 review-plan.md §5)
- 禁止操作: Figma MCP / 非白名单占位符

## 2. 文件结构预览
- 新增文件:
- 修改文件:
- 不动文件:

## 3. 任务拆分

### Task 1: <任务名>
**Files**:
- Create:
- Reference: spec §
- Test / Verify:

**Step 1.1**:
```bash
```
预期输出:

---

```

---

## 10. 历史背景

review-plan.md 当前为空。Plan 自审规范的详细 SubAgent 派发契约、报告模板、红线检查表等将在 `review-plan.md` 中以独立规范形式落盘,与 `review-spec.md` 的结构对齐(强制 SubAgent 审查 + 逐条对照 + 红线即停)。

本规范明确不沿用旧版执行手册里的"已废弃六字段门禁"(`NativeHelpChecked` / `MissingNativeCapability` / `TargetNodeIds` / `FallbackCodeScope` / `FallbackImpact` / `GeometryReaudit`),即使原文历史背景中提及,正文也不引入该门禁语言。