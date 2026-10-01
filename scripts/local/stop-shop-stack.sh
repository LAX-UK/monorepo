#!/usr/bin/env bash
set -euo pipefail
LOG_DIR="${TMPDIR:-/tmp}/shop-local-logs"
if [[ -f "$LOG_DIR/dev-shop.pid" ]]; then
  kill "$(cat "$LOG_DIR/dev-shop.pid")" 2>/dev/null || true
  rm -f "$LOG_DIR/dev-shop.pid"
fi
pkill -f "turbo dev --filter=@auction/auth-app" 2>/dev/null || true
pkill -f "tsx watch --env-file=../../.env src/server.ts" 2>/dev/null || true
pkill -f "next dev --port 3020" 2>/dev/null || true
echo "Stopped local Shop dev processes (if any were running)."
