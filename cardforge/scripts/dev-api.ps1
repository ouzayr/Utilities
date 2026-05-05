# CardForge API — Windows Dev Runner
# Prerequisites: .NET 8 SDK, SQL Server Express / LocalDB
# Run from the repo root: .\scripts\dev-api.ps1

$ErrorActionPreference = "Stop"
$apiDir = Join-Path $PSScriptRoot "..\apps\api"

Write-Host "CardForge API — starting dev environment" -ForegroundColor Cyan

# Apply EF Core migrations
Write-Host "Running database migrations..." -ForegroundColor Yellow
Push-Location $apiDir
dotnet ef database update `
    --project CardForge.Infrastructure `
    --startup-project CardForge.Api
Pop-Location

Write-Host "Migrations applied." -ForegroundColor Green

# Start the API
Write-Host "Starting API (http://localhost:5000)..." -ForegroundColor Yellow
Push-Location $apiDir
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run --project CardForge.Api --launch-profile "http"
Pop-Location
