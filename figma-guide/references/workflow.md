# workflow.md

Figma 工程执行时，主文档只给主路径；本文件负责展开“怎么做结构与布局”。

## 1. 先用 CLI 自查当前上下文

本 Skill 不再维护旧的上下文读取命令清单，也不要求固定缓存 `state.json`。

执行任务前，先通过新 CLI 自查：

1. `figma-cli status`：看是否已连接、daemon 是否正常。
2. `figma-cli files`：看当前打开了哪些 Figma 文件。
3. `figma-cli canvas info` / `figma-cli find "Name"`：看画布结构或定位节点。
4. 不知道还有什么上下文命令，就先跑：
   - `figma-cli --help`
   - `figma-cli <command> --help`
   - `figma-cli <command> <subcommand> --help`

原则：

- 由 CLI 的当前 help 作为命令真相。
- 本 Skill 只保留设计执行纪律，不再复写一套会过期的命令索引。

## 2. 组件页与复用纪律

### 2.1 必须有组件页

每个文件都应有独立组件页，常见命名：`组件` / `Components` / `Library`。

组件页负责：

- 通用组件定义。
- 多状态对照。
- 全局样式预览。

UI 设计页负责：

- 消费实例或 clone 结果。
- 组合页面结构。
- 调整页面级文字与状态。

### 2.2 复用优先级

所有重复出现的视觉单元，优先按以下顺序复用：

1. **已有组件实例**：`figma-cli spec "Name"` 找复用 handle，再 `figma-cli instantiate "Name"`。
2. **组件 / Component Set**：导航栏、侧边栏、标题栏、页脚、按钮、输入框、标签等。
3. **clone 既有结构**：列表行、表格行、卡片组、对照态。
4. **仅在必要时新建**：一次性占位节点、演示用临时内容、用户明确要求重画的对象。

禁止做法：

- 对重复结构从头新建 N 次。
- 在 UI 页里直接定义通用组件。
- 凭记忆重画已有组件。
- 用户说“使用已有 X 组件”时改用手写 JSX 复刻。

### 2.3 DESIGN.md 与抽取系统

当设计系统来自 `figma-cli extract` 生成的 `DESIGN.md`：

- 每个组件都可能带复用 handle；先用 `spec` 看是否能 instance。
- 要复刻组件时，先用 `figma-cli spec <name>` 读取轴、变体值和样例尺寸。
- 多变体组件必须按 spec 生成 `COMPONENT_SET`，不要简化成单个节点。
- 构建后用 `figma-cli spec <name> --check <nodeId>` 验证；失败就继续修。
- 不要手读巨大的 structure markdown 来猜尺寸、轴名或高度。

### 2.4 页面级框架的推荐方式

对导航栏 / 标题栏 / 页脚这类“每页都出现，但通常只放一份”的结构，优先用：

- 组件页定义 Component / Component Set。
- UI 页引用实例。
- 通过 properties 或少量文案改动切状态。

只有当组件缺失、且任务只是快速补齐时，才退到 clone 方案。

## 3. 创建策略

### 3.1 单个结构

单个 frame、card、button、局部 UI 组合优先使用：

```bash
figma-cli render '<Frame>...</Frame>'
```

`render` 负责智能放置和安全创建；不要用 `eval` 新建视觉节点。

### 3.2 多个同类节点

用户说“创建 N 个按钮 / 卡片 / 列表项 / 自定义组件”时，默认含义是：

```text
N 个独立顶层节点，而不是一个 wrapper Frame 或一个包含 N 个子项的 Component。
```

优先使用：

- shadcn 原语：`figma-cli shadcn add <component> --count N`
- 自定义结构：`figma-cli render-batch '["<Frame>...</Frame>", ...]' --direction row|col`

禁止模式：

- 用 `eval` 创建 parent，然后 appendChild N 个类似节点。
- 用一个 `<Frame>` 包住 N 个同类子节点来冒充“N 个对象”。
- 对 wrapper 调 `node to-component`，导致用户无法单独移动或复用每个对象。

如果误包了一层，优先用 `figma-cli unwrap <wrapperId>` 救回子节点。

### 3.3 shadcn 与 themed 组件的意图区别

用户措辞决定用哪条路径：

| 用户说法 | 含义 | 优先方式 |
|---|---|---|
| “创建 3 个按钮 / 添加一个 card” | shadcn 风格原语可以接受 | `figma-cli shadcn add button --count 3` |
| “用变量 / figma style / themed / loaded design system / tokens” | 要绑定当前设计系统变量的自定义组件 | `figma-cli render-batch ... --collection <name>` |

注意：

