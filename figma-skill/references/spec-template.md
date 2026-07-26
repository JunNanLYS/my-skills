# Figma Spec 编写规范 v0.1.1

> 生效: 所有 Step4 Spec 编写必须遵循本规范

---

## 1. 用途 / 适用阶段 / 读者

本规范用于 **Step4（写 Spec）**，是 Skill 使用者在动手修改 Figma 前的完整操作蓝图。

- **不适用**: Plan 阶段（Plan 由 `plan-template.md` 规范）
- **读者**: 执行 Figma 修改的 AI agent 或人类读者
- **目的**: 产出一份可直接执行、无占位符、带自审清单的 Spec，确保 Step5 review-spec 能通过

---

## 2. 核心原则（Non-Negotiable）

1. **禁止占位符**: Spec 中不得出现 TBD / TODO / "等评审完再补" / "之后再说" 等任何未完成声明

**允许的占位符白名单(仅示例代码中使用)**:
- `<FRAME_NODE_ID>` / `<TEXT_NODE_ID>` / `<COMPONENT_NODE_ID>` / `<VARIABLE_NODE_ID>`
- `<TASK_ID>`
- `<NEXT_X>` / `<NEXT_Y>`

白名单外任何占位符(包括 `<背景色>` `<字号>` `<待补>` 等)一律视为违规。占位符仅作为示例语法骨架，实际填写时必须用真实 NodeId 与 task-id 替换。
2. **禁止猜测命令**: 所有 `figma-cli` 命令必须先 `figma-cli <topic> -h` 核对参数，Spec 中标注 "通过 `figma-cli <topic> -h` 已核对参数"
3. **禁止 Figma MCP 写入**: 所有读取、写入、验证、导出、创建操作必须使用 `figma-cli`，禁止 Figma MCP
4. **必须引用 FIGMA_DESIGN_SYSTEM.md**: 所有 token 值、字号、颜色、间距必须指向 `<Current workspace>/docs/FIGMA_DESIGN_SYSTEM.md` 的具名章节，不准凭记忆填写
5. **Three-Page Architecture 必须落到具名 Page + Section**: 操作目标必须显式写明 `01 Library` / `02 Screens` / `03 Flows` 及其下的具名 Section

---

## 3. 必填章节

每份 Spec 必须包含以下全部章节。任务类型不同，章节侧重不同（详见第 4 节任务类型分支）。

### 3.1 任务类型（task type）

## 任务类型(可多选)
- [ ] Create Component
- [ ] Modify Component
- [ ] Create Screen
- [ ] Modify Screen
- [ ] Adjust Tokens
- [ ] Create Flow
- [ ] Modify Flow

### 任务执行顺序(必填)
1. <TASK_TYPE_A> → <本任务产物引用句,如 `<Task-A 产物名>`(NodeId 待填)>
2. <TASK_TYPE_B> → <上一任务产物如何被复用,如 `实例化 <Task-A 产物名>`(NodeId 占位待填)>

> 当仅勾选一项时,可保留一行说明;勾选 ≥2 项时必须按真实执行顺序填写,下游任务的输入必须显式引用上游任务的产物(NodeId / Frame / Token 名)。

### 3.2 目标与背景

```
## 目标与背景
- **目标**: <一句话说清楚要做什么>
- **背景**: <为什么要做，驱动力是什么>
- **验收标准**: <如何判断任务完成，必须可观察>
```

目标必须具体到"在哪个 Page 的哪个 Section 下新增名为 X 的组件"或"将 X 组件的 Y 属性从 A 改为 B"，不能是模糊描述。

### 3.3 非目标（Scope Negation）

```
## 非目标
- <本任务不涉及的内容，例如：不新建 Disabled 状态，不修改父级 Frame 尺寸>
```

明确边界，防止范围蔓延。

### 3.4 三页结构位置（Three-Page Architecture）

```
## 三页结构位置
- **Page**: <01 Library | 02 Screens | 03 Flows>
- **Section**: <Foundations | Components | Internal | Deprecated | 或业务域 Section 名>
- **路径**: <Page/Section/具体 Frame 或组件节点名>
```

