# `figma-skill` 端到端设计执行 Skill 设计规格

**日期：** 2026-07-12  
**状态：** 已经用户逐节确认，待书面规格复核  
**目标版本：** `figma-skill` 1.0

## 1. 背景与目标

创建一个名为 `figma-skill` 的新 skill，完整替代现有 `figma-guide`。新 skill 面向产品 UI 与设计系统，既支持从零创建 Web、桌面端和移动端设计，也支持理解并安全修改现有 Figma 文件。

该 skill 的首要标准是端到端设计执行：从需求澄清、环境准备、设计系统确认、只读发现和执行规划，一直负责到 Figma 写入、视觉迭代、三层验证与交付报告。

首版不以 FigJam、营销视觉或复杂原型动效为核心范围，也不实现跨任务持久缓存。

## 2. 核心决策

1. 新 skill 固定命名为 `figma-skill`。
2. 新 skill 验证完成后，删除 `figma-guide/`，禁止同时保留两套同范围规则。
3. 所有 Figma 操作必须使用 `silships/figma-cli` 2.x 的 `figma-cli` 命令入口。
4. Windows 环境未安装 CLI 时，必须从 `silships/figma-cli` 官方 GitHub Releases 安装最新稳定版。
5. 每个新会话首次执行 Figma 任务时，必须以 Yolo 模式执行 `figma-cli connect`，随后执行 `figma-cli status`。
6. 设计规范的唯一权威来源是 `[当前工作区]/docs/FIGMA_DESIGN_SYSTEM.md`。
7. 设计系统文档审批与 Figma 首次写入审批是两次独立门禁。
8. 首版禁止持久化组件或 NodeId 缓存，只维护单次任务内的临时上下文。
9. 所有硬性约束必须使用“必须”“禁止”“只有……才允许”等强制措辞。

## 3. 项目根目录定义

`[当前工作区]` 是用户启动 Claude Code 或 Codex 时选择并授权给当前会话的工作区目录。

- 必须把当前工作区视为项目根目录。
- 禁止通过向上查找 `.git` 重新定义项目根目录。
- 禁止因后续命令改变工作目录而改变项目根目录。
- 用户明确指定并授权另一个目录时，才允许改用该目录。
- 当前会话没有明确或可访问的工作区时，必须要求用户选择工作区后再继续。

## 4. 端到端状态机

固定主流程如下：

```text
接收需求
→ 确定当前工作区
→ 检查并安装 figma-cli
→ Yolo 连接与状态检查
→ 只读发现 Figma 上下文
→ 检查 docs/FIGMA_DESIGN_SYSTEM.md
→ 必要时补建设计系统并完成第一次审批
→ 形成 Figma 执行方案并完成第二次审批
→ 记录修改基线
→ 小批次执行
→ 三层验证
→ 最多三轮修正
→ 交付或报告未通过项
```

### 4.1 需求澄清

只澄清会改变以下内容的问题：

- 目标平台。
- 核心用户与核心任务。
- 信息架构。
- 品牌方向。
- 关键交互。
- 响应式范围。
- 会显著改变设计结果的业务约束。

间距、栅格细节、基础状态、图标、颜色、字体、圆角和组件规则必须先从 `docs/FIGMA_DESIGN_SYSTEM.md` 获取。文档没有覆盖时，才允许采用专业默认值。

### 4.2 首次写入前确认

只读发现和设计系统确定后，必须向用户提交具体 Figma 执行方案。只有获得明确批准后，才允许首次写入 Figma。

审批后若变化影响页面结构、设计系统、任务边界、已有组件或 `eval/run` 降级方式，原审批失效，必须重新提交对应审批。只调整同一批准方案内的文案、尺寸或低风险细节时，可以继续执行。

## 5. 目录结构

```text
figma-skill/
├── SKILL.md
├── references/
│   ├── installation.md
│   ├── design-system.md
│   ├── discovery-and-planning.md
│   ├── execution.md
│   └── validation.md
├── scripts/
│   ├── install-figma-cli.ps1
│   └── figma-validate-bounds.mjs
└── tests/
    ├── scenarios.md
    └── expected-behaviors.md
```

### 5.1 `SKILL.md`

主文件负责：

