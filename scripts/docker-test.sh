#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.test.yml)

cleanup() {
  "${COMPOSE[@]}" down -v --remove-orphans 2>/dev/null || true
}

trap cleanup EXIT

# Clear any half-removed project from a prior Ctrl+C / concurrent run (avoids "marked for removal").
"${COMPOSE[@]}" down -v --remove-orphans 2>/dev/null || true

"${COMPOSE[@]}" build test
"${COMPOSE[@]}" up --abort-on-container-exit --exit-code-from test --attach test