禁止创建第四个 Page。路径必须具体到 Section 层级，不能只写 "在 Library 里"。

### 3.5 复用审计与状态变更策略（必填，勾选的所有任务类型对应章节均生效）

```
## 复用审计与状态变更策略
### 复用 Component 检索结果
| 组件名 | NodeId | 来源 Page/Section | 是否同名/同功能 |
|--------|--------|-------------------|----------------|
| ...    | ...    | ...               | ...            |

### 新建 / 修改决策
- <本任务新建哪些组件>
- <复用哪些已有组件（NodeId 如上）>
- <不新建哪些组件>

### 状态变更策略（Create/Modify Component 必填）
- <声明哪些状态以 variant / property 修改颜色等属性达成，而不是新建组件>
- 示例: "Default / Hover / Active 状态均通过同一组件 + property 覆盖颜色实现，不新建独立组件"
- 规范要求: "绝大多数情况下，状态变更应通过 variant / property 完成；只有结构差异 > 2 个层级的状态才允许新建独立组件"
```

**Create Component 任务必须先执行** `figma-cli read find` **检索 Library 内是否有同名 / 同功能 / 不同状态的现有组件**，检索结果写入本节。

**Create Flow / Modify Flow 任务的复用审计**: 必须列出 Flow 内每个节点引用的 Component / Screen(NodeId / 来源 Page/Section)。Flow 不得创建独立于现有 Component 的 inline 实现，如确需新建，需在 §3.5 新建 / 修改决策中显式声明并说明理由。

### 3.6 命名规则

```
## 命名规则
引用: SKILL.md — 以功能命名，首字母大写，子层级如 Text / Icon
示例:
  Button
    Text
  Badge
    Icon
    Text
```

不得自行发明命名规则；唯一来源是 SKILL.md。

**Flow 命名约定(必填,Create Flow / Modify Flow 任务)**:
- Flow 以业务场景命名,首字母大写,示例: `Onboarding Flow` / `Portfolio Detail Flow` / `Settings Flow`
- Flow 内部 Screen / Frame 仍以功能命名,引用 SKILL.md 第 36-43 行的"以功能命名 / 首字母大写"
- Flow 内部节点命名按"业务场景 → 屏内功能"两级结构,如 `Onboarding Flow / Welcome Screen / Continue Button`

### 3.7 设计规范来源引用

```
## 设计规范来源
| 属性 | 值 | 引用路径（FIGMA_DESIGN_SYSTEM.md） |
|------|----|--------------------------------|
| 背景色 | <token 名或 hex> | docs/FIGMA_DESIGN_SYSTEM.md §<章节号> |
| 文字色 | <token 名或 hex> | docs/FIGMA_DESIGN_SYSTEM.md §<章节号> |
| 字号   | <px 值>          | docs/FIGMA_DESIGN_SYSTEM.md §<章节号> |
| 圆角   | <px 值>          | docs/FIGMA_DESIGN_SYSTEM.md §<章节号> |
| 间距   | <px 值>          | docs/FIGMA_DESIGN_SYSTEM.md §<章节号> |
```

所有 token / 字号 / 颜色 / 间距必须给出 FIGMA_DESIGN_SYSTEM.md 的具名引用，不准写"记忆值"。

### 3.8 操作步骤

```
## 操作步骤
> 每条命令前置 "通过 `figma-cli <topic> -h` 已核对参数"

1. [前置] <读取当前状态，如 `figma-cli page current` / `figma-cli read list` 等>
   命令: `figma-cli <sub>`
   目的: <确认当前 NodeId / 几何>

2. [核心操作 A]
   命令: `figma-cli <topic> <verb> <args>`
   通过 `figma-cli <topic> -h` 已核对参数: <列出核对到的关键参数>
   目的: <做什么>

3. [duplicate / reparent / unwrap / 组件化 后]
   ⚠️ 层级或 ID 已改变，重新读取几何:
   命令: `figma-cli read list` 或 `figma-cli read canvas`
   目的: 获取最新 NodeId 和坐标，再继续写入

4. [核心操作 B]（如有）

5. [文档同步]（Adjust Tokens 任务必须填写，其他任务按需）
   ⚠️ Token 变更必须同步更新 `docs/FIGMA_DESIGN_SYSTEM.md`
   命令: <手动更新文档对应章节>
   目的: 保持文档与 Figma 实际值一致
```

