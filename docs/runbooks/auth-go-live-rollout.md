# Auth go-live rollout (phased)

1. **DB**: Run collision report → apply `0057_auth_hardening` during a maintenance window.
2. **JWKS + env**: Deploy `apps/auth` + `apps/api` with `pg_try_advisory_xact_lock` retirement; set `JWT_AUDIENCE`, `AUTH_DEK_KEY`, `WEB_ORIGINS`, production `superRefine` validations.
3. **Encryption**: Set `AUTH_DEK_KEY`, deploy auth stack with adapter + JWKS envelope writes; run `pnpm --filter @auction/db db:backfill-auth-at-rest` once against the auth DB.
4. **Core + UX**: Deploy web redirect hardening, logout broadcast, reset-password URL strip, session revocation hooks.
5. **Sessions UI + step-up + Turnstile**: Enable after API routes for `/me/sessions` and `POST /auth/reauth` ship.
6. **CSP**: Start `Content-Security-Policy-Report-Only` on marketing surfaces; fix violations; switch to enforce (`CSP_ENFORCE=1` on `apps/web`). Before enforcing, in **Cloudflare** disable **Scrape Shield → Email Address Obfuscation** for each zone (`lax.bid`, `test.lax.bid`, etc.): Cloudflare injects `cdn-cgi/scripts/.../email-decode.min.js`, which violates `script-src 'strict-dynamic'` and cannot be allowlisted by host when enforcing.
7. **GDPR purge**: Apply `0058_user_pii_purge.sql`; worker job `purge-soft-deleted-users` calls `SELECT user_pii_purge(id)` for users past deletion cooling-off.

See also: [auth-secrets-rotation.md](./auth-secrets-rotation.md), [jwks-rotation.md](./jwks-rotation.md).

## Backfill: personal legal entity for users missing provisioning (LAX-PROD-AUTH-2)

After deploying the `user.registered` → worker projector flow, optionally enqueue domain events for users who signed up while `auth_app` lacked `legal_entity` write access. The worker projector provisions entities idempotently on the next tick.

Run once against production (or test) as `DATABASE_URL_OWNER`:

```sql
INSERT INTO domain_events (aggregate_type, aggregate_id, event_type, payload, producer, schema_version)
SELECT 'user', u.id, 'user.registered',
       jsonb_build_object('userId', u.id, 'email', u.email, 'name', u.name, 'source', 'backfill'),
       'ops/backfill', 1
FROM "user" u
LEFT JOIN legal_entity le ON le.created_by_user_id = u.id AND le.kind = 'individual'
WHERE le.id IS NULL;
```

Do not run automatically in deploy scripts. Users who hit an authenticated API path before the projector runs are still covered by lazy `ensurePersonalEntity` on the API side.