- `shadcn add` 使用 shadcn 自己的 primitives，不会自动继承用户刚导入的 Airbnb / Cursor / in-house 变量系统。
- `--count` 在有 variety pool 的组件上表示 N 个不同样式，不是 N 组完整 gallery，也不是 N 个完全相同 clone。
- 如果用户明确要求“变量绑定”或“某 collection 风格”，不要默认走 `shadcn add`。

### 3.4 Blocks

Dashboard 或页面级布局优先查看现成 block：

```bash
figma-cli blocks list
figma-cli blocks create <block-name>
```

不要在已有 block 能满足需求时手工重建完整 dashboard。

## 4. 坐标与几何规则

### 4.1 三条铁律

1. 节点几何坐标使用的是**直接父容器的本地坐标**，不是页面绝对坐标。
2. 新建节点后，先放入目标父容器，再设置 `x / y / w / h`。
3. 改几何优先改位置和尺寸，不要靠删掉重建来“修布局”。

### 4.2 推荐节奏

```text
创建节点 → 放入目标父容器 → 设本地坐标 / 尺寸 → 重新读取关键节点验证
```

### 4.3 改几何用 CLI 命令，别走 eval

以下操作直接走原生命令，比 `eval` 安全、可读、可撤销（完整列表见 `SKILL.md` 常用命令）：

- 单节点改 `x/y/w/h/fill/radius` → `figma-cli set <nodeId> --x --y --w --h --fill --radius`
- 批量改多个节点 → `figma-cli set-batch '[{...},{...}]'`
- 调 auto-layout 尺寸模式（HUG / FILL / FIXED）→ `figma-cli sizing <nodeId>`
- Pin 到父边（stretch-x / scale-y 等）→ `figma-cli pin <edge> <nodeId>`
- 设 padding / gap / align → `figma-cli padding <nodeId> ...` / `figma-cli gap <nodeId> <value>` / `figma-cli align <nodeId> <value>`

`eval` / `script` 只在 CLI 没有对应能力时才用，比如 Plugin API 专属操作、批量读多个节点的私有字段、或修改既有节点的非标属性。

## 5. NodeId 纪律

- 不要凭记忆推断 NodeId。
- clone、reparent、大改结构、删除重建之后，都要重新读取关键节点。
- 不要一口气创建 50+ 节点再回头验证。
- 搜索节点时尽量限定 scope，避免在整份文档里爆炸扫描。

## 5.5 高频节点缓存（可选）

Skill 不内置自动缓存工具；下面是统一的口径，具体项目按这套规则自实现。

### 5.5.1 存储位置

- 路径：`<当前项目根>/.figma/cache.json`。
- 不进 git；建议在项目 `.gitignore` 里加 `.figma/`。
- 单一 JSON 文件，按 `fileKey` 划分命名空间，避免跨文件 NodeId 串扰。

### 5.5.2 缓存字段（白名单）

每个缓存条目建议只保存：

- `id`、`name`、`type`、`parentId`
- 关键几何：`w`、`h`、`layoutMode`（FILL / HUG / FIXED）
- `reuseHandle`（来自 `figma-cli spec` 的复用句柄）
- 变量 collection 名称 + 关键变量 id（用于把 `var:primary` 解析到正确 collection）
- `cachedAt`（时间戳），用于 TTL 判断
- `version`（缓存 schema 版本号，方便以后升级时一次性失效）

### 5.5.3 不缓存的内容

- base64 缩略图、整棵子树 dump、文本字符串。
- setter 操作的中间状态、坐标中间值。
- 一旦写入就会被改动的任何属性。

### 5.5.4 TTL 与失效

- 默认 TTL：**3 天**（259200 秒）。
- TTL 过期 → 强制重读，不允许“用老缓存接着写”。
- 显式失效触发点：
  - 任务中包含“修改 / 移动 / 删除 / 重命名 X” → 命中 key 必须失效并 re-fetch。
  - `figma-cli find` / `spec` 返回与缓存不一致（id、name、type 任意一项不同）→ 立即失效。
  - 用户说“刷新缓存” → 全量重拉。

### 5.5.5 命中后的二次确认

即便缓存命中且 TTL 没过期：

1. 写入任何 id 之前，必须跑一次 `figma-cli find "<name>"` 或 `figma-cli spec "<name>"`。
2. 若返回的 id / 名称 / 类型与缓存一致 → 可继续；输出里注明“使用缓存，已二次确认”。
3. 若不一致：
   - 把旧 key 标记失效。
   - 按返回的新 id 更新缓存。
   - **重新规划几何与下游引用**，不要直接套用旧坐标。
