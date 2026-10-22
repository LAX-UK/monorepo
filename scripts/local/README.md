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

## LAX Admin (staff) locally

LAX Admin (`apps/shop-admin`) signs in through the local identity service and calls shop-api's `/admin/v1`.

**Prerequisites:** the stack above is running (`start-shop-stack.sh` now sets `SHOP_ADMIN_ENABLED=true`, which mounts `/admin/v1`; restart a stack started earlier), and the local database was migrated from `main` and seeded with `pnpm --filter @auction/db db:seed:dev`.

```bash
./scripts/local/start-shop-admin.sh        # http://localhost:3030/
./scripts/local/start-shop-admin.sh stop
```

The script registers the `lax-shop-admin` OIDC client in the local database (`db:configure-oidc-clients`, scoped to that client), grants staff roles to the dev accounts (`pnpm --filter @auction/shop-api seed:local-admin-staff`) and starts `next dev`. All of it is idempotent. Admin runs on :3030, not :3020, because that is the only local redirect the `lax-shop-admin` client registers, and :3020 is the storefront.

**Signing in:** open http://localhost:3030/ and sign in as one of these accounts with the dev seed password (`SEED_PASSWORD` in `packages/db/src/seed/dev/legacy-demo-seed.ts`). The dev seed leaves staff two-step verification optional, so no TOTP is asked.

| Role | Account | Sees |
| --- | --- | --- |
| shop_admin | `admin@lax.bid` | everything |
| catalogue_editor | `staff-catalogue@lax.bid` | Artists, Artworks, Editorial |
| operations | `staff-operations@lax.bid` | Production, Fulfilment |
| finance | `accountant@lax.bid` | Overview, Orders, Payouts, Disputes, Audit log |
| account_manager | `staff-advisor@lax.bid` | Clients, Limit requests |
| broker | `gallery-admin@lax.bid` | Clients (assigned only); there is no dedicated broker dev account |

The seed refuses a non-local database or `NODE_ENV=production`, never creates users, and fails if a dev account is missing.

**Playwright:** with admin running, `LOCAL_STAFF_PASSWORD=<dev seed password> pnpm --filter @auction/shop-admin test:e2e:local-setup` signs in each role and saves `apps/shop-admin/e2e/.auth/<role>.json` (git-ignored) for reuse via `test.use({ storageState })`.

**Shared local database caveat:** if sign-in fails with a 500 and the auth log reports a missing column such as `session.social_auth_at`, that database's migration history is behind `main`. Use a scratch database migrated from `main` and point the stack at it instead; the script honours `DATABASE_URL`, `OIDC_ISSUER_URL` and `SHOP_API_BASE_URL` set by the caller.
