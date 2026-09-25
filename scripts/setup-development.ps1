[CmdletBinding()]
param(
    [switch]$ValidateOnly,
    [switch]$SkipFrontend,
    [switch]$SkipCrystalBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$apiProject = Join-Path $repositoryRoot 'backend\CrystalReportPortal.Api\CrystalReportPortal.Api.csproj'
$testProject = Join-Path $repositoryRoot 'backend\CrystalReportPortal.Api.Tests\CrystalReportPortal.Api.Tests.csproj'
$crystalProject = Join-Path $repositoryRoot 'crystal-service\CrystalReportPortal.CrystalService\CrystalReportPortal.CrystalService.csproj'
$frontendDirectory = Join-Path $repositoryRoot 'frontend'
$crystalAssemblyDirectory = 'C:\Program Files (x86)\SAP BusinessObjects\Crystal Reports for .NET Framework 4.0\Common\SAP BusinessObjects Enterprise XI 4.0\win64_x64\dotnet'
$crystalAssemblies = @(
    'CrystalDecisions.ReportAppServer.ClientDoc.dll',
    'CrystalDecisions.ReportAppServer.Controllers.dll',
    'CrystalDecisions.ReportAppServer.DataDefModel.dll'
)

function Write-Status([string]$message) {
    Write-Host "[setup] $message" -ForegroundColor Cyan
}

function Require-Command([string]$name) {
    if ($null -eq (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "Missing command: $name. Install the prerequisite listed in project-dependencies.json."
    }
}

function Invoke-SetupCommand([string]$command, [string[]]$commandArguments, [string]$workingDirectory) {
    Write-Status "$command $($commandArguments -join ' ')"
    Push-Location $workingDirectory
    try {
        & $command @commandArguments
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed: $command $($commandArguments -join ' ')"
        }
    }
    finally {
        Pop-Location
    }
}

if ($env:OS -ne 'Windows_NT') {
    throw 'RPT upload and the Crystal Service require Windows.'
}

Write-Status "Repository: $repositoryRoot"
Require-Command 'dotnet'
Require-Command 'npm.cmd'

$dotnetSdks = & dotnet --list-sdks
if (-not ($dotnetSdks | Where-Object { $_ -match '^10\.' })) {
    throw 'Missing .NET 10 SDK. Install a 10.0.x SDK listed in project-dependencies.json.'
}

$missingCrystalAssemblies = @($crystalAssemblies | Where-Object {
    -not (Test-Path (Join-Path $crystalAssemblyDirectory $_))
})
if ($missingCrystalAssemblies.Count -gt 0) {
    throw "Missing SAP Crystal Reports x64 developer components: $($missingCrystalAssemblies -join ', '). Install the SAP runtime and Visual Studio/.NET Framework 4.8 developer components."
}

Write-Status '.NET 10, npm, and SAP Crystal Reports x64 checks passed.'

$sqlServerAvailable = Test-NetConnection -ComputerName 'localhost' -Port 1433 -InformationLevel Quiet -WarningAction SilentlyContinue
if ($sqlServerAvailable) {
    Write-Status 'SQL Server detected at localhost:1433.'
}
else {
    Write-Warning 'No SQL Server was detected at localhost:1433. Package setup can continue, but API startup and migrations need a reachable database.'
}

if ($ValidateOnly) {
    Write-Status 'Validation completed. No packages were restored and no projects were built.'
    exit 0
}

Invoke-SetupCommand 'dotnet' @('restore', $apiProject) $repositoryRoot
Invoke-SetupCommand 'dotnet' @('restore', $testProject) $repositoryRoot

if (-not $SkipFrontend) {
    Invoke-SetupCommand 'npm.cmd' @('ci') $frontendDirectory
}

if (-not $SkipCrystalBuild) {
    Invoke-SetupCommand 'dotnet' @('build', $crystalProject) $repositoryRoot
}

Write-Status 'Setup completed. Start the API to apply EF Core migrations to the configured SQL Server.'
