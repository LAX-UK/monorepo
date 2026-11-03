#!/usr/bin/env bash
# Starts LAX Admin for browser checks in CI, on top of a stack that already has Postgres, Redis,
# a migrated and dev-seeded database, the registered OIDC clients, and the identity service
# (auth) answering on OIDC_ISSUER_URL. Both e2e-pr.yml and visual-baselines.yml call this.
#
# What it adds:
#   - the demo top-up people, with the six LAX Admin roles granted (the role checks sign in as them)
#   - the dev accounts' LAX Admin roles (admin@lax.bid is the Administrator the page checks use)
#   - a second shop-api on :3012 with the admin routes and every feature flag on, so the shared
#     shop-api on :3011 that the storefront checks use is left exactly as it was
#   - LAX Admin on :3030
#
# The builds are expected to exist already (`pnpm turbo run build --filter=@auction/shop-api
# --filter=@auction/shop-admin`). Logs go to /tmp/e2e-logs.
set -euo pipefail

LOG_DIR="${E2E_LOG_DIR:-/tmp/e2e-logs}"
SHOP_API_ADMIN_PORT=3012
SHOP_ADMIN_PORT=3030
mkdir -p "$LOG_DIR"

pnpm --filter @auction/db db:seed:demo-topup

# Demo top-up subjects 40 to 45 (packages/db/src/seed/demo/demo-topup-ids.ts), one role each.
grant() {
  pnpm --filter @auction/shop-api staff:grant \
    --subject "9de00000-0000-4000-8000-0000000000$1" --role "$2" --operator "ops:ci@lax.bid"
}
grant 40 operations
grant 41 editor
grant 42 catalogue_editor
grant 43 finance
grant 44 account_manager
grant 45 read_only
pnpm --filter @auction/shop-api seed:local-admin-staff

SHOP_ADMIN_ENABLED=true \
SHOP_PAYOUTS_ENABLED=true \
SHOP_THIRD_PARTY_ENABLED=true \
SHOP_ORIGINALS_ENABLED=true \
SHOP_MERCHANDISE_ENABLED=true \
SHOP_EDITORIAL_ENABLED=true \
SHOP_EDITORIAL_PREVIEW_SECRET=ci-editorial-preview-secret-minimum-32-chars \
PORT="$SHOP_API_ADMIN_PORT" \
  pnpm --filter @auction/shop-api start >"$LOG_DIR/shop-api-admin.log" 2>&1 &

SHOP_API_BASE_URL="http://localhost:$SHOP_API_ADMIN_PORT" \
SHOP_ADMIN_PUBLIC_ORIGIN="http://localhost:$SHOP_ADMIN_PORT" \
SHOP_ADMIN_INTERNAL_URL="http://127.0.0.1:$SHOP_ADMIN_PORT" \
OIDC_CLIENT_ID=lax-shop-admin \
OIDC_CLIENT_SECRET_LAX_SHOP_ADMIN="${OIDC_CLIENT_SECRET_LAX_SHOP_ADMIN:-ci-shop-admin-client-secret-at-least-32-chars}" \
SHOP_ADMIN_SESSION_ENCRYPTION_KEY=ci-shop-admin-session-key-0123456789abcdef \
  pnpm --filter @auction/shop-admin start >"$LOG_DIR/shop-admin.log" 2>&1 &

npx --yes wait-on \
  "http://localhost:$SHOP_API_ADMIN_PORT/health/ready" \
  "http://127.0.0.1:$SHOP_ADMIN_PORT/health/live" \
  --timeout 120000
echo "LAX Admin is up on http://localhost:$SHOP_ADMIN_PORT"
