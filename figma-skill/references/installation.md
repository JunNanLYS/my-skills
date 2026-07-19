# Installation and Connection

## Existing CLI Gate

1. 运行 `figma-cli --version`。
2. 运行 `figma-cli --help`。
3. 两者都成功才允许继续。

PATH 中存在但任一检查失败时，必须视为损坏安装并报告。

## Skill-bundled Binary

`figma-skill/bin/figma-cli.exe` 是本 skill 自带的 Rust 重写版 CLI（与 `figma-daemon.exe` 同目录）。推荐调用方式：

```bash
# 直接用 skill 自带 binary（无需安装）
"$(git rev-parse --show-toplevel)/figma-skill/bin/figma-cli.exe" --version

# 或者把 bin/ 加入 PATH
export PATH="$PWD/figma-skill/bin:$PATH"
figma-cli --version
```

Windows PowerShell 等价：

```powershell
& "$PSScriptRoot\..\figma-skill\bin\figma-cli.exe" --version
```

如果 `figma-cli` 已存在于 PATH 且两个检查通过，允许继续；否则必须显式指定 `bin/figma-cli.exe` 路径。禁止从 npm registry 或其他来源拉取同名 CLI；禁止把 Figma MCP、其他 Figma CLI、GUI 自动化作为替代路径。

## Daemon Process

`figma-daemon.exe` 与 `figma-cli.exe` 同目录，由 `figma-cli daemon start` 自动管理。token 文件固定位于 `~/.figma-ds-cli/.daemon-token`；多 agent 并发共享同一 token 文件——任何 session 调用 `daemon restart / stop / reconnect` 都会重新生成 token 并让其他 agent 的 CDP 连接断开，必须由统一 orchestrator 决策。

## Singular Yolo Connection Gate

每个新会话必须按下列顺序执行：

```text
figma-cli --version
figma-cli --help
figma-cli daemon status
  若 connected-to-figma 且 daemon-running → 跳过 connect，直接进入下一步
  否则 figma-cli connect（不传 --safe / --no-restart / --no-patch，除非用户明确批准）
figma-cli daemon status   # 二次确认
```

失败时按当前 `connect --help`、`daemon --help`、`daemon diagnose --help` 输出报告；失败层必须明确（CLI 缺失 / daemon 未运行 / token 失效 / CDP 断开）。任何情况下禁止自动调用 `daemon restart`——它会打断其他 agent 的并发会话。