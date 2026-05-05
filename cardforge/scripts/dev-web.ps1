# CardForge Web — Windows Dev Runner
# Prerequisites: Node.js 20+
# Run from the repo root: .\scripts\dev-web.ps1

$ErrorActionPreference = "Stop"
$webDir = Join-Path $PSScriptRoot "..\apps\web"

Write-Host "CardForge Web — starting dev environment" -ForegroundColor Cyan

Push-Location $webDir

# Copy .env.local if missing
if (-not (Test-Path ".env.local")) {
    Copy-Item ".env.local.example" ".env.local"
    Write-Host ".env.local created from example. Edit it if needed." -ForegroundColor Yellow
}

Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

Write-Host "Starting Next.js (http://localhost:3000)..." -ForegroundColor Yellow
npm run dev

Pop-Location
