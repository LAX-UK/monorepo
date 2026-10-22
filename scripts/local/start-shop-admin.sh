#!/usr/bin/env bash
# Local LAX Admin (apps/shop-admin) on :3030, signed in through the local identity service.
#
# Expects the stack from start-shop-stack.sh to be running already (Postgres, Redis, auth on
# :3003, shop-api on :3011). Does not start, stop or restart any of it.
#
# Port 3030 is not arbitrary: the lax-shop-admin OIDC client only registers
# http://localhost:3030/api/auth/callback as a local redirect, and :3020 belongs to the storefront.
#
# Usage: scripts/local/start-shop-admin.sh [stop]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="${TMPDIR:-/tmp}/shop-local-logs"
ADMIN_PORT=3030
mkdir -p "$LOG_DIR"

if [[ "${1:-}" == "stop" ]]; then
  lsof -ti "tcp:$ADMIN_PORT" -sTCP:LISTEN | xargs kill 2>/dev/null || true
  rm -f "$LOG_DIR/dev-shop-admin.pid"
  echo "LAX Admin stopped."
  exit 0
fi

# .env also sets these; an explicit value from the caller must win over it.
CALLER_DATABASE_URL="${DATABASE_URL:-}"
CALLER_OIDC_ISSUER_URL="${OIDC_ISSUER_URL:-}"
CALLER_SHOP_API_BASE_URL="${SHOP_API_BASE_URL:-}"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

# Same local Postgres/Redis as start-shop-stack.sh; .env may point at remote databases.
export DATABASE_URL="${CALLER_DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/auction}"
export DATABASE_URL_AUTH="$DATABASE_URL"
export OIDC_ISSUER_URL="${CALLER_OIDC_ISSUER_URL:-http://localhost:3003}"
export OIDC_INTERNAL_BASE_URL="$OIDC_ISSUER_URL"
export SHOP_API_BASE_URL="${CALLER_SHOP_API_BASE_URL:-http://localhost:3011}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export SHOP_ADMIN_PUBLIC_ORIGIN="http://localhost:$ADMIN_PORT"
export SHOP_ADMIN_INTERNAL_URL="http://127.0.0.1:$ADMIN_PORT"
# .env carries the storefront's OIDC_CLIENT_ID; LAX Admin has its own client.
export OIDC_CLIENT_ID="lax-shop-admin"
# Local-only values; the matching client row is written below.
export OIDC_CLIENT_SECRET_LAX_SHOP_ADMIN="${OIDC_CLIENT_SECRET_LAX_SHOP_ADMIN:-local-lax-shop-admin-client-secret-32}"
export SHOP_ADMIN_SESSION_ENCRYPTION_KEY="${SHOP_ADMIN_SESSION_ENCRYPTION_KEY:-local-shop-admin-session-key-0123456789abcdef}"

for url in "$OIDC_ISSUER_URL/health/live" "$SHOP_API_BASE_URL/health/ready"; do
  if ! curl -sf --max-time 3 "$url" >/dev/null; then
    echo "$url is not answering. Start the stack first: scripts/local/start-shop-stack.sh" >&2
    exit 1
  fi
done

# shop-api only mounts /admin/v1 when SHOP_ADMIN_ENABLED=true; without it every admin page 404s.
admin_status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$SHOP_API_BASE_URL/admin/v1/health/live" || true)"
if [[ "$admin_status" == "404" ]]; then
  echo "shop-api at $SHOP_API_BASE_URL was started without SHOP_ADMIN_ENABLED=true (no /admin/v1 routes)." >&2
  echo "Restart the stack with it set: SHOP_ADMIN_ENABLED=true scripts/local/start-shop-stack.sh" >&2
  exit 1
fi

cd "$ROOT"
echo "Registering the lax-shop-admin OIDC client and granting staff roles to dev accounts (idempotent)…"
OIDC_CLIENT_IDS=lax-shop-admin pnpm --filter @auction/db db:configure-oidc-clients
DATABASE_URL_SHOP="${DATABASE_URL_SHOP:-${DATABASE_URL/postgres:postgres@/shop_app:postgres@}}" \
  pnpm --filter @auction/shop-api seed:local-admin-staff

# next dev resolves @auction/* workspace packages from their built output (cached by turbo).
echo "Building LAX Admin's workspace dependencies…"
pnpm turbo run build --filter='@auction/shop-admin^...' >"$LOG_DIR/build-shop-admin-deps.log" 2>&1 \
  || { echo "Dependency build failed, see $LOG_DIR/build-shop-admin-deps.log" >&2; exit 1; }

lsof -ti "tcp:$ADMIN_PORT" -sTCP:LISTEN | xargs kill 2>/dev/null || true
nohup bash -c "
  cd \"$ROOT/apps/shop-admin\"
  exec pnpm exec next dev --port $ADMIN_PORT
" >"$LOG_DIR/dev-shop-admin.log" 2>&1 &
echo $! >"$LOG_DIR/dev-shop-admin.pid"
echo "Logs: $LOG_DIR/dev-shop-admin.log"

echo "Waiting for LAX Admin (first compile may take a minute)…"
deadline=$((SECONDS + 180))
until curl -sf --max-time 3 "http://127.0.0.1:$ADMIN_PORT/health/live" >/dev/null; do
  if (( SECONDS >= deadline )); then
    echo "Timed out waiting for LAX Admin (see $LOG_DIR/dev-shop-admin.log)" >&2
    exit 1
  fi
  sleep 2
done
echo "LAX Admin is up on http://localhost:$ADMIN_PORT/ — stop it with: scripts/local/start-shop-admin.sh stop"
