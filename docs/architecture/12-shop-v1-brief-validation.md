# Shop V1 brief validation and build SSOT

> **Implementation status (last reviewed 2026-10-05)**
>
> - **Phase 0:** decisions D28–D32 recorded; this document and [10-shop-commerce-boundary.md](./10-shop-commerce-boundary.md) updated.
> - **Phases 1–4:** in progress per the delivery plan below. Treat code and migrations as SSOT once merged; this doc tracks intent and acceptance mapping.

## Purpose

This document validates the shop.lax.art V1 business brief against the existing Shop codebase,
records confirmed product and technical decisions, lists outside inputs by owner and blocking
phase, and maps the seven acceptance tests to delivery phases.

Related decisions: **D28** (Stripe only), **D29** (phased delivery), **D30** (shop-admin +
RBAC), **D31** (acr/auth_time on exchanged tokens), **D32** (no international checkout in V1).

## Confirmed product decisions

| Topic | Decision |
| --- | --- |
| Payments | Stripe only; extend Checkout, webhooks, Refunds, Disputes, Invoicing |
| Next edition sold | First **authorised**, then lowest edition number (`sale_authorised_at`, `edition_number`) |
| LAX editions | Require explicit sale authority like buyer/artist editions — no auto-listing |
| Checkout account | Sign-in required before checkout (current behaviour) |
| Staff admin | Phase 1 ops via CLI (`sale-authority`, `staff-grant`); `apps/shop-admin` UI deferred (D30); MFA silver + recent auth for finance when admin API is enabled |
| Sale limits | Owner instructs account manager; staff record grants with evidence; portal read-only + change requests |
| Merchandise | V1 simple LAX-owned SKUs with stock counts (Phase 4) |
| lax.bid auction originals | V1 manual buyer-edition assignment in admin; auto event deferred |
| Zoho | CRM only in V1; Inventory/Books out of scope |
| Zoho edition model | One `Artworks` (Arts) record per numbered edition; original in `Products` |
| Print spec | Single size/paper/frame per artwork in V1 |
| Owner proceeds in Zoho | Sale `Transactions` + `Royalty_Transactions` (Print Sale Proceeds); fees as separate Fee transactions |
| Payout methods | Bank transfer only in V1 |
| Zoho accounts | Shop creates/links `Accounts`; sets `Contacts.Account_Name` |
| Shopify | Out of scope — do not migrate or integrate |
| International delivery | Online checkout UK/collection/storage only (D32); `international_quotation` stays enquiry |

## Code vs brief — resolved gaps (pre–Phase 1)

These were gaps in the foundation slice; Phase 1+ code addresses them:

| Gap | Resolution |
| --- | --- |
| Artist editions 11–20 had no owner | Backfill `owner_party_id` to artist party; two-axis listing/custody status |
| LAX editions auto-`available` | Listing status `authorised` only after explicit grant |
| Single `shop_edition.status` enum | Split `listing_status` + `custody_status` |
| Refund period from `paidAt` | Cancellation period from possession (Phase 2); migrate paid orders to `pending_possession` |
| Fixed fulfilment surcharges in domain | Configurable prices table (Phase 2) |
| Six shop events emitted but unregistered | Register all; `ShopDomainEventPublisher` + `DOMAIN_EVENT_PUBLISH_VALIDATE` |
| No staff admin / portal ownership views | Phase 1 admin + `/v1/me/*` portal |
| Zoho shop sync beyond `shop.order.paid` | Phase 1 foundation modules; Phase 2+ money/production |

## Outside inputs (configuration — never hard-coded)

Until supplied, related production actions stay blocked with `shop.policy_not_configured`.

| Owner | Input | Blocks phase |
| --- | --- | --- |
| Brian (legal) | Cancellation period start for collection and LAX storage orders; personalised-goods exemption; payee/transaction compliance triggers | Phase 2 go-live |
| Accountant + Brian | VAT/margin scheme; Artist's Resale Right rates and remittance fields | Phase 2 go-live (VAT); Phase 3 (ARR reporting) |
| Oliver | Confirm staff role matrix default (shop_admin, account_manager, broker, operations, finance, catalogue_editor) | Phase 1 roles (default in plan) |
| Felix + Oliver | Confirm D32 — no international paid checkout in V1 | Phase 2 marketing copy / go-live |
| Operations | Fulfilment and insurance prices, collection locations, storage terms | Phase 2 settings |
| Finance | LAX-owned sales reporting; chargeback clawback after owner paid | Phase 2–3 |
| CRM admin | Sandbox → production promotion of Zoho integration fields and `LAX Platform` pipeline | Phase 1 Zoho live |
| Omar / infra | Production DNS `shop.lax.art`, `admin.shop.lax.art`; registrant/KYC migration plan | Deploy |

