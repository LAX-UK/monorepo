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

## Pay several (one payment for several invoices)

Organisation payers can settle several invoices with one checkout (`POST /legal-entities/purchases/pay-several`). Each invoice keeps its own `payment` row; a `payment_group` row ties them to the one checkout.

| Topic | Behaviour |
|-------|-----------|
| **Webhook events** | The Bid payments webhook endpoint must also send `checkout.session.expired` (it releases a group whose checkout lapsed). Without it, a lapsed group is released only by `payment_intent.canceled`. |
| **Settlement** | `payment_intent.succeeded` with `metadata.paymentGroupId` marks every invoice paid in one transaction. Any mismatch (amount, currency, an invoice paid or cancelled meanwhile, a released group) applies nothing and raises `payment_group.settlement_refused` plus the `payment_group_settlement_refused_*` metric: reconcile and refund by hand. |
| **Refunds** | Always per invoice and by amount; the Stripe refund carries `metadata.paymentId`. A refund made in the Stripe dashboard on a group charge must set `paymentId`, or it raises `payment_group.refund_unattributed` and changes no ledger. |
| **Disputes** | Any dispute on a combined payment is recorded as a dispute case that needs allocation (`dispute_case.needs_allocation`). No seller payout moves until finance allocates it; each line then moves its seller's net share. |
| **Double payment** | An invoice paid through an older single checkout after its group was paid logs `payment_group_invoice_paid_twice`: refund one of the two. |
| **Xero** | One Xero payment per invoice, as for single payments; the Stripe payout still lands as one deposit. |
| **Rollback** | `0261_rollback.sql` stops while a paid group exists, because grouped invoices share one charge. |

## Scheduled jobs (now wired)

When `CRON_INTERNAL_SECRET` is set, the worker registers:

| Job | Interval | API endpoint |
|-----|----------|--------------|
| `expire-stale-payments` | 5 min | `POST /internal/jobs/expire-stale-payments` |
| `retry-xero-webhook-failures` | 15 min | `POST /internal/jobs/retry-xero-webhook-failures` |
| `retry-xero-stripe-capture-sync` | 15 min | `POST /internal/jobs/retry-xero-stripe-capture-sync` |
| `retry-refund-reconciles` | 15 min | `POST /internal/jobs/retry-refund-reconciles` |
| `refresh-xero-tokens` | 6 h | `POST /internal/jobs/refresh-xero-tokens` |
| `process-notification-outbox` | 1 min, plus on demand (below) | `POST /internal/jobs/process-notification-outbox` |

Time-critical notices (outbid, bid refused at limit, won, lost, seller lot ended, ending soon) do not wait for the minute sweep. Staging one in `notification_outbox` sends `pg_notify('notification_outbox_critical')`, which Postgres delivers when the staging transaction commits. Each worker holds a `LISTEN` connection and, on a signal, queues an immediate drain and a follow-up 1.5 s later (after the outbox's 1 s claim guard) on the same `process-notification-outbox` queue, so delivery takes about 1.5 s. The queue runs one job at a time across all replicas (BullMQ global concurrency 1), so on-demand drains and the sweep never claim side by side and rows still go out in the order they were staged; a drain can deliver any pending row, routine ones included. Signals in the same 250 ms window share one job. A lost signal (listener reconnecting) only falls back to the minute sweep. `NOTIFICATION_OUTBOX_WAKE_ENABLED=false` on the worker turns the on-demand path off.

Manual replay remains available via the same endpoints (see `docs/runbooks/xero-stripe-payment-setup.md`, `docs/runbooks/monitoring-alerts.md`).

## Go-live hardening (checkout — applied)

| Fix | What changed |
|-----|----------------|
| **Webhook status races** | `payment_intent.processing` / `partially_funded` use conditional `applyAuthorizedInTransaction` (pending → authorized only). Cancel paths use `applyCancelledInTransaction`. |
| **Bank transfer PI orphan** | Re-POST `/payments` when status is already `authorized` returns in-flight state without minting a new Stripe session/PI. |
| **Async bank transfer failure** | `checkout.session.async_payment_failed` cancels authorized payments so buyers can retry cleanly. |
| **Dispute clawback timing** | Every dispute is recorded as a dispute case, matched or not. Seller clawback on `charge.dispute.funds_withdrawn`; reversed once on `charge.dispute.funds_reinstated` or `charge.dispute.closed` + `won`. `charge.dispute.updated` keeps the status and respond-by deadline current. |
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

### Courier delivery paid inside the invoice payment

Behind `DELIVERY_IN_PAYMENT_ENABLED` (off).

- **Refunds.** A refund of the courier charge must be made with `metadata.deliveryQuoteId` (the gateway's `createRefund` takes `deliveryQuoteId`). The refund webhook (`PaymentGroupChargeEvents`) attributes it to the quote and emits `payment_group.delivery_refunded` once per increase of the quote's refunded total (kept in `payment_group_delivery.refunded_pence`), so a later event that adds nothing for the courier charge announces nothing; it never moves an invoice's refunded amount or claws back a seller payout. Invoice refunds name `metadata.paymentId`. On a group that carries delivery, each invoice and each quote is capped at what it was charged; any excess is reported as `payment_group.refund_unattributed`, again only when the excess grows (kept in `payment_group.refund_unattributed_pence`). A refund naming neither (made in the Stripe dashboard) is reported as unattributed, never spread. Groups without delivery behave as before.
- **Staff courier refund.** Finance refunds the courier part on its own from the lot's fulfilment panel ("Refund courier charge"), which calls `POST /admin/payment-groups/:groupId/deliveries/:quoteId/refund` (finance write, recent sign-in, `Idempotency-Key`, reason of at least 10 characters, optional amount in pence). The Stripe refund names `metadata.deliveryQuoteId` and never `paymentId`, so the refund webhook raises the quote's refunded total and the seller's ledger is not touched. Only a paid group's courier charge can be refunded, and never more than what is left of it (refunds Stripe is still processing count). The request is kept in the audit log as `payment_group.delivery_refund_requested` with the staff reason; the ledger moves only when the webhook sees the refund succeed.
- **Invoice refund finance task.** On a group that charged courier delivery, a refund of an invoice (however it was made) opens a finance task (`payment.unapplied_money_received`, reason `group_invoice_refunded_with_delivery`; Work inbox and the finance email) so finance decides whether the courier charge should go back too and reconciles Books. One task per increase of the invoice's refunded total (key `<paymentId>:<pence>`), so a replayed event opens nothing.
- **"Paid with invoice" marker.** The lot fulfilment queue shows "Courier paid with invoice" on a lot whose courier quote was charged in a paid group, with the amount and what was refunded, so staff do not take a manual courier payment for it. These three appear only where a combined payment actually charged a courier quote, which happens only while the flag is on.
- **No separate courier payment.** There is no staff or buyer path for paying a delivery quote outside the invoice payment, so nothing needs switching off. The `payment_group_delivery` row marks the quote as taken by a payment, not as paid: it exists while a payment holds the quote and is deleted when the group is released (`releaseMembersInTransaction`), which frees the quote to be charged again. `acceptedFor` excludes any quote that has a row, so a quote is never in two payments at once.
