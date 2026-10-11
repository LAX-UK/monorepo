# lax.art production launch plan

This runbook is the production cutover checklist for **lax.art** alongside the existing Shop stack. Test continues to use the Bid Stripe sandbox (`STRIPE_SHOP_CONNECT_PLATFORM_KEY=bid_sandbox`) until this plan is executed.

## Preconditions

- Test exit criteria met: phase gates 2–4 recorded, originals journey on test-art, live QA signed off, Sentry clean on test for shop-api, shop-identity, art (art-identity image), account, and Bid services.
- Production Terraform state and DNS are owned by `auction-infra` (`terraform/persistent/prod`, `terraform/ephemeral/prod`).
- Production OIDC clients registered in auth for `lax-art-web` (mirror test redirect URIs with prod hostnames).

## 1. Stripe (account 2)

Production uses a dedicated LAX Art Stripe platform account, not the Bid auction platform.

| Secret / var | Action |
| --- | --- |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` (Shop) | Replace with LAX Art platform keys in prod GitHub secrets |
| `STRIPE_SHOP_SECRET_KEY` | Same LAX Art secret key as Shop checkout + Connect |
| `STRIPE_SHOP_WEBHOOK_SECRET` | New endpoint on `https://shop.lax.art/webhooks/stripe` (or prod Shop hostname) |
| `STRIPE_SHOP_CONNECT_WEBHOOK_SECRET` | New Connect endpoint on `https://shop.lax.art/webhooks/stripe/connect` (`account.updated`) |
| `STRIPE_SHOP_CONNECT_PLATFORM_KEY` | Set to `lax_art` (prod enum) in Terraform |
| Bid `STRIPE_*` keys | Unchanged on auction API; do not mix with Shop/Art |

**Payee migration:** Connected accounts cannot move between Stripe platforms. Every payee who onboarded on test (Bid sandbox) must complete Connect onboarding again on production LAX Art. Document this in client comms (D38).

**Order of operations:** deploy shop-api with new keys and webhook secrets **before** enabling `SHOP_CONNECT_TRANSFERS_ENABLED` or flipping merchandise/originals flags.

## 2. Terraform components (prod ephemeral)

Mirror the test layout in `auction-infra/terraform/ephemeral/prod/main.tf`:

| Component | Image | Notes |
| --- | --- | --- |
| `shop`, `shop-api`, `shop-identity`, `shop-admin` | `lax-prod-*` | Existing |
| `account` | `lax-prod-account` | Payout launch links include `LAX_ART_PUBLIC_URL` |
| `art-identity` | **Reuse** `lax-prod-shop-identity` tag | `OIDC_CLIENT_ID=lax-art-web`, storefront URL `https://lax.art` |
| `art` | `lax-prod-art` | Port 3050, primary domain `lax.art` |

**Ingress on `lax.art`:** route identity-owned prefixes (`/login`, `/logout`, `/register`, `/auth`, `/api`, `/me`, `/commerce`) to `art-identity`; all other paths to `art`.

**Env highlights:**

- `shop-api`: `LAX_ART_PUBLIC_URL=https://lax.art` (Connect return URLs + notification links)
- `auth`: `LAX_ART_ORIGIN=https://lax.art`
- `account`: `LAX_ART_PUBLIC_URL=https://lax.art`

**CORS:** add `https://lax.art` to shop-api allowed origins.

## 3. DNS

In persistent prod Terraform:

| Record | Type | Target |
| --- | --- | --- |
| `lax.art` | CNAME | App Platform hostname (proxied via Cloudflare) |
| `shop.lax.art` | CNAME | Existing Shop app |

Apply persistent layer first, then ephemeral. Verify TLS and `/health/ready` on both hostnames after deploy.

## 4. OIDC

Register production client `lax-art-web`:

- Redirect: `https://lax.art/auth/callback`
- Post-logout: `https://lax.art/signed-out`
- Back-channel logout: same pattern as test (`verify-backchannel-logout-live.mjs` includes `lax-art-web`)

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

## 7. Post-launch verification

- [shop-live-qa-checklist.md](./shop-live-qa-checklist.md) (Shop + lax.art sections)
- Originals journey on production: enquiry → reserve → invoice → pay → Collection on **both** Shop and lax.art
- Sentry: zero unresolved issues for prod environment on listed services
- Monitoring uptime targets for `art` `/health/ready`

## References

- Architecture: [09-lax-identity-boundary](../architecture/09-lax-identity-boundary.md), doc 13 shop/lax.art collection parity
- Test inventory: [docs/ui/art-figma-inventory.md](../ui/art-figma-inventory.md)
- Infra precedent: `auction-infra` branch `feat/test-art-lax-bid-infra` (test components)
