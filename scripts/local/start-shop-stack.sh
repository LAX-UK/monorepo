#!/usr/bin/env bash
# Local Shop purchase stack: Postgres + Redis (docker compose), then turbo dev for auth + shop-*.
# Also starts lax.art: a second shop-identity instance (art-identity, lax-art-web client) on :3051
# and the Art storefront on :3050. Set START_ART=0 to skip both.
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
# Mounts shop-api /admin/v1, which LAX Admin (scripts/local/start-shop-admin.sh) needs.
export SHOP_ADMIN_ENABLED="${SHOP_ADMIN_ENABLED:-true}"
export SHOP_VAT_STANDARD_RATE_BP="${SHOP_VAT_STANDARD_RATE_BP:-2000}"
export SHOP_IDENTITY_BASE_URL="${SHOP_IDENTITY_BASE_URL:-http://localhost:3010}"
export SHOP_IDENTITY_INTERNAL_BASE_URL="${SHOP_IDENTITY_INTERNAL_BASE_URL:-http://localhost:3010}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
# Storefront dev without Turbopack — stable for long browsing sessions (see run-shop-next-dev.mjs).
export SHOP_LOCAL_STACK=1

START_ART="${START_ART:-1}"
ART_IDENTITY_PORT=3051
ART_PORT=3050
export LAX_ART_PUBLIC_URL="${LAX_ART_PUBLIC_URL:-http://localhost:$ART_PORT}"
export ART_IDENTITY_BASE_URL="${ART_IDENTITY_BASE_URL:-http://localhost:$ART_IDENTITY_PORT}"
export ART_IDENTITY_INTERNAL_BASE_URL="${ART_IDENTITY_INTERNAL_BASE_URL:-http://localhost:$ART_IDENTITY_PORT}"
# Lets local publishes show on lax.art at once; shop-api only sends it when both are set.
export ART_REVALIDATE_SECRET="${ART_REVALIDATE_SECRET:-local-art-revalidate-secret-32-chars-min}"
export ART_REVALIDATE_URL="${ART_REVALIDATE_URL:-http://localhost:$ART_PORT/api/revalidate}"
export OIDC_CLIENT_SECRET_LAX_ART_WEB="${OIDC_CLIENT_SECRET_LAX_ART_WEB:-local-lax-art-web-client-secret-32}"

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
  export SHOP_ADMIN_ENABLED
  export ART_REVALIDATE_SECRET ART_REVALIDATE_URL
  export SHOP_VAT_STANDARD_RATE_BP
  export REDIS_URL
  export SHOP_LOCAL_STACK
  cd \"$ROOT\"
  exec pnpm dev:shop
" >"$LOG_DIR/dev-shop.log" 2>&1 &
echo $! >"$LOG_DIR/dev-shop.pid"
echo "Logs: $LOG_DIR/dev-shop.log (wrapper pid $(cat "$LOG_DIR/dev-shop.pid"))"

HEALTH_URLS=(
  "http://127.0.0.1:3003/health/live"
  "http://127.0.0.1:3010/health/ready"
  "http://127.0.0.1:3011/health/ready"
  "http://127.0.0.1:3020/health/live"
)

if [[ "$START_ART" == "1" ]]; then
  # art-identity: same shop-identity app, lax-art-web OIDC client, Art storefront as return target.
  nohup bash -c "
    export DATABASE_URL DATABASE_URL_SHOP OIDC_ISSUER_URL OIDC_INTERNAL_BASE_URL ALLOW_HTTP_COOKIES
    export SHOP_API_BASE_URL REDIS_URL
    export PORT=$ART_IDENTITY_PORT
    export OIDC_CLIENT_ID=lax-art-web
    export OIDC_CLIENT_SECRET=\"$OIDC_CLIENT_SECRET_LAX_ART_WEB\"
    export OIDC_REDIRECT_URI=http://localhost:$ART_IDENTITY_PORT/auth/callback
    export OIDC_POST_LOGOUT_REDIRECT_URI=http://localhost:$ART_PORT/signed-out
    export SHOP_STOREFRONT_URL=\"$LAX_ART_PUBLIC_URL\"
    cd \"$ROOT/apps/shop-identity\"
    exec pnpm dev
  " >"$LOG_DIR/dev-art-identity.log" 2>&1 &
  echo $! >"$LOG_DIR/dev-art-identity.pid"

  nohup bash -c "
    export SHOP_API_BASE_URL ART_IDENTITY_BASE_URL ART_IDENTITY_INTERNAL_BASE_URL LAX_ART_PUBLIC_URL
    export SHOP_PORTAL_OWNERSHIP_ENABLED SHOP_PAYOUTS_ENABLED ART_REVALIDATE_SECRET
    cd \"$ROOT\"
    exec pnpm --filter @auction/art dev
  " >"$LOG_DIR/dev-art.log" 2>&1 &
  echo $! >"$LOG_DIR/dev-art.pid"
  echo "Art logs: $LOG_DIR/dev-art-identity.log, $LOG_DIR/dev-art.log"
  HEALTH_URLS+=(
    "http://127.0.0.1:$ART_IDENTITY_PORT/health/ready"
    "http://127.0.0.1:$ART_PORT/health/live"
  )
fi

echo "Waiting for health endpoints (first compile may take a minute)…"
deadline=$((SECONDS + 240))
ready=0
while (( SECONDS < deadline )); do
  ready=0
  for url in "${HEALTH_URLS[@]}"; do
    curl -sf --max-time 3 "$url" >/dev/null && ready=$((ready + 1))
  done
  if (( ready == ${#HEALTH_URLS[@]} )); then
    break
  fi
  sleep 2
done
if (( ready != ${#HEALTH_URLS[@]} )); then
  echo "Timed out waiting for stack health (see logs in $LOG_DIR)" >&2
  exit 1
fi
echo "Shop stack is up (pnpm dev:shop, SHOP_LOCAL_STACK=1 — webpack dev on :3020)."
if [[ "$START_ART" == "1" ]]; then
  echo "lax.art is up on http://127.0.0.1:$ART_PORT/ (art-identity on :$ART_IDENTITY_PORT)."
  echo "Note: both identity instances use the shop_identity_session cookie on localhost; sign in to one storefront at a time."
fi
echo "Open http://127.0.0.1:3020/ — if a page hangs, run: bash scripts/local/stop-shop-stack.sh && bash scripts/local/start-shop-stack.sh"
