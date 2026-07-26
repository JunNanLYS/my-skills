# Figma Spec 自审规范

> 生效: 所有 Step5 Spec 自审必须遵循本规范
> 配套规范: `spec-template.md` 

---

## 1. 用途 / 适用阶段 / 读者

本规范用于 **Step5(自审 Spec)**,是 Skill 使用者在写完 Spec 之后、进入 Step7 写 Plan 之前的强制自审门禁。本阶段不询问用户、不等待用户审批——Spec 直接由 SubAgent 独立审计,主对话依据审查结果自主决定修复后进入 Step7 还是继续重审。

- **不适用**: Plan 阶段（Plan 由 `review-plan.md` 规范）、Spec 编写阶段（由 `spec-template.md` 规范）
- **读者**: 执行 Spec 自审的 AI agent（强制 SubAgent，详见 §3）
- **目的**: 在不打扰用户的前提下，由 SubAgent 对 Spec 做一次独立、客观的合规审计，产出 PASS / FAIL 结论与逐条证据

---

## 2. 核心原则（Non-Negotiable）

1. **强制 SubAgent 自审**: Step5 必须通过 `Agent` 工具派发**独立 SubAgent** 执行自审，禁止主对话"自己写完自己审"。SubAgent 上下文必须洁净，不得携带主对话的写作推理。

2. **必读前置**: SubAgent 在审查前必须**强制 Read 一次** `spec-template.md` v0.1.1 全文，并以该规范的 §3.11 自检清单 21 条作为审查依据。任何跳过此 Read 步骤的审查一律视为无效。

3. **逐条对照**: SubAgent 必须对 §3.11 自检清单 21 条**逐条打勾**或**逐条打叉**，每条必须给出**具体证据**（文件行号 / 引用文本片段 / 缺失原因）。任何"差不多就行"或"我已检查"的笼统回答一律 FAIL。

4. **红线可修复重审**: 发现以下任一情况，SubAgent 必须立即判定 FAIL;主对话必须**就地自主修复**(删除 TBD / 删除 MCP 操作 / 改写为 checkbox 多选 / 补齐任务执行顺序),然后**新派 SubAgent 重审**;禁止把红线条目抛回用户裁定:
   - Spec 中含 TBD / TODO / "等评审完再补" / "之后再说" / 占位符(白名单外)
   - Spec 中含 Figma MCP 操作(`figma_mcp_*`)
   - Spec 中任务类型章节仍是单选语言(违反 v0.1.1 多选规则)
   - Spec 中勾选 ≥2 项任务类型但"任务执行顺序"子节为空

5. **零度容忍冗余**: SubAgent 不得在审查结论中复述 Spec 原文超过 5 行；必须以"§X.Y 第 N 条 → 状态 / 证据"结构化呈现。复制粘贴型报告一律 FAIL。

6. **失败可无限重审**: 同一份 Spec 的 SubAgent 自审**无轮次上限**——主对话必须在每轮 FAIL 后就地自主修复并新派 SubAgent,直到取得 PASS。仅在主对话自身判定"修复已无方向 / 反复在同一处失败"等非轮次原因时,才停止重审并向用户报告完整失败上下文。

---

## 3. SubAgent 派发契约（必读）

### 3.1 派发方式

```text
主对话 Agent(本主进程)
  └─ Agent(subagent_type=general-purpose, prompt=<审查 prompt 模板>)
       └─ SubAgent: 洁净上下文, 仅 Read spec-template.md v0.1.1 + 待审 Spec 文件
            └─ 输出: 结构化审查报告(§4 模板),返回主对话
```

**禁止**:
- 在主对话内"模拟"SubAgent 审查
- 在 SubAgent prompt 中携带主对话的写作草稿或思考
- 使用同一个 SubAgent 连续审查多份 Spec（每份 Spec 必须新派 SubAgent）

### 3.2 SubAgent Prompt 模板

主对话必须按以下模板构造 SubAgent prompt（替换 `<...>` 占位符）：

```text
你是 Figma Spec 自审 SubAgent。请独立、客观地审查以下 Spec 是否符合规范。

## 必读前置(强制,未完成则审查无效)
1. Read `D:\Project\figma-cli-rust\skills\figma-skill\references\spec-template.md` v0.1.1 全文
2. 重点关注 §3.11 自检清单 21 条(每条都必须对照)

## 待审 Spec
文件: <待审 Spec 文件绝对路径>
请 Read 该文件全文。

## 审查任务
对照 spec-template.md v0.1.1 §3.11 自检清单 21 条,逐条打勾或打叉。
每条必须给出:
- 状态: ✅ PASS / ❌ FAIL / ⚠️ PARTIAL
- 证据: 文件行号 + 引用文本片段(≤3 行) 或 缺失原因

## 输出格式(强制)
按 §4 报告模板输出,不得超出该结构。结尾必须给出 **总判定: PASS / FAIL** 与 1 句总评。

## 硬约束
- 不得修改任何文件
- 不得跳过 21 条中的任一条
- 不得复述 Spec 原文超过 5 行
- 发现红线情况立即 FAIL,不得打回修改
```

### 3.3 SubAgent 类型

