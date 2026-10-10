# LAX Account (`apps/account`)

Neutral identity settings portal at `account.lax.bid` (OIDC client `lax-account-web`).

- `/`: sign-in landing, post-logout landing and callback error notices (`?error=`).
- `/account`: profile (read-only) and security (change password, authenticator setup).
- Sign-in: `/api/auth/login` → auth issuer → `/api/auth/callback`; sign-out is a same-origin
  `POST /api/auth/logout` that ends the issuer session.
- Sensitive steps (password reset, authenticator setup) stay on auth-hosted pages. The hosted
  setup page refuses to re-enrol an account that already has an authenticator.

## Environment

| Variable | Notes |
| --- | --- |
| `LAX_ACCOUNT_PUBLIC_ORIGIN` | Public origin; HTTPS origins use a `__Host-` session cookie. |
| `OIDC_ISSUER_URL`, `OIDC_INTERNAL_BASE_URL` | Issuer (internal URL is used for token and JWKS calls). |
| `OIDC_CLIENT_SECRET_LAX_ACCOUNT_WEB` | Confidential client secret. |
| `REDIS_URL`, `LAX_ACCOUNT_SESSION_ENCRYPTION_KEY` | Encrypted BFF session store (key ≥ 32 chars). |
| `LAX_BID_PUBLIC_URL` | Optional; shows "Edit in LAX Bid" for profile changes. |

Keep `LAX_ACCOUNT_ORIGIN` unset on Bid web while Bid owns profile editing, otherwise Bid settings
redirect here and the "Edit in LAX Bid" link loops.

Deploy: DigitalOcean component + DNS `test-account.lax.bid` / `account.lax.bid` (see `auction-infra`).
