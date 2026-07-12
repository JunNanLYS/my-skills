# Installation and Connection

## Existing CLI Gate

1. 运行 `figma-cli --version`。
2. 运行 `figma-cli --help`。
3. 两者都成功才允许继续。

PATH 中存在但任一检查失败时，必须视为损坏安装。

## Windows Installation

Windows 未安装时运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File <skill-directory>/scripts/install-figma-cli.ps1
```

安装器必须解析 `silships/figma-cli` 官方 GitHub Releases 的最新稳定、非 draft、非 prerelease 版本。存在兼容 Windows Release asset 时使用该 asset；没有兼容 asset 时，必须使用同一 Release 的 `zipball_url`，验证 `package.json` 的名称和版本，再从解压后的本地目录安装。禁止把 npm registry latest tag 当作版本来源。

安装失败必须停止 Figma 任务。禁止改用 Figma MCP、其他 CLI、GUI 自动化或按包名安装 registry latest。

首版只自动安装 Windows。非 Windows 只有在现有 `figma-cli` 通过两个检查时才允许继续。

## Yolo Connection Gate

每个新会话执行一次：

1. `figma-cli connect`
2. `figma-cli status`
3. Figma Desktop 连接和 daemon 状态都通过后才允许继续。

失败时检查当前 `connect --help`、`status --help` 和 `daemon --help`，并报告失败层。只有用户明确要求时才允许 Safe 模式。连接失败必须停止所有 Figma 读写。
