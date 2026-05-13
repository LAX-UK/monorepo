# Auth go-live rollout (phased)

1. **DB**: Run collision report → apply `0057_auth_hardening` during a maintenance window.
2. **JWKS + env**: Deploy `apps/auth` + `apps/api` with `pg_try_advisory_xact_lock` retirement; set `JWT_AUDIENCE`, `AUTH_DEK_KEY`, `WEB_ORIGINS`, production `superRefine` validations.
3. **Encryption**: Set `AUTH_DEK_KEY`, deploy auth stack with adapter + JWKS envelope writes; run `pnpm --filter @auction/db db:backfill-auth-at-rest` once against the auth DB.
4. **Core + UX**: Deploy web redirect hardening, logout broadcast, reset-password URL strip, session revocation hooks.
5. **Sessions UI + step-up + Turnstile**: Enable after API routes for `/me/sessions` and `POST /auth/reauth` ship.
6. **CSP**: Start `Content-Security-Policy-Report-Only` on marketing surfaces; fix violations; switch to enforce (`CSP_ENFORCE=1` on `apps/web`).
7. **GDPR purge**: Apply `0058_user_pii_purge.sql`; worker job `purge-soft-deleted-users` calls `SELECT user_pii_purge(id)` for users past deletion cooling-off.

See also: [auth-secrets-rotation.md](./auth-secrets-rotation.md), [jwks-rotation.md](./jwks-rotation.md).
