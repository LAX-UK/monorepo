# Shop commerce boundary

> **Implementation status (last reviewed 2026-09-18)**
>
> - **Implemented in code:** `apps/shop-api` (Fastify v5 catalogue + commerce API), `packages/shop-domain`, `packages/shop-contracts`, Shop-owned Drizzle tables (catalogue + commerce: baskets, orders, reservations, Stripe checkout metadata, processed payment events, payout ledger), concurrency-safe idempotent import, public catalogue reads, basket/checkout/order HTTP routes, Stripe webhooks (raw body scoped to the webhook plugin only), and the Shop storefront (`apps/shop`) with a same-origin commerce proxy to `apps/shop-identity`.
> - **BFF role:** `apps/shop-identity` owns OIDC, opaque sessions, guest sessions, CSRF, basket token cookies, RFC 8693 exchange to `lax-shop-api`, and `/commerce/*` proxy routes. Signed-in shoppers receive 15-minute OIDC ID tokens with `offline_access` refresh tokens stored AES-256-GCM encrypted on `shop_identity_session`; `ShopIdentityTokenService` refreshes under a per-session advisory lock before exchange. Legacy cookie-only sessions upgrade once via `GET /auth/upgrade` (`prompt=none`); missing or rejected refresh maps to `401 sign_in_required`, issuer outages stay `503 identity_token_unavailable`. Guest BFF credential (`SHOP_API_BFF_TOKEN`) is mandatory in production.
> - **Deferred:** admin/dashboard, Zoho/client-portal field mappings, automated payout execution, authenticated HTTP import (seed script remains the write path).

## Product boundary

Shop is a first-party LAX product at `shop.lax.art` (staging: `test-shop.lax.bid` for Identity only until handover). It shares the canonical Identity issuer (`auth.lax.bid`) but owns its own PostgreSQL schema, deployable API, and Next.js storefront.

| Deployable | Role | Database role |
|---|---|---|
| `apps/shop` | Next.js storefront (SSR catalogue reads) | none |
| `apps/shop-identity` | Confidential OIDC BFF (`lax-shop-web`) | `shop_app` on identity/profile tables only |
| `apps/shop-api` | Shop commerce API (`lax-shop-api` resource) | `shop_app` on Shop catalogue tables (`shop_artwork`, `shop_edition`, …), commerce tables, and append-only `domain_events` |

Bid auction tables, lot inventory, and `bid_user_profile` are never imported or joined from Shop code paths in this slice.

## First vertical slice (foundation)

The first commerce slice is **artwork + fixed 24-edition allocation**, not generic Shopify variants:

1. Import/create an artwork with an idempotent `import_key`.
2. If the artwork is **eligible**, allocate editions **1–24** in one transaction: **10** `original_buyer_entitlement`, **10** `artist`, **4** `lax`. Buyer-entitlement rows have **no owner** until a future original sale completes.
3. If **ineligible**, create **zero** edition rows.
4. Append `shop.artwork.created` and, when applicable, `shop.editions.allocated` to `domain_events` in the same transaction as authoritative state.
5. Expose **public** catalogue reads (artworks, categories, artists; list + by slug where applicable) with redacted edition detail.
6. Curate home merchandising via `shop_home_placement` slots (`featured_originals`, `featured_categories`, `featured_prints`, `featured_artists`) — screen composition stays in `apps/shop`, not in `shop-api` aggregate endpoints.
7. Record authenticated **notify-me** interest for unavailable editions and **enquiry** interest for originals in `shop_artwork_interest` (unique per artwork + Identity subject + `intent`: `notify_me` | `enquiry`) and append `shop.artwork.interest_registered` to `domain_events` in the same transaction. HTTP surface: `POST/GET /v1/artworks/:slug/interest` (user token required; optional `intent` on read/write); storefront reaches it through Shop Identity `/commerce/artworks/:slug/interest`.

Admin UI and external CRM projections remain out of scope. V1 purchase flow uses basket persistence, checkout idempotency, edition reservation (`FOR UPDATE SKIP LOCKED`), Stripe hosted checkout created **after** the reservation transaction commits, and locked webhook transitions with processed-event deduplication.

**Reservation attribution invariant.** Each reserved `shop_edition` row stores `reserved_by_order_id` pointing at the owning `shop_order`. Checkout sets this column when editions are held; `checkout.session.completed` and `checkout.session.expired` webhooks may transition only rows where `reserved_by_order_id` matches the webhook order. Sellable-edition selection treats TTL-expired reservations as available only when no `pending_payment` order still owns the hold, so a late webhook cannot sell an edition re-reserved by another checkout. `edition_state_invalid` is non-retryable once attribution is enforced.

