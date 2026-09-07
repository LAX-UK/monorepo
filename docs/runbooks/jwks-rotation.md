# JWKS rotation

Quarterly proactive rotation of the JWT signing key, plus emergency rotation on suspected leak. The procedure is the same in both cases — only the trigger differs.

This runbook is the operational checklist. The retirement-window math and the table schema live in [../security/key-rotation.md](../security/key-rotation.md), and the rationale for storing keys in Postgres at all is D2 in [../architecture/02-decisions.md](../architecture/02-decisions.md).

> **Status today.** Key persistence lives in [packages/identity-db/src/adapters/drizzle-jwks-store.ts](../../packages/identity-db/src/adapters/drizzle-jwks-store.ts). The retirement helper and 15-minute schedule live in [packages/identity-db/src/adapters/drizzle-jwks-retirement.ts](../../packages/identity-db/src/adapters/drizzle-jwks-retirement.ts) and run inside `apps/auth` under the `auth_app` database role. The scheduler uses a Postgres advisory lock so only one auth replica performs each retirement tick.

## Triggers

- **Quarterly.** First business day of each quarter.
- **Emergency.** Any of: a Sentry alert indicating unusual auth patterns, a credential leak in any env var dump, a privileged developer's laptop being compromised, or a confirmed Postgres-cluster breach.

## Procedure

The retirement window is **30 minutes** = `max(60s discovery cache TTL, 15min access-token lifetime) + 15min safety margin`.

1. **Pre-flight.** Confirm `apps/auth` and `apps/api` are healthy. Confirm Cloudflare cache for `/.well-known/jwks.json` is up. Open the on-call channel and post "starting JWKS rotation".
2. **Insert a rotating key.** Use the repository's tested JWKS rotation command to generate and envelope-encrypt a new RS256 key with status `rotating`. Do not hand-write private JWK SQL. If the command is unavailable or its dry-run/preflight fails, stop the rotation.
3. **Wait 60 seconds.** This is the Cloudflare cache TTL on `/.well-known/jwks.json`. After 60 s, every consumer's next fetch will see both keys.
4. **Promote.** `UPDATE jwks_key SET status='active' WHERE kid='<new_kid>'`. Demote the previous active key with `UPDATE jwks_key SET status='retired', rotated_at=now() WHERE kid='<old_kid>' AND status='active'`. Both keys remain in JWKS.
5. **Wait 30 minutes** from the previous step. During this window, in-flight access tokens signed with the old key continue to validate.
6. **Retire the old key.** The scheduled `retireExpiredJwksKeys` helper from [packages/identity-db/src/adapters/drizzle-jwks-retirement.ts](../../packages/identity-db/src/adapters/drizzle-jwks-retirement.ts) updates eligible rotating rows after the 30-minute window. If running the step manually, use the repository command rather than hand-writing the update so the predicate stays aligned with code.
7. **Smoke test.** Issue a fresh sign-in and verify the resulting JWT validates against the JWKS endpoint. Force-fetch JWKS through Cloudflare with `cache-bypass=1` to confirm the new key is published.
8. **Post-completion.** Post "JWKS rotation complete, new kid `<new_kid>`" in the on-call channel. Update the rotation log in 1Password.

## Emergency variant

If the trigger is a suspected leak:

- Skip step 1's "ask if anyone's deploying" and just go.
- After step 4, **also** invalidate every active session: `DELETE FROM session`. This logs every user out, which is the intended cost — they'll re-authenticate against the new key.
- Open a parallel incident ticket and follow [./jwt-key-leak.md](./jwt-key-leak.md).

## Verifying nothing's left behind

After rotation, run:

```sql
SELECT kid, status, created_at, rotated_at FROM jwks_key ORDER BY created_at;
```

You should see exactly one `active` row and zero or one `retired` rows whose `rotated_at` is more than 30 minutes ago. Anything else means the procedure was interrupted; restart the runbook.

## Why the procedure is on a runbook and not fully automated

The retirement step (`rotating` → `retired` → row deleted) is automated by the scheduler in `apps/auth`. The promote/insert/wait steps still need human judgement (timing, smoke tests, on-call coordination), so the runbook is the source of truth for the overall procedure even though the back half runs on its own.
