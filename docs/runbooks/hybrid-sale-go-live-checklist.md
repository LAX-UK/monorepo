# Hybrid sale go-live checklist

Use this checklist the day before and day of a **hybrid** sale. For mode differences see [Sale delivery modes](../SALE_DELIVERY_MODES.md).

## Infrastructure (day before)

- [ ] **Worker** running with `CRON_INTERNAL_SECRET`, `API_INTERNAL_BASE_URL`, `REDIS_URL` set.
- [ ] **lot-lifecycle-tick** heartbeat fresh (`worker:heartbeat:lot-lifecycle-tick` in Redis, updated every ~10s).
- [ ] **WebSocket** (`apps/ws`) reachable at `NEXT_PUBLIC_WS_URL` (`wss://ws.lax.bid` in prod).
- [ ] **CORS** — `CORS_ORIGIN` on WS matches web origin (`https://lax.bid`).
- [ ] **Auth JWT on sockets** — signed-in staff receive live overlay sync (not 15s poll only).
- [ ] **`DISABLE_BIDDING`** is not set on API.

## Sale configuration

- [ ] Delivery mode is **Hybrid**.
- [ ] `allowOnlineBidsBeforeGoLive` is **false** (default on-block gating) unless intentionally using legacy open mode.
- [ ] Sale is **published** and will be **active** at go-live (lots activate via cron at `sale.startTime`).
- [ ] **`sale.endTime`** is set **well after** the expected finish — lots do not auto-close while the saleroom session is live/paused, but a generous window avoids confusion.
- [ ] Stream URL and venue location filled in if used on marketing pages.

## Registrations & paddles

- [ ] Buyer-agent registration requests approved.
- [ ] Walk-in bidders **checked in** with paddles assigned (**Admin → Sale → Registrations**).
- [ ] Telephone bookings confirmed for opening lots.

## Staging dry-run (recommended)

Run on staging/test with a hybrid sale:

1. Publish sale → confirm lots become `active` and sale `active`.
2. Pair venue display at `/display/{saleId}`.
3. Open clerk console → **Go live** → **Advance** first lot.
4. Place **online**, **paddle**, and **telephone** bids.
5. Trigger **fair warning** overlay — confirm venue screen and clerk console update live.
6. **Hammer** (reserve met) and **No sale** (reserve not met) on test lots.
7. **Pause** / **Resume**.
8. Kill socket connection → confirm reconnect refreshes session.
9. **Close session** → remaining active lots finalized.
10. **Past endTime test:** with session still live, confirm cron does **not** auto-close lots (advance + bid still work).

## Day-of (30 min before)

- [ ] Open clerk console — connection chip shows **Connected**.
- [ ] Venue display paired and showing standby/board.
- [ ] Paddle roster loaded (non-empty alert cleared).
- [ ] Staff logged in with `auction.manage` capability.

## During sale

- Use **Advance next** in the bottom action bar between lots.
- Use **Hammer** / **No sale** in the action bar while selling.
- Monitor **Activity log** and live bid panel for online + floor activity.
- On channel warnings (bidder also online), confirm with bidder they are not double-bidding.

## If something breaks

| Symptom | Check |
|---------|--------|
| Go live disabled | Sale must be `active`; worker cron must have activated lots |
| Bids rejected "not on block" | Session live + lot advanced + lot `active` |
| No live updates | WS URL, Redis bridge, connection chip |
| Overlay lag on clerk only | Staff JWT on socket; venue TV uses display token (separate) |
| All lots closed unexpectedly | Was saleroom session ended? Cron only auto-closes when session not live/paused |

See [Saleroom clerk runbook](./saleroom-clerk.md) for error codes and bid-feed lag.
