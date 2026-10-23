# LAX Account (`apps/account`)

Neutral identity settings portal at `account.lax.bid` (OIDC client `lax-account-web`).

- `/`: sign-in landing, post-logout landing and callback error notices (`?error=`).
- `/account`: overview and Security Checkup.
- `/account/profile`: name, email (changed through links emailed to both the current and the new address) and phone (added or changed with a texted code) are edited here.
- `/account/email-change?t=`: where the emailed confirmation links land. It needs no sign-in; the signed token is the proof, and a button (not the link itself) makes the change.
- `/account/security`: password and two-step links, and Where you're signed in (sign out one device, or every other device).
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
| `LAX_BID_PUBLIC_URL` | Optional; enables the address book, notification and help links that still live in LAX Bid. |
| `LAX_BID_API_URL`, `LAX_SHOP_API_URL` | Optional server-to-server URLs of the product APIs the portfolio is read from (fall back to `INTERNAL_API_URL` / `NEXT_PUBLIC_API_URL` and `SHOP_API_BASE_URL`). A product without a URL shows as unavailable. |
| `LAX_MEDIA_ORIGINS` | Optional comma-separated origins product images may load from; also read from `NEXT_PUBLIC_MEDIA_BASE_URL` and `SHOP_MEDIA_PUBLIC_BASE_URL`. Used for the CSP `img-src` (set at build time) and to drop images from any other origin. |

Name, email, phone and sessions are changed through client-authenticated issuer routes (`/api/auth/lax/account-*`),
called server-side with the person's own access token. Renaming, starting an email change, sending or checking a phone code, and signing devices out need a
sign-in from the last five minutes; Account otherwise sends the person through a fresh sign-in
(`/api/auth/login?intent=reauth`) and back to the same page.

Keep `LAX_ACCOUNT_ORIGIN` unset on Bid web while Bid still hosts its own identity settings pages,
otherwise Bid settings redirect here and Account's remaining links to Bid loop.

Deploy: DigitalOcean component + DNS `test-account.lax.bid` / `account.lax.bid` (see `auction-infra`).
