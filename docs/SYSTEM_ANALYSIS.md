# Auction System - Current Analysis

Updated: 2026-05-05

Note: This document describes current implementation state of the auction
domain (sales, lots, bids, payments). For platform/identity architecture see
`docs/architecture/01-overview.md` and the rest of `docs/architecture/`.

## System Architecture Overview

```
Browser / Next.js app (apps/web, port 3000)
  ├─ REST/RPC JSON calls with Better Auth cookies
  │    └─ Hono API (apps/api, port 3001)
  │         ├─ PostgreSQL 16 via Drizzle ORM (api_app role)
  │         ├─ Redis cache, pub/sub, idempotency keys
  │         ├─ BullMQ lot-lifecycle queue (in-process today, target: apps/worker)
  │         ├─ /api/auth/* via Better Auth (also served by apps/auth — D7 dual-stack)
  │         └─ Inbound webhooks: Shopify, WordPress, Xero, Postmark
  ├─ Socket.IO client
  │    └─ WebSocket gateway (apps/ws, port 3002)
  │         └─ Redis PSUBSCRIBE: lot:*:events, sale:*:saleroom, sale:*:display, user:*:notifications
  └─ OIDC sign-in
       └─ Auth issuer (apps/auth, port 3003)
            └─ /.well-known/openid-configuration, /.well-known/jwks.json, /api/auth/*

Async work: apps/worker (port 3004, /health + /metrics only)
  ├─ BullMQ consumers: email, marketing-sync, webhook-events,
  │  validate-upload, image-cleanup, gc-pending-uploads
  └─ domain_events polling runner (FOR UPDATE SKIP LOCKED) → Zoho/Xero projectors (stubs today)
```

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, Tailwind CSS v4 |
| API | Hono on Node.js, Better Auth |
| Realtime | Socket.IO, Redis pub/sub |
| Lifecycle jobs | BullMQ + Redis, plus API reconciliation interval |
| Database | PostgreSQL 16 + Drizzle ORM |
| Validation | Zod in `@auction/validators` |
| Build | pnpm 9, Turborepo, TypeScript, Biome |

## Data Model

The system uses a hybrid **sale + lot** model:

- `sale` is an optional umbrella saleroom/event. It can be `online` or `onsite`, has optional theme `category_id`, optional stream URL, preview start, buyer premium, terms, and structured onsite location fields.
- `lot` is the biddable catalog row. Lots can be standalone (`sale_id` null) or attached to a sale (`sale_id` set). Every lot has a required `category_id`, auction mechanics, timing, pricing, and status.
- `bid`, `watchlist`, `notification`, and `payment` all point at `lot_id`, not an `auction_id`.
- `sale_follow` lets users follow a sale independently of per-lot watchlists.
- `item_submission` is the seller intake lifecycle; approved submissions create draft lots.
- Xero integration uses `xero_connection`, `payment_external_ref`, and `xero_webhook_event`.

```
USER(admin) ──creates──► SALE ──0..N──► LOT ◄──submissions convert to draft lots
USER(user)  ──sells────► LOT
USER(user)  ──places───► BID ─────────► LOT
USER(user)  ──watches──► WATCHLIST ───► LOT
USER(user)  ──follows──► SALE_FOLLOW ─► SALE
LOT         ──has──────► PAYMENT
PAYMENT     ──optional─► PAYMENT_EXTERNAL_REF (Xero invoice)
LOT         ──has──────► NOTIFICATION
```

### Status Enums

| Entity | Statuses |
|--------|----------|
| `sale_status` | `draft`, `scheduled`, `active`, `ended`, `cancelled` |
| `lot_status` | `draft`, `scheduled`, `active`, `ended`, `cancelled` |
| `auction_type` on `lot` | `english`, `dutch`, `sealed`, `buy_it_now` |
| `item_submission_status` | `draft`, `submitted`, `under_review`, `approved`, `rejected`, `withdrawn`, `converted` |

## Core Flows

### Lot and Sale Lifecycle

Admins can create standalone lots with `POST /lots`, create sales with nested lots using `POST /sales`, or add/attach lots to a draft sale.

Publishing is implemented:

- `POST /lots/:id/publish` moves a draft standalone lot to `scheduled`.
- `POST /sales/:id/publish` moves a draft sale and all draft child lots to `scheduled`.
- Publishing schedules BullMQ `activate` and `end` jobs for each lot.

Lifecycle transitions are handled by `LotLifecycleService`:

- `scheduled -> active` when `startTime <= now`.
- `active -> ended` when `endTime <= now`.
- Ending uses the selected lot strategy's `determineWinner()` and enforces `reservePrice` before setting `winnerId`.
- Dutch active lots decrement `currentPrice` over time using `dutchDecrementAmount` or a derived default and `dutchDecrementIntervalMs`.
- A 10 second API reconciliation interval also runs transitions and keeps sale statuses aligned with child lots.

Cancellation and admin overrides are implemented:

- `POST /lots/:id/cancel`
- `POST /lots/bulk` with `op: "publish" | "cancel"`
- `POST /sales/:id/cancel`
- `POST /sales/:id/lots/:lotId/cancel`
- `POST /sales/:id/lots/:lotId/status`
- `POST /sales/:id/mark-ended` for onsite sales

### Sale Delivery Modes

`sale.deliveryMode` changes behavior:

- `online` sales allow bidding and use timed lot lifecycle.
- `onsite` sales can carry location and stream metadata and are treated as read-only/marketing for bidding. Admins can mark onsite sales ended manually.
- Sale mode policy lives in `packages/validators/src/sale-mode-policy.ts`.