每条操作必须明确写出使用的 `figma-cli` 子命令和参数，不得笼统写"使用 figma-cli design 命令"。

### 3.9 验收(命令验收 + 截图验收)

```
## 验收
> 两段式: 命令验收在前(几何 / 排布自检),截图验收在后(视觉验收)
> 命令验收不通过 → 不进入截图,直接计入修正轮次

### 3.9.1 命令验收

1. 重叠检测(parent 内):
   命令: `figma-cli node check overlap --parents <PARENT_NODE_ID> --fail-on-findings`
   通过条件: 退出码 0(findings 为空)

2. 裁剪检测(嵌套,parent 边界外,任一裁剪祖先):
   命令: `figma-cli node check containment --parent <PARENT_NODE_ID> --recursive --fail-on-findings`
   通过条件: 退出码 0(findings 为空)。`--recursive` 遍历 `--parent` 的每个后代,对照其最近 `clipsContent=true` 祖先的边界做嵌套检查;无 flag 时只查直接子节点(legacy Node 行为,不足以发现深层嵌套溢出)

3. 重叠检测(可选,page 顶层):
   命令: `figma-cli node check page-overlap --page <PAGE_NODE_ID> --fail-on-findings`
   通过条件: 退出码 0(findings 为空)

所有 check 子命令支持 `--json` 输出 JSON envelope 供解析。任一失败退出码 3 → 计入修正轮次。

4. 属性验收(可选,Token 应用验证):
   命令: `figma-cli read get --node <NODE_ID> fills` / `corner-radius` / `width` / `height` / `opacity`
   通过条件: 返回值与 spec §3.7 设计规范来源(背景色 / 圆角 / 尺寸 / 透明度)一致
   适用场景: 验证 token 应用、几何尺寸、透明度等数值属性

### 3.9.2 截图验收
> 截图必须用 `Read` 工具真实读取,禁止以截图后不读取

**截图对象 = 本 Task 产出的原子节点**(Create Component → 新组件 Component NodeId;Modify Component → 被改节点;Create Screen → 新 Screen Frame;Modify Screen → 被改区块;Adjust Tokens → 承载 Token 的代表节点;Create/Modify Flow → Flow 内目标 Screen)。
**禁止**以整个 Section / Page / 父级 Frame 作为截图对象——会带入无关内容,无法独立验收本 Task 改动。

1. 截图命令: `figma-cli export node <NODE_ID> --output .figma/screenshot/<task-id>/<name>.png`
   保存路径: `<Current workspace>/.figma/screenshot/<task-id>/`
   task-id: <任务唯一标识>
   `<NODE_ID>` = 本 Task 原子节点的 NodeId,**不是** Section / Page / 父级 Frame 的 NodeId

2. Read 工具读取截图,报告以下视觉属性:
   - 背景色: <是否与 token 定义一致>
   - 文字色: <是否与 token 定义一致>
   - 字号: <实测 px 值>
   - 圆角: <实测 px 值>
   - 内边距: <实测 px 值>
   - 对齐: <水平/垂直居中或其他>
```

### 3.10 失败停止条件

```
## 失败停止条件
- 无法完成任务: 当已经试过各种方案依旧无法完成任务时
- 停止后输出: 完整失败报告（包含所有已尝试的修正及结果）
- Spec 不准含: TBD / 待定 / 之后再说 / 占位
- 停止后报告必须包含: 受影响节点 NodeId 列表 + 失败截图（含截图路径 task-id）+ 已尝试修正的清单
- 跨任务执行时,前一任务失败不得进入后一任务;停止报告必须含前一任务的受影响 NodeId 列表 + 上一任务的失败截图（若已生成）
```

