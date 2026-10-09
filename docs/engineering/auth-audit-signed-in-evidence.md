# Auth audit — signed-in test evidence (test environment)

Auth audit fixes merged in #480; deploy unblock in auction-infra #34 and monorepo #481. App deploy test green on main (2026-10-09 UTC).

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

## Live reverify (post deploy, 2026-10-09 UTC)

| Check | Result |
|-------|--------|
| `test-auth` `/health/ready` | `status: ok`, release `2b5164d63b91d279003371ef2c4ced67d0d53168` |
| Shop Admin callback, no pending | `Location: https://test-shop-admin.lax.bid/api/auth/login?returnTo=/` |
| Forgot password API | 404 on `/forget-password` (hosted UI uses `/request-password-reset`) |

```bash
curl -sI "https://test-shop-admin.lax.bid/api/auth/callback?code=x&state=y" | grep -i location
curl -sS "https://test-auth.lax.bid/health/ready"
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
