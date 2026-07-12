$ErrorActionPreference = "Stop"
$Script = Join-Path $PSScriptRoot "..\scripts\install-figma-cli.ps1"
$Fixtures = Join-Path $PSScriptRoot "fixtures"

function Assert-Equal($Actual, $Expected, $Message) {
    if ($Actual -ne $Expected) {
        throw "$Message. Expected '$Expected', got '$Actual'."
    }
}

function Invoke-Plan($Fixture, $Architecture) {
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $Script `
        -PlanOnly `
        -ReleaseMetadataPath (Join-Path $Fixtures $Fixture) `
        -Architecture $Architecture 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Plan failed for $Fixture`: $($output -join [Environment]::NewLine)"
    }
    return ($output -join [Environment]::NewLine | ConvertFrom-Json)
}

$source = Invoke-Plan "release-source-only.json" "AMD64"
Assert-Equal $source.tagName "v2.1.0" "Source tag"
Assert-Equal $source.version "2.1.0" "Normalized version"
Assert-Equal $source.mode "source-archive" "No-asset fallback"
Assert-Equal $source.downloadUrl "https://api.github.com/repos/silships/figma-cli/zipball/v2.1.0" "Release archive URL"

$binary = Invoke-Plan "release-windows-x64.json" "AMD64"
Assert-Equal $binary.mode "portable-zip" "Windows x64 asset selection"
Assert-Equal $binary.assetName "figma-cli-v2.2.0-windows-x64.zip" "Asset name"

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$rejected = & powershell -NoProfile -ExecutionPolicy Bypass -File $Script `
    -PlanOnly `
    -ReleaseMetadataPath (Join-Path $Fixtures "release-prerelease.json") `
    -Architecture "AMD64" 2>&1
$rejectedExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference
if ($rejectedExitCode -eq 0) { throw "Prerelease metadata must be rejected." }
if (($rejected -join "`n") -notmatch "prerelease") { throw "Prerelease error must be actionable." }

Write-Host "PASS: installer planning tests"