### 3.11 自检清单（Embedded Checklist）

```
## 自检清单
- [ ] 任务类型已填写，且与 Spec 实际内容一致
- [ ] 目标一句话说清楚，可被 Step5 审查者独立判断是否完成
- [ ] 非目标（Scope Negation）已填写，边界清晰
- [ ] 三页结构位置已填写 Page + Section，不含模糊路径
- [ ] 复用审计已完成（Create Component 与 Create Screen 均必填），无同名/同功能已有组件被遗漏
- [ ] 状态变更策略已填写，声明通过 variant / property 而非新建达成
- [ ] 命名规则符合 SKILL.md 第 36-43 行
- [ ] 所有 token / 字号 / 颜色 / 间距均引用 FIGMA_DESIGN_SYSTEM.md 具名章节
- [ ] 每条操作步骤均写出完整 `figma-cli <topic> <verb> <args>` 命令
- [ ] 每条操作命令均标注"通过 `figma-cli <topic> -h` 已核对参数"
- [ ] duplicate / reparent / unwrap / 组件化 后已声明重新读取几何
- [ ] 命令验收已声明:`node check overlap` / `containment` / `page-overlap` 至少 1 条,带 `--fail-on-findings`;裁剪检测必须带 `--recursive` 做嵌套检查
- [ ] 截图路径包含 task-id,截图 NODE_ID 是本 Task 原子节点（非 Section / Page / 父级 Frame）,截图后用 Read 工具真实读取
- [ ] 截图 Read 报告了颜色 / 字号 / 间距 / 对齐等视觉属性
- [ ] Token 变更任务已包含文档同步步骤
- [ ] 无 TBD / TODO / 占位符 / "等评审完再补"
- [ ] 验证失败停止条件已声明（≥3 轮停止）
- [ ] 示例/命令段中的占位符均在白名单内，无 `<背景色>` `<字号>` `<待补>` 等违规占位符
- [ ] 任务类型为多选且勾选数量与实际内容一致
- [ ] 任务执行顺序已明确写出,下游任务显式引用上游任务产物
- [ ] Create Flow / Modify Flow 已填写 Flow 命名规则
```

---

## 4. 任务类型分支要求

| 任务类型 | 必须额外覆盖 |
|---------|------------|
| Create Component | 复用审计 + 状态变更策略 + 命名规则验证 |
| Modify Component | 目标明确到具体组件 NodeId + 状态变更策略 |
| Create Screen | 三页结构位置精确 + 复用 Screen 检索 |
| Modify Screen | 目标区块 NodeId 已确认 + 改动范围枚举 |
| Adjust Tokens | 设计规范来源引用 + 文档同步步骤 + 影响范围枚举 |
| Create Flow | 复用 Screen / Component 检索 + Flow 命名 + 内部节点顺序 |
| Modify Flow | 目标 Flow NodeId 已确认 + 改动范围枚举 + 内部节点引用一致性 |

**勾选组合生效规则**: 当勾选 ≥2 项时,组合要求是"各任务类型分支要求的并集",且执行顺序必须与 §3.1 任务执行顺序子节一致。例如勾选 Create Component + Create Screen,需同时满足"Create Component 分支(复用审计 + 状态变更策略 + 命名规则验证)"与"Create Screen 分支(三页结构位置精确 + 复用 Screen 检索)"。

---

## 5. Rationalization 表

以下误区在 Spec 编写时必须主动规避：

