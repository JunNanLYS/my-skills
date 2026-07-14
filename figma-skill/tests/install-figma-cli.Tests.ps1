$ErrorActionPreference = "Stop"
$Script = Join-Path $PSScriptRoot "..\scripts\install-figma-cli.ps1"
$Fixtures = Join-Path $PSScriptRoot "fixtures"

function Assert-Equal($Actual, $Expected, $Message) {
    if ($Actual -ne $Expected) {
        throw "$Message. Expected '$Expected', got '$Actual'."
    }
}

function Invoke-Plan($Fixture, $Architecture, $ExtraArgs = @()) {
    $args = @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $Script,
        "-PlanOnly",
        "-ReleaseMetadataPath", (Join-Path $Fixtures $Fixture),
        "-Architecture", $Architecture
    ) + $ExtraArgs
    $output = & powershell @args 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Plan failed for $Fixture`: $($output -join [Environment]::NewLine)"
    }
    return ($output -join [Environment]::NewLine | ConvertFrom-Json)
}

function Invoke-Installer($InstallerArgs, [ref]$ExitCode) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $Script @InstallerArgs 2>&1
    $ExitCode.Value = $LASTEXITCODE
    $ErrorActionPreference = $previous
    return ($output -join [Environment]::NewLine)
}

# ── Existing plan tests ──────────────────────────────────────────────

$source = Invoke-Plan "release-source-only.json" "AMD64"
Assert-Equal $source.tagName "v2.1.0" "Source tag"
Assert-Equal $source.version "2.1.0" "Normalized version"
Assert-Equal $source.mode "source-archive" "No-asset fallback"
Assert-Equal $source.checksumSource "none-binary-unavailable" "Source checksum source"
Assert-Equal $source.downloadUrl "https://api.github.com/repos/silships/figma-cli/zipball/v2.1.0" "Release archive URL"

$binary = Invoke-Plan "release-windows-x64.json" "AMD64"
Assert-Equal $binary.mode "portable-zip" "Windows x64 asset selection"
Assert-Equal $binary.assetName "figma-cli-v2.2.0-windows-x64.zip" "Asset name"
Assert-Equal $binary.checksumSource "none" "Binary checksum source (no TrustedChecksumPath)"

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

# ── InstallRoot validation ───────────────────────────────────────────

function Test-InstallRootRejection($Root, $ExpectedPattern) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $Script `
        -PlanOnly `
        -ReleaseMetadataPath (Join-Path $Fixtures "release-source-only.json") `
        -Architecture "AMD64" `
        -InstallRoot $Root 2>&1
    $code = $LASTEXITCODE
    $ErrorActionPreference = $previous
    if ($code -eq 0) {
        throw "InstallRoot '$Root' should have been rejected but was accepted."
    }
    $text = $output -join "`n"
    if ($text -notmatch $ExpectedPattern) {
        throw "InstallRoot '$Root' rejection message did not match '$ExpectedPattern'. Got: $text"
    }
    Write-Host "  PASS: InstallRoot '$Root' correctly rejected (matched '$ExpectedPattern')"
}

Write-Host "InstallRoot validation..."
Test-InstallRootRejection "C:\" "filesystem root|leaf"
Test-InstallRootRejection "D:\" "filesystem root|leaf"
Test-InstallRootRejection "C:\Users\someone\stuff" "leaf|figma-cli"
Test-InstallRootRejection "C:\Users\someone\Programs" "leaf|figma-cli"

Write-Host "PASS: InstallRoot validation tests"

# ── SHA-256 checksum tests (with local zip fixture) ──────────────────

Write-Host "SHA-256 checksum tests..."

