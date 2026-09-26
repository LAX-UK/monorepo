# Silent SSO rollout (test → prod)

Cross-product silent sign-in uses a shared policy in `@auction/identity-rp` and `prompt=none` OIDC redirects on Shop and Bid.

## Flags

| Flag | Scope | Default |
|------|--------|---------|
| `SILENT_SSO_ENABLED` | Shop storefront + Bid web | `false` |
| `FEDCM_ENABLED` | Identity + RPs (Chromium enhancement) | `false` |

Enable on **test** first; watch error rates and redirect loops before prod.

## Cookies (host-only, `SameSite=Lax`, httpOnly)

| Cookie | Max age | Meaning |
|--------|---------|---------|
| `{prefix}_probe` | 10 min | Silent redirect in flight |
| `{prefix}_quiet` | 30 min | No IdP session; suppress repeat probes |
| `{prefix}_suppressed` | 30 days | User logged out; no silent sign-in |

Prefixes: `shop_sso_*` (Shop), `bid_sso_*` (Bid).

## Flow

1. Guest document navigation on an eligible page → middleware redirects to product SSO probe route.
2. Probe starts OIDC with `prompt=none`.
3. Success → same page, signed in. `login_required` → guest on same page + quiet cookie.
4. Logout → suppressed cookie until interactive sign-in.

## Identity Login Status

When `Set-Login: logged-in|logged-out` is emitted from Identity (`apps/auth`), browsers that support the Login Status API can skip redundant prompts.

## FedCM

Requires spike validation (well-known on `lax.bid`, `SameSite=None` session reachability, auth code minting). Endpoints live under Identity `/fedcm/*` when `FEDCM_ENABLED=true`. Redirect probe remains the fallback.