| 误区 | 对应规范章节 | 正确做法 |
|------|------------|---------|
| "当前页就是 Components Section，直接建就行" | §3.4 三页结构位置 | 必须写明 Page + Section 完整路径 |
| "figma-cli design 命令我知道怎么用" | §3.8 操作步骤 | 每条命令必须先 -h 核对并标注 |
| "Token 值我记得，primary.500 直接写" | §3.7 设计规范来源引用 | 必须引用 FIGMA_DESIGN_SYSTEM.md 具名章节 |
| "figma-cli containment 只检查直接子节点就行,嵌套太慢" | §3.9.1 命令验收 | 裁剪检测必须 `--recursive`,对每个后代对照其最近 clipsContent 祖先的边界做嵌套检查 |
| "截图了，看起来差不多就行" | §3.9 截图验收 | 必须 Read 截图并报告具体视觉属性 |
| "截图整个 Section / Page 看一眼全貌就行" | §3.9.2 截图对象 | 截图 NODE_ID 必须是本 Task 原子节点,Section / Page / 父级 Frame 会带入无关内容 |
| "Disabled 状态等评审完再补" | §2 核心原则 / §3.10 失败停止条件 | Spec 不准含 TBD / 占位符 |
| "Token 改了就行，FIGMA_DESIGN_SYSTEM.md 以后再说" | §3.8 操作步骤 + §3.7 | 任何 token 变更必须同步更新文档 |
| "先用 MCP 快速改一下" | §2 核心原则第 3 条 | 禁止使用 Figma MCP，所有操作走 figma-cli |
| "再多改几轮总能找到对的" | §3.10 失败停止条件 | ≥3 轮失败必须停止，输出完整报告 |
| "新建一个 Default + Hover 组件" | §3.5 复用审计与状态变更策略 | 状态通过 variant / property 覆盖颜色实现，不新建独立组件 |
| "duplicate 后节点 ID 不会变" | §3.8 操作步骤（层级变更后重新读取） | 任何改变节点层级或 ID 的操作后，必须重新 read 获取最新几何 |
| "references/naming.md 文件不存在，照着其他组件命名就行" | §3.6 命名规则 | 命名规则必须引用 SKILL.md 第 36-43 行，不存在 naming.md 不影响规范适用 |
| "scripts/*.mjs 那么多，挑一个顺手的用" | 辅助脚本使用规则 | 当前仅 `scripts/figma-task-state.mjs` 与 `scripts/figma-validate-bounds.mjs` 为合法离线助手，其余已退役不得使用（当前 scripts/ 目录为空） |
| "用户要建 Screen,结果里面少组件,先去建一下" | §3.1 任务类型 + §3.1.1 任务执行顺序 | 必须在同一份 Spec 中勾选 Create Component + Create Screen,并显式列出执行顺序 |
| "Flow 就是多个 Screen 拼一起,命名随便起"   | §3.6 Flow 命名约定                | Flow 必须按业务场景命名,首字母大写;命名规则引用 SKILL.md 第 36-43 行 |

---

## 6. Red Flags

Spec 存在以下任一情况，立即打回，不进入执行阶段：

1. **含 TBD / 占位符**: Spec 中出现 "等评审完再补"、"之后再说"、"TBD"、"TODO"、"待定"
2. **无三页结构位置**: 缺少 `Page` + `Section` 完整路径，或路径模糊（如仅写"在 Library 里"）
3. **无设计规范引用**: token / 字号 / 颜色 / 间距未引用 FIGMA_DESIGN_SYSTEM.md 具名章节
4. **命令无 -h 标注**: 操作步骤中 `figma-cli` 命令未标注"通过 `figma-cli <topic> -h` 已核对参数"
5. **截图未声明 Read**: 截图验收章节未声明使用 Read 工具读取并报告视觉属性
6. **截图对象错位**: §3.9.2 截图 NODE_ID 不是本 Task 原子节点,指向 Section / Page / 父级 Frame(无法独立验收本 Task 改动)
7. **Create Component 无复用审计**: 新建组件前未检索 Library 内是否有同名 / 同功能已有组件
7. **Token 变更无文档同步**: Adjust Tokens 任务的操作步骤中缺少同步更新 `docs/FIGMA_DESIGN_SYSTEM.md` 的步骤
8. **含 Figma MCP 操作**: Spec 中出现 MCP 命令（如 `figma_mcp_*`），违反唯一写入通道原则
9. **非白名单占位符**: 示例代码中出现 `<背景色>` `<字号>` `<待补>` 等非白名单占位符，直接打回
10. **任务类型仍是单选格式**: 任务类型章节未使用 checkbox,而是用"选一"等单选语言,违反 v0.1.1 多选规则
11. **多选但无任务执行顺序**: 勾选 ≥2 项任务类型,但"任务执行顺序"子节为空或与勾选不一致

