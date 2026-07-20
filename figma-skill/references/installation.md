# Installation and Connection

## Install Once (Required First Run)

`figma-skill` 的 Rust CLI **不会**自动出现在 `PATH` 上——每个用户首次使用本 skill 时必须手动跑一次安装脚本，把 `figma-skill/bin/` 下的两个 binary 复制到一个**单一规范化位置**，再把那个位置写入 user PATH。这一步只需做一次：

```bash
# 在 skill 根目录下：
node scripts/install-figma-cli.ps1
# 或：
pwsh -NoProfile -File scripts/install-figma-cli.ps1
```

脚本做三件事：

1. 复制 `figma-skill/bin/figma-cli.exe` 与 `figma-daemon.exe` 到 `%LOCALAPPDATA%\figma-cli\bin\`（即 `C:\Users\<user>\AppData\Local\figma-cli\bin\`）。
2. SHA-256 校验：源 binary 与目标 binary 哈希一致则**跳过复制**——脚本幂等，可重复跑。
3. 用 `[Environment]::SetEnvironmentVariable("Path", ..., "User")` 把 `%LOCALAPPDATA%\figma-cli\bin\` 加入 user-level PATH（HKCU\Environment），已存在则跳过。

**为什么需要这个独立位置**：skill 目录本身会通过 `sync-skills.mjs` 复制到多个位置（`~/.claude/skills/figma-skill/bin/`、`~/.codex/skills/figma-skill/bin/` 等）；每个 agent 都把 skill bin 加到 PATH 会导致重复 entry 与版本漂移。`%LOCALAPPDATA%\figma-cli\bin\` 是**单一规范化 runtime location**，所有 agent / shell / IDE 都从这里加载。

**支持参数**：

```bash
# 预览（不复制、不改 PATH）
node scripts/install-figma-cli.ps1 -WhatIf
# 或
pwsh -NoProfile -File scripts/install-figma-cli.ps1 -WhatIf

# 自定义源 / 目标
node scripts/install-figma-cli.ps1 -SourceBin C:\path\to\other\bin -InstallBin D:\tools\figma-cli\bin
```

**注意**：脚本只写 user PATH，不会自动通知已经打开的 shell。每个 agent 启动新进程时自然继承新 PATH；老 shell 需要重启或手动 `refreshenv`（PowerShell）。

## Existing CLI Gate

1. **打开新的 shell**（让 user PATH 生效）。
2. 运行 `figma-cli --version`——必须能解析到 `%LOCALAPPDATA%\figma-cli\bin\figma-cli.exe`。
3. 运行 `figma-cli --help`——必须返回 v3 命令面（daemon / eval / patch / unpatch / connect / disconnect / batch / export / node / create / read / design / fill / stroke / radius / size / scale / pos / opacity / name / effect / shadow / blur / corners / stroke-weight / constraints / rotation / blend-mode / text / help）。
4. 两项都成功才允许进入 Connection Gate。

PATH 中存在 `figma-cli` 但指向**非 install path**（例如指向 `figma-skill/bin/figma-cli.exe`）视为损坏安装——重跑 install 脚本以统一到规范化路径。

PATH 中存在但 `--help` 返回 v2 旧命令面（`lint` / `canvas next` / `unstack` 等）也视为损坏——说明 PATH 上有遗留的旧 CLI，需先 `Remove-Item` 再重装。

## Daemon Process

`figma-daemon.exe` 与 `figma-cli.exe` 同 install path 目录，由 `figma-cli daemon start` 自动管理。token 文件固定位于 `~/.figma-ds-cli/.daemon-token`；多 agent 并发共享同一 token 文件——任何 session 调用 `daemon restart / stop / reconnect` 都会重新生成 token 并让其他 agent 的 CDP 连接断开，必须由统一 orchestrator 决策。

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

## 升级 figma-cli

仓库内的 `figma-skill/bin/figma-cli.exe` 是 source of truth。Skill 通过 sync-skills.mjs 同步到 `~/.claude/skills/figma-skill/bin/` 与 `~/.codex/skills/figma-skill/bin/` 等位置。**这些位置不是 canonical install path——它们只用于仓库分发**。

升级流程：

```bash
git pull origin main                 # 拉新 binary
node scripts/install-figma-cli.ps1   # 脚本会自动检测 hash 不一致并覆盖
```

脚本是幂等的：源与目标 hash 相同 → skip；不同 → 覆盖。

## 卸载

```bash
# 1. 停止 daemon
figma-cli daemon stop

# 2. 移除 canonical install path
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\figma-cli"

# 3. 从 user PATH 移除该 entry
[Environment]::SetEnvironmentVariable(
    "Path",
    (([Environment]::GetEnvironmentVariable("Path", "User") -split ';' |
       Where-Object { $_ -ne "$env:LOCALAPPDATA\figma-cli\bin" }) -join ';'),
    "User"
)

# 4. 可选：清理 daemon 状态目录
Remove-Item -Recurse -Force "$HOME\.figma-ds-cli"
```