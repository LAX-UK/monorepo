# Secrets management

Every secret in the system, where it lives, who can read it. The principles behind this list are in [../architecture/07-security-model.md](../architecture/07-security-model.md) under "Secrets management"; this file is the inventory.

> **Status note.** Pino field-redaction (auto-redacting any field containing `password`, `secret`, `token`, `key`) is **(planned)**. Today the discipline is "do not log secrets" enforced by code review, not by runtime redaction.

## Inventory

The shape of every secret in this list:

- **Name** — the env-var name as it appears in [.env.example](../../.env.example) and [.env.production.example](../../.env.production.example).
- **Where it lives** — DigitalOcean App Platform encrypted env, 1Password, the issuing console (Apple, Google, Stripe, etc.).
- **Who can read it** — the apps with the env var bound, plus the humans on the team page.
- **Rotation cadence** — quarterly, annually, on incident.

| Name | Where it lives | Who can read it | Rotation |
|---|---|---|---|
| `DATABASE_URL_OWNER` | DO App Platform env on the migration job; 1Password | Migration job only; founders | Annual or on suspected leak |
| `DATABASE_URL_AUTH` | DO App Platform env on `apps/auth`; 1Password | `apps/auth`; founders | Annual |
| `DATABASE_URL_API` | DO App Platform env on `apps/api`; 1Password | `apps/api`; founders | Annual |
| `DATABASE_URL_WORKER` | DO App Platform env on `apps/worker`; 1Password | `apps/worker`; founders | Annual |
| `DATABASE_URL_SHOP` | DO App Platform env on the Shop BFF; 1Password | Shop only; founders | Annual |
| `BETTER_AUTH_SECRET` | DO App Platform env on `apps/auth`; 1Password | `apps/auth`; founders | Quarterly |
| `CHECK_IN_TOKEN_SECRET` | DO App Platform env on `apps/api`; 1Password | `apps/api`; founders | Quarterly |
| `IDENTITY_MACHINE_CLIENT_ID` / `IDENTITY_MACHINE_CLIENT_SECRET` | DO App Platform env on `apps/api` and `apps/auth`; 1Password | `apps/api`, `apps/auth`; founders | Quarterly |
| `OIDC_CLIENT_SECRET_LAX_BID_WEB` | DO App Platform env on `apps/web`; 1Password | Bid BFF and one-time client provisioning only | Quarterly |
| `BID_BFF_SESSION_ENCRYPTION_KEY` | DO App Platform env on `apps/web`; 1Password | Bid BFF only | Quarterly; rotation logs out Bid sessions |
| `OIDC_CLIENT_SECRET` (`lax-shop-web`) | DO App Platform env on the Shop BFF; 1Password | Shop BFF and one-time client provisioning only | Quarterly |
| `SESSION_SECRET` (Shop) | DO App Platform env on the Shop BFF; 1Password | Shop BFF only | Quarterly; rotation logs out Shop sessions |
| `AUTH_DEK_KEY` | DO App Platform env on `apps/auth`; 1Password | `apps/auth` only | Re-encryption procedure only; never rotate in place |
| `JWKS` private keys | Postgres `jwks_key.private_jwk`, readable only by `auth_app` role | The role; nobody on the team has direct DB access at app-runtime time | Quarterly via [../runbooks/jwks-rotation.md](../runbooks/jwks-rotation.md) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | DO App Platform env on `apps/auth`; Google Cloud console | `apps/auth`; ops team | On suspected leak |
| `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET` | DO App Platform env on `apps/auth`; Apple Developer Program | `apps/auth`; ops team | Every 180 days or on suspected leak |
| `APPLE_DOMAIN_ASSOCIATION` | DO App Platform env on `apps/auth`; Apple Developer Program | `apps/auth`; ops team | When Apple domain verification content changes |
| `XERO_*` (client id/secret/refresh token) | DO App Platform env on `apps/worker`; Xero developer console; 1Password | `apps/worker`; ops team | Refresh token rotates on use; client secret annually |
| `ZOHO_*` (client id/secret/refresh token, region) | DO App Platform env on `apps/worker`; api-console.zoho.eu; 1Password | `apps/worker`; ops team | Refresh token rotates on use; client secret annually |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | DO App Platform env on `apps/api` and `apps/worker`; DigitalOcean Spaces keys; 1Password | `apps/api`, `apps/worker`; ops team | Annual or on suspected leak |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | DO App Platform env on `apps/api`; Stripe dashboard; 1Password | `apps/api`; ops team | Quarterly for live keys, on suspected leak |
| `SENTRY_DSN_API` / `SENTRY_DSN_AUTH` / `SENTRY_DSN_WS` / `SENTRY_DSN_WORKER` / `SENTRY_DSN_WEB` | DO App Platform env per app; Sentry; 1Password | The respective app; ops team | On suspected leak |
| `SENTRY_DSN_WEB` (GitHub env secret) | Optional mirror of web client DSN for CI prebuilt image builds | `.github/workflows/build-images.yml` (`NEXT_PUBLIC_SENTRY_DSN_WEB` build arg) | When Sentry web project is rotated |
| `REDIS_URL` | DO App Platform env on `apps/api`, `apps/auth`, `apps/ws`, `apps/worker`; 1Password | The respective apps; ops team | On Redis cluster rotation |
| `POSTMARK_SERVER_TOKEN` | DO App Platform env on `apps/worker`; Postmark server settings; 1Password | `apps/worker`; ops team | Annual or on suspected leak |
| `POSTMARK_TRANSACTIONAL_STREAM` / `POSTMARK_BROADCAST_STREAM` | DO App Platform env on `apps/worker` | `apps/worker`; ops team | Not a secret, listed for completeness — change only when Postmark stream ids change |
| `POSTMARK_WEBHOOK_BASIC_AUTH` | DO App Platform env on `apps/api`; Postmark webhook config; 1Password | `apps/api`; ops team | Annual; rotate Postmark side and `apps/api` env together |
| `EMAIL_UNSUBSCRIBE_SECRET` | DO App Platform env on `apps/api`; 1Password | `apps/api`; ops team | Only on suspected leak — rotation invalidates List-Unsubscribe links in already-delivered mail |
| `EMAIL_FROM` / `EMAIL_REPLY_TO` | DO App Platform env on `apps/auth`, `apps/api`, `apps/worker` | All three apps; ops team | Not a secret; change with Postmark sender domain updates |
| `ZOHO_CAMPAIGNS_API_KEY` / `ZOHO_CAMPAIGNS_LIST_KEY` | DO App Platform env on `apps/worker`; Zoho Campaigns; 1Password | `apps/worker`; ops team | Annual; rotate the API key only — list key changes with the marketing list |

