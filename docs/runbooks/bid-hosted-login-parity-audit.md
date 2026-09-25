# Bid hosted login — staging parity audit (`client_id=lax-bid-web`)

**Status:** checklist pending — run on staging before production cutover.

| Flow | Entry | Hosted page | Bid BFF resume | Verified (staging) |
| --- | --- | --- | --- | --- |
| Sign-in | `/login` | `/login` (bid theme) | Callback → post-login | [ ] |
| Sign-up | `/register` | `/sign-up` via `prompt=create` | Callback → `/onboarding/account` if profile incomplete | [ ] |
| Sign-up + invite | `/register?invite=…` | Hosted sign-up | Invite carried in pending session → onboarding | [ ] |
| Sell intent | `/login?intent=sell` | Hosted login | `entry_intent=sell` analytics on post-login | [ ] |
| Account switch | `/login?switch=1` | `prompt=login` | Fresh session | [ ] |
| Password reset | `/forgot-password`, `/reset-password` | Issuer recovery | N/A (issuer completes) | [ ] |
| 2FA challenge | `/login/two-factor` | `/two-factor` | OIDC after TOTP | [ ] |
| Verify pending | `/register/verify-pending` | `/resend-verification` | After verify → BFF login | [ ] |
| Magic link / activate | `/auth/activate?token=…` | Magic-link verify (Bid button) | BFF login | [ ] |
| Google / Apple | Hosted login buttons | Issuer OAuth | OIDC callback only | [ ] |
| Step-up | Sensitive API actions | `/api/auth/login?intent=reauth` | `auth_time` window on callback | [ ] |
| Logout / sessions | `/api/auth/logout`, settings | Issuer session APIs | Backchannel + post-login broadcast | [ ] |

Automated probe: `node scripts/ci/verify-bid-web-bff-roundtrip.mjs` (identity staging acceptance).

Manual check: each row on staging without entering a password on the Bid origin (except `/onboarding/account`).
