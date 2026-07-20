#!/usr/bin/env pwsh
# install-figma-cli.ps1 (v3) — manual installer for the Rust-port figma-cli
#
# Source of truth : <skill-root>/bin/figma-cli.exe + figma-daemon.exe
# Install target  : %LOCALAPPDATA%\figma-cli\bin\  (canonical runtime location)
# PATH update     : adds the install bin to user PATH (HKCU\Environment)
#
# Idempotent — re-running this script with the same source bytes is a no-op.
# Safe to call from any agent / shell — the install path is a single
# canonical location shared across all sessions.

[CmdletBinding()]
param(
    # Override the source directory that contains figma-cli.exe / figma-daemon.exe.
    # Default: <skill-root>/bin/  (resolved relative to this script).
    [string]$SourceBin,

    # Override the install directory. Default: %LOCALAPPDATA%\figma-cli\bin
    [string]$InstallBin = (Join-Path $env:LOCALAPPDATA "figma-cli\bin"),

    # Dry run — print the actions without copying or mutating PATH.
    [switch]$WhatIf,

    # Skip SHA-256 check (NOT recommended).
    [switch]$SkipChecksum
)

$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# Resolve source / target paths
# ---------------------------------------------------------------------------
$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillRoot   = Split-Path -Parent $ScriptDir
$SourceBin   = if ($SourceBin) { (Resolve-Path -LiteralPath $SourceBin).Path } else { (Join-Path $SkillRoot "bin") }
$InstallBin  = if ($WhatIf) { $InstallBin } else { [Environment]::ExpandEnvironmentVariables($InstallBin) }

$ExeSource   = Join-Path $SourceBin "figma-cli.exe"
$DaemonSrc   = Join-Path $SourceBin "figma-daemon.exe"
$ExeTarget   = Join-Path $InstallBin "figma-cli.exe"
$DaemonTgt   = Join-Path $InstallBin "figma-daemon.exe"

if (-not (Test-Path -LiteralPath $ExeSource)) {
    throw "Source binary not found: $ExeSource. Make sure you are running this script from inside figma-skill/, or pass -SourceBin."
}
if (-not (Test-Path -LiteralPath $DaemonSrc)) {
    throw "Source binary not found: $DaemonSrc. The daemon is required for figma-cli to talk to Figma."
}

# ---------------------------------------------------------------------------
# Hash helper
# ---------------------------------------------------------------------------
function Get-FileHash256 {
    param([string]$Path)
    $h = Get-FileHash -LiteralPath $Path -Algorithm SHA256
    return $h.Hash.ToLower()
}

# ---------------------------------------------------------------------------
# Pre-flight: if both files already match source hash, no-op.
# ---------------------------------------------------------------------------
$NeedsCopy = $true
if ((Test-Path -LiteralPath $ExeTarget) -and (Test-Path -LiteralPath $DaemonTgt) -and -not $SkipChecksum) {
    $srcExeHash    = Get-FileHash256 $ExeSource
    $srcDaemonHash = Get-FileHash256 $DaemonSrc
    $tgtExeHash    = Get-FileHash256 $ExeTarget
    $tgtDaemonHash = Get-FileHash256 $DaemonTgt
    if ($srcExeHash -eq $tgtExeHash -and $srcDaemonHash -eq $tgtDaemonHash) {
        $NeedsCopy = $false
    }
}

if ($WhatIf) {
    Write-Host "[whatif] Source: $SourceBin"
    Write-Host "[whatif] Target: $InstallBin"
    if ($NeedsCopy) {
        Write-Host "[whatif] Would copy figma-cli.exe + figma-daemon.exe"
    } else {
        Write-Host "[whatif] Source bytes already match target — would skip copy"
    }
    Write-Host "[whatif] Would ensure $InstallBin is on user PATH (idempotent)"
    return
}

# ---------------------------------------------------------------------------
# Copy
# ---------------------------------------------------------------------------
if ($NeedsCopy) {
    New-Item -ItemType Directory -Force -Path $InstallBin | Out-Null
    Copy-Item -LiteralPath $ExeSource  -Destination $ExeTarget  -Force
    Copy-Item -LiteralPath $DaemonSrc -Destination $DaemonTgt  -Force
    Write-Host "Copied figma-cli.exe + figma-daemon.exe -> $InstallBin"
} else {
    Write-Host "Source bytes match target — nothing to copy."
}

# ---------------------------------------------------------------------------
# PATH update (user scope, [Environment]::SetEnvironmentVariable, idempotent)
# ---------------------------------------------------------------------------
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$entries  = @($userPath -split ';' | Where-Object { $_ })

if ($entries -notcontains $InstallBin) {
    $newPath = (@($InstallBin) + $entries) -join ';'
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "Added $InstallBin to user PATH."
    Write-Host "(New shells will pick this up automatically; already-open shells need to be restarted or read the new PATH manually.)"
} else {
    Write-Host "$InstallBin already on user PATH."
}

# ---------------------------------------------------------------------------
# Post-install sanity check
# ---------------------------------------------------------------------------
$postExeHash    = Get-FileHash256 $ExeTarget
$postDaemonHash = Get-FileHash256 $DaemonTgt
Write-Host ""
Write-Host "Installed:"
Write-Host "  $ExeTarget  (sha256=$postExeHash)"
Write-Host "  $DaemonTgt  (sha256=$postDaemonHash)"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Open a NEW shell (so PATH is re-read)."
Write-Host "  2. Run: figma-cli --version"
Write-Host "  3. Run: figma-cli --help"
Write-Host "  4. Run: figma-cli daemon status"
Write-Host "  5. If daemon is not running: figma-cli connect"