---

## 7. 示例模板

以下是一份"合格 Spec"应长什么样——所有字段真实填写，无占位符：

```markdown
# Spec: 在 01 Library / Components 新增 Tooltip Pill 浅色胶囊

## 任务类型(可多选)
- [x] Create Component
- [x] Create Screen
- [ ] Modify Component
- [ ] Modify Screen
- [ ] Adjust Tokens
- [ ] Create Flow
- [ ] Modify Flow

### 任务执行顺序(必填)
1. Create Component → 创建 Tooltip Pill,NodeId 待填
2. Create Screen → 在 02 Screens / Onboarding / Welcome Screen 中实例化 Tooltip Pill(NodeId 占位待填)

## 目标与背景
- **目标**: 在 `01 Library / Components` Section 下新增 Tooltip Pill 浅色胶囊组件，并在 `02 Screens / Onboarding / Welcome Screen` 中实例化
- **背景**: 当前 Tooltip 使用深色背景，浅色 Pill 胶囊提供更轻量的信息提示方式；Welcome Screen 需引入该组件作为说明文字载体
- **验收标准**: 截图 Read 后 Tooltip Pill 组件背景色为 `#EBF5FF`（primary.500 @ 10% 透明度）、文字色为 `#1E40AF`（primary.700）、圆角 999px、字号 14px；Welcome Screen 中可见该组件实例

## 非目标
- 不修改现有深色 Tooltip 组件
- 不新建 Disabled 状态（本组件无交互状态）
- 不在 Welcome Screen 外其他 Screen 中实例化本组件

## 三页结构位置
- **Page**: 01 Library
- **Section**: Components
- **路径**: 01 Library / Components / Tooltip Pill

## 复用审计与状态变更策略
### 复用 Component 检索结果
| 组件名 | NodeId | 来源 Page/Section | 是否同名/同功能 |
|--------|--------|-------------------|----------------|
| Tooltip Pill | — | 未检索到 | 否（新建） |
| Badge | 1:234 | 01 Library/Components | 否（功能不同，Badge 为状态标签） |
| Welcome Screen | 待确认 | 02 Screens/Onboarding | 是(目标 Screen,实例化 Tooltip Pill) |

### 新建 / 修改决策
- 新建 Tooltip Pill 组件（NodeId 待创建后填充）
- 在 Welcome Screen 中实例化 Tooltip Pill（NodeId 占位待填）
- 复用 `figma-cli create text` 文字节点
- 不新建独立 Hover 组件

### 状态变更策略
- Default / Hover 状态通过同一 Tooltip Pill 组件 + fill 颜色 property 覆盖实现，不新建独立组件
- 规范要求: "绝大多数情况下，状态变更应通过 variant / property 完成"

## 命名规则
引用: SKILL.md 第 36-43 行 — 以功能命名，首字母大写
```
Tooltip Pill
  Text
```
> Flow 命名约定(本任务示例): `Onboarding Flow`