$tempWork = Join-Path ([System.IO.Path]::GetTempPath()) ("figma-cli-test-" + [guid]::NewGuid())
try {
    New-Item -ItemType Directory -Path $tempWork -Force | Out-Null

    # Build a minimal figma-cli.exe stub that responds to --version and --help
    $exeDir = Join-Path $tempWork "bin"
    New-Item -ItemType Directory -Path $exeDir -Force | Out-Null
    $csSource = @'
using System;
class Program {
    static void Main(string[] args) {
        if (args.Length > 0 && args[0] == "--version") {
            Console.WriteLine("v2.2.0");
        } else if (args.Length > 0 && args[0] == "--help") {
            Console.WriteLine("Usage: figma-cli [options]");
        }
    }
}
'@
    $csFile = Join-Path $tempWork "stub.cs"
    Set-Content -LiteralPath $csFile -Value $csSource -Encoding UTF8
    try {
        Add-Type -OutputAssembly (Join-Path $exeDir "figma-cli.exe") -OutputType ConsoleApplication -TypeDefinition $csSource -ErrorAction Stop
    } catch {
        throw "Failed to compile C# stub for figma-cli.exe. Is .NET Framework SDK available? Error: $($_.Exception.Message)"
    }

    # Create test zip
    $testZip = Join-Path $tempWork "release.zip"
    Compress-Archive -Path (Join-Path $exeDir "figma-cli.exe") -DestinationPath $testZip -Force
    $zipHash = (Get-FileHash -LiteralPath $testZip -Algorithm SHA256).Hash.ToLowerInvariant()

    # Create checksum fixture with CORRECT hash
    $correctChecksumPath = Join-Path $tempWork "correct-checksum.json"
    @{ sha256 = $zipHash } | ConvertTo-Json -Compress | Set-Content -LiteralPath $correctChecksumPath

    # Create checksum fixture with WRONG hash
    $wrongChecksumPath = Join-Path $tempWork "wrong-checksum.json"
    @{ sha256 = "0000000000000000000000000000000000000000000000000000000000000000" } | ConvertTo-Json -Compress | Set-Content -LiteralPath $wrongChecksumPath

    # Build a release fixture pointing at the local zip
    $localReleaseJson = Join-Path $tempWork "local-release.json"
    @{
        tag_name = "v2.2.0"
        draft = $false
        prerelease = $false
        zipball_url = "https://api.github.com/repos/silships/figma-cli/zipball/v2.2.0"
        assets = @(
            @{
                name = "figma-cli-v2.2.0-windows-x64.zip"
                browser_download_url = "file://" + ($testZip -replace '\\', '/')
            }
        )
    } | ConvertTo-Json -Compress -Depth 3 | Set-Content -LiteralPath $localReleaseJson

    $testInstallRoot = Join-Path $tempWork "install-root\figma-cli"

    # Test 1: Wrong checksum → installer must fail before touching InstallRoot
    Write-Host "  Test: hash mismatch rejection..."
    $exitCode = 0
    $output = Invoke-Installer -InstallerArgs @(
        "-ReleaseMetadataPath", $localReleaseJson,
        "-Architecture", "AMD64",
        "-InstallRoot", $testInstallRoot,
        "-TrustedChecksumPath", $wrongChecksumPath,
        "-SkipExistingCheck"
    ) -ExitCode ([ref]$exitCode)
    if ($exitCode -eq 0) {
        throw "SHA-256 mismatch should have caused installer failure but succeeded.`nOutput: $output"
    }
    if ($output -notmatch "mismatch|SHA-256") {
        throw "SHA-256 mismatch error should mention SHA-256 or mismatch. Got: $output"
    }
    # Verify InstallRoot was NOT removed
    if (Test-Path -LiteralPath $testInstallRoot) {
        throw "InstallRoot should not have been created on checksum failure."
    }
    Write-Host "  PASS: hash mismatch correctly rejected"

    # Test 2: Correct checksum → installer succeeds
    Write-Host "  Test: correct hash acceptance..."
    $exitCode = 0
    $output = Invoke-Installer -InstallerArgs @(
        "-ReleaseMetadataPath", $localReleaseJson,
        "-Architecture", "AMD64",
        "-InstallRoot", $testInstallRoot,
        "-TrustedChecksumPath", $correctChecksumPath,
        "-SkipExistingCheck"
    ) -ExitCode ([ref]$exitCode)
    if ($exitCode -ne 0) {
        throw "SHA-256 matched but installer failed with code $exitCode.`nOutput: $output"
    }
    if ($output -notmatch "verified|Installed") {
        throw "Installer should report successful verification and installation. Got: $output"
    }
    Write-Host "  PASS: correct hash accepted and installed"

    Write-Host "PASS: SHA-256 checksum tests"
} finally {
    if (Test-Path -LiteralPath $tempWork) {
        Remove-Item -LiteralPath $tempWork -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# ── Plan with TrustedChecksumPath ────────────────────────────────────

Write-Host "Plan with TrustedChecksumPath..."
$binaryWithChecksum = Invoke-Plan "release-windows-x64.json" "AMD64" @(
    "-TrustedChecksumPath", (Join-Path $Fixtures "release-windows-x64-checksum.json")
)
Assert-Equal $binaryWithChecksum.mode "portable-zip" "Checksum plan mode"
Assert-Equal $binaryWithChecksum.checksumSource "trusted-checksum-path" "Checksum source with path"

Write-Host "PASS: installer safety tests"
