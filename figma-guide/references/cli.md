# cli.md

本文件只讲一件事：`figma-guide` 应该使用哪个 CLI，以及 AI 在不确定命令时该如何自查。

## 1. 唯一 CLI 入口

本 Skill 统一使用：

- 仓库：`https://github.com/silships/figma-cli`
- 主命令：`figma-cli`
- 等价别名：`figma-ds-cli`

默认规则：

- 文档、示例、提示语一律优先写 `figma-cli`。
- 若本机只存在 `figma-ds-cli`，可视为等价命令。
- 不再引用历史文档里的其他 Figma CLI 语法。

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

## 4. AI 应该如何查询命令

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

## 5. 使用口径

AI 使用本 CLI 时应遵守：

- 先查 help，再执行真实命令。
- 不要凭旧记忆猜子命令、参数名或输出格式。
- 不要把别的 Figma CLI 语法套到这个仓库上。
- 若用户只要求“用哪个 CLI、怎么查命令”，不要继续展开成整页命令手册。

## 6. 废弃内容处理原则

本 Skill 不再保留以下类型的内容：

- 指向其他历史 CLI 路径的安装或调用说明
- 与当前 `figma-cli --help` 不一致的旧语法示例
- 指向瞬时机器状态的临时说明（例如本地安装状态、一次性检测结论）

若未来 CLI 再升级，直接以仓库 README 和本机 `--help` 输出为准，更新本文件的唯一入口信息与查询方法即可。
