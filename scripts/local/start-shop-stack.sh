#!/usr/bin/env bash
# Local Shop purchase stack: Postgres + Redis (docker compose), then turbo dev for auth + shop-*.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="${TMPDIR:-/tmp}/shop-local-logs"
mkdir -p "$LOG_DIR"

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
export SHOP_IDENTITY_BASE_URL="${SHOP_IDENTITY_BASE_URL:-http://localhost:3010}"
export SHOP_IDENTITY_INTERNAL_BASE_URL="${SHOP_IDENTITY_INTERNAL_BASE_URL:-http://localhost:3010}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"

cd "$ROOT"
nohup bash -c "
  export DATABASE_URL DATABASE_URL_SHOP DATABASE_URL_AUTH
  export OIDC_ISSUER_URL OIDC_INTERNAL_BASE_URL ALLOW_HTTP_COOKIES
  export SHOP_STOREFRONT_URL SHOP_API_BASE_URL SHOP_API_PUBLIC_BASE_URL
  export SHOP_FAKE_CHECKOUT_ENABLED SHOP_IDENTITY_BASE_URL SHOP_IDENTITY_INTERNAL_BASE_URL
  export SHOP_PORTAL_OWNERSHIP_ENABLED
  export REDIS_URL
  cd \"$ROOT\"
  exec pnpm dev:shop
" >"$LOG_DIR/dev-shop.log" 2>&1 &
echo $! >"$LOG_DIR/dev-shop.pid"
echo "Logs: $LOG_DIR/dev-shop.log (pid $(cat "$LOG_DIR/dev-shop.pid"))"
echo "Waiting for health endpoints…"
npx --yes wait-on \
  http://localhost:3003/health/live \
  http://localhost:3010/health/ready \
  http://localhost:3011/health/ready \
  http://localhost:3020/health/live \
  --timeout 180000
echo "Shop stack is up (pnpm dev:shop)."