- 以 YAML frontmatter 作为文件第一段，包含仓库要求的 `name`、`model`、`category`、`description` 和 `version`。
- 明确 Figma 相关触发条件与不适用范围。
- 定义不可绕过的硬性约束。
- 定义端到端状态机和两次审批门禁。
- 定义 `eval/run` 准入条件。
- 定义最多三轮修正规则。
- 给出 reference 文件的按需加载索引。
- 提供完工检查清单。

`description` 只描述适用场景和触发条件，禁止概述完整执行流程，避免代理仅凭 frontmatter 行动而跳过正文。

### 5.2 `references/installation.md`

负责：

- Windows 环境的 `figma-cli` 存在性和版本检查。
- 从官方 GitHub Releases 查询最新稳定版本。
- 排除 draft 和 prerelease。
- 匹配 Windows CPU 架构与 Release 资产。
- 安装、PATH 处理与安装验证。
- Yolo 连接、daemon 诊断和失败终止。
- CLI 版本变化后的帮助自查规则。

### 5.3 `references/design-system.md`

负责：

- 固定读取 `[当前工作区]/docs/FIGMA_DESIGN_SYSTEM.md`。
- 文档缺失时的最小完整结构。
- 从用户需求和现有 Figma 规律生成草案的方法。
- 规范缺项时的最小补充规则。
- 第一次审批的内容与边界。
- 文档与 Figma 冲突时的文档优先策略。
- 当前任务范围之外的冲突记录方式。

### 5.4 `references/discovery-and-planning.md`

负责：

- 读取打开的文件、页面、目标节点、variables、styles、components 和 Component Set。
- 判断应复用、实例化、duplicate 或新建。
- 维护单次任务内的临时 NodeId、组件和 token 上下文。
- 记录查询次数和大致耗时。
- 形成包含目标、范围、假设、复用策略、风险和降级项的执行方案。
- 第二次审批门禁。

### 5.5 `references/execution.md`

负责：

- 记录关键属性和基线截图。
- 将工作拆成可验证的小批次。
- 原生命令选择和实时帮助自查。
- 结构变化后的 NodeId 重读。
- 组件页、Component Set、实例和局部重复内容的复用规则。
- `eval/run` 的证据要求、影响范围和记录格式。
- 写入失败后的停止与 `undo` 安全评估。

### 5.6 `references/validation.md`

负责：

- 结构、视觉、规范三层验证。
- 截图归档和实际看图要求。
- 必要时使用离线 bounds 审计。
- 最多三轮“定位—最小修正—复验”循环。
- 失败报告和成功交付格式。

### 5.7 `scripts/`

脚本只自动化确定性操作：

- `install-figma-cli.ps1` 查询官方最新稳定 Release，安装并验证 Windows CLI。
- `figma-validate-bounds.mjs` 复用现有离线父子越界审计能力。

禁止创建包装 `render`、`set`、`instantiate` 等日常命令的通用脚本，避免重新实现并落后于 `figma-cli`。

### 5.8 `tests/`

测试文件是 skill 的行为验收资产，覆盖 RED、GREEN 和 REFACTOR 过程中的压力场景、观察结果和期望行为。它们不作为 Figma 运行时代码。

## 6. 环境准备与安装

### 6.1 强制 CLI 边界

所有 Figma 读取、创建、修改、导出和验证必须通过 `figma-cli` 完成。

- 禁止使用 Figma MCP、其他 Figma CLI、GUI 自动化或直接修改 Figma 内部数据。
- CLI 安装或连接失败时，必须停止 Figma 写入。
- 非 Windows 环境首版不负责自动安装；系统中已有可用的 `figma-cli` 时，可以继续使用工作流。

### 6.2 Windows 自动安装

未找到可用的 `figma-cli` 时必须：

1. 查询 `silships/figma-cli` 官方 GitHub Releases。
2. 选择最新稳定 Release，排除 draft 和 prerelease。
3. 检测 Windows CPU 架构并选择对应资产。
4. 下载、安装并按需更新 PATH。
5. 执行 `figma-cli --version` 和 `figma-cli --help` 验证。

安装失败时必须报告具体阶段和错误，禁止改用 npm 上可能滞后的版本或其他工具。

### 6.3 连接

每个新会话第一次执行 Figma 任务时：

