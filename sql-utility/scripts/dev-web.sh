#!/usr/bin/env bash
# Run the sqlutil web UI locally without Docker (Vite dev server on :5173).

set -euo pipefail
cd "$(dirname "$0")/../apps/web"

if [ ! -d node_modules ]; then
  npm install
fi

exec npm run dev
