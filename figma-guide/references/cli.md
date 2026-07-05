# cli.md

本文件只讲 `figma-cli` 的安装、调用和当前验证状态。

## 1. 当前状态

截至本次重构时，已确认：

- `figma` 命令当前**不在 PATH**。
- `npx` 当前**可用**。
- `npm list -g --depth=0` 输出中**未看到** `@nono/figma-cli`。

因此当前只能说：

- CLI 工作流已经按 `@nono/figma-cli` 的命令形态整理好；
- 文档中已经给出推荐调用方式；
- **本机是否可直接执行，仍待 smoke test 验证**。

在真正跑过命令之前，不要把它写成“已验证可用”。

## 2. 什么时候查本页

以下情况优先看本页：

- 需要确认 CLI 是否已安装。
- 需要知道应该用 `figma`、`npx -y @nono/figma-cli`，还是本地仓库入口。
- 需要看 JSON I/O 契约、退出码、长 JSON 处理方式。
- 需要快速判断当前环境能不能做 CLI smoke test。

## 3. 推荐安装方式

### 方案 A：全局安装

```bash
npm install -g @nono/figma-cli
```

适合：

- 本机长期使用。
- 希望直接运行 `figma`。

### 方案 B：临时通过 `npx`

```bash
npx -y @nono/figma-cli list
```

适合：

- 本机未全局安装。
- 只想临时验证命令是否可跑。

### 方案 C：本地仓库入口

如果你维护的是未发布版本，也可以通过本地仓库入口调用对应 `cli.js`。

适合：

- 调试本地开发中的 CLI。
- 尚未完成发布流程。

## 4. 推荐调用形式

优先使用 canonical `call` 形式：

```bash
figma call <tool> --json '{...}'
```

建议约定：

- 简单 payload 走 `--json`。
- 长 JSON 走 `--json-file`。
- 需要临时验证时先跑 `list`。

示例：

```bash
figma list
figma call figma_get_context --json '{}'
figma call figma_export_node --json-file ./args.json
```

若本机没有 `figma` 命令，可改为：

```bash
npx -y @nono/figma-cli list
npx -y @nono/figma-cli call figma_get_context --json '{}'
```

## 5. 长 JSON 处理

当 payload 比较长时，不建议直接塞到命令行里。推荐：

```bash
figma call figma_export_node --json-file ./args.json
```

这样做的好处：

- 避免命令行长度问题。
- 便于复用、回放和存档。
- 减少 JSON 转义失误。

## 6. 输出契约

推荐按以下心智模型理解 CLI：

- `stdout`：输出单个 JSON 文档。
- `stderr`：输出提示、错误或运行日志。
- `exit code`：区分成功、参数错误、业务错误、传输错误。

处理结果时：

- 先看退出码。
- 再解析 `stdout` JSON。
- 不要把它当成“流式日志输出”。

## 7. 验证顺序

推荐 smoke test 顺序：

### 第一步：确认命令存在

```bash
command -v figma
```

### 第二步：看全局安装情况

```bash
npm list -g --depth=0
```

### 第三步：列出工具

若 `figma` 已存在：

```bash
figma list
```

若 `figma` 不存在但允许通过 `npx` 临时验证：

```bash
npx -y @nono/figma-cli list
```

### 第四步：最小调用测试

命令可运行后，再做最小 `call`：

```bash
figma call figma_get_context --json '{}'
```

或：

```bash
npx -y @nono/figma-cli call figma_get_context --json '{}'
```

## 8. 何时写“当前环境待验证”

遇到以下任一情况，都应写成“当前环境待验证”：

- `figma` 不在 PATH。
- 未确认是否全局安装。
- 用户不希望跑 `npx` 下载式验证。
- 命令能列出工具，但还没完成最小调用测试。

## 9. 常见误区

- 把文档里的命令形态当成“本机已安装完成”的证据。
- 还没看 PATH 和全局包，就宣称 CLI 可用。
- 长 JSON 直接塞命令行。
- 不看退出码，只盯着 `stdout` 有没有内容。
