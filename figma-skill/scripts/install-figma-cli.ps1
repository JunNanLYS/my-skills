[CmdletBinding()]
param(
    [switch]$PlanOnly,
    [string]$ReleaseMetadataPath,
    [ValidateSet("AMD64", "ARM64")]
    [string]$Architecture = $env:PROCESSOR_ARCHITECTURE,
    [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA "Programs\figma-cli"),
    [string]$TrustedChecksumPath,
    [switch]$SkipExistingCheck
)

$ErrorActionPreference = "Stop"
$ReleaseApi = "https://api.github.com/repos/silships/figma-cli/releases/latest"
$TempRoot = $null

function Get-ReleaseMetadata {
    param([string]$FixturePath)
    if ($FixturePath) {
        return Get-Content -Raw -LiteralPath $FixturePath | ConvertFrom-Json
    }
    return Invoke-RestMethod -Headers @{ "User-Agent" = "figma-skill-installer" } -Uri $ReleaseApi
}

function Get-InstallPlan {
    param($Release, [string]$CpuArchitecture)
    if ($Release.draft -or $Release.prerelease) {
        throw "Latest metadata resolved to a draft or prerelease; refusing installation."
    }
    if ($Release.tag_name -notmatch '^v?(\d+\.\d+\.\d+)$') {
        throw "Release tag '$($Release.tag_name)' is not a stable semantic version."
    }

    $version = ($Release.tag_name -replace '^v', '')
    $archPattern = if ($CpuArchitecture -eq "ARM64") { 'arm64|aarch64' } else { 'x64|amd64' }
    $asset = @($Release.assets) | Where-Object {
        $_.name -match '(?i)(windows|win32|win-)' -and
        $_.name -match "(?i)($archPattern)" -and
        $_.name -match '(?i)\.zip$'
    } | Select-Object -First 1

    if ($asset) {
        return [ordered]@{
            tagName = $Release.tag_name
            version = $version
            architecture = $CpuArchitecture
            mode = "portable-zip"
            downloadUrl = $asset.browser_download_url
            assetName = $asset.name
        }
    }

    if (-not $Release.zipball_url) {
        throw "Stable Release has no compatible Windows asset and no zipball_url."
    }
    return [ordered]@{
        tagName = $Release.tag_name
        version = $version
        architecture = $CpuArchitecture
        mode = "source-archive"
        downloadUrl = $Release.zipball_url
        assetName = $null
    }
}

function Invoke-CheckedCommand {
    param([string]$Command, [string[]]$Arguments)
    $output = & $Command @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "$Command $($Arguments -join ' ') failed: $($output -join [Environment]::NewLine)"
    }
    return ($output -join [Environment]::NewLine).Trim()
}

function Add-UserPathEntry {
    param([string]$Entry)
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $entries = @($userPath -split ';' | Where-Object { $_ })
    if ($entries -notcontains $Entry) {
        $newPath = (@($Entry) + $entries) -join ';'
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    }
}

function Refresh-ProcessPath {
    $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machine;$user"
}

function Assert-ValidInstallRoot {
    param([string]$Path)
    $leaf = Split-Path $Path -Leaf
    if ($leaf -ne "figma-cli") {
        throw "REJECTED-INSTALLROOT: '$leaf' is not 'figma-cli'"
    }
    $parent = Split-Path $Path -Parent
    if (-not $parent) {
        throw "InstallRoot cannot be a filesystem root: $Path"
    }
    $broadParents = @(
        [Environment]::GetFolderPath("ProgramFiles"),
        [Environment]::GetFolderPath("ProgramFilesX86")
    ) | Where-Object { $_ } | Select-Object -Unique
    foreach ($bp in $broadParents) {
        if ($Path -eq $bp) {
            throw "InstallRoot cannot be a broad Programs directory: $Path"
        }
    }
}