When you add a secret to the codebase, add a row to this table in the same PR. When you rotate a secret, update the rotation date in 1Password (this file does not track exact dates — that's the 1Password entry's job).

`SSF_DELIVERY_ENABLED`, `SSF_DELIVERY_TIMEOUT_MS`, and
`SSF_DELIVERY_MAX_ATTEMPTS` are security-sensitive configuration but not
secrets. Streams remain disabled until receiver verification passes.

## Rotation procedure

The detailed procedure for the JWT signing keys is [../runbooks/jwks-rotation.md](../runbooks/jwks-rotation.md). For everything else, the procedure is:

1. Generate a new value in the issuing console (Stripe, Zoho, Apple, etc.).
2. Set the new value in DO App Platform encrypted env. Most issuers support overlap windows, so the old value keeps working.
3. Trigger a deploy. Confirm the new value works through a smoke test of the relevant flow.
4. Revoke the old value in the issuing console.
5. Update 1Password with the new rotation date.

For OAuth refresh tokens (Xero, Zoho), the refresh-flow rotates the token automatically on each use. The "rotation cadence" in those rows refers to the *client secret*, not the refresh token.

## What never lives in env vars

Database row contents are not secrets at the env-var level. JWKS private keys
live in `jwks_key.private_jwk`, restricted to the `auth_app` Postgres role.
Stripe customer payment-method tokens remain on Stripe's side; we hold reference
IDs only. Apple privacy-relay addresses are Identity PII and receive the same
protection as any other user email.

## Pre-commit scanning

Pre-commit hooks should scan for high-entropy strings to prevent accidental commits of secrets. Adding the hook is **(planned)** — today the convention is "review the diff before committing" plus the GitHub secret scanner that runs on push.
