# Auth audit — signed-in test evidence (test environment)

Automated probes and unit tests validate the fixes in branch `fix/auth-audit`. Live test hosts still run the previous deploy until this branch merges and app deploy completes.

## Automated (pre-fix baseline, 2026-10-08 UTC)

| Check | Result |
|-------|--------|
| `POST /api/auth/forget-password` | 404 |
| `POST /api/auth/request-password-reset` | 200 |
| Shop Admin callback without pending cookie | `Location: https://0.0.0.0:3030/login?error=missing_pending` |
| `oidc_login_prompt` Set-Cookie | No HttpOnly/Secure |
| Hosted login CSP / HSTS | Present |

## Post-fix (local / CI, 2026-10-09 UTC)

| Area | Evidence |
|------|----------|
| `@auction/auth` | hosted-auth-html, flow-context (`acr_values`), continue (`/api/auth/callback`) |
| `@auction/auth-app` | silver ACR gate, OIDC prompt cookie hardening, root → `/login`, staff sign-up redirect |
| `@auction/shop-admin` | callback/reauth `publicOrigin` redirects, pending retry cookie, logout 303, end-session public issuer |
| `@auction/shop-identity` | `/me` preserves pending OAuth (`pendingLogin: true`, no cookie wipe) |

## Live reverify (still on old deploy, 2026-10-09 UTC)

| Check | Current test result | Expected after deploy |
|-------|---------------------|------------------------|
| Shop Admin callback, no pending | `https://0.0.0.0:3030/login?error=missing_pending` | `https://test-shop-admin.lax.bid/api/auth/login?returnTo=/` (first hit) or public-origin error |
| Forgot password API | 404 on `/forget-password` | Hosted page uses `/request-password-reset` (200) |

Re-run after deploy:

```bash
curl -sI "https://test-shop-admin.lax.bid/api/auth/callback?code=x&state=y" | grep -i location
curl -sI -X POST "https://test-auth.lax.bid/api/auth/forget-password" | head -1
```

## Manual signed-in rows (credentials not in chat)

Use staff and customer test accounts on `test-auth`, `test-shop-admin`, and `test-shop`. Record URL chain, cookies, and `doctl` log lines here.

- [ ] Shop Admin: password + TOTP sign-in; note `acr`/`amr` in session
- [ ] Shop Admin: sign out → Auth end-session (not JSON)
- [ ] Shop Admin: stale pending (>10m) → restart or clear error on public origin
- [ ] Shop: sign out → sign in (watch for `token_exchange_failed`)
- [ ] Auth: forgot password email delivery
- [ ] Auth: enable TOTP on fresh account (500 check)
- [ ] Shop Admin: non-staff customer → `not_authorized`
- [ ] Shop: Google sign-in; magic link

**Unconfirmed (needs signed-in capture):** Shop `token_exchange_failed` after sign-out/sign-in; staff TOTP 500; back-channel logout `sid`/`sub` indexing; array `aud` from issuer.