固定使用 `general-purpose`(本仓库 subagent 类型表中的 catch-all)。不得使用 `Explore`(只读,无法输出结构化报告)、不得使用 `Plan`(产物是 plan 不是 review)、不得使用 `claude-code-guide`(领域不符)。

---

## 4. 审查报告模板（SubAgent 必填）

SubAgent 输出必须严格按下表结构,任何多余段落 / 缺失段落视为格式违规 → FAIL。

```markdown
# Spec 自审报告

**待审 Spec**: <文件绝对路径>
**审查依据**: skills/figma-skill/references/spec-template.md v0.1.1 §3.11
**审查者**: SubAgent(独立上下文)
**日期**: <YYYY-MM-DD>

---

## §3.11 自检清单 21 条逐条对照

| # | 检查项 | 状态 | 证据 |
|---|--------|------|------|
| 1 | 任务类型已填写,且与 Spec 实际内容一致 | ✅/❌/⚠️ | <行号 + 引用或缺失> |
| 2 | 目标一句话说清楚,可被 Step5 审查者独立判断是否完成 | | |
| 3 | 非目标(Scope Negation)已填写,边界清晰 | | |
| 4 | 三页结构位置已填写 Page + Section,不含模糊路径 | | |
| 5 | 复用审计已完成(所有勾选任务类型),无同名/同功能已有组件被遗漏 | | |
| 6 | 状态变更策略已填写,声明通过 variant / property 而非新建达成 | | |
| 7 | 命名规则符合 SKILL.md 第 36-43 行 | | |
| 8 | 所有 token / 字号 / 颜色 / 间距均引用 FIGMA_DESIGN_SYSTEM.md 具名章节 | | |
| 9 | 每条操作步骤均写出完整 `figma-cli <topic> <verb> <args>` 命令 | | |
| 10 | 每条操作命令均标注"通过 `figma-cli <topic> -h` 已核对参数" | | |
| 11 | duplicate / reparent / unwrap / 组件化 后已声明重新读取几何 | | |
| 12 | 命令验收已声明:`node check overlap` / `containment --recursive` / `page-overlap` 至少 1 条带 `--fail-on-findings`;裁剪检测必须带 `--recursive`;属性验收含 `read get fills` / `corner-radius` 等 | | |
| 13 | 截图路径包含 task-id,截图 NODE_ID 是本 Task 原子节点(非 Section / Page / 父级 Frame),截图后用 Read 工具真实读取 | | |
| 14 | 截图 Read 报告了颜色 / 字号 / 间距 / 对齐等视觉属性 | | |
| 15 | Token 变更任务已包含文档同步步骤 | | |
| 16 | 无 TBD / TODO / 占位符 / "等评审完再补" | | |
| 17 | 验证失败停止条件已声明(≥3 轮停止) | | |
| 18 | 示例/命令段中的占位符均在白名单内,无 `<背景色>` `<字号>` `<待补>` 等违规占位符 | | |
| 19 | 任务类型为多选且勾选数量与实际内容一致 | | |
| 20 | 任务执行顺序已明确写出,下游任务显式引用上游任务产物 | | |
| 21 | Create Flow / Modify Flow 已填写 Flow 命名规则 | | |

---

## 红线检查(任一命中即 FAIL)

- [ ] 不含 TBD / TODO / 占位符
- [ ] 不含 Figma MCP 操作
- [ ] 任务类型章节使用 checkbox 多选格式
- [ ] 多选时任务执行顺序子节非空

---

## 总判定

**PASS / FAIL**

<一句话总评,不超过 50 字>
```

---

## 5. 主对话收到 SubAgent 报告后的处理流程

### 5.1 PASS 路径

```
SubAgent 报告 PASS
  → 主对话 Read 报告,确认 21 条全 ✅、红线全过
  → 在 Spec 文件首部追加 1 行自审元数据:
    `<!-- self-reviewed-by: SubAgent, date: YYYY-MM-DD, verdict: PASS -->`
  → 进入 Step6(写 Plan)
```

### 5.2 FAIL 路径(命中红线)

```
SubAgent 报告 FAIL(红线)
  → 主对话立即停止 Step6,进入自主修复
  → 就地修正所有红线条目(删除 TBD / 删除 MCP / checkbox 多选 / 补齐执行顺序)
  → 新派 SubAgent 重审(无轮次上限,见 §2 第 6 条)
  → 重审 PASS → 走 §5.1 流程进入 Step6
  → 主对话判定"修复已无方向 / 反复在同一处失败" → 向用户报告完整失败上下文
     (红线条目清单 + 已尝试修复的轮次与改动摘要 + 失败截图若有)
  → 禁止把红线条目抛回用户裁定"删除 / 改写 / 接受红线风险"
```

### 5.3 FAIL 路径(普通条目)

```
SubAgent 报告 FAIL(普通条目)
  → 主对话在原 Spec 上就地修复非红线条目
  → 必须新派 SubAgent 重审(无轮次上限,与红线共用 §2 第 6 条规则)
  → 主对话判定"修复已无方向 / 反复在同一处失败" → 视为规范未达,向用户报告完整失败上下文
```

---

