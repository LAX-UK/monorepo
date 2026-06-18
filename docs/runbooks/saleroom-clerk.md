# Saleroom clerk runbook

Operational guide for in-room paddle bidding and the clerk console.

See also [Sale delivery modes](../SALE_DELIVERY_MODES.md) (online · hybrid · onsite) and the [Hybrid sale go-live checklist](./hybrid-sale-go-live-checklist.md).

| Variable | Service | Notes |
|----------|---------|-------|
| `NEXT_PUBLIC_ENGLISH_ONLY_AUCTIONS` | **Web** | `true` (default) for English-only V1; set `false` only if non-English lot types are enabled |

## Two tracks (hybrid sales)

| Track | Who | What staff do |
|-------|-----|----------------|
| **Online** | Private collectors (and anyone bidding on web) | Sign in, verify identity (KYC), bid on lots — **no** sale registration or desk step |
| **In-room paddle** | Walk-ins who want a physical paddle | Staff **check in** on **Admin → Sale → Registrations** → assign paddle → clerk bids on their behalf |
| **Buyer agents** | Organisations bidding as agents | Self-service **Register to bid** on the sale page → staff approve in **Registration requests** (optional paddle after approve) |

Staff do **not** create accounts or complete KYC at the desk in v1.

## Before the sale

1. Confirm the sale uses **Hybrid** (preferred) or legacy **Onsite** delivery mode.
2. Ensure in-room bidders complete **KYC** before check-in — paddle assignment is blocked until `kycStatus = approved`.
3. For buyer-agent organisations, approve pending **registration requests**.

## Staff check-in (walk-ins)

1. Open **Admin → Sale → Registrations** → **In-room check-in** (`#check-in`).
2. Search by email or name (min 2 characters).
3. Select the client, confirm KYC and email verified (fix in **Admin → Clients** if not).
4. Choose buying entity (defaults to personal profile).
5. Optionally set a **bid limit** (applies to web and paddle bids on this sale).
6. Optionally set paddle # (≥100) or leave blank to auto-assign.
7. Click **Check in and assign paddle**.

Check-in is atomic: the approved registration and paddle assignment commit together. If the paddle
clashes (**409 paddle_taken**), nothing is saved — pick another number and retry. Re-check-in updates
limits/notes and keeps the existing paddle unless you type a new one. Rate limit matches paddle assign.

## Assign a paddle (approved registration)

For buyer-agent approvals or reassign after check-in:

1. Find the approved registration row.
2. Enter a paddle number (≥100) or leave blank to auto-assign.
3. Click **Assign**. Duplicate paddle returns **409 paddle_taken**.

## Place a paddle bid (clerk console)

1. Open **Admin → Saleroom → [sale] → Clerk console**.
2. **Go live** (suspends lot auto-close timers for active lots; timed close is also skipped while the session is live or paused — the sale can run past its scheduled `endTime`).
3. **Advance** the lot on the block (lot runway shows next lots; use **Advance next** for speed).
4. In **Paddle bid**, enter paddle # and amount (separate from telephone amount).
5. Use **Min bid / +1 inc / +2 inc / +5 inc** increment chips or press **Enter** in the amount field to place quickly.
6. If a **channel warning** appears (bidder also active online), confirm with the bidder they are not double-bidding — warn-only, not blocked.

### Keyboard flow

| Step | Key |
|------|-----|
| Focus paddle # | Tab to `Paddle #` field |
| Enter amount | Tab to `Amount` |
| Place bid | **Enter** (submits paddle bid) |

## Operations command center

**Admin → Sale → Operations** shows live session status, current lot, leader channel, and pending telephone work. Updates over Socket.IO without refreshing the page.

## Hybrid day-of checklist

1. Confirm sale delivery mode is **Hybrid**.
2. Check in walk-in bidders and assign paddles (**Registrations → Check in**).
3. Confirm telephone requests for opening lots.
4. Open **Saleroom console** → **Go live** → advance first lot.
5. Monitor **Activity log** (unified socket + DB events) during the session.

## Telephone bids (same console)

Use the telephone line selector when a confirmed/in-progress booking exists for the current lot.

## Hammer / no sale

- **Hammer (sold)** — settles the current lot using normal bid rules; cancels that lot's scheduled jobs.
- **No sale** — ends the lot without a winner.
- **Close session** — ends the saleroom session and finalizes any still-active lots on the sale.

## Error codes

| Code | Meaning | Action |
|------|---------|--------|
| `sale_not_saleroom` | Sale is online-only | Check-in not available |
| `sale_not_registerable` | Sale not scheduled/active | Wait for sale to open |
| `user_suspended` | Account suspended | Escalate to user moderation |
| `kyc_required` | Bidder not verified | Complete KYC before assign/bid |
| `email_not_verified` | Email not verified | Client must verify email |
| `membership_required` | Not member of entity | Fix entity membership |
| `entity_not_authorised` | Entity not approved/restricted | Complete org onboarding |
| `not_eligible_for_check_in` | Wrong role/entity kind | Use personal owner or org buyer agent |
| `paddle_not_found` | No approved registration with that paddle | Re-check paddle # or check in at desk |
| `paddle_taken` | Paddle # already assigned | Pick another number |
| `bid_limit_exceeded` | Over registration/booking cap | Get limit raised or lower bid |
| `paddle_not_registered` | Registration not approved | Approve registration first |
| `rate_limited` | Too many assign/check-in attempts | Wait and retry |

## Bid feed lag

1. Check Redis/WebSocket bridge health.
2. Refresh the clerk console; bids still land in DB if API succeeded.
3. Review the unified **Activity log** panel (socket events merged with recent DB events).
4. Watch the **Connection** chip — `Reconnecting` or `Stale` means hydration may be needed.

## Rollback

Check-in is additive API + UI. Revert deploy restores buyer-agent request flow only; approved check-in rows remain in DB.

Migration `0118` is additive (nullable columns). Existing bids retain attribution on `bidderId`.
