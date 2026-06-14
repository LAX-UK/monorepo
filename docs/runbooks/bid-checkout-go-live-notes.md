# Bid → checkout go-live — remaining findings

Fixes shipped in this pass are listed in the PR description. The items below are **lower risk** or **by design** — track for post-launch hardening.

## Realtime / frontend

| Finding | Risk | Recommendation |
|---------|------|----------------|
| Socket reconnect refetches price/status only (`use-lot-bid-state.ts`); live bid feed in `OnlineBidsView` does not resync history | Medium | On reconnect, refetch bid history snapshot or merge server feed |
| Reconnect snapshot failure is silent (`fetchLotBidSnapshot` returns null) | Low | Toast or banner when refetch fails while socket is live |
| Socket client uses default Socket.IO reconnection (no explicit backoff/max in `socket.ts`) | Low | Document or configure reconnection policy for prod |

## Bidding side-effects

| Finding | Risk | Recommendation |
|---------|------|----------------|
| Post-commit bid notifications are best-effort (`BidNotificationCoordinator.runBestEffort`) | Medium | Consider outbox for Redis publish + BullMQ reschedule |
| Proxy cancellation notify is fire-and-forget (`void` without error logging) | Low | Await + log in `ProxyAutoBidResolver` |
| Won/lost email at timed close has no outbox (duplicate possible if notify retries after partial failure) | Low | Idempotent notification keys or outbox |
| Reserve enforced at close only, not at bid time | By design | Confirm product expectation with saleroom ops |

## Infrastructure / ops

| Finding | Risk | Recommendation |
|---------|------|----------------|
| **`CRON_INTERNAL_SECRET` must be set in prod** — without it, API runs in-process 10s lifecycle sweep alongside BullMQ | Medium | Enforce in deploy checklist / Terraform |
| `webhook-events` queue is a Phase 2 stub (no producer) | Low | Remove from worker startup or implement |
| Several worker queues lack DLQ / `on("failed")` handlers | Low | Align with `QUEUE_REGISTRY` policy |
| `lot-lifecycle-tick` and payment-ops crons are not in `QUEUE_REGISTRY` | Low | Register for consistent retry/DLQ metadata |

## Checkout / payments (non-blockers)

| Finding | Risk | Recommendation |
|---------|------|----------------|
| Admin `capture-and-process` only moves manual review → pending; buyer must re-POST `/payments` for Stripe URL | Low | Rename route or auto-issue checkout after release |
| `payment_due` notification meta `invoiceUrl` holds Stripe checkout URL, not Xero invoice | Low | Rename field or populate Xero hosted URL from `payment_external_ref` |
| Xero capture recording failure does not fail capture (cron retry exists) | Low | Monitor `xero_payment_record_failed` |
| Basket checkout is per-lot only (`checkout-basket-panel.tsx`) | By design | Finance roadmap for consolidated invoice |

## Scheduled jobs (now wired)

When `CRON_INTERNAL_SECRET` is set, the worker registers:

| Job | Interval | API endpoint |
|-----|----------|--------------|
| `expire-stale-payments` | 5 min | `POST /internal/jobs/expire-stale-payments` |
| `retry-xero-webhook-failures` | 15 min | `POST /internal/jobs/retry-xero-webhook-failures` |
| `retry-xero-stripe-capture-sync` | 15 min | `POST /internal/jobs/retry-xero-stripe-capture-sync` |
| `retry-refund-reconciles` | 15 min | `POST /internal/jobs/retry-refund-reconciles` |
| `refresh-xero-tokens` | 6 h | `POST /internal/jobs/refresh-xero-tokens` |
| `process-notification-outbox` | 1 min | `POST /internal/jobs/process-notification-outbox` |

Manual replay remains available via the same endpoints (see `docs/runbooks/xero-stripe-payment-setup.md`, `docs/runbooks/monitoring-alerts.md`).

## Go-live hardening (checkout — applied)

| Fix | What changed |
|-----|----------------|
| **Webhook status races** | `payment_intent.processing` / `partially_funded` use conditional `applyAuthorizedInTransaction` (pending → authorized only). Cancel paths use `applyCancelledInTransaction`. |
| **Bank transfer PI orphan** | Re-POST `/payments` when status is already `authorized` returns in-flight state without minting a new Stripe session/PI. |
| **Async bank transfer failure** | `checkout.session.async_payment_failed` cancels authorized payments so buyers can retry cleanly. |
| **Dispute clawback timing** | Seller clawback on `charge.dispute.funds_withdrawn`; reversal on `dispute.closed` + `won`. |
| **Stale authorized payments** | Cron expires `authorized` rows after `PAYMENT_AUTHORIZED_EXPIRE_DAYS` (default 30). |
| **Admin capture amount parity** | `markCapturedByAdmin` rejects Stripe PI amount ≠ DB invoice total. |
| **Buyer UX** | Null checkout URL → paid state; payments slice failure surfaced; Stripe redirect retry; manual-review keeps order summary; fulfilment polling retains last snapshot on error. |
| **Partial refund status** | Payment stays `captured` until fully refunded (payout clawback is delta-correct) — intentional. |

## Go-live hardening (applied)

| Fix | What changed |
|-----|----------------|
| **B1 — compliance hold strands funds** | Before promoting a pending payment to `requires_manual_review`, revoke open Stripe Checkout sessions / cancel the PaymentIntent (`revokeOpenCheckoutForPayment`). Webhook capture now accepts `requires_manual_review` so a buyer who pays on a stale session still settles locally (`payment_capture_from_manual_review_reconciliation`). |
| **H1 — bid idempotency scope** | Idempotency keys include `lotId`: `idempotency:bid:{userId}:{lotId}:{key}`. Telephone default key includes `lotId`. |
| **H3 — seller archived on pending retry** | Re-evaluates seller-archived / tier manual-review gate before re-issuing checkout for an existing `pending` payment. |
| **H5 — socket reconnect** | `joinLot` is re-emitted on socket reconnect so live bid events resume without a full page reload. |

## Go-live findings (verified non-bugs / deferred)

| Finding | Outcome |
|---------|---------|
| **H2 — refund double clawback** | **Not a bug.** Admin refund clawback runs only when `applyRefundedInTransaction` succeeds (status still `captured`/`requires_manual_review`). Webhook `charge.refunded` sets `refunded` and clawback in one transaction; admin path no-ops when status is already `refunded`. |
| **H4 — `payment_intent.payment_failed` leaves status pending** | **By design** — keeps checkout retryable; `payment.checkout_failed` domain event is published. |
| **H6 — worker cron 503 treated as success** | **Low risk** — prod env validation requires identical `CRON_INTERNAL_SECRET` on API + worker. Optional follow-up: Sentry alert on worker `cron_not_configured` warn. |

### Deploy checklist

- [ ] `CRON_INTERNAL_SECRET` (≥32 chars) set identically on **API** and **worker**
- [ ] Alert on worker log `"skipped (API reports cron_not_configured)"` and missing `worker:heartbeat:lot-lifecycle-tick`

### Medium/low backlog (not code-fixed this pass)

- Validator 2dp gaps on telephone / absentee / auto-bid schemas
- Lot cross-field validation (`endTime > startTime`, `reserve <= buyNow`)
- Rate limit increments before bid outcome
- `setAutoBid` rewrites all historical bid rows for a bidder on a lot
- Admin `/capture-and-process` is release-only (rename or chain checkout)
- `OnlineBidsView` bid history not resynced on reconnect
- Cron trigger queues outside `QUEUE_REGISTRY`
- Reserve enforced at close only (English auctions — confirm with saleroom ops)
