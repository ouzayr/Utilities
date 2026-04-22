# Run the sqlutil API locally on Windows without Docker.
# Usage:  .\scripts\dev-api.ps1

$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\..\apps\api"

if (-not (Test-Path .venv)) {
    python -m venv .venv
}
. .\.venv\Scripts\Activate.ps1

python -m pip install --upgrade pip | Out-Null
python -m pip install -e ".[dev]"

$port = $env:SQLUTIL_API_PORT
if (-not $port) { $port = "8000" }

uvicorn sqlutil.main:app --reload --port $port