### Bid Placement

Clients call `POST /bids` with `{ lotId, amount, maxAutoBidAmount? }`.

The API:

1. Checks the authenticated user is allowed to bid and the lot is accepting bids.
2. Rejects bids on onsite/marketing-only sale lots.
3. Locks the lot row in a transaction.
4. Runs the strategy validation for the lot's `auctionType`.
5. Creates the bid and marks the winning bid.
6. Runs proxy auto-bidding for English and buy-it-now lots when max ceilings are present.
7. Updates `lot.currentPrice`, except active sealed lots keep the public display price at starting price.
8. Extends English/buy-it-now lots by 30 seconds when anti-sniping applies.
9. Ends Dutch lots immediately on acceptance, and ends buy-it-now lots immediately when the buy-now price is met.
10. Publishes realtime and user notification events.

`Idempotency-Key` is supported for `POST /bids` and cached in Redis for 24 hours per user/key.

### Realtime Events

The API publishes to Redis channels `lot:{lotId}:events`, `sale:{saleId}:saleroom`, `sale:{saleId}:display`, and `user:{userId}:notifications`.

The WebSocket app subscribes to `lot:*:events`, `sale:*:saleroom`, `sale:*:display`, and `user:*:notifications` and emits:

| Redis channel / event | Socket event |
|-----------------------|--------------|
| `lot:*:events` → `bid_placed` | `bidUpdate` |
| `lot:*:events` → `lot_extended` | `lotExtended` |
| `lot:*:events` → `lot_ended` | `lotEnded` |
| `lot:*:events` → other | `lotEvent` |
| `sale:*:saleroom` | `saleroomEvent` |
| `sale:*:display` | `displayControl` |
| `user:*:notifications` | `userNotification` |

Active sealed-lot bid payloads are redacted for non-admin sockets.

### Payments and Xero

Checkout uses `POST /payments` with `{ lotId }`; only the winning bidder can create a payment and the lot must be `ended`.

Amount calculation:

- Hammer = `lot.currentPrice`
- Buyer total = hammer * `(1 + lot.buyerPremiumRate)`
- Platform fee stored locally = 5% of the buyer total

When Xero is configured and connected, payment creation creates or reuses an authorised Xero invoice and returns `checkoutUrl`. `clientSecret` remains `null` until a card gateway is added.

Admin and integration settlement paths:

- `POST /payments/:id/capture`
- `POST /payments/:id/refund`
- `POST /admin/payments/:id/xero-sync`
- `POST /webhooks/xero`

## Auction Strategies

| Auction Type | Validation | Price Behavior | Time / End Behavior |
|--------------|------------|----------------|---------------------|
| English | Bidder is not seller; bid must meet current price + `minBidIncrement` | Updates to winning bid amount; proxy auto-bids can advance price | Anti-sniping extends by 30s near end |
| Dutch | Bidder is not seller; bid must equal current price | Lifecycle decrements current price over time | Accepted bid ends lot immediately |
| Sealed | Bidder is not seller; bid must be at least starting price | Active public price remains starting price | Winner determined at end by highest bid, earliest created wins ties |
| Buy-it-now | Bidder is not seller; bid must meet buy-now price or current price + increment | Updates to winning bid amount; proxy auto-bids can advance price | Can end immediately if buy-now is met |

## Current Known Gaps / Follow-ups

| Area | Notes |
|------|-------|
| Card processing | Xero hosted invoices and manual capture/refund are implemented; no Stripe/other gateway/client secret yet. |
| Bid retraction | Bids are final; no buyer/admin bid retraction flow is implemented. |
| Dutch scheduling precision | Dutch decrements run in lifecycle processing; there is no separate per-decrement BullMQ job. |
| Admin override breadth | Admin lot status overrides intentionally avoid moving lots back to active. |
| Domain event projectors | Zoho and Xero projectors are scaffolded as no-op stubs; outbound API calls are **(Phase 2)**. See `docs/architecture/04-domain-events.md`. |
| Lot lifecycle ownership | `lot-lifecycle` BullMQ scheduler runs in `apps/api` today; migrating it into `apps/worker` is **(Phase 2)**. |

## File Reference

| Component | Key Files |
|-----------|-----------|
| API entry | `apps/api/src/index.ts`, `apps/api/src/app.ts` |
| DI container | `apps/api/src/container.ts` |
| Routes | `apps/api/src/routes/*.ts` |
| Lot lifecycle | `apps/api/src/services/lot-lifecycle.service.ts`, `apps/api/src/jobs/lot-job-scheduler.ts` |
| Sale lifecycle | `apps/api/src/services/sale-lifecycle.service.ts`, `apps/api/src/services/sale-status-transition.service.ts` |
| Bidding | `apps/api/src/services/bid.service.ts`, `apps/api/src/strategies/*.ts` |
| Payments/Xero | `apps/api/src/services/payment.service.ts`, `apps/api/src/routes/payments.ts`, `apps/api/src/routes/xero-webhook.ts`, `apps/api/src/routes/xero-admin.ts` |
| DB schema | `packages/db/src/schema/*.ts` |
| Validators | `packages/validators/src/*.ts` |
| Types | `packages/types/src/*.ts` |
| WebSocket gateway | `apps/ws/src/index.ts`, `apps/ws/src/services/redis-bridge.ts` |
| Web client | `apps/web/src/` |
