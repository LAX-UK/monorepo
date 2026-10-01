# Local Shop purchase journey

**Prerequisites:** Docker (Postgres + Redis), root `.env` with auth secrets (e.g. `BETTER_AUTH_SECRET`).

1. One-time DB (from repo root):

```bash
docker compose up postgres redis -d
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/auction
pnpm --filter @auction/db db:migrate
pnpm --filter @auction/db db:seed:dev
DATABASE_URL_OWNER="$DATABASE_URL" pnpm --filter @auction/db db:roles
DATABASE_URL_AUTH="$DATABASE_URL" OIDC_CLIENT_IDS=lax-bid-web,lax-shop-web \
  OIDC_CLIENT_SECRET_LAX_BID_WEB=ci-bid-web-client-secret-at-least-32 \
  OIDC_CLIENT_SECRET_LAX_SHOP_WEB=ci-shop-identity-client-secret-at-least-32 \
  pnpm --filter @auction/db db:configure-oidc-clients
export DATABASE_URL_SHOP=postgresql://shop_app:postgres@localhost:5432/auction
pnpm --filter @auction/shop-api seed:catalogue
```

2. **Keep one terminal open** for the stack:

```bash
./scripts/local/start-shop-stack.sh
```

Or manually: `pnpm dev:shop` (after exporting local `DATABASE_URL*` as above).

3. In another terminal: `./scripts/local/test-shop-purchase-local.sh` or use the browser checklist in the chat.

4. Stop: `./scripts/local/stop-shop-stack.sh`

**Tips:** Set `SHOP_FAKE_CHECKOUT_ENABLED=true` before start to skip real Stripe. Dev buyer: `user1@lax.bid` / `Password123!`. If pages hang, stop and restart the stack; avoid hammering `/basket` while Next is still compiling.
