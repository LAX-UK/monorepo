# Silent SSO rollout (test → prod)

Cross-product silent sign-in uses a shared policy in `@auction/identity-rp` and `prompt=none` OIDC redirects on Shop and Bid.

## Flags

| Flag | Scope | Default |
|------|--------|---------|
| `SILENT_SSO_ENABLED` | Shop storefront + Bid web | `false` |
| `FEDCM_ENABLED` | Identity + RPs (Chromium enhancement) | `false` |

Enable on **test** first; watch error rates and redirect loops before prod.

**Test App Platform:** `SILENT_SSO_ENABLED=true` on the `web` and `shop` components in [auction-infra/terraform/ephemeral/test/main.tf](https://github.com/LAX-UK/auction-infra/blob/main/terraform/ephemeral/test/main.tf). Apply Terraform (or your usual test infra workflow) after merging that change. Leave `FEDCM_ENABLED` unset/false everywhere on test.

## Cookies (host-only, `SameSite=Lax`, httpOnly)

| Cookie | Max age | Meaning |
|--------|---------|---------|
| `{prefix}_probe` | 10 min | Silent redirect in flight |
| `{prefix}_quiet` | 30 min | No IdP session; suppress repeat probes |
| `{prefix}_suppressed` | 30 days | User logged out; no silent sign-in |
| `{prefix}_notice` | 120 s | Silent sign-in succeeded; show one-shot “signed in as …” modal (not httpOnly, value `1`, no PII) |

Prefixes: `shop_sso_*` (Shop), `bid_sso_*` (Bid).

After a **silent** OIDC success, the product callback sets `{prefix}_notice`. The storefront reads and clears it on the next page load, then shows a small centred modal: **Continue** (or Esc / outside click) keeps the session; **Not you? Sign out** runs the normal product logout (RP-initiated IdP logout + suppressed cookie). Interactive sign-in and FedCM paths do not set the notice cookie.

## Flow

1. Guest document navigation on an eligible page → middleware redirects to product SSO probe route.
2. Probe starts OIDC with `prompt=none`.
3. Success → same page, signed in + notice cookie → one-shot modal with display name from session. `login_required` → guest on same page + quiet cookie.
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

Keep **`FEDCM_ENABLED=false`** until all of the following ship:

- Working `POST /fedcm/assertion` (not 501) and RP `/fedcm/complete` handlers.
- `login_url` in Identity `fedcm/config.json` (required by Chromium).
- `/.well-known/web-identity` on the **eTLD+1** (`lax.bid`), not only on product subdomains.

**Test environment:** Chromium expects `/.well-known/web-identity` on the **eTLD+1** (`lax.bid`), not on `test.lax.bid` / `test-shop.lax.bid`. FedCM cannot be fully exercised on test subdomains until well-known is served at the registrable root (or prod-like hostnames).

FedCM client bootstraps only run when server-side cookie gates pass (no session, not quiet/suppressed). Each tab attempts FedCM once (`sessionStorage`); failed attempts fall back to the redirect probe, which also refuses suppressed/quiet/authenticated callers.

## Manual cross-product verification (test)

Automated Playwright coverage is not checked in: it needs real test origins, `SILENT_SSO_ENABLED=true`, and an existing IdP session from an interactive sign-in on the other product.

1. Sign in on Shop (interactive) on test; confirm guest basket if merge matters.
2. Open Bid in a fresh profile (or after clearing Bid cookies only) → expect silent sign-in without a login form; land on the requested page, not forced onboarding. Confirm the **You're signed in** modal shows the correct name/email; **Continue** dismisses it.
3. Reverse: sign in on Bid, open Shop → silent sign-in, notice modal (before any basket-merge banner), and basket merge via `/account/post-sign-in` when applicable.
4. On a fresh profile after silent sign-in, choose **Not you? Sign out** on Bid and Shop → confirm IdP session ends (no silent re-sign-in on the other product until interactive login).
5. Log out on one product (header/account) → confirm suppressed cookie blocks silent probe until interactive sign-in on that product.

**Privacy / legal (no code change):** Bid footer entity is “London Auction Xchange LTD” and Shop is “London Art Exchange Ltd”. If these are separate controllers, ensure the shared LAX sign-in is covered in the privacy notice.

## Backchannel logout

`suppressed` is set on **interactive** product logout (Shop identity `POST /logout`, Bid BFF logout). OIDC backchannel logout invalidates server sessions but cannot set browser cookies — guests may still get one silent probe until the next full-page navigation after cookie expiry unless they hit a product logout path.

## Hosted login (Identity auth component)

Turnstile (`TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`) must be set on the **auth** App Platform component (not only web/api) so hosted login renders the widget and enforces captcha after repeated failed passwords. Confirm Cloudflare Turnstile hostname allow-list includes `test-auth.lax.bid` / `auth.lax.bid`.

## CI: lax-identity closure

PRs touching `apps/auth/**` run **Identity closure sync** against `lax-identity@main`. Merge the paired lax-identity closure PR (or sync SHA) before expecting that check to pass on the monorepo PR.
