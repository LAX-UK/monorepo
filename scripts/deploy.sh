#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
COMPOSE="docker compose -f docker-compose.prod.yml"

if [[ ! -f .env ]]; then
  echo "Error: .env not found. Copy .env.production.example to .env and set secrets and URLs." >&2
  exit 1
fi

echo "=== Building images ==="
$COMPOSE build

echo "=== Starting Postgres and Redis ==="
$COMPOSE up -d postgres redis

echo "=== Waiting for Postgres to accept connections ==="
for _ in $(seq 1 90); do
  if $COMPOSE exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
    echo "Postgres is ready."
    break
  fi
  sleep 1
done

if ! $COMPOSE exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
  echo "Error: Postgres did not become ready in time." >&2
  exit 1
fi

echo "=== Starting all services (API container runs migrations on every start) ==="
$COMPOSE up -d

echo "=== Status ==="
$COMPOSE ps

echo ""
echo "Done. Migrations run automatically when the API container starts."
echo "Open WEB_ORIGIN / API_PUBLIC_URL in a browser (same URL). Logs: $COMPOSE logs -f"
