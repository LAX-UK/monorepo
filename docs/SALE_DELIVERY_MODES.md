# Sale delivery modes (online · hybrid · onsite)

**Source of truth:** [`getSaleModeCapabilities`](../../packages/validators/src/sale-mode-policy.ts) in `@auction/validators`. When this doc and the code disagree, trust the code map.

This reference contrasts how **online**, **hybrid**, and **onsite** sales behave for staff, bidders, and background jobs.

---

## Online

- **Web bidding:** Yes — self-service on lot pages for the full catalog window.
- **Operator bidding (paddle / telephone / absentee):** No clerk console path; absentee may still be scheduled pre-sale on lot pages.
- **Lot timing:** Each lot carries its own `startTime` / `endTime` (must fall within the sale window).
- **Saleroom session:** Not available — no go-live, advance, or hammer.
- **On-block gating:** N/A — online bidders bid whenever the lot is `active` and within its window.
- **Anti-snipe:** Yes — timed extensions apply when bids arrive near `endTime`.
- **Lot close:** Timed — cron / Bull jobs finalize when `endTime` passes.
- **Check-in / paddle:** Not used.
- **Telephone bookings:** Not used for saleroom flow.
- **Venue display (`/display/[saleId]`):** Not used.
- **Stream URL / location fields:** Stream URL disabled; location disabled.

---

## Hybrid

- **Web bidding:** Yes — self-service on lot pages, gated by default behind clerk **Go live** + **on-block** lot (`allowOnlineBidsBeforeGoLive=false`).
- **Operator bidding:** Yes — clerk places paddle (`saleroom`) and telephone bids from the saleroom console.
- **Lot timing:** Inherits the sale's `startTime` / `endTime` (`inheritsLotTiming: true`). All lots share one window.
- **Saleroom session:** Yes — `/admin/saleroom/[saleId]`. Staff go live, advance lots, hammer / no-sale, pause, close.
- **On-block gating:** Default — online bids require session `live`, `currentLotId === lotId`, lot `active`. Set `allowOnlineBidsBeforeGoLive=true` on the sale to allow web bids before go-live (legacy open mode).
- **Anti-snipe:** Disabled while saleroom session is `live` or `paused` — clerk hammer drives close.
- **Lot close:** Clerk hammer / no-sale per lot. Timed auto-close is **skipped** while the saleroom session is live or paused (even if `endTime` has passed). Closing the session finalizes remaining active lots.
- **Advance behavior:** `advanceToLot` sets the on-block lot and auto-activates `scheduled` lots when needed.
- **Check-in / paddle:** Yes — walk-ins checked in at **Admin → Sale → Registrations**.
- **Telephone bookings:** Yes — request on lot page; clerk starts lines from console.
- **Venue display:** Yes — pair TVs at `/display/[saleId]`.
- **Stream URL / location:** Both enabled.

---

## Onsite (legacy in-room only)

- **Web bidding:** No — `saleModeAllowsBidding("onsite")` is false for self-service web bids.
- **Operator bidding:** Yes — paddle, telephone, absentee via clerk / pre-sale flows.
- **Lot timing:** Inherits sale window (same as hybrid).
- **Saleroom session:** Yes — same clerk console as hybrid.
- **On-block gating:** Operator paths only; no online channel to gate.
- **Anti-snipe / lot close:** Same saleroom-driven rules as hybrid (timed close skipped during live/paused session).
- **Check-in / paddle / telephone / display:** Same as hybrid.
- **Stream URL / location:** Both enabled.

---

## Realtime channels (all saleroom modes)

| Redis channel | Socket.IO room | Event | Consumers |
|---------------|----------------|-------|-----------|
| `lot:{lotId}:events` | `lot:{lotId}` | `bidUpdate`, `lotExtended`, `lotEnded` | Bidders, clerk on-block panel, venue display |
| `sale:{saleId}:saleroom` | `sale:{saleId}` | `saleroomEvent` | Clerk console, hybrid catalog, venue display |
| `sale:{saleId}:display` | `display:{saleId}` | `displayControl` | Venue TVs, clerk overlay mirror (staff JWT) |
| `user:{userId}:notifications` | `user:{userId}` | `userNotification` | Signed-in users (requires WS JWT) |

Web clients pass a better-auth JWT on the Socket.IO handshake so staff join `display:{saleId}` and users join `user:{userId}`.

---

## Operational checklist (hybrid day-of)

See [Saleroom clerk runbook](./runbooks/saleroom-clerk.md) and [Hybrid sale go-live checklist](./runbooks/hybrid-sale-go-live-checklist.md).
