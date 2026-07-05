# cli.md

本文件只讲两件事：`figma-guide` 应该使用哪个 CLI，以及 AI 在不确定命令时该如何自查和选择主命令入口。

## 1. 唯一 CLI 入口

本 Skill 统一使用：

- 仓库：`https://github.com/silships/figma-cli`
- 主命令：`figma-cli`
- 等价别名：`figma-ds-cli`

默认规则：

- 文档、示例、提示语一律优先写 `figma-cli`。
- 若本机只存在 `figma-ds-cli`，可视为等价命令。
- 不再引用历史文档里的其他 Figma CLI 语法。
- 不要默认使用 `npx figma-use ...` 或其他旧工具链。

## 2. 安装与更新

### 安装

优先按仓库 release 或本地源码目录安装，避免从 npm 拉到旧版本：

```bash
npm install -g "D:\\Project\\figma-cli-2.1.0"
```

如果用户下载了新的 release 目录，则直接替换路径重新安装：

```bash
npm install -g "D:\\Project\\figma-cli-新版本目录"
```

### 更新

当前已知情况：

- GitHub release 已到 2.x。
- npm registry 上的 `figma-ds-cli` 仍可能停留在较老版本。

因此默认更新策略是：

- **优先用 GitHub release / 本地目录更新**。
- 不要默认执行 `npm install -g figma-ds-cli`，除非先确认 npm 上确实是目标版本。

## 3. 连接 Figma 的标准方式

- `figma-cli connect`：默认就是 **Yolo 模式**。
- `figma-cli connect --safe`：需要插件桥接时再用。
- `figma-cli status`：查看当前连接状态。
- `figma-cli daemon --help`：需要处理 daemon 问题时再查。
- `figma-cli unpatch`：需要回滚 Yolo patch 时使用。

## 4. 常见意图的主命令入口

本表不是完整命令手册；执行前仍以 `figma-cli --help` 和子命令 help 为准。

| 用户意图 | 优先查看 / 使用 |
|---|---|
| 连接或检查 Figma | `figma-cli connect`、`figma-cli status`、`figma-cli files` |
| 看画布 / 找节点 | `figma-cli canvas info`、`figma-cli find "Name"` |
| 创建单个 frame / rectangle / 组件草图 | `figma-cli render '<Frame>...</Frame>'` |
| 创建多个自定义同类节点 | `figma-cli render-batch '[...]' --direction row|col` |
| 创建 dashboard 或页面级布局 | `figma-cli blocks list` 后 `figma-cli blocks create <block>` |
| 创建 shadcn 原语 | `figma-cli shadcn add <component> [--count N]` |
| 转成组件 | `figma-cli node to-component "NODE_ID"` |
| 使用已有组件而不是重画 | `figma-cli spec "Component"` 后 `figma-cli instantiate "Component"` |
| 组合 variants | `figma-cli variants from <ids> ...` 或 `figma-cli prop combine <ids> ...` |
| 创建 / 管理 slots | `figma-cli slot create/list/convert/reset/...` |
| 导入 token 或代码来源 | `figma-cli import <tailwind.config.js|globals.css|tokens.json|storybook-url|DESIGN.md>` |
| 导出设计系统文档 | `figma-cli extract [output.md]` |
| 导出 token | `figma-cli export dtcg|css|tailwind ...` |
| 创建或查看变量 | `figma-cli tokens ...`、`figma-cli var list`、`figma-cli var visualize` |
| 导出 PNG / SVG 或验证截图 | `figma-cli verify --save ...` 或 `figma-cli export ... -o ...` |
| 还原上一步 | `figma-cli undo` |
| 图片渐变 / mesh 背景 | `figma-cli gradient extract ...`、`figma-cli gradient mesh ...` |
| Figma motion | `figma-cli motion inspect/add/preset/stagger/apply/...` |
| 可访问性检查 | `figma-cli a11y contrast|vision|touch|text|audit` |
| 插件 / voice / chat | `figma-cli plugins ...`、`figma-cli voice`、`figma-cli chat ...` |

对用户沟通时：

- 除非用户明确要学习命令，否则不要把终端命令长篇贴给用户。
- 先执行并验证，再用自然语言报告结果。
- 用户自然语言里说“导出设计系统”“导入 Tailwind 颜色”“用已有 Button”，都应映射到对应 CLI 能力，而不是要求用户背命令。

## 5. AI 应该如何查询命令

本 Skill 不维护大而全的命令枚举。AI 一律按以下顺序自查：

### 第一步：查顶层命令

```bash
figma-cli --help
```

### 第二步：查命令组

```bash
figma-cli <command> --help
```

### 第三步：查子命令

```bash
figma-cli <command> <subcommand> --help
```

### 第四步：先查状态再执行

如果不确定连接、文件或运行上下文：

```bash
figma-cli status
figma-cli files
```

## 6. 使用口径

AI 使用本 CLI 时应遵守：

- 先查 help，再执行真实命令。
- 不要凭旧记忆猜子命令、参数名或输出格式。
- 不要把别的 Figma CLI 语法套到这个仓库上。
- 优先使用 `render` / `render-batch` / `blocks` / `shadcn` / `node` / `variants` 等原生命令创建视觉节点。
- `eval` 只用于没有 CLI 对应能力的 Plugin API 操作、批量读取、或修改既有节点；禁止用 `eval` 新建视觉节点。
- 若用户只要求“用哪个 CLI、怎么查命令”，不要继续展开成整页命令手册。

## 7. 废弃内容处理原则

本 Skill 不再保留以下类型的内容：

- 指向其他历史 CLI 路径的安装或调用说明
- 与当前 `figma-cli --help` 不一致的旧语法示例
- 指向瞬时机器状态的临时说明（例如本地安装状态、一次性检测结论）

若未来 CLI 再升级，直接以仓库 README 和本机 `--help` 输出为准，更新本文件的唯一入口信息与查询方法即可。
