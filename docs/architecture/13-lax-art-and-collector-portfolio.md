# lax.art storefront, collector portfolio, and LAX Art commerce channels

## Purpose

This document is the architecture SSOT for **lax.art** as a second public storefront on the same LAX Art commerce backend as **shop.lax.art**, for how collectors see owned works across both sites, and for how payout onboarding stays **one account per business** (not per site).

Related decisions: **D17** (Shop at `shop.lax.art`), **D37** (lax.art channel), **D38** (two Stripe accounts), **D13** (roles stay product-owned), **D18** (canonical identity subject).

## Product split

| Surface | Domain (production) | Interim (test) | Primary catalogue |
| --- | --- | --- | --- |
| LAX Art | `www.thelax.art` (apex `thelax.art`, `lax.art`, `www.lax.art` → 301) | `test-art.lax.bid` | Originals and gallery-led sales (enquiry → invoice) |
| shop.lax.art | `shop.lax.art` | `test-shop.lax.bid` | Edition prints and merchandise (Stripe Checkout) |
| lax.bid | `lax.bid` | `test.lax.bid` | Auctions (separate product; Bid API and Stripe account) |

Marketing copy may describe lax.art as the gallery and Shop as the editions destination; **commerce rules, parties, editions, orders, documents and payouts** for lax.art and Shop share **`apps/shop-api`** and **`packages/shop-domain`**.

## Sales channel

Listings and orders carry a **sales channel** (for example `art` vs `shop`) so reporting, storefront filters and admin queues can distinguish originals workflow from print checkout without duplicating domain models.

- **shop channel:** existing print and merchandise checkout.
- **art channel:** originals enquiry, reservation, Stripe Invoicing, assignment of original custody and buyer editions.

Both channels read the same **`shop_party`** (keyed by identity subject) for ownership and payouts.

## Collector portfolio (client UX)

Collectors think in **my works and my money**, not in which hostname they used.

| Account area | Meaning | lax.art Figma | Shop today |
| --- | --- | --- | --- |
| **Collection** | Owned originals and editions, documents, provenance | To be designed | `/account/editions` (partial) |
| **Enquiries** | Open and historical purchase / viewing enquiries | Inquiries tab | Interest / enquiry (partial) |
| **Favorites** | Saved artworks and followed artists | Saved / Followed | Unified in `shop-api`; lax.art `/account/favorites` is the first consumer |
| **Orders** | Paid commerce orders (prints, merch) | N/A for originals invoice path | `/account/orders` |
| **Payouts** | LAX Art business payout account (Connect) | Payouts (mobile designs) | `/account/payouts` when enabled |

**API:** `GET /v1/me/collection` aggregates owned works and document metadata across channels. **Enquiries** use `GET /v1/me/enquiries` with a staff-visible status lifecycle; each row includes the enquiry `message` and `contactPhone` (migration 0212; both nullable). Enquiry requests validate `message` (1–2000 characters) and `contactPhone` (same shape as checkout `deliveryPhone`).

Presentation uses shared view models in a package consumed by **`apps/shop`** and **`apps/art`** so both sites render the same collection semantics.

### Favorites

Saved artworks and followed artists live in `shop-api` (migration **0213**: `shop_saved_artwork`, `shop_followed_artist`). Rows are keyed by **identity subject**, not party, so a collector without a `shop_party` can still save works. Deleting an artwork or artist cascades its favorites. Identity merges re-key both tables in the merge-inbox runner, dropping duplicates. `shop_app` has DML grants via `SHOP_COMMERCE_TABLES` in `migrate-roles`.

Favorites are only registered when `SHOP_PORTAL_OWNERSHIP_ENABLED` is true. When the flag is off they return `shop.feature_disabled` (404). Routes require a user token (BFF tokens get 401). Reads need `shop.read`; writes need `shop.write`.

| `shop-api` route | BFF route (`shop-identity` / art-identity) | Result |
| --- | --- | --- |
| `GET /v1/me/favorites/artworks` | `GET /commerce/me/favorites/artworks` | `{ items: PortalSavedArtwork[] }`, newest first |
| `PUT /v1/me/favorites/artworks/:slug` | `PUT /commerce/me/favorites/artworks/:slug` (CSRF) | `saved` or `already_saved` |
| `DELETE /v1/me/favorites/artworks/:slug` | `DELETE /commerce/me/favorites/artworks/:slug` (CSRF) | `removed` or `already_removed` |
| `GET /v1/me/favorites/artists` | `GET /commerce/me/favorites/artists` | `{ items: PortalFollowedArtist[] }`, newest first |
| `PUT /v1/me/favorites/artists/:slug` | `PUT /commerce/me/favorites/artists/:slug` (CSRF) | `followed` or `already_followed` |
| `DELETE /v1/me/favorites/artists/:slug` | `DELETE /commerce/me/favorites/artists/:slug` (CSRF) | `removed` or `already_removed` |

