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
6. **Notify me** — when a print edition is listed but not purchasable online (sold out or
   awaiting allocation), signed-in viewers can register interest; the API rejects
   registration while editions remain purchasable, including direct API calls.

### Notify-me journey and failure states

| Step | Expected behaviour |
|---|---|
| Guest on unavailable edition | Sees sign-in CTA with `returnTo` on the artwork URL; no enabled notify button. |
| Authenticated, interest loaded | Notify button or “already subscribed” copy; never guest “Create a LAX account” on editions. |
| Interest status load failed / 401 | Alert copy; notify control disabled until status is known. |
| POST while artwork purchasable | `409 shop.conflict`; storefront shows conflict message. |
| Unknown artwork slug (GET/POST) | `404 shop.not_found`; storefront does not treat as unsubscribed. |
| Duplicate registration | Idempotent `already_subscribed`; one interest row and one domain event. |

Post–sign-in basket merge surfaces a global `basketMerge` query notice (merged / skipped /
failed) on any `returnTo` destination; Stripe checkout cancel uses a dismissible basket
notice that clears `cancelled=1` from the URL.

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

**Foundation (implemented on main; staging deploy follows Identity soak gates):**

1. Shop-owned artwork model with eligibility flag and idempotent `import_key`.
2. Transactional allocation of editions **1–24** when eligible (**10 / 10 / 4** buyer-entitlement / artist / LAX).
3. `apps/shop-api` public catalogue reads; `apps/shop` homepage backed by seeded data.
4. Figma-derived desktop navigation + accessible responsive fallback (not full homepage Figma parity).

**Commerce slice (on main; staging proof via `shop-staging-acceptance.yml`):**

1. Anonymous basket with server-side persistence keyed to Shop session or guest token.
2. Checkout requires Shop SSO; sandbox Stripe Checkout on staging (`shop-api` requires Stripe secrets at boot).
3. Persist order + line items under `shop_app` tables; webhook-driven payment completion in `shop-api` tests.
4. **Automated release acceptance** (recovery / `shop-staging-acceptance.yml` with `seed_catalogue=false`): release-pinned `/health/ready`, Stripe unsigned webhook returns `400`, and fixture-independent Playwright tier (home a11y/theme/viewport). **Commerce evidence** requires a disposable run with `seed_catalogue=true` plus manual Stripe test-card checkout; do not treat tier 1 alone as proof of basket/checkout on staging.

**Later increment:**

1. Import from Shopify export where it maps to artwork/edition (not generic variant SKUs).

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

- [`shop-staging-acceptance.yml`](../../.github/workflows/shop-staging-acceptance.yml) green on `test-shop.lax.bid` with `shop_sha` matching deployed release (tier 1 always; tier 2 when `seed_catalogue=true` on disposable data)
- Staging browse → basket → SSO → sandbox checkout completes end-to-end (manual card step until recorded in evidence)
- Notify-me cannot register for currently purchasable artworks; interest + event proven in DB integration tests
- Session-aware footer, artwork unavailable panel, and commerce read failures each have distinct UI (no masquerading as empty/unsubscribed)
- Shop obeys layer guardrails (`scripts/check-layers.mjs` Shop section)
- Separate Docker images (`shop`, `shop-identity`, `shop-api`), deploy components, tests, and rollback path documented
- Identity staging acceptance remains green with Shop gates enabled

## Extraction threshold (unchanged)

Revisit a standalone Shop repository only with an independent owning team, stable
versioned contracts, and no shared monorepo source imports. Until then, keep Shop in
this monorepo with strict product boundaries.
