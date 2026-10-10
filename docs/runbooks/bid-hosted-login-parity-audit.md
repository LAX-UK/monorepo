# Bid hosted login — staging parity audit (`client_id=lax-bid-web`)

**Status:** unauthenticated handoffs verified on test (`test.lax.bid`, image
`8f88e911`, 2026-10-10). Credentialed completion rows remain open before
production cutover.

| Flow                  | Entry                                    | Hosted page                                                          | Bid BFF resume                                         | Handoff (test)                                 | Credentialed completion |
| --------------------- | ---------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------- | ----------------------- |
| Sign-in               | `/login`                                 | `/login` (bid theme)                                                 | Callback → post-login                                  | [x]                                            | [ ]                     |
| Sign-up               | `/register`                              | `/sign-up` via `prompt=create`                                       | Callback → `/onboarding/account` if profile incomplete | [x]                                            | [ ]                     |
| Sign-up + invite      | `/register?invite=…`                     | Hosted sign-up                                                       | Invite carried in pending session → onboarding         | [x]                                            | [ ]                     |
| Sell intent           | `/login?intent=sell`                     | Hosted sign-up (`prompt=create`; sign-in link for existing accounts) | `entry_intent=sell` analytics on post-login            | [x]                                            | [ ]                     |
| Account switch        | `/login?switch=1`                        | `prompt=login`                                                       | Fresh session                                          | [x]                                            | [ ]                     |
| Password reset        | `/forgot-password`, `/reset-password`    | Issuer recovery                                                      | N/A (issuer completes)                                 | [x]                                            | [ ]                     |
| 2FA challenge         | `/login/two-factor`                      | `/two-factor`                                                        | OIDC after TOTP                                        | [x]                                            | [ ]                     |
| Verify pending        | `/register/verify-pending`               | `/resend-verification`                                               | After verify → BFF login                               | [x]                                            | [ ]                     |
| Magic link / activate | `/auth/activate?token=…`                 | Magic-link verify (Bid button)                                       | BFF login                                              | [x]                                            | [ ]                     |
| Google / Apple        | Hosted login buttons                     | Issuer OAuth                                                         | OIDC callback only                                     | [x] Google; Apple off (no credentials on test) | [ ]                     |
| Step-up               | Sensitive API actions                    | `/api/auth/login?intent=reauth` → `prompt=login`                     | `auth_time` window on callback                         | [x]                                            | [ ]                     |
| Logout / sessions     | `/api/auth/logout` (POST only), settings | Issuer session APIs                                                  | Backchannel + post-login broadcast                     | [x]                                            | [ ]                     |

"Handoff" means the Bid entry reaches the listed hosted page with
`client_id=lax-bid-web` and the expected `prompt`, without a password field on
the Bid origin. `/forgot-password` and `/login/two-factor` must answer with an
HTTP redirect; a route-level `loading.tsx` turns that into a streamed 200 plus
a delayed meta refresh.

Automated probe: `node scripts/ci/verify-bid-web-bff-roundtrip.mjs` (identity staging acceptance).

Manual check: each row on staging without entering a password on the Bid origin (except `/onboarding/account`).
