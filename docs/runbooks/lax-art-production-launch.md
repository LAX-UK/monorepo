# LAX Art production launch plan

This runbook is the production cutover checklist for **LAX Art** alongside the existing Shop stack. Production LAX Art launches on the existing domain **`https://www.thelax.art`** so the legacy site's search equity carries over; the SEO cutover itself is in [thelax-seo-migration.md](./thelax-seo-migration.md). A later move to `lax.art` is a separate Change-of-Address project (see that runbook) — do not point `lax.art` at the app except as a 301 to `www.thelax.art`. Test runs Shop and lax.art on the **London Art Test** Stripe sandbox (`STRIPE_SHOP_CONNECT_PLATFORM_KEY=lax_art`), separate from Bid's sandbox ([shop-stripe-setup.md](./shop-stripe-setup.md)).

## Preconditions

- Test exit criteria met: phase gates 2–4 recorded, originals journey on test-art, live QA signed off, Sentry clean on test for shop-api, shop-identity, art (art-identity image), account, and Bid services.
- Production Terraform state and DNS are owned by `auction-infra` (`terraform/persistent/prod`, `terraform/ephemeral/prod`).
- Production OIDC client `lax-art-web` configured from the registry (`packages/identity-contracts/src/clients.ts`, applied by `pnpm --filter @auction/db db:configure-oidc-clients`) with `www.thelax.art` URIs (section 4).

## 1. Stripe (account 2)

Production uses a dedicated LAX Art Stripe platform account, not the Bid auction platform.

| Secret / var | Action |
| --- | --- |
| `STRIPE_SHOP_SECRET_KEY` | LAX Art live secret key (Shop checkout + Connect) |
| `STRIPE_SHOP_PUBLISHABLE_KEY` | LAX Art live publishable key (embedded Connect onboarding) |
| `STRIPE_SHOP_WEBHOOK_SECRET` | New endpoint on `https://shop.lax.art/webhooks/stripe` (or prod Shop hostname) |
| `STRIPE_SHOP_CONNECT_WEBHOOK_SECRET` | New Connect endpoint on `https://shop.lax.art/webhooks/stripe/connect` (`account.updated`) |
| `STRIPE_SHOP_CONNECT_PLATFORM_KEY` | Set to `lax_art` (prod enum) in Terraform |
| Bid `STRIPE_*` keys | Unchanged on auction API; do not mix with Shop/Art |

**Payee migration:** Connected accounts cannot move between Stripe platforms. Every payee who onboarded on test (London Art Test sandbox) must complete Connect onboarding again on production LAX Art. Document this in client comms (D38).

**Order of operations:** deploy shop-api with new keys and webhook secrets **before** enabling `SHOP_CONNECT_TRANSFERS_ENABLED` or flipping merchandise/originals flags.

## 2. Terraform components (prod ephemeral)

Mirror the test layout in `auction-infra/terraform/ephemeral/prod/main.tf`:

| Component | Image | Notes |
| --- | --- | --- |
| `shop`, `shop-api`, `shop-identity`, `shop-admin` | `lax-prod-*` | Existing |
| `account` | `lax-prod-account` | Payout launch links include `LAX_ART_PUBLIC_URL` |
| `art-identity` | **Reuse** `lax-prod-shop-identity` tag | `OIDC_CLIENT_ID=lax-art-web`, `SHOP_STOREFRONT_URL=https://www.thelax.art` |
| `art` | `lax-prod-art` | Port 3050, primary domain `www.thelax.art` |

**Ingress on `www.thelax.art`:** route identity-owned prefixes (`/login`, `/logout`, `/register`, `/auth`, `/api`, `/me`, `/commerce`) to `art-identity`; all other paths to `art`. App Platform matches these per path segment (verified on test-art: `/mexyz` reaches `art`, `/me/…` reaches `art-identity`), so legacy URLs such as `/message-from-ceo` still reach the Art redirect middleware.

**Env highlights:**

- `shop-api`: `LAX_ART_PUBLIC_URL=https://www.thelax.art` (Connect return URLs + notification links)
- `auth`: `LAX_ART_ORIGIN=https://www.thelax.art` (derived automatically from `SHOP_ORIGIN=https://shop.lax.art` when unset)
- `account`: `LAX_ART_PUBLIC_URL=https://www.thelax.art`
- `art`: `LAX_ART_PUBLIC_URL=https://www.thelax.art` (canonical, sitemap and redirect base), `ART_GA_MEASUREMENT_ID` (GA4 property already used by the legacy site), `ART_GOOGLE_SITE_VERIFICATION` (Search Console HTML-tag token). Leave `ART_ALLOW_INDEXING` unset in prod — indexing is allowed only when the public host is `www.thelax.art`.
- `art` on test/staging: `ART_ALLOW_INDEXING=false` (belt and braces; non-prod hosts are already `noindex` + `Disallow: /`).

**CORS:** none. shop-api is reached server-side by the Art BFF and art-identity, never from the browser, so it has no CORS allow-list to update.

**Cookies:** Identity, art-identity and Art cookies are host-only (no `Domain` attribute), so they bind to `www.thelax.art`. The apex and `lax.art` hosts only ever return edge 301s and never set cookies.

**Stripe:** webhook endpoints stay on `https://shop.lax.art` (section 1). Connect onboarding return/refresh URLs for Art payees are built from `LAX_ART_PUBLIC_URL`, so they follow the env change; confirm the live LAX Art Stripe account has `www.thelax.art` in its branding/business URL.