4. 仅读取（不写）场景：二次确认可放宽为只校验存在性。

### 5.5.6 写入路径绝不读缓存

任何 setter（坐标、尺寸、文本、属性）必须基于**重读**拿到的 id 和当前几何，禁止“从缓存里取 id 然后写”。这是和读取路径最大的区别。

### 5.5.7 高频节点的判定标准

缓存不是“什么都能塞”，下面是统一的判定口径：

#### 准入门槛（必须满足）

1. **频次**：同一节点在同一文件内被 `find` / `spec` / `instantiate` 访问 **≥ 3 次**。
   - 不足 3 次的访问，缓存带来的查询加速抵不上维护成本，宁可不缓存。

#### 价值评估（满足 3 项以上）

2. **跨任务复用度**：节点在多个 UI 页或多个 task 中被引用（导航栏、侧边栏、按钮、卡片、表格行骨架）。
3. **身份稳定**：节点类型是 `COMPONENT` / `COMPONENT_SET` / `INSTANCE`，或者拥有 `reuseHandle`，或者名字带项目语义（`Sidebar / NavBar / TableRow`）。
4. **结构复杂度**：子树 ≥ 3 层，或变体集合 ≥ 2，或含可复用子结构。
5. **叶子节点豁免**：纯装饰矩形、单行文字、单色 frame 不缓存（重建成本低，不值得维护缓存条目）。

#### 单任务高频的例外通道

AI 没有跨任务记忆，单次会话里若同一节点在单任务内被查询 ≥ 3 次，可以临时建缓存条目；条件是同时满足“身份稳定 + 结构复杂度”两项。该条目随任务结束失效，不写入持久缓存。

#### 变更频繁的反向保护

- 不强制把“7 天变更次数”作为硬阈值，因为 UI 反复调整是常态。
- 改用“**缓存条目标记 dirty**”机制：任何 setter 操作命中 key 时，把该 key 标记为 dirty；下次查询时优先 re-fetch，并刷新缓存。
- dirty 状态持续 1 次任务即被清掉，避免误判。

#### 显式黑名单（不缓存）

- 临时占位 / 演示用的一次性 Frame。
- 名字带 `Frame N` / `Rectangle N` / `Group N` 这种自动命名。
- 完整子树 dump、base64 缩略图、文本内容。
- 任何接下来就会被 set 改动的属性。
- 跨 `fileKey` 的引用（避免串文件）。
- 叶子节点（纯装饰矩形、单行文字）。

#### 触发时机

- **建缓存**：节点同时命中“准入门槛 + 价值评估 3 项以上”。
- **查缓存**：只读查询（`find` / `spec` / `var list`）时优先查缓存。
- **失效缓存**：写入操作命中 key、TTL 过期、二次确认失败、缓存被标记 dirty。
- **不用缓存**：写入路径、临时节点、跨文件场景、已 detached 的 instance。

#### 与现有纪律的关系

- 缓存不能取代 4.2 的“先重读再写”节奏，只能在只读查询里加速。
- 缓存不能取代 5 自身的 NodeId 纪律：clone / reparent / 重建之后必须重读。
- 缓存命中率与 spec / instantiate 的命中率联动，命中率低时考虑降级为不缓存。

## 6. Token 与变量纪律

本 Skill 不硬编码项目 token。颜色、字号、圆角、间距、阴影、语义色都应以项目设计系统为准。

执行时：

- 先查项目文档、`DESIGN.md`、`figma-cli var list` 或变量 collection。
- 查不到再问用户。
- 不要凭经验把主色、语义色、涨跌色写死。
- `var:name` 应用于 `render`、`create`、`set` 等支持变量绑定的命令。

### 6.1 命名 collection 必须显式绑定

当文件里有多个 variable collection，且用户命名了其中一个（如 `figma`、`cursor`、`airbnb`、`miro`），必须在 `render` / `render-batch` 中传：

```bash
--collection <name>
```

否则 `var:primary` 可能解析到错误系统。

判断方式：

| 用户说法 | 处理 |
|---|---|
| “use figma variables / figma style / figma collection” | 加 `--collection figma` |
| “use airbnb variables / airbnb style” | 加 `--collection airbnb` |
| “cursor themed / cursor tokens” | 加 `--collection cursor` |
| 只说“use variables / themed”但未命名 | 若不知道最近导入 collection，先问用户 |

需要混用系统时，可用 per-attribute 覆盖：`bg="var:cursor:primary"`。

### 6.2 token 细节

