#!/usr/bin/env bash
# Run the sqlutil API locally without Docker.
# Creates a venv on first run, installs deps, then starts uvicorn.

set -euo pipefail
cd "$(dirname "$0")/../apps/api"

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

pip install -q --upgrade pip
pip install -q -e ".[dev]"

exec uvicorn sqlutil.main:app --reload --port "${SQLUTIL_API_PORT:-8000}"