1. 必须运行 `figma-cli connect` 使用 Yolo 模式。
2. 必须运行 `figma-cli status` 确认 CDP 连接和 daemon 状态。
3. 失败时必须检查 Figma Desktop、daemon 和当前 CLI 帮助。
4. 禁止默认使用 `connect --safe`；只有用户明确要求时才允许使用 Safe 模式。

## 7. 设计系统工作流

### 7.1 文档存在

文件存在时，颜色、字体、间距、栅格、响应式、圆角、描边、阴影、图标、基础状态、组件、交互和命名规则必须以该文档为准。

文档缺少当前任务需要的规则时，必须提出最小补充方案。只有用户批准并更新文档后，才允许提交 Figma 写入方案。禁止使用临时默认值绕过缺失规范，也禁止先改 Figma、事后补文档。

### 7.2 文档缺失

必须依次依据以下来源生成设计系统草案：

1. 用户明确需求和项目品牌资料。
2. 现有 Figma variables、styles 和 components。
3. 目标页面中稳定且重复的视觉规律。
4. 没有其他依据时采用的专业默认值。

草案至少包括：

- 设计原则与平台范围。
- 颜色和语义色。
- 字体层级。
- 间距和尺寸尺度。
- 栅格与响应式断点。
- 圆角、描边和阴影。
- 图标体系。
- 基础组件及其状态。
- 交互状态和可访问性底线。
- 命名与组件组织规则。

### 7.3 第一次审批

审批内容必须展示：

- 新增或修改的规范。
- 每项规范的依据。
- 对当前任务和已有设计的影响。
- 已发现但暂不治理的范围外冲突。

用户批准后才允许写入或更新 Markdown 文档。该批准禁止被解释为 Figma 写入批准。

### 7.4 文档与 Figma 冲突

`docs/FIGMA_DESIGN_SYSTEM.md` 是唯一权威来源。

- 当前任务涉及的页面、组件及其直接依赖必须按文档修正。
- 禁止为了迁就现有页面而静默偏离文档。
- 禁止顺手修改任务范围之外的历史页面。
- 范围外的不一致只记录在交付报告中。
- 直接依赖修正会影响其他页面时，必须在第二次审批中说明影响。

## 8. 只读发现与第二次审批

### 8.1 最小上下文发现

连接成功后，必须先收集完成当前任务所需的最小上下文：

- 当前打开的 Figma 文件和目标文件。
- 页面、Section、目标 Frame 和相关父子层级。
- variables、styles、components、Component Set 和 variants。
- 与目标页面直接相关的可复用实例。
- 当前结构、关键尺寸和基线截图。

禁止一开始扫描或导出整个大型文件。搜索必须按目标页面、命名或父节点缩小范围。只读发现阶段禁止产生 Figma 写入。

### 8.2 第二次审批内容

Figma 执行方案必须包含：

- 目标文件、页面、Frame 和任务边界。
- 将复用、实例化、duplicate 或创建的结构。
- 将修改的已有组件或 variables。
- 关键布局和响应式方案。
- 与现有设计的冲突和修正范围。
- 基线记录方式和分批执行顺序。
- `eval/run` 降级及其能力缺失证据。
- 验证对象和验收标准。

只有用户明确批准该方案后，才允许首次写入 Figma。

## 9. 执行策略

### 9.1 命令真相来源

命令语法必须以当前安装版本的帮助为准：

1. `figma-cli --help`
2. `figma-cli <command> --help`
3. `figma-cli <command> <subcommand> --help`

Skill 可以记录意图入口，但禁止把示例语法视为永久 API。

主要意图入口包括：

- 发现：`files`、`canvas`、`find`、`get`、`inspect`、`spec`。
- 创建：`render`、`render-batch`、`blocks`、`shadcn`。
- 复用：`instantiate`、`duplicate|dup` 和 component/variant 命令。
- 修改：`set`、`set-batch`、`padding`、`gap`、`align`、`sizing`、`pin`。
- 结构：`node`、`slot`、`section`、`grid`、`unwrap`。
- 设计系统：`variables|var`、`collections|col`、`tokens`、`bind`、`theme`。
- 验证：`verify`、`export`、`lint`、`a11y`、`spec --check`。
- 恢复：`undo`。

### 9.2 复用决策

依次应用以下规则：