## 6. Rationalization 表

主对话 / SubAgent 自审时必须主动规避以下误区:

| 误区 | 对应规范章节 | 正确做法 |
|------|------------|---------|
| "我自己写完自己审一下就行,不用 SubAgent" | §2 核心原则第 1 条 | 强制 SubAgent 独立审查,主对话自审一律无效 |
| "SubAgent prompt 里把 Spec 摘要带上更方便" | §3.2 prompt 模板 | prompt 只给文件路径,让 SubAgent 自己 Read,防止主对话偏见污染 |
| "我已检查,大致符合规范" | §2 核心原则第 3 条 | 必须 21 条逐条打勾,笼统回答一律 FAIL |
| "红线条目主对话先修一下再重审" | §5.2 | 红线 FAIL 由主对话就地自主修复 + 新派 SubAgent 重审(无轮次上限),禁止抛回用户裁定 |
| "SubAgent 也审了,我也审了,双重保险" | §2 核心原则第 1 条 | 仅 SubAgent 审查有效,主对话自审不计入 |
| "审查报告复制了 Spec 原文好让用户看清楚" | §2 核心原则第 5 条 | 报告引用原文 ≤ 3 行,过长一律 FAIL |
| "同一个 SubAgent 连续审 3 份 Spec 提高效率" | §3.1 禁止条款 | 每份 Spec 必须新派 SubAgent,上下文隔离 |
| "红线是建议不是强制" | §2 核心原则第 4 条 + §4 红线检查 | 红线强制,任一命中立即 FAIL;但 FAIL 后由主对话就地修复 + 新派 SubAgent 重审,而非抛回用户 |
| "截图 NODE_ID 是 Section 也行,反正能看到组件" | spec §3.9.2 + 截图自检第 13 条 | 截图 NODE_ID 必须是本 Task 原子节点,Section / Page / 父级 Frame 会带入无关组件,无法独立验收本 Task |
| "containment 不带 --recursive 也算裁剪检测" | spec §3.9.1 命令验收 + 自检第 12 条 | 裁剪检测必须带 `--recursive`,无 flag 只查直接子节点,会漏掉深层嵌套溢出 |

---

## 7. Red Flags

Spec 自审存在以下任一情况,主对话**立即停止当前 Spec 自审流程**,按 §5.1 / §5.2 / §5.3 自主处理(自主修复 + 新派 SubAgent 重审;非轮次原因判定无方向时再向用户报告完整失败上下文)——禁止把红线条目抛回用户裁定:

1. **无 SubAgent 审查**: 主对话跳过 SubAgent 派发,直接进入 Step6(违反 §2 第 1 条)
2. **SubAgent 未读 spec-template.md**: SubAgent 报告未引用 spec-template.md 任何章节 / 行号(违反 §2 第 2 条)
3. **审查报告缺条**: §3.11 21 条任一条状态为"未检查"或"跳过"(违反 §2 第 3 条)
4. **红线未拦截**: 报告中红线章节 4 项未全部勾选,但总判定仍为 PASS(违反 §2 第 4 条)
5. **冗余复述**: SubAgent 报告任一处复述 Spec 原文超过 5 行(违反 §2 第 5 条)
6. **主对话自审冒充**: SubAgent prompt 中携带主对话的写作草稿 / 思考过程(违反 §3.1 禁止条款)
7. **复用 SubAgent**: 同一 SubAgent 连续审查 ≥ 2 份 Spec(违反 §3.1 禁止条款)
8. **红线 FAIL 抛回用户**: 红线 FAIL 后主对话未就地自主修复并重审,而是向用户发出"删除 / 改写 / 接受风险"的裁定请求(违反 §5.2)

---

## 8. 示例:SubAgent 报告(合规)

```markdown
# Spec 自审报告

**待审 Spec**: D:/Project/Nono/.figma/specs/2026-07-20-tooltip-pill.md
**审查依据**: skills/figma-skill/references/spec-template.md v0.1.1 §3.11
**审查者**: SubAgent(独立上下文)
**日期**: 2026-07-20

---

## §3.11 自检清单 21 条逐条对照

| # | 检查项 | 状态 | 证据 |
|---|--------|------|------|
| 1 | 任务类型已填写 | ✅ | L7-9 勾选 Create Component + Create Screen |
| 2 | 目标一句话说清楚 | ✅ | L11 "在 01 Library/Components 新增 Tooltip Pill 并在 Welcome Screen 实例化" |
| 3 | 非目标已填写 | ✅ | L15-17 三条边界清晰 |
| 4 | 三页结构位置 | ✅ | L20-23 Page=01 Library, Section=Components |
| 5 | 复用审计 | ✅ | L27-31 表格 3 行,无遗漏 |
| 6 | 状态变更策略 | ✅ | L35-36 显式声明 variant/property |
| ...(其余 14 条均已对照,详见完整报告) | | | |

## 红线检查(任一命中即 FAIL)

- [x] 不含 TBD / TODO
- [x] 不含 Figma MCP
- [x] checkbox 多选
- [x] 执行顺序非空

## 总判定

**PASS**

21 条全过,红线全清,Spec 可进入 Step6。
```
