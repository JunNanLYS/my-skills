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

安装器只接受 leaf 名为 `figma-cli` 的目标路径，文件系统根与宽 `Programs` 目录拒绝；安装前必须验证发布 checksum。安装失败必须停止 Figma 任务。禁止改用 Figma MCP、其他 CLI、GUI 自动化或按包名安装 registry latest。

首版只自动安装 Windows。非 Windows 只有在现有 `figma-cli` 通过两个检查时才允许继续。

## Pre-Spec Environment Gate

每个新会话必须按下列顺序执行：

```text
figma-cli --version
figma-cli --help
figma-cli status
  若 connected-to-figma 且 daemon-running → 跳过 connect，直接进入下一步
  否则 figma-cli connect（不传 --safe，除非用户明确批准）
figma-cli status
  确认 PASS
```

This command output is Pre-Spec Context Gate evidence for tasks requiring live Figma access.

失败时按当前 `connect --help`、`status --help` 和 `daemon --help` 报告；失败层必须明确（CLI 缺失 / daemon 未运行 / token 失效 / CDP 断开）。任何情况下禁止自动调用 `daemon restart`。