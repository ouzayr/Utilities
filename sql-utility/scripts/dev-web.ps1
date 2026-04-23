# Run the sqlutil web UI locally on Windows without Docker.
# Usage:  .\scripts\dev-web.ps1

$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\..\apps\web"

if (-not (Test-Path node_modules)) {
    npm install
}

npm run dev
