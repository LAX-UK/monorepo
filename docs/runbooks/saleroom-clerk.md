# Saleroom clerk runbook

Operational guide for in-room paddle bidding and the clerk console.

| Variable | Service | Notes |
|----------|---------|-------|
| `NEXT_PUBLIC_ENGLISH_ONLY_AUCTIONS` | **Web** | `true` (default) for English-only V1; set `false` only if non-English lot types are enabled |

## Before the sale

1. Confirm the sale uses **Hybrid** (preferred) or legacy **Onsite** delivery mode.
2. Ensure bidders complete **KYC** before check-in — paddle assignment is blocked until `kycStatus = approved`.
3. Open **Admin → Sale → Registrations** (or operations desk) and approve pending registrations.

## Assign a paddle (check-in)

1. Find the approved registration for the bidder.
2. Enter a paddle number (≥100) or leave blank to auto-assign (uses preferred paddle if free, else next free number).
3. Click **Assign**. The paddle is unique per sale; a duplicate returns **409 paddle_taken**.
4. If KYC is not complete, fix verification first — do not bypass at the desk.

## Place a paddle bid (clerk console)

1. Open **Admin → Saleroom → [sale] → Clerk console**.
2. **Go live** (suspends lot auto-close timers for active lots).
3. **Advance** the lot on the block.
4. In **Paddle bid**, enter paddle # and amount, press Enter or **Place paddle bid**.
5. If a **channel warning** appears (bidder also active online), confirm with the bidder they are not double-bidding — warn-only, not blocked.

## Telephone bids (same console)

Use the telephone line selector when a confirmed/in-progress booking exists for the current lot.

## Hammer / no sale

- **Hammer (sold)** — settles the current lot using normal bid rules; cancels that lot's scheduled jobs.
- **No sale** — ends the lot without a winner.
- **Close session** — ends the saleroom session and finalizes any still-active lots on the sale.

## Error codes

| Code | Meaning | Action |
|------|---------|--------|
| `paddle_not_found` | No approved registration with that paddle | Re-check paddle # or assign at desk |
| `paddle_taken` | Paddle # already assigned | Pick another number |
| `kyc_required` | Bidder not verified | Complete KYC before assign/bid |
| `bid_limit_exceeded` | Over registration/booking cap | Get limit raised or lower bid |
| `paddle_not_registered` | Registration not approved | Approve registration first |

## Bid feed lag

1. Check Redis/WebSocket bridge health.
2. Refresh the clerk console; bids still land in DB if API succeeded.
3. Compare **Recent events (DB)** vs **Live feed (socket)** panels.

## Rollback

Migration `0118` is additive (nullable columns). Code can be reverted independently; existing bids retain attribution on `bidderId`.
