# Bid hosted login — surface inventory

Signed-off classification for the Bid → issuer-hosted login cutover (D27).

| Surface | Classification | Notes |
| --- | --- | --- |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Redirect → BFF / issuer | `ensureHostedAuthRedirect` |
| `/login/two-factor` | Redirect → issuer `/two-factor` | |
| `/register/verify-pending` | Redirect → issuer `/resend-verification` | |
| `/auth/activate` | Redirect → issuer `/login` | |
| `/auth/activate/expired` | Redirect → issuer `/magic-link` | |
| `/auth/social-callback` | Redirect → `/login` (deprecated) | Social is issuer-hosted |
| `/api/auth/login`, `/api/auth/callback/lax-bid-web` | Keep (BFF) | PKCE, session cookie |
| `/auth/post-login` + `PostLoginHandoff` | Keep | Analytics + broadcast |
| `/auth/activate`, `/auth/activate/expired` | Redirect → issuer | Login / magic-link |
| `ActivateSetPasswordForm`, `/auth/activate/set-password` | Keep (account mgmt) | Post magic-link session; issuer JSON set-password |
| `/dashboard/invitations/accept/[token]` | Keep (links only) | `/login` + `/register` → hosted |
| 2FA enable wizard, connected accounts, phone verify | Keep (account mgmt) | Issuer JSON from Bid browser |
| `PasswordReauthDialog` / embedded sign-in forms | **Deleted** | Step-up → OIDC reauth |
| `sign-in.client.ts`, `sign-up.client.ts`, primary form components | **Deleted** | |

Verification: `rg` for `/api/auth/sign-in/` under `apps/web/src` (excluding `lib/auth/services` account adapters) must be empty; `pnpm exec node scripts/check-web-guardrails.mjs`.
