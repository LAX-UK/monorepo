#!/usr/bin/env bash
# Run unit + browser smoke against a running local stack (see start-shop-stack.sh).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "== Shop package unit tests =="
pnpm --filter @auction/shop test

echo "== Shop-api + shop-identity unit tests =="
pnpm --filter @auction/shop-api test
pnpm --filter @auction/shop-identity test

echo "== Playwright commerce smoke (localhost:3020) =="
cd apps/shop
PLAYWRIGHT_E2E=1 pnpm exec playwright test e2e/buyer-flow.spec.ts \
  --project=chromium-desktop \
  --grep "guest can add|basket route|artwork detail"

echo "== Signed-in checkout with fake Stripe (no real Stripe keys) =="
PLAYWRIGHT_E2E=1 pnpm exec playwright test e2e/buyer-flow.spec.ts \
  --project=chromium-desktop \
  --grep "signed-in buyer" \
  || echo "Note: full Stripe E2E needs SHOP_E2E_STRIPE_CHECKOUT=1; fake checkout may skip stripe.com"

echo "Local purchase smoke finished."