PUT and DELETE are idempotent: repeating one returns `200` with the `already_*` status. An unknown slug returns `404 shop.not_found`. Contracts are in `packages/shop-contracts/src/portal-favorites.ts`. Layering follows the usual path: route → `application/handlers/portal-favorites.handler.ts` → `PortalFavoritesPort` → Drizzle adapter.

## lax.art application

- **`apps/art`:** Next.js storefront and signed-in account surfaces aligned with [Figma LAX.art rebuild](https://www.figma.com/design/JvWqZrAeu8r8fs5EfjDlRc/LAX.art-rebuild).
- **OIDC client:** `lax-art-web` (confidential BFF pattern, same family as Shop). Its redirect on test is `https://test-art.lax.bid/auth/callback`.
- **Public URL:** from env only (`LAX_ART_PUBLIC_URL`); never hard-code production host in code. `shop-api` reads the same variable (`StorefrontOrigins`) to pick the origin for art-channel artwork links in enquiry and notify-me emails, and to allow lax.art Connect return URLs.
- **BFF (art-identity):** a second deployment of the **`apps/shop-identity`** codebase (see **D37**), configured with `OIDC_CLIENT_ID=lax-art-web` and `SHOP_STOREFRONT_URL=<LAX_ART_PUBLIC_URL>`. Ingress on the art hostname routes exactly the `SHOP_IDENTITY_OWNED_PREFIXES` (`/login`, `/logout`, `/register`, `/auth`, `/api`, `/me`, `/commerce`) to art-identity and everything else to `apps/art`. `apps/art` calls art-identity server-side (`ART_IDENTITY_INTERNAL_BASE_URL`, falling back to `ART_IDENTITY_BASE_URL`).
- **Routes:** `/`, `/artworks`, `/artworks/[slug]`, `/artists/[slug]`, `/search`, and the signed-in `/account` area with `/account/collection`, `/account/inquiries`, `/account/favorites` and `/account/payouts`. Health checks are `/health/live` and `/health/ready`.

Editorial pages (exhibitions, stories, Arthub, press) may ship after commerce and account MVP.

## Identity and LAX Account boundary

Per [09-lax-identity-boundary.md](./09-lax-identity-boundary.md):

- **LAX Account** (`apps/account`) holds profile, security, **Your LAX access** (staff launch links from `lax_staff_platforms`), and **payout launch links** per business — not product money balances or Connect state.
- **LAX Art payouts UI** is owned by the commerce product: one screen reused at Shop `/account/payouts` and lax.art account, backed by `shop-api`.
- **Bid payouts UI** stays on Bid; unchanged.

## Stripe (see D38)

Exactly **two** Stripe platform accounts:

1. **LAX Bid** — `apps/api` payments and Bid seller Connect.
2. **LAX Art** — `shop-api` Checkout, Invoicing, refunds, and payee Connect for both lax.art and shop.lax.art.

A person may have at most **one Connect account per Stripe platform**. Until account 2 exists, test runs on the separate **London Art Test** sandbox (`STRIPE_SHOP_CONNECT_PLATFORM_KEY=lax_art`); production Connect for LAX Art must not go live on the shared sandbox account (connected accounts cannot migrate between platforms), and `shop-api` enforces `lax_art` when `APP_ENV=production`.

| `shop-api` setting | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` | LAX Art platform keys (London Art Test sandbox keys on test until account 2 exists) |
| `STRIPE_SHOP_CONNECT_PLATFORM_KEY` | `bid_sandbox` or `lax_art`; part of every Connect row and transfer idempotency key |
| `STRIPE_SHOP_CONNECT_WEBHOOK_SECRET` | Secret of the **Connect** webhook endpoint `/webhooks/stripe/connect` (`account.updated`) |
| `SHOP_CONNECT_TRANSFERS_ENABLED` | Turns on automatic transfers of `due` payouts to ready accounts |

Connect onboarding return and refresh URLs must be on the `SHOP_STOREFRONT_URL` or `LAX_ART_PUBLIC_URL` origin. URLs are compared by exact origin (scheme, host and port), and anything else gets `400 shop.validation`.

Payee journey: Shop `/account/payouts` (and lax.art `/account/payouts`) shows the payout account state (not set up, action needed, ready) and opens Stripe's embedded onboarding or account management. Ready accounts receive `due` payouts automatically; staff can still mark a payout paid by bank transfer.

## Original purchase flow (lax.art)

1. Client submits enquiry (storefront or lax.art account).
2. Staff reserve original in Shop Admin (`SHOP_ORIGINALS_ENABLED`).
3. Staff issue Stripe Invoice via commerce API.
4. `invoice.paid` webhook assigns original + configured buyer editions to buyer party, creates documents and ledger lines, notifies client.
5. Work appears in **Collection** on lax.art and Shop; resale of editions follows existing sale-authority and payout rules.

## References

- [12-shop-v1-brief-validation.md](./12-shop-v1-brief-validation.md) — phases and acceptance tests
- [10-shop-commerce-boundary.md](./10-shop-commerce-boundary.md) — executable boundaries
- [shop-v1-phase-gates.md](../runbooks/shop-v1-phase-gates.md) — flag rollout
