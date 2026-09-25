# Bid hosted login — rollout and rollback

## Order

1. Apply DB migration `0177_bid_account_onboarding.sql` (journal entry `0177_bid_account_onboarding`; backfills **all** profiles with legacy terms).
2. Deploy **issuer** (`apps/auth` / lax-identity): primary-login-only credential CORS, `user.create.before` registration kill switch (issuer-wide, including OAuth), relative redirects, `prompt_values_supported`.
3. Deploy **Bid API + web**: BFF redirects, `/onboarding/account`, `POST /users/me/onboarding` (no Turnstile; authenticated only), Redis-cached onboarding gate on bids/lots/sales/submissions/payments/org create, staff bypass, dashboard layout guard, HttpOnly invite cookie (not URL).
4. **Removed** public `POST /users/register` on Bid API — sign-up is issuer-hosted only; `Lead` fires from onboarding completion.
5. Run staging **identity-staging-acceptance** (`verify-bid-web-bff-roundtrip.mjs`).
6. Mirror issuer changes to `lax-identity` and run `LAX_IDENTITY_ROOT=../lax-identity node scripts/ci/verify-identity-source-parity.mjs`.
7. Complete manual parity checklist: [bid-hosted-login-parity-audit.md](./bid-hosted-login-parity-audit.md).

## Kill switch

Set `DISABLE_NEW_USER_REGISTRATION=true` on the **issuer** env. Blocks all new auth users (email and OAuth) via `databaseHooks.user.create.before`. Shop and Bid share the issuer.

## Sessions

Existing HttpOnly `lax-bid-session` cookies remain valid. Re-auth restores the prior session on failure; step-up requires matching subject on callback. Any new login while authenticated sets `replacesSessionId`.

## Rollback

Revert the hosted-login deploy pair (issuer + Bid web/API). Migration backfill is safe to leave applied.

## Production cutover

Staging acceptance green → promote same image digests → smoke `/login`, `/register?intent=sell`, account onboarding after hosted sign-up, 2FA/phone from dashboard, step-up reauth from settings.
