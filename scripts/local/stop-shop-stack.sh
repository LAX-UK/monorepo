#!/usr/bin/env bash
# Stop turbo dev and shop stack child processes (Next, Fastify, auth), plus lax.art (:3050/:3051).
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

for name in dev-art dev-art-identity; do
  if [[ -f "$LOG_DIR/$name.pid" ]]; then
    pid="$(cat "$LOG_DIR/$name.pid")"
    if kill -0 "$pid" 2>/dev/null; then
      pkill -P "$pid" 2>/dev/null || true
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$LOG_DIR/$name.pid"
  fi
done

pkill -f "turbo dev --filter=@auction/auth-app" 2>/dev/null || true
pkill -f "turbo dev --filter=@auction/shop" 2>/dev/null || true
pkill -f "tsx watch --env-file=../../.env src/server.ts" 2>/dev/null || true
pkill -f "next dev --port 3020" 2>/dev/null || true
pkill -f "next dev --port 3050" 2>/dev/null || true
pkill -f "run-shop-next-dev.mjs" 2>/dev/null || true

for port in 3050 3051 3020 3011 3010 3003; do
  lsof -ti ":$port" 2>/dev/null | xargs kill -9 2>/dev/null || true
done

echo "Stopped local Shop and Art dev processes (if any were running)."
