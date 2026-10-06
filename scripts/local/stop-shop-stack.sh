#!/usr/bin/env bash
# Stop turbo dev and shop stack child processes (Next, Fastify, auth).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="${TMPDIR:-/tmp}/shop-local-logs"

if [[ -f "$LOG_DIR/dev-shop.pid" ]]; then
  wrapper_pid="$(cat "$LOG_DIR/dev-shop.pid")"
  if kill -0 "$wrapper_pid" 2>/dev/null; then
    # Kill the whole session (turbo + next + tsx children).
    pkill -P "$wrapper_pid" 2>/dev/null || true
    kill "$wrapper_pid" 2>/dev/null || true
  fi
  rm -f "$LOG_DIR/dev-shop.pid"
fi

pkill -f "turbo dev --filter=@auction/auth-app" 2>/dev/null || true
pkill -f "turbo dev --filter=@auction/shop" 2>/dev/null || true
pkill -f "tsx watch --env-file=../../.env src/server.ts" 2>/dev/null || true
pkill -f "next dev --port 3020" 2>/dev/null || true
pkill -f "run-shop-next-dev.mjs" 2>/dev/null || true

for port in 3020 3011 3010 3003; do
  lsof -ti ":$port" 2>/dev/null | xargs kill -9 2>/dev/null || true
done

echo "Stopped local Shop dev processes (if any were running)."