1. 已有目标 component 或 reuse handle 时，必须先 `spec`，再 `instantiate`。
2. 跨页面使用、具有多状态或未来需要统一演进时，必须使用 Component 或 Component Set。
3. 当前页面内结构相同、内容不同的对象，先完成一份，再 `duplicate`，并按新的 NodeId 修改内容。
4. 多个完全相同且相互独立的节点使用 `render-batch`。
5. 只有确认不存在合适的复用结构后，才允许新建。

禁止凭印象重画已有组件。用户要求 N 个同类对象时，必须提供 N 个独立节点，禁止把它们包在一个 wrapper 后冒充独立组件。

### 9.3 小批次写入

每个批次固定遵循：

```text
确认目标与当前状态
→ 执行最小相关写入
→ 重读受影响节点
→ 检查结果
→ 进入下一批
```

以下变化后必须重新读取 NodeId 和当前几何：

- duplicate。
- reparent 或 unwrap。
- 组件化或组合 variants。
- 删除重建。
- 大幅层级调整。

禁止凭旧 NodeId 继续写入。

### 9.4 `eval/run` 准入门禁

只有同时满足以下条件才允许使用 `figma-cli eval` 或 `figma-cli run`：

1. 已运行 `figma-cli --help`。
2. 已运行最接近意图的命令组或子命令 `--help`。
3. 当前帮助确实没有提供对应的原生能力。
4. Figma 执行方案已写明缺失能力、拟执行代码、目标节点和影响范围。
5. 用户已在第二次审批中批准该降级。

执行过程中才发现能力缺失时，必须暂停并补充方案。原批准禁止自动覆盖新的 `eval/run`。

`eval/run` 必须限定目标 NodeId，禁止无范围的全文件遍历或批量改动。完成后必须重读目标并执行完整验证。

## 10. 基线与恢复

修改现有文件前必须保存：

- 目标节点及直接依赖的 NodeId。
- 类型、名称、父节点、尺寸、位置、Auto Layout 和关键绑定。
- 目标区域基线截图。
- 当前批次拟修改的节点清单。

严重偏差或命令部分成功时必须停止后续批次。只有确认最近一次 `render` 或 `render-batch` 的撤销语义与影响范围安全时，才允许使用 `figma-cli undo`。否则必须保留现场并报告，禁止连续尝试破坏性恢复。

## 11. 三层验证

### 11.1 结构层

- 重读关键节点、父子层级、类型和 NodeId。
- 核对尺寸、位置、Auto Layout、约束、组件实例和变量绑定。
- Component 或 Component Set 复刻任务必须运行适用的 `spec --check`。

### 11.2 视觉层

- 使用当前 CLI 支持的 `verify --save` 或 `export` 命令生成 PNG。
- 截图保存到 `[当前工作区]/temp/figma-screenshot/`，并使用页面或功能语义命名。
- 必须实际打开截图，检查文字裁切、遮挡、对齐、间距、颜色、状态、圆角和层级。
- 禁止以退出码、导出成功或缩略图存在代替看图。

### 11.3 规范层

- 核对当前任务涉及的内容是否符合 `docs/FIGMA_DESIGN_SYSTEM.md`。
- 检查 tokens、字体、间距、栅格、图标、组件状态和响应式行为。
- 只报告任务范围之外的历史不一致，禁止自动扩大治理范围。

## 12. 自动修正与错误处理

### 12.1 自动修正循环

```text
发现失败
→ 定位具体节点和原因
→ 执行最小范围修正
→ 重跑受影响的验证
```

最多自动修正三轮。第三轮后仍失败时，必须停止写入并报告：

- 未通过的检查项。
- 受影响节点和可见症状。
- 三轮分别尝试过的修正。
- 当前 Figma 状态是否可继续使用。
- 可行的恢复或人工处理方式。

禁止隐藏失败、降低标准或只展示通过的局部截图。

### 12.2 错误分类

- **环境错误：** 安装、PATH、Figma Desktop、Yolo 连接或 daemon 失败。立即停止 Figma 写入。
- **上下文错误：** 目标文件、页面或节点不明确。保持只读并获取必要信息。
- **规范错误：** 设计系统缺失、缺项或冲突。返回第一次审批流程。
- **审批失效：** 范围、结构、设计系统或降级方式发生实质变化。暂停并重新审批。
- **命令错误：** 查询当前帮助并修正命令；禁止直接改用其他工具。
- **写入偏差：** 停止后续批次，重读现场并评估安全恢复。
- **验证失败：** 进入最多三轮修正循环。