## 3. DNS

In persistent prod Terraform (the `thelax.art` zone must be added to Cloudflare first and nameservers delegated from the registrar; lower TTLs to 300 s at least 48 h before cutover):

| Record | Type | Target |
| --- | --- | --- |
| `www.thelax.art` | CNAME | App Platform hostname (proxied via Cloudflare) |
| `thelax.art` | A/AAAA (proxied, dummy origin) or flattened CNAME | Edge redirect only |
| `lax.art`, `www.lax.art` | proxied, dummy origin | Edge redirect only |
| `shop.lax.art` | CNAME | Existing Shop app (unchanged) |
| `admin.shop.lax.art` | CNAME | Existing Shop admin (unchanged) |

Apply persistent layer first, then ephemeral. Verify TLS and `/health/ready` on `www.thelax.art` and `shop.lax.art` after deploy.

### Host redirects (Cloudflare `http_request_dynamic_redirect`)

The existing `cloudflare-domain` module only knows "www → apex" for `lax.bid`. LAX Art needs the opposite direction plus the `lax.art` hosts. Add per-zone rulesets in `auction-infra` (one hop, 301, path and query preserved):

```hcl
# thelax.art zone: apex → www
rules {
  action     = "redirect"
  expression = "(http.host eq \"thelax.art\")"
  action_parameters {
    from_value {
      status_code           = 301
      target_url { expression = "concat(\"https://www.thelax.art\", http.request.uri.path)" }
      preserve_query_string = true
    }
  }
}

# lax.art zone: lax.art and www.lax.art → www.thelax.art (shop.* and admin.* untouched)
rules {
  action     = "redirect"
  expression = "(http.host in {\"lax.art\" \"www.lax.art\"})"
  action_parameters {
    from_value {
      status_code           = 301
      target_url { expression = "concat(\"https://www.thelax.art\", http.request.uri.path)" }
      preserve_query_string = true
    }
  }
}
```

Exclude nothing else: legacy-path redirects happen in the Art middleware (one hop after the host hop at most). Verify with `curl -sI https://thelax.art/about-us.html` → `301 location: https://www.thelax.art/about-us.html`, then that URL → `301 /about`.

## 4. OIDC

Production client `lax-art-web` (registry: `packages/identity-contracts/src/clients.ts`):

- Redirect: `https://www.thelax.art/auth/callback`
- Post-logout: `https://www.thelax.art/` and `https://www.thelax.art/signed-out`
- Back-channel logout: `https://www.thelax.art/api/auth/backchannel-logout` (`verify-backchannel-logout-live.mjs` includes `lax-art-web`)

Run `db:configure-oidc-clients` in the prod migrate job after the registry change ships so auth stops accepting the old `lax.art` URIs.

Store `OIDC_CLIENT_SECRET_LAX_ART_WEB` in GitHub prod secrets; migrate job must populate auth env (same as test infra #29 pattern).

## 5. Feature flag rollout (prod)

Follow [shop-v1-phase-gates.md](./shop-v1-phase-gates.md). Default prod flags off except portal ownership and admin as already defined for Shop.

Recommended order:

1. Deploy stack with Shop payouts **off** and Connect keys live; smoke webhooks (unsigned POST → 400).
2. Enable `SHOP_PAYOUTS_ENABLED`; verify embedded onboarding on Shop and lax.art `/account/payouts`.
3. Phase 2: `SHOP_CONNECT_TRANSFERS_ENABLED` after one ready payee and two green acceptance runs.
4. Phase 3: `SHOP_THIRD_PARTY_ENABLED`.
5. Phase 4: `SHOP_ORIGINALS_ENABLED` + `SHOP_MERCHANDISE_ENABLED` together.

Each flip: Terraform apply (approval), deploy if image pins changed, **two** `shop-staging-acceptance` runs with `seed_catalogue=true`, record run IDs in the gate table.

## 6. Rollback

- **Flag regression:** set the GitHub var back to `false`, re-apply Terraform, redeploy if needed, re-run acceptance twice before retrying.
- **Stripe misconfiguration:** disable transfers and payouts flags first, then rotate webhook secrets; never leave unsigned webhooks accepting traffic.
- **Art-only outage:** roll `art_image_tag` to last known good SHA via App Platform pin; art-identity rolls with `shop_identity_image_tag`.
- **Search traffic regression:** fix forward; DNS rollback to the legacy site only on the threshold in [thelax-seo-migration.md](./thelax-seo-migration.md#53-monitoring).

## 7. Post-launch verification

- [shop-live-qa-checklist.md](./shop-live-qa-checklist.md) (Shop + lax.art sections)
- Originals journey on production: enquiry → reserve → invoice → pay → Collection on **both** Shop and lax.art
- Sentry: zero unresolved issues for prod environment on listed services
- Monitoring uptime targets for `art` `/health/ready`
- SEO: `pnpm seo:verify-legacy-redirects -- --base-url https://www.thelax.art` passes, sitemaps submitted, monitoring cadence per [thelax-seo-migration.md](./thelax-seo-migration.md#phase-5--cutover-and-monitoring)

## References

- Architecture: [09-lax-identity-boundary](../architecture/09-lax-identity-boundary.md), doc 13 shop/lax.art collection parity
- Test inventory: [docs/ui/art-figma-inventory.md](../ui/art-figma-inventory.md)
- Infra precedent: `auction-infra` branch `feat/test-art-lax-bid-infra` (test components)
