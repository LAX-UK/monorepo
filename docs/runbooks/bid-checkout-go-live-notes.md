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

Manual replay remains available via the same endpoints (see `docs/runbooks/xero-stripe-payment-setup.md`, `docs/runbooks/monitoring-alerts.md`).