- `rounded=` 接受数字，不要写 `rounded="var:md"`；先查 radius token 的 px 值再填数字。
- 数字对齐场景优先使用等宽数字能力。
- 红 / 绿 / 橙 / 黄使用前先确认项目语义限制。
- Apple 风格的 pill、focus ring、glass 等都先看项目是否已有约定。

## 7. JSX / render 常见坑

### 7.1 文本换行

长文本要换行时，父容器和每个 Text 都要有 `w="fill"`：

```jsx
<Frame flex="col" gap={8} w="fill">
  <Text size={16} weight="semibold" w="fill">Long title wraps correctly</Text>
  <Text size={14} w="fill">Description wraps correctly</Text>
</Frame>
```

### 7.2 控件布局

- Button 文本居中：按钮 frame 用 `flex="row" justify="center" items="center"`。
- Toggle switch：用 flex + `justify="start|end"` 控制 knob，不要绝对定位。
- Navbar 两端对齐：优先 `justify="between"`，特殊布局再用 grow spacer。
- Layered art / spinner / badge 可用 `flex="none"` + `position="absolute"`，但要明确命名和坐标。

### 7.3 图标与符号

- 不要用 emoji 做正式 UI 图标；渲染不稳定。
- 优先 `<Icon name="lucide:..." />` 或基础 shape。
- 三点菜单、评分占位等简单符号可用小圆点 / shape 组合。

### 7.4 slots

- JSX 中 `<Slot name="Content" ... />` 会在组件内创建真实 slot。
- `eval` 里设置 `frame.isSlot = true` 不会创建 slot。
- 已有 frame 转 slot 时用 `figma-cli slot convert ...`。

### 7.5 unknown props

常见 JSX 属性名：

```text
layout="horizontal" → flex="row"
padding={24}        → p={24}
fill="#fff"        → bg="#fff"
cornerRadius={12}   → rounded={12}
fontSize={18}       → size={18}
fontWeight="bold"   → weight="bold"
```

CLI 若提示 unknown prop，按建议修正后重跑，不要忽略 warning。

## 8. 复合结构 6 大高频坑

| # | 坑 | 现象 | 应对 |
|---|---|---|---|
| 1 | `clipsContent` 截断 | 子节点超出父框时被裁掉 | 改完结构立刻检查；必要时显式关闭裁切 |
| 2 | ID 重映射 | 结构重排后旧 ID 失效 | 改完立刻重读关键节点 |
| 3 | 实例子项只读 | 子节点属性改不进去 | 改实例暴露属性、换实例、或改源组件 |
| 4 | 升组件是快照 | 升完后才发现结构不对 | 升组件前先把结构和样式调对 |
| 5 | 父框被内容撑开 | 打破原有栅格或容器尺寸 | 改父框时配合 bounds/resize 流程 |
| 6 | 文本自动尺寸不一致 | 文字撑破布局或高度异常 | 长文本优先固定宽度、纵向增长；不可控时显式截断 |

## 9. Section 模式

新增 Section 前，先扫描同 page 下已有 Section：

- 看宽高。
- 看描边、圆角、标题样式、副标题样式。
- 看内容区起点和间距。

不要假设 Section 有固定像素模板；永远从兄弟节点测量得到模式，再做复刻。

## 10. 批量 / 串行纪律

### 适合批量的场景

- 同类重复节点的 clone。
- `render-batch` 创建多个独立同类节点。
- 一次性删除多个同来源节点。
- 多个同来源节点的统一移动或统一 resize。
- 多个目标节点的连续导出。

### 适合串行的场景

- 新建节点后放入父容器，再设置几何。
- 同一容器内多层结构搭建。
- 需要先验证上一步结果再继续的变更。

### 反例

- 一次性铺大量节点再统一排错。
- 父容器还没确定就先写几何。
- 结构坏了就删掉重建。
- 为了省事用 `eval` 批量新建视觉节点。

## 11. 页面内重复内容（卡片组 / 列表项 / 表格行）的复用决策

UI 页里大量重复出现的局部结构（新闻列表卡片、商品卡、feed 行、表格行、用户头像列表），是复用纪律最容易掉链子的地方。这类结构既不像 NavBar 那样"够格单独上组件页"，也不能像占位框那样随手画——它的复用决策需要单独拆开讲。

### 11.1 三条复用路径与决策树

处理"页面内有 N 个结构相同、内容不同的卡片 / 行"时，只有这三条路径可用：

1. **升 Component → 实例化**  
   适合"卡片需要多状态 / 跨页复用 / 后续还要换皮"的场景。
2. **clone 现有节点 → 改内容**  
   适合"本页面里有几张同类卡片，结构和样式都不会变"的场景。一次做一个、复制 N 份、改每份的内容。