function Get-FileSha256 {
    param([string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Test-ChecksumMatch {
    param([string]$ArchivePath, [string]$ChecksumPath, [string]$AssetName)
    if (-not $ChecksumPath) {
        Write-Host "[checksum] No TrustedChecksumPath provided; skipping SHA-256 verification."
        return
    }
    if (-not (Test-Path -LiteralPath $ChecksumPath)) {
        throw "TrustedChecksumPath not found: $ChecksumPath"
    }
    $checksums = Get-Content -Raw -LiteralPath $ChecksumPath | ConvertFrom-Json
    if (-not $checksums.sha256) {
        throw "TrustedChecksumPath JSON must contain a 'sha256' field."
    }
    $expected = $checksums.sha256
    $actual = Get-FileSha256 -Path $ArchivePath
    if ($actual -ne $expected) {
        throw "SHA-256 mismatch for archive${AssetName}: expected $expected, got $actual"
    }
    Write-Host "[checksum] SHA-256 verified: $actual"
}

try {
    Assert-ValidInstallRoot -Path $InstallRoot
    if (-not $PlanOnly -and -not $SkipExistingCheck) {
        $existing = Get-Command figma-cli -ErrorAction SilentlyContinue
        if ($existing) {
            $existingVersion = Invoke-CheckedCommand -Command "figma-cli" -Arguments @("--version")
            Invoke-CheckedCommand -Command "figma-cli" -Arguments @("--help") | Out-Null
            Write-Host "figma-cli $existingVersion is already installed and responds correctly."
            exit 0
        }
    }

    $release = Get-ReleaseMetadata -FixturePath $ReleaseMetadataPath
    $plan = Get-InstallPlan -Release $release -CpuArchitecture $Architecture

    if ($plan.mode -eq "portable-zip" -and $TrustedChecksumPath) {
        $plan["checksumSource"] = "trusted-checksum-path"
    } elseif ($plan.mode -eq "portable-zip") {
        $plan["checksumSource"] = "none"
    } else {
        $plan["checksumSource"] = "none-binary-unavailable"
    }

    if ($PlanOnly) {
        $plan | ConvertTo-Json -Compress
        exit 0
    }

    $TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("figma-cli-" + [guid]::NewGuid())
    $archive = Join-Path $TempRoot "release.zip"
    $expanded = Join-Path $TempRoot "expanded"
    New-Item -ItemType Directory -Path $expanded -Force | Out-Null
    if ($plan.downloadUrl -match '^file://') {
        $localPath = $plan.downloadUrl -replace '^file://', ''
        if (-not (Test-Path -LiteralPath $localPath)) {
            throw "Local archive not found: $localPath"
        }
        Copy-Item -LiteralPath $localPath -Destination $archive -Force
    } else {
        Invoke-WebRequest -UseBasicParsing -Headers @{ "User-Agent" = "figma-skill-installer" } -Uri $plan.downloadUrl -OutFile $archive
    }
    Test-ChecksumMatch -ArchivePath $archive -ChecksumPath $TrustedChecksumPath -AssetName $plan.assetName
    Expand-Archive -LiteralPath $archive -DestinationPath $expanded -Force

    if ($plan.mode -eq "portable-zip") {
        $executables = @(Get-ChildItem -LiteralPath $expanded -Recurse -File -Filter "figma-cli.exe")
        if ($executables.Count -ne 1) {
            throw "Expected exactly one figma-cli.exe in the Release asset; found $($executables.Count)."
        }
        if (Test-Path -LiteralPath $InstallRoot) {
            Remove-Item -LiteralPath $InstallRoot -Recurse -Force
        }
        New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
        Copy-Item -Path (Join-Path $executables[0].Directory.FullName "*") -Destination $InstallRoot -Recurse -Force
        Add-UserPathEntry -Entry $InstallRoot
    } else {
        Write-Host "[checksum] Source archive mode — no binary to checksum; relying on package name/version validation."
        $nodeVersion = Invoke-CheckedCommand -Command "node" -Arguments @("--version")
        if ($nodeVersion -notmatch '^v(\d+)\.') {
            throw "Could not parse Node.js version '$nodeVersion'."
        }
        if ([int]$Matches[1] -lt 18) {
            throw "figma-cli requires Node.js >=18; found $nodeVersion."
        }
        Invoke-CheckedCommand -Command "npm" -Arguments @("--version") | Out-Null

        $roots = @(Get-ChildItem -LiteralPath $expanded -Directory)
        if ($roots.Count -ne 1) {
            throw "Expected one source root in the Release archive; found $($roots.Count)."
        }
        $packagePath = Join-Path $roots[0].FullName "package.json"
        if (-not (Test-Path -LiteralPath $packagePath)) {
            throw "Release source archive does not contain a root package.json."
        }
        $package = Get-Content -Raw -LiteralPath $packagePath | ConvertFrom-Json
        if ($package.name -ne "figma-ds-cli") {
            throw "Unexpected package name '$($package.name)'; expected 'figma-ds-cli'."
        }
        if ($package.version -ne $plan.version) {
            throw "Package version '$($package.version)' does not match Release '$($plan.version)'."
        }
        Invoke-CheckedCommand -Command "npm" -Arguments @("install", "--global", $roots[0].FullName) | Out-Null
    }

    Refresh-ProcessPath
    $installedVersion = Invoke-CheckedCommand -Command "figma-cli" -Arguments @("--version")
    Invoke-CheckedCommand -Command "figma-cli" -Arguments @("--help") | Out-Null
    if (($installedVersion -replace '^v', '') -ne $plan.version) {
        throw "Installed figma-cli version '$installedVersion' does not match Release '$($plan.version)'."
    }
    Write-Host "Installed and verified figma-cli $installedVersion from $($plan.tagName)."
    exit 0
} catch {
    Write-Error "figma-cli installation failed: $($_.Exception.Message)"
    exit 1
} finally {
    if ($TempRoot -and (Test-Path -LiteralPath $TempRoot)) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