## 设计规范来源
| 属性 | 值 | 引用路径（FIGMA_DESIGN_SYSTEM.md） |
|------|----|--------------------------------|
| 背景色 | primary.500 @ 10% (#EBF5FF) | docs/FIGMA_DESIGN_SYSTEM.md §2.1 Token 色板 |
| 文字色 | primary.700 (#1E40AF) | docs/FIGMA_DESIGN_SYSTEM.md §2.1 Token 色板 |
| 字号   | 14px，font-weight: 500 | docs/FIGMA_DESIGN_SYSTEM.md §3.2 字号系统 |
| 圆角   | 999px | docs/FIGMA_DESIGN_SYSTEM.md §4.1 圆角规范 |
| 内边距 | 8px 16px | docs/FIGMA_DESIGN_SYSTEM.md §5.1 间距规范 |

## 操作步骤
> 每条命令前置 "通过 `figma-cli <topic> -h` 已核对参数"

1. [前置] 切换到 01 Library Page
   命令: `figma-cli page set-current-page-by-name "01 Library"`
   通过 `figma-cli page -h` 已核对参数: subcommand=set-current-page-by-name, 位置参数: <page name>
   目的: 确认当前 Page 为 Library

2. [前置] 检索 Components Section 下是否有同名组件
   命令: `figma-cli read find --name "Tooltip Pill" --scope "01 Library"`
   通过 `figma-cli read -h` 已核对参数: subcommand=find, --name, --scope
   目的: 确认无同名组件，避免覆盖

3. [核心操作] 创建 Tooltip Pill Frame
   命令: `figma-cli create frame --name "Tooltip Pill" --width 120 --height 32 --x <NEXT_X> --y <NEXT_Y>`
   通过 `figma-cli create -h` 已核对参数: subcommand=frame, --name, --width, --height, --x, --y
   目的: 创建 Tooltip Pill 主 Frame
   说明: <NEXT_X> / <NEXT_Y> 仅作为示例坐标占位,实际使用前需用 `figma-cli read arrange` 或同级命令算出下一个非重叠坐标后替换。

4. [核心操作] 设置背景色（primary.500 @ 10%）
   命令: `figma-cli node <FRAME_NODE_ID> fill --color "#EBF5FF"`
   通过 `figma-cli node -h` 已核对参数: subcommand=node, <node-id>, fill, --color
   目的: 设置浅色背景

5. [核心操作] 创建 Text 子节点
   命令: `figma-cli create text --parent-id <FRAME_NODE_ID> --text "Tooltip text" --font-size 14 --font-weight 500 --color "#1E40AF"`
   通过 `figma-cli create -h` 已核对参数: subcommand=text, --parent-id, --text, --font-size, --font-weight, --color
   目的: 创建文字内容节点

6. [核心操作] 设置 Frame 圆角
   命令: `figma-cli node <FRAME_NODE_ID> corners --all 999`
   通过 `figma-cli node -h` 已核对参数: subcommand=node, corners, --all
   目的: 胶囊形圆角

7. [组件化] 将 Frame 转换为 Component
   命令: `figma-cli node <FRAME_NODE_ID> component`
   通过 `figma-cli node -h` 已核对参数: subcommand=node, component
   目的: 注册为正式 Component

8. [核心操作] 设置 auto-layout 内边距
   命令: `figma-cli node <FRAME_NODE_ID> layout --padding-left 16 --padding-right 16 --padding-top 8 --padding-bottom 8`
   通过 `figma-cli node -h` 已核对参数: subcommand=node, layout, --padding-*
   目的: 8px 16px 内边距

9. [前置] 切换到 02 Screens / Onboarding Page
   命令: `figma-cli page set-current-page-by-name "02 Screens"`
   通过 `figma-cli page -h` 已核对参数: subcommand=set-current-page-by-name
   目的: 准备在 Welcome Screen 中实例化组件

10. [核心操作] 在 Welcome Screen 中实例化 Tooltip Pill
    命令: `figma-cli create instance --component-id <COMPONENT_NODE_ID> --parent-id <WELCOME_SCREEN_FRAME_ID>`
    通过 `figma-cli create -h` 已核对参数: subcommand=instance, --component-id, --parent-id
    目的: 在 Welcome Screen 中实例化 Tooltip Pill

11. [文档同步]
    ⚠️ 新增组件规范已同步到 `docs/FIGMA_DESIGN_SYSTEM.md` §6 Components 章节
    手动更新文档: 在 §6 新增 "Tooltip Pill" 条目，包含上述所有属性值

## 截图验收
> 截图必须用 `Read` 工具真实读取，禁止以截图后不读取

1. 截图命令: `figma-cli export node <COMPONENT_NODE_ID> --output .figma/screenshots/T-001-tooltip-pill/component.png`
   保存路径: `<Current workspace>/.figma/screenshots/T-001-tooltip-pill/`

2. Read 工具读取截图，报告以下视觉属性:
   - 背景色: `#EBF5FF`（primary.500 @ 10%），与 §2.1 Token 色板一致
   - 文字色: `#1E40AF`（primary.700），与 §2.1 Token 色板一致
   - 字号: 14px，与 §3.2 字号系统一致
   - 圆角: 999px，胶囊形，与 §4.1 圆角规范一致
   - 对齐: 文字水平居中

3. 截图命令: `figma-cli export node <WELCOME_SCREEN_FRAME_ID> --output .figma/screenshots/T-001-tooltip-pill/screen.png`
   保存路径: `<Current workspace>/.figma/screenshots/T-001-tooltip-pill/`

4. Read 工具读取 Welcome Screen 截图，确认 Tooltip Pill 实例存在并可见

## 失败停止条件
- 验证失败修正轮次: 无上限(主对话必须持续修正直到通过,或主对话自身判定"修复已无方向 / 反复在同一处失败"等非轮次原因时停止)
- 停止后输出: 完整失败报告(包含所有已尝试的修正及结果)
- Spec 不准含: TBD / 待定 / 之后再说 / 占位

## 自检清单
- [x] 任务类型已填写（Create Component + Create Screen，多选）
- [x] 任务执行顺序已明确（两步，Create Component 先于 Create Screen）
- [x] 目标一句话说清楚（新增 Tooltip Pill + 在 Welcome Screen 中实例化）
- [x] 非目标已填写（不修改现有 Tooltip，不新建 Disabled，不扩展到其他 Screen）
- [x] 三页结构位置已填写（01 Library / Components）
- [x] 复用审计已完成，检索结果已记录（Tooltip Pill 未检索到，Badge 确认不同功能，Welcome Screen 确认复用）
- [x] 状态变更策略已填写（通过 variant/property 而非新建）
- [x] 命名规则符合 SKILL.md 第 36-43 行（Tooltip Pill 以功能命名）
- [x] Flow 命名约定已填写（Onboarding Flow 示例）
- [x] 所有 token / 字号 / 颜色 / 间距均引用 FIGMA_DESIGN_SYSTEM.md 具名章节
- [x] 每条操作步骤均写出完整 `figma-cli` 命令
- [x] 每条操作命令均标注"通过 `figma-cli <topic> -h` 已核对参数"
- [x] duplicate/reparent/unwrap/组件化 后已声明重新读取几何（步骤 7 组件化后重新 read）
- [x] 截图路径包含 task-id（`T-001-tooltip-pill`）
- [x] 截图后用 Read 工具读取并报告视觉属性（Component 截图 + Screen 截图）
- [x] 文档同步步骤已包含
- [x] 无 TBD / TODO / 占位符
- [x] 验证失败停止条件已声明（≥3 轮停止）
- [x] 示例/命令段中的占位符均在白名单内
- [x] 任务类型为多选且勾选数量与实际内容一致（2 项均已实现）
- [x] 任务执行顺序已明确写出，下游任务显式引用上游任务产物
- [x] Create Flow / Modify Flow 已填写 Flow 命名规则（本任务示例为 Onboarding Flow）
```

---

## 8. 版本与变更

### 当前版本

- **版本号**: 0.1.1
- **与 SKILL.md 对齐**: SKILL.md 当前版本为 0.1，本规范跟随 SKILL.md 主版本，修订号递增
- **修订**: 2026-07-20 v0.1.1 — 任务类型由单选改为多选,新增 Create Flow / Modify Flow 两类
- **生效日期**: 2026-07-20

### 历史背景

本规范 v0.1 是 figma-skill 的第一份正式 Spec 编写规范。在此之前的 `eval` 六字段（`NativeHelpChecked` / `MissingNativeCapability` / `TargetNodeIds` / `FallbackCodeScope` / `FallbackImpact` / `GeometryReaudit`）是 v3 旧版 `execution.md` 中的概念，在 v0.1 事实基线下该 `execution.md` 已为空文件，六字段概念不在本规范覆盖范围内。若后续 v0.x 版本引入六字段门禁，按新的事实增补，不追溯本 v0.1 规范。
