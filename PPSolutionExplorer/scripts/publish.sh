#!/usr/bin/env bash
# Builds the Angular client and publishes a self-contained server to ./publish/<rid>.
# Usage: scripts/publish.sh [linux-x64|win-x64|osx-arm64]   (default: linux-x64)
set -euo pipefail

RID="${1:-linux-x64}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/publish/$RID"

echo "==> Building web client"
(cd "$ROOT/web" && npm ci && npx ng build --configuration production)

echo "==> Running tests (excluding live model tests)"
dotnet test "$ROOT/PPSolutionExplorer.sln" -c Release --filter "Category!=LlamaLive"

echo "==> Publishing server for $RID"
rm -rf "$OUT"
dotnet publish "$ROOT/src/Api/PPSolutionExplorer.Api.csproj" -c Release -r "$RID" --self-contained true -o "$OUT"

echo "==> Done: $OUT"