## 13. 首版缓存策略

首版禁止创建 `.figma/cache.json` 或任何跨任务持久缓存。

单次任务内可以维护：

- `fileKey`、页面和目标 Frame。
- 已确认的 NodeId、名称和类型。
- component、variant 和 reuse handle。
- variables、collections 和关键 token 映射。
- 查询次数和大致耗时。
- 结构变化后的失效状态。

任务内上下文禁止覆盖以下实时读取要求：

- 任何写入前读取当前状态。
- duplicate、reparent、组件化或重建后重新读取。
- 验证阶段重读关键节点。

交付报告可以记录重复查询是否形成明显瓶颈。只有后续真实数据持续证明发现成本显著时，才单独设计持久缓存。首版禁止提前引入 TTL、dirty 标记或缓存 schema。

## 14. Skill 测试策略

新 skill 必须按 `writing-skills` 的 RED—GREEN—REFACTOR 方法建立和验证。

### 14.1 RED：无新 skill 的基线

在编写 `figma-skill` 前，使用不加载新 skill 的独立代理运行压力场景并记录原始行为。场景至少覆盖：

1. 用户催促立即修改，代理是否跳过设计系统和写入审批。
2. 系统没有 `figma-cli`，代理是否改用 MCP 或其他工具。
3. `docs/FIGMA_DESIGN_SYSTEM.md` 缺失，代理是否直接采用默认样式。
4. CLI 原生命令看似麻烦，代理是否未经帮助验证直接使用 `eval/run`。
5. 现有页面与文档冲突，代理是否迁就现状或扩大治理范围。
6. duplicate 后 NodeId 变化，代理是否继续使用旧 ID。
7. 截图导出成功但存在视觉问题，代理是否只看退出码。
8. 三轮修正仍失败，代理是否继续盲目写入或虚报完成。

必须记录失败模式和代理使用的具体合理化语言。

### 14.2 GREEN：最小有效 skill

编写最小内容以纠正 RED 阶段真实出现的失败。使用相同场景重新测试，确认代理遵守：

- 强制 `figma-cli`。
- 两次独立审批。
- 设计系统文档优先。
- `eval/run` 证据门禁。
- NodeId 重读。
- 三层验证。
- 三轮失败终止。

### 14.3 REFACTOR：关闭漏洞

根据 GREEN 测试中出现的新合理化补充规则、反例和红旗，并重复测试直到行为稳定。测试资产保存在 `figma-skill/tests/`，记录场景、基线、实际结果和期望行为。

## 15. 完成和迁移条件

只有满足以下条件后，才允许删除 `figma-guide/`：

1. `figma-skill` 的目录结构和全部必需文件已完成。
2. Windows 安装脚本通过可重复的本地测试或安全模拟测试。
3. `figma-validate-bounds.mjs` 已迁移并通过现有或新增测试。
4. RED、GREEN、REFACTOR 行为测试已经记录并通过。
5. Frontmatter 位于 `SKILL.md` 第一行，字段和版本符合仓库规范。
6. 文档内部不存在指向 `figma-guide` 的运行时依赖。
7. 本地同步 dry-run 或等价验证确认新 skill 可被发现。
8. 删除旧 skill 后，仓库中只剩一个 Figma 端到端执行 skill。

实施阶段修改任何 `SKILL.md` 或 reference 文件时，必须按仓库规则递增版本。任务结束前必须验证、提交并推送到 `origin main`，由项目 hook 同步到运行时目录。

## 16. 成功标准

一次 Figma 任务只有满足以下条件才允许报告完成：

- 所有批准范围内的写入已经执行。
- 三层验证全部通过。
- 最终截图已经实际检查并归档。
- 当前任务涉及的设计符合设计系统文档。
- 没有未披露的失败、范围变化或未经批准的降级。
- 工作区内文档变更已经按所在仓库规则处理。
- Figma 画布变更已在交付报告中列明。

`figma-skill` 本身只有在行为测试通过、旧 skill 安全移除、仓库验证成功并推送后才算完成。