**Checkout liveness.** When Stripe never delivers `checkout.session.expired`, `shop-api` runs an advisory-locked scheduler task that expires stale `pending_payment` orders past `checkout_expires_at` using the same release path as the webhook (synthetic `shop_processed_payment_event` id `reaper:order:<orderId>`). A later Stripe expiry event is a no-op once the order is no longer `pending_payment`.

**Notifications.** Shop transactional mail is staged in the shared `email_outbox` table inside the same database transaction as the business change (order paid → receipt, enquiry registration → ops alert, notify-me dispatch when editions become sellable). The existing worker email relay delivers rows; `shop_app` has `INSERT, SELECT` on `email_outbox` only.

## SOLID dependency rules

These rules are enforced by `scripts/check-layers.mjs` and code review:

- **`packages/shop-domain`** — pure policies and value types only. No Fastify, Drizzle, env, or app imports.
- **`packages/shop-contracts`** — transport-neutral TypeBox schemas and shared error codes. No framework or database imports.
- **`apps/shop-api` application layer** — use-case handlers depend on application-owned read models and narrow ports. Cursor decoding happens before reader ports; no Fastify, Drizzle, or `@auction/db` types enter this layer.
- **`apps/shop-api` transport layer** — route presenters map application read models to `@auction/shop-contracts`; catalogue and health routes receive segregated dependency objects.
- **`apps/shop-api` infrastructure** — Drizzle repositories and seed adapters implement ports; wired only from the composition root (`container.ts`, `server.ts`). Equal import keys are serialized transactionally, artwork identity policy keeps slug/edition eligibility immutable, and curation replaces only declared slots.
- **`apps/shop`** — server components call `shop-api` for catalogue reads via a runtime-validating client using `@auction/shop-contracts`. Commerce commands go through the storefront `/api/shop-identity` proxy to `shop-identity`, which exchanges (or uses the BFF token for guests) and calls `shop-api` basket/order routes.

## Deployment (App Platform)

Test/staging Shop runs on DigitalOcean App Platform (`auction-infra`):

- **`shop`** — public host (`test-shop.lax.bid`), port 3020.
- **`shop-identity`** — same host via ingress path prefixes for auth routes, port 3010.
- **`shop-api`** — internal service only; the storefront reaches it at `http://shop-api:3011` through `SHOP_API_BASE_URL`.

Legacy `docker-compose.prod.yml` still lists `shop-identity` for the single-droplet stack but does not deploy `shop-api` or the Next storefront; treat App Platform as the SSOT for Shop delivery.

## HTTP and Identity integration

- **Public reads:** `apps/shop` → `apps/shop-api` server-to-server on `SHOP_API_BASE_URL` (internal App Platform URL in production).
- **Catalogue pagination:** artwork and artist cursors encode `(created_at, id)` and are backed by matching composite indexes; categories are capped at 50 and support direct slug lookup.
- **Commerce writes:** browser/server action → `apps/shop` proxy → `apps/shop-identity` `/commerce/*` → `apps/shop-api` `/v1/basket` and `/v1/orders` with either the BFF bearer + `X-Shop-Basket-Token` (guest) or a `lax-shop-api` access token from RFC 8693 exchange (signed-in).
- **Payments:** `shop-api` creates Stripe Checkout sessions after reservations commit; `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired` webhooks require signature verification, event-id idempotency, order row locks, and per-edition state checks before marking sold, `payment_failed`, or releasing reservations.
- Resource indicator remains `https://shop.lax.art/api` per [09-lax-identity-boundary.md](./09-lax-identity-boundary.md).

## Related decisions

- **D17** — LAX owns Shop at `shop.lax.art`.
- **D24** — Shop commerce API boundary (Fastify + Drizzle modular monolith).
- **D5 / D8** — transactional outbox via `domain_events`.

## Verification gates

| Batch | Gate |
|---|---|
| 0 | This document, D24, MVP spec alignment, docs index links |
| 1 | `shop-api` boot, health, OpenAPI, layer checks |
| 2 | Pure domain unit tests (allocation, idempotency policy) |
| 3 | PostgreSQL integration (constraints, transaction + outbox, `shop_app` grants) |
| 4 | HTTP contract tests, public redaction |
| 5 | Navigation a11y/responsive, homepage data states |
| 6 | Full `pnpm` portfolio for touched packages (no staging deploy) |
