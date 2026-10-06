#!/usr/bin/env bash
# Local Shop purchase stack: Postgres + Redis (docker compose), then turbo dev for auth + shop-*.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="${TMPDIR:-/tmp}/shop-local-logs"
mkdir -p "$LOG_DIR"

# Avoid wedged ports / duplicate turbo from a prior run.
bash "$ROOT/scripts/local/stop-shop-stack.sh"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

# Always use compose Postgres for this script (override .env remote URLs).
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/auction"
export DATABASE_URL_SHOP="postgresql://shop_app:postgres@localhost:5432/auction"
export DATABASE_URL_AUTH="$DATABASE_URL"
export OIDC_ISSUER_URL="${OIDC_ISSUER_URL:-http://localhost:3003}"
export OIDC_INTERNAL_BASE_URL="${OIDC_INTERNAL_BASE_URL:-http://localhost:3003}"
export ALLOW_HTTP_COOKIES="${ALLOW_HTTP_COOKIES:-true}"
export SHOP_STOREFRONT_URL="${SHOP_STOREFRONT_URL:-http://localhost:3020}"
export SHOP_API_BASE_URL="${SHOP_API_BASE_URL:-http://localhost:3011}"
export SHOP_API_PUBLIC_BASE_URL="${SHOP_API_PUBLIC_BASE_URL:-http://localhost:3011}"
export SHOP_FAKE_CHECKOUT_ENABLED="${SHOP_FAKE_CHECKOUT_ENABLED:-true}"
export SHOP_PORTAL_OWNERSHIP_ENABLED="${SHOP_PORTAL_OWNERSHIP_ENABLED:-true}"
export SHOP_PAYOUTS_ENABLED="${SHOP_PAYOUTS_ENABLED:-true}"
export SHOP_VAT_STANDARD_RATE_BP="${SHOP_VAT_STANDARD_RATE_BP:-2000}"
export SHOP_IDENTITY_BASE_URL="${SHOP_IDENTITY_BASE_URL:-http://localhost:3010}"
export SHOP_IDENTITY_INTERNAL_BASE_URL="${SHOP_IDENTITY_INTERNAL_BASE_URL:-http://localhost:3010}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
# Storefront dev without Turbopack — stable for long browsing sessions (see run-shop-next-dev.mjs).
export SHOP_LOCAL_STACK=1

cd "$ROOT"
echo "Starting Postgres + Redis (if not already up)…"
docker compose up -d postgres redis

nohup bash -c "
  export DATABASE_URL DATABASE_URL_SHOP DATABASE_URL_AUTH
  export OIDC_ISSUER_URL OIDC_INTERNAL_BASE_URL ALLOW_HTTP_COOKIES
  export SHOP_STOREFRONT_URL SHOP_API_BASE_URL SHOP_API_PUBLIC_BASE_URL
  export SHOP_FAKE_CHECKOUT_ENABLED SHOP_IDENTITY_BASE_URL SHOP_IDENTITY_INTERNAL_BASE_URL
  export SHOP_PORTAL_OWNERSHIP_ENABLED
  export SHOP_PAYOUTS_ENABLED
  export SHOP_VAT_STANDARD_RATE_BP
  export REDIS_URL
  export SHOP_LOCAL_STACK
  cd \"$ROOT\"
  exec pnpm dev:shop
" >"$LOG_DIR/dev-shop.log" 2>&1 &
echo $! >"$LOG_DIR/dev-shop.pid"
echo "Logs: $LOG_DIR/dev-shop.log (wrapper pid $(cat "$LOG_DIR/dev-shop.pid"))"
echo "Waiting for health endpoints (first compile may take a minute)…"
deadline=$((SECONDS + 180))
ready=0
while (( SECONDS < deadline )); do
  ready=0
  curl -sf --max-time 3 http://127.0.0.1:3003/health/live >/dev/null && ready=$((ready + 1))
  curl -sf --max-time 3 http://127.0.0.1:3010/health/ready >/dev/null && ready=$((ready + 1))
  curl -sf --max-time 3 http://127.0.0.1:3011/health/ready >/dev/null && ready=$((ready + 1))
  curl -sf --max-time 3 http://127.0.0.1:3020/health/live >/dev/null && ready=$((ready + 1))
  if (( ready == 4 )); then
    break
  fi
  sleep 2
done
if (( ready != 4 )); then
  echo "Timed out waiting for shop stack health (see $LOG_DIR/dev-shop.log)" >&2
  exit 1
fi
echo "Shop stack is up (pnpm dev:shop, SHOP_LOCAL_STACK=1 — webpack dev on :3020)."
echo "Open http://127.0.0.1:3020/ — if a page hangs, run: bash scripts/local/stop-shop-stack.sh && bash scripts/local/start-shop-stack.sh"