3. **`render-batch` 一次性创建 N 份**  
   适合"N 份卡片结构完全一致且共享同一 layout / tokens"的场景；后续想单独调整某一份，依旧可以走 `set` / `text` 命令。

判断流程：

```text
本页面还是多页面？
  ├── 多页面都要用 / 要做多状态变体 → 升 Component（或 Component Set）
  └── 仅本页面使用
        ├── 每份都可能要单独微调 → 先做一个 → clone N 份 → set 改内容
        └── 每份结构和样式完全一致 → render-batch 一次性建
```

禁止路径：

- 直接在 UI 页里手画 N 次相同结构（效率最低、改一处忘十处）。
- 把 N 张卡片塞进一个 wrapper Frame 再 `node to-component`（违反 §3.2 的"不要给 wrapper 升组件"原则）。
- 升了 Component 之后又"为了快速"用 `eval` 复制出脱缰节点（又回到 §2.2 禁止做法第一条）。

### 11.2 卡片复用工作流：做一个 → clone N 份 → 改内容

这是 UI 设计里最常见的一类操作流。标准节奏：

```text
1. 在 UI 页 / 目标父容器里正常做出第一份卡片（含标题、图片、文字、按钮等）
2. figma-cli spec "Card"           →  确认它是不是 COMPONENT / INSTANCE / 普通 Frame
3. figma-cli clone <card-id> --count (N-1) --offset <dx> <dy>
   或 figma-cli clone <card-id>    →  重复 N-1 次到想要的位置
4. 重新读取副本的 NodeId（clone 后节点 id 会变化）   →   关键！
5. figma-cli set <copy-id> --text <新内容>
   figma-cli text <copy-id> <新文案>
   figma-cli set <copy-id> --image <新图片>
6. 导出 verify 截图，逐张看内容是否生效、是否越界
```

要点：

- **clone 后必须重读 NodeId**：违反这一步会导致后续 `set` 写错位置（参考 §5）。
- **改内容用 `set` / `text` 命令，不要 detach 副本再手改**：detached 副本脱离主结构，将来主结构改版时副本不会跟随。
- **N 张卡片的纵向 / 横向间距** 优先用父容器的 `gap` 或 auto-layout，而不是手动算每张的 `y`。
- **如果卡片需要换图**：优先用 `set` 的 image 字段，不要 `delete` 旧图再 `create`。

### 11.3 什么时候必须升 Component

出现以下任一情况，把当前卡片"升 Component"再创建实例更划算：

- 卡片在多个页面（比如首页 + 详情页 + 推荐页）都要出现。
- 卡片有 ≥ 2 个语义状态（已读 / 未读、关注 / 已关注、收藏 / 未收藏）。
- 后续设计迭代可能改卡片结构（比如增加 footer、改 padding）——升了 Component 后续改一处全跟随，不升则要手动改 N 次。
- 卡片会作为 `instantiate` 来源被其他设计页 / 其他文件消费。

反之，本页面静态的 5 张同结构卡片，clone 就够，不必为了"看起来规范"强行升 Component。

### 11.4 常见错误

| # | 错误 | 后果 | 正确做法 |
|---|---|---|---|
| 1 | 把 clone 出来的 N 张卡片先 `group_nodes` 再 `to-component` | 失去单卡可单独移动 / 重命名的能力 | 直接逐张 `clone`；不要套 wrapper |
| 2 | 用 `render-batch` 建了 N 张卡片后又 `set-batch` 改全部 | `set-batch` 对同名字段是统一改，结果所有卡片变成同一份内容 | 改内容用 `set` / `text` 单卡调用，按 NodeId 区分 |
| 3 | 卡片是 INSTANCE 但试图直接 `set` 内部文字 | INSTANCE 子项只读，set 不进去 | 用 `set text` / 暴露 `text` property、或改源 Component |
| 4 | clone 后凭旧 NodeId 继续 set | 写入失败或错位 | clone 后跑一次 `find` / `get_children` 重读所有副本的 id |
| 5 | "几十张卡片"整体升 Component | 拖累性能、设计后续小调整要重做 Component | 静态卡片用 clone 即可；只有 §11.3 触发条件才升 Component |

### 11.5 与既有纪律的关系

- §11 不能取代 §2.2 的复用优先级总表——§11 只是把"页面内重复内容"这一最难判断的场景单拆出来。
- §11 同样遵守 §5（clone / reparent 之后必须重读 NodeId）。
- §11 不绕开 §13（每轮修改后的 verify 截图），clone N 份卡片后必须实际看图确认内容生效。
