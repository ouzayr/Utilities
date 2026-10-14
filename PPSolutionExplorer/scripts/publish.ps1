# Builds the Angular client and publishes a self-contained server to .\publish\<rid>.
# Usage: .\scripts\publish.ps1 [-Rid win-x64]
param([string]$Rid = "win-x64")
$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$out = Join-Path $root "publish\$Rid"

Write-Host "==> Building web client"
Push-Location (Join-Path $root "web")
npm ci
if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
npx ng build --configuration production
if ($LASTEXITCODE -ne 0) { throw "ng build failed" }
Pop-Location

Write-Host "==> Running tests (excluding live model tests)"
dotnet test (Join-Path $root "PPSolutionExplorer.sln") -c Release --filter "Category!=LlamaLive"
if ($LASTEXITCODE -ne 0) { throw "tests failed" }

Write-Host "==> Publishing server for $Rid"
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
dotnet publish (Join-Path $root "src\Api\PPSolutionExplorer.Api.csproj") -c Release -r $Rid --self-contained true -o $out
if ($LASTEXITCODE -ne 0) { throw "publish failed" }

Write-Host "==> Done: $out"