Zoho sandbox module shapes were verified 2026-10-01 (LAX Integration Test); production lacks integration fields until promotion.

## Delivery phases (summary)

See [10-shop-commerce-boundary.md](./10-shop-commerce-boundary.md) for executable boundaries.

1. **Phase 1 — Client ownership foundation:** migrations 0182–0194 (+ staff/authority), domain modules, event catalog, ops CLI (`staff:grant`, `sale-authority`), client portal editions/limits (orders via existing commerce routes), authorised-only checkout, Zoho Products upsert when `SHOP_ZOHO_CATALOGUE_SYNC_ENABLED`, dead-letter email alert. Staff browser UI (`apps/shop-admin`) deferred.
2. **Phase 2 — Sell, deliver, get paid:** production, fulfilment, possession-based cancellation, refunds/disputes, payout eligibility, finance mark-paid, portal payouts/documents, Zoho Transactions/Royalties/production/fulfilment docs.
3. **Phase 3 — Operations dashboard:** brokers, holds, third-party sales and fees, reconciliation, ARR report, full admin dashboard.
4. **Phase 4 — Originals and merchandise:** Stripe Invoicing, enquiry → Deals, original sale workflow, merchandise storefront.

Feature flags (representative): `SHOP_PORTAL_OWNERSHIP_ENABLED`, `SHOP_ADMIN_ENABLED`, `SHOP_PAYOUTS_ENABLED`, `SHOP_THIRD_PARTY_ENABLED`, `SHOP_ORIGINALS_ENABLED`, `SHOP_MERCHANDISE_ENABLED`.

## Acceptance tests → phases

| # | Test | Phase |
| --- | --- | --- |
| 1 | Eligible original → 24 editions 10/10/4 via admin | 1 |
| 2 | Ineligible → zero editions | 1 |
| 3 | Owner limit + broker hold, no double sale | 1 (limit); 3 (hold) — [stock-holds.spec.ts](../../apps/shop-admin/e2e/stock-holds.spec.ts) (BFF → shop-api over HTTP) |
| 4 | Direct sale → production → fulfilment → cancellation → manual payout | 2 — [direct-sale-payout.spec.ts](../../apps/shop-admin/e2e/direct-sale-payout.spec.ts) |
| 5 | Third-party sale gross/fees/net match shop, Zoho, portal | 3 — [third-party-sales.spec.ts](../../apps/shop-admin/e2e/third-party-sales.spec.ts) |
| 6 | Original sale reservation → invoice → assign original + buyer editions | 4 — [original-sales.spec.ts](../../apps/shop-admin/e2e/original-sales.spec.ts) + [merchandise.spec.ts](../../apps/shop/e2e/merchandise.spec.ts) |
| 7 | Zoho failure alerts; stock correct; safe retry | 1 (catalogue); 3 (full sync) |

**Buyer checkout (cross-phase):** tier-2 staging acceptance covers browse → basket → sign-in → Stripe redirect, webhook-paid order for the acceptance buyer (`rehearse:staging-stripe-webhook`), and buyer-visible paid order on confirmation + `/account/orders` ([paid-order.spec.ts](../../apps/shop/e2e/paid-order.spec.ts)). Commerce seed reset clears all sellable fixtures and buyer basket/pending orders before each seeded run ([acceptance-commerce-seed.ts](../../apps/shop-api/src/infrastructure/seed/acceptance-commerce-seed.ts)).

## Architecture rules (SOLID)

- `packages/shop-domain`: pure policies only; transition-table unit tests.
- `apps/shop-api/application`: use cases + narrow ports; no Drizzle/Fastify.
- `apps/shop-api/infrastructure`: adapters; wired in `container.ts` only.
- State changes: `domain_events` (+ `email_outbox` when needed) in the same transaction.
- Stock master: `shop-api` only; Zoho and portal are read/projections.

## References

- [10-shop-commerce-boundary.md](./10-shop-commerce-boundary.md)
- [02-decisions.md](./02-decisions.md) (D24–D32)
- [docs/integrations/zoho.md](../integrations/zoho.md)
- Plan file (Cursor): shop V1 detailed build plan — do not edit in-repo; this doc is the published SSOT.
