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

Release (Set-Login and FedCM Identity routes):

1. `pnpm ci:identity-closure-sync` — verify `lax-identity` closure matches `apps/auth`.
2. Publish the lax-identity image for the merge SHA (identity deploy workflow).
3. Run staging recovery with the new image digest and re-baseline the identity soak gate.
4. Roll Shop/Bid `SILENT_SSO_ENABLED` only after Identity is live on test.

## FedCM

Requires spike validation (`SameSite=None` session reachability, auth code minting). Endpoints live under Identity `/fedcm/*` when `FEDCM_ENABLED=true`. Redirect probe remains the fallback.

**Test environment:** Chromium expects `/.well-known/web-identity` on the **eTLD+1** (`lax.bid`), not on `test.lax.bid` / `test-shop.lax.bid`. FedCM cannot be fully exercised on test subdomains until well-known is served at the registrable root (or prod-like hostnames).

FedCM client bootstraps only run when server-side cookie gates pass (no session, not quiet/suppressed). Each tab attempts FedCM once (`sessionStorage`); failed attempts fall back to the redirect probe, which also refuses suppressed/quiet/authenticated callers.

## Backchannel logout

`suppressed` is set on **interactive** product logout (Shop identity `POST /logout`, Bid BFF logout). OIDC backchannel logout invalidates server sessions but cannot set browser cookies — guests may still get one silent probe until the next full-page navigation after cookie expiry unless they hit a product logout path.

## CI: lax-identity closure

PRs touching `apps/auth/**` run **Identity closure sync** against `lax-identity@main`. Merge the paired lax-identity closure PR (or sync SHA) before expecting that check to pass on the monorepo PR.
