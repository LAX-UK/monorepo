# Shop MVP product specification

Status: **draft for post–Identity-milestone delivery**  
Scope: customer-facing commerce on `test-shop.lax.bid`, then `shop.lax.art` at handover.

## Purpose

Replace Shopify incrementally with a custom Shop product that shares LAX Identity and
design language but remains an independently deployable boundary inside the monorepo
until extraction thresholds are met.

## Out of scope for the Identity milestone (already delivered separately)

- Hosted credential pages on `auth.lax.bid` (sign-in, sign-up, verification, reset, MFA, consent)
- Shop Identity BFF (`apps/shop-identity`): OIDC, opaque session cookie, back-channel logout, SSF
- Shop storefront entry states in `apps/shop`: sign-in/register CTAs, redirect/transition pages, minimal account shell

## MVP customer journeys

1. **Browse** — open catalogue, view product detail, see variant availability copy.
2. **Basket** — add/remove line items; basket survives anonymous session until checkout requires sign-in.
3. **Sign-in** — Shop BFF OIDC with PKCE; no passwords on Shop pages.
4. **Checkout (non-production)** — place a test order with sandbox payment; no live capture.
5. **Account** — order history and profile summary after authentication.

## Domain ownership

| Concern | Owner | Notes |
|---|---|---|
| Identity credentials, OIDC grants | `auth_app` / `apps/auth` | Sole issuer |
| Shop session + OIDC tokens server-side | `shop_app` / `apps/shop-identity` | Host-only cookie |
| Shop profile (`shop_user_profile`) | `shop_app` | Linked by Identity `sub` |
| Catalogue, variants, merchandising | `shop_app` | New Shop schema |
| Basket / checkout orchestration | `shop_app` | Shop packages + BFF |
| Payment authorisation | `shop_app` + provider adapter | Sandbox first |
| Inventory reservations | `shop_app` | No Bid inventory imports |
| Tax / shipping quotes | `shop_app` adapters | Provider-specific |
| Fulfilment events | `shop_app` | Webhooks + admin ops |

## First commerce vertical slice

Deliver on staging (`test-shop.lax.bid`) before production handover:

1. Import one real product (+ variant) from the Shopify catalogue export.
2. Render catalogue list and product detail in `apps/shop`.
3. Anonymous basket with server-side persistence keyed to Shop session or anonymous token.
4. Checkout requires Shop SSO; payment uses sandbox credentials only.
5. Persist order + line items under `shop_app` tables; emit Shop lifecycle events for observability.

## Shopify migration inputs required

Before implementation starts, provide:

- Current Shopify catalogue export (products, variants, images, collections)
- Payment provider and sandbox keys
- Inventory source of truth and sync expectations
- Shipping zones, carriers, and rate rules
- Tax configuration (VAT schemes, nexus)
- Fulfilment workflow (3PL, manual, dropship)

## Non-goals for MVP

- Bid catalogue or auction cross-sell
- Shared basket between Bid and Shop
- Admin merchandising CMS (manual seed/import only)
- Multi-currency beyond GBP unless export proves requirement
- Production `shop.lax.art` cutover (tracked in identity-boundary-cutover runbook)

## Acceptance for MVP slice

- Staging browse → basket → SSO → sandbox checkout completes end-to-end
- Shop obeys layer guardrails (`scripts/check-layers.mjs` Shop section)
- Separate Docker image, deploy component, tests, and rollback path documented
- Identity staging acceptance remains green with Shop gates enabled

## Extraction threshold (unchanged)

Revisit a standalone Shop repository only with an independent owning team, stable
versioned contracts, and no shared monorepo source imports. Until then, keep Shop in
this monorepo with strict product boundaries.
