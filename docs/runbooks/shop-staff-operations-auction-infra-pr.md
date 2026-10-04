# auction-infra PR: shop-admin on test

Monorepo ships `apps/shop-admin` and documents flags in [shop-v1-phase-gates.md](./shop-v1-phase-gates.md). Apply this in **auction-infra** (test environment) before staff-operations acceptance can go green end-to-end.

**Open PR:** [auction-infra #29](https://github.com/LAX-UK/auction-infra/pull/29) (`feat/shop-admin-test`).

After #29 merges and applies, open **one flag-flip PR each** on `terraform/ephemeral/test/variables.tf` defaults: `shop_payouts_enabled`, `shop_third_party_enabled`, then `shop_originals_enabled` + `shop_merchandise_enabled`. Run two seeded acceptance passes after each apply.

## New component

- **Name:** `shop-admin`
- **Image:** `registry.digitalocean.com/<registry>/lax-test-shop-admin:test` (built from monorepo `apps/shop-admin/Dockerfile`)
- **Public host:** `test-shop-admin.lax.bid` (TLS + DNS)
- **Port:** `3030`

## shop-admin environment

| Variable | Notes |
| --- | --- |
| `OIDC_ISSUER_URL` | `https://test-auth.lax.bid` |
| `OIDC_INTERNAL_BASE_URL` | internal auth URL |
| `OIDC_CLIENT_ID` | `lax-shop-admin` |
| `OIDC_CLIENT_SECRET_LAX_SHOP_ADMIN` | from identity client configure step |
| `SHOP_API_BASE_URL` | internal `http://shop-api:3011` |
| `REDIS_URL` | shared Redis |
| `SHOP_ADMIN_PUBLIC_ORIGIN` | `https://test-shop-admin.lax.bid` |
| `SHOP_ADMIN_SESSION_ENCRYPTION_KEY` | ≥32 chars secret |
| `SENTRY_RELEASE` / deploy SHA | matches monorepo pin |

## shop-api (test) additions

| Variable | Value |
| --- | --- |
| `SHOP_ADMIN_ENABLED` | `true` |
| `SHOP_OPS_ALERT_EMAIL` | ops mailbox |
| `SHOP_OPS_FINANCE_CLI_ENABLED` | `true` |
| `SHOP_VAT_STANDARD_RATE_BP` | `2000` (TEST placeholder) |
| `SHOP_CANCELLATION_DAYS_AFTER_POSSESSION` | `0` (TEST placeholder) |
| `SHOP_PERSONALISED_GOODS_CANCELLATION_EXEMPT` | `false` |

Keep `SHOP_PAYOUTS_ENABLED`, `SHOP_THIRD_PARTY_ENABLED`, `SHOP_ORIGINALS_ENABLED`, and `SHOP_MERCHANDISE_ENABLED` **false** until each rollout step in the phase gates runbook.

## Identity and GitHub

1. Merge lax-identity closure PR (includes `lax-shop-admin` redirect URIs on shop-admin hosts only).
2. Run `configure-oidc-clients` on test.
3. Enrol TOTP (silver) on the dedicated staff acceptance identity.
4. Set GitHub **test** secrets: `SHOP_ADMIN_ACCEPTANCE_EMAIL`, `SHOP_ADMIN_ACCEPTANCE_PASSWORD`, `SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET`.

## Verification

- `curl -sS https://test-shop-admin.lax.bid/health/ready | jq` → `status: ok`, `dependencies.shopApi.status: ok`
- OIDC login completes at `/api/auth/callback` with silver `acr`
