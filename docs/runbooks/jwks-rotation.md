# JWKS rotation

Quarterly proactive rotation of the JWT signing key, plus emergency rotation on suspected leak. The procedure is the same in both cases; only the trigger differs.

This runbook is the operational checklist. The retirement-window math and the table schema live in [../security/key-rotation.md](../security/key-rotation.md), and the rationale for storing keys in Postgres at all is D2 in [../architecture/02-decisions.md](../architecture/02-decisions.md).

> **How keys behave.** Only keys with status `active` or `rotating` are published at `/.well-known/jwks.json` and accepted for verification; `retired` keys disappear from JWKS at once. New tokens are signed with the newest `active` key. Key persistence is in [packages/identity-db/src/adapters/drizzle-jwks-store.ts](../../packages/identity-db/src/adapters/drizzle-jwks-store.ts). Rotation is [scripts/rotate-jwks.ts](../../scripts/rotate-jwks.ts) (`pnpm jwks:rotate`). Retirement is automatic: `retireExpiredJwksKeys` in [packages/identity-db/src/adapters/drizzle-jwks-retirement.ts](../../packages/identity-db/src/adapters/drizzle-jwks-retirement.ts) runs every 15 minutes inside `apps/auth` under the `auth_app` role, behind a Postgres advisory lock so only one replica acts per tick.

## Triggers

- **Quarterly.** First business day of each quarter. The key-age alert in [monitoring-alerts.md](./monitoring-alerts.md#jwks-signing-key-age) fires at 100 days as a reminder.
- **Emergency.** Any of: a Sentry alert indicating unusual auth patterns, a credential leak in any env var dump, a privileged developer's laptop being compromised, or a confirmed Postgres-cluster breach.

## Retirement window

A `rotating` key is retired when `rotated_at` is older than the window below. The window is computed in code from the access-token lifetime (`ACCESS_TOKEN_TTL_SECONDS`, 15 minutes), so a longer lifetime widens it automatically:

```text
max(60s discovery cache TTL, access-token lifetime) + 15min safety margin = 30 minutes
```

Every token signed by the old key has expired, and every consumer has re-fetched JWKS, before the key leaves it.

## Procedure

1. **Pre-flight.** Confirm `apps/auth` and `apps/api` are healthy and Cloudflare is serving `/.well-known/jwks.json`. Post "starting JWKS rotation" in the on-call channel. Take a snapshot: `pnpm jwks:snapshot <test|prod>` (needs `DATABASE_URL_OWNER`, `JWKS_SNAPSHOT_KEY_<ENV>` and the Spaces credentials). Rehearse on test first: run the whole procedure there before prod.
2. **Dry run.** `DATABASE_URL_OWNER=... AUTH_DEK_KEY=... pnpm jwks:rotate --dry-run` generates and seals a key without touching the database. If it fails, stop and fix the environment; do not hand-write private JWK SQL.
3. **Rotate.** Run `DATABASE_URL_OWNER=... AUTH_DEK_KEY=... pnpm jwks:rotate` as the owner role, with the same `AUTH_DEK_KEY` the auth service uses. In one transaction (under the same advisory lock the retirement tick uses) it inserts a new RS256 key as `active`, with the private key sealed by the envelope, and moves the previous `active` key to `rotating` with `rotated_at = now()`. It prints the new kid and the old kid(s). Both keys are now published.
4. **Wait for caches.** Allow at least 60 seconds (the Cloudflare cache TTL on `/.well-known/jwks.json`) so every consumer has fetched the new key. Tokens signed by the old key keep validating, because it is still published.
5. **Smoke test.** Issue a fresh sign-in and check the token's `kid` is the new kid and that it validates. Fetch JWKS through Cloudflare with `cache-bypass=1` and confirm it lists both the new and the old kid.
6. **Retirement happens by itself.** Once `rotated_at` is older than the retirement window, the next scheduled tick sets the old key to `retired` and it leaves JWKS. Do not edit status by hand. To check, wait at least 30 minutes plus one tick (15 minutes) and run the verification query below. If the old key is still `rotating` after 45 minutes, check the `jwks_retirement_tick` and `jwks_retirement_tick_failed` log lines in `apps/auth`.
7. **Post-completion.** Post "JWKS rotation complete, new kid `<new_kid>`" in the on-call channel. Update the rotation log in 1Password.

## Emergency variant

If the trigger is a suspected leak, follow [./jwt-key-leak.md](./jwt-key-leak.md) alongside this runbook:

- Skip the "ask if anyone is deploying" step and go straight to step 2.
- After step 3, also invalidate every session: `DELETE FROM session`. This logs every user out, which is the intended cost; they re-authenticate against the new key.
- If the old key must stop being trusted immediately, set it to `retired` in the database after step 3. Tokens it signed fail verification straight away. This is the only status edit that is ever done by hand.

## Verifying nothing is left behind

```sql
SELECT kid, status, created_at, rotated_at FROM jwks_key ORDER BY created_at;
```

Exactly one `active` row. Any `rotating` row has a `rotated_at` less than 30 minutes ago; older ones should already be `retired`. Anything else means the procedure was interrupted: check for a second `active` key or a `rotating` row with a null `rotated_at`, and re-run from step 2 after resolving it.

## Why part of this stays manual

Retirement is automated. Rotation is still run by a person, because the timing, the smoke test and on-call coordination need judgement, and an unattended rotation that fails halfway is worse than a late one.
