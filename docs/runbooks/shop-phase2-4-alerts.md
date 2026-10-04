# Shop Phase 2–4 ops alerts

Monitor these signals after Phase 2–4 flags are enabled on test or production. Wire dashboards and paging to the listed Sentry messages, metrics, or log patterns.

## Refund submission failures

**Source:** `apps/shop-api` scheduler task `submit-pending-refunds` (`createSubmitPendingRefundsRunner`).

| Signal | Meaning | Action |
| --- | --- | --- |
| Sentry `shop_refund_submit_terminal_failure` | Refund outbox row exceeded `MAX_SUBMIT_ATTEMPTS` (8) or Stripe returned a non-retryable error | Inspect `shop_refund` row (`submit_attempts`, `last_submit_error`); reconcile with Stripe Dashboard; finance may complete manually |
| Elevated `submit_attempts` without terminal event | Backoff in progress (`refundSubmitBackoffMs`) | Usually self-heals; investigate if sustained >24h |

**Suggested alert:** count of `shop_refund_submit_terminal_failure` ≥ 1 in 15 minutes (page finance + on-call).

## Stripe money webhook 5xx

**Source:** `POST /webhooks/stripe` money path (`createDrizzleStripeMoneyWebhookProcessor`).

| Signal | Meaning | Action |
| --- | --- | --- |
| HTTP 5xx rate on `/webhooks/stripe` | Handler threw (DB, domain event guard, persist failure) | Check Stripe webhook delivery log; replay after fix; verify idempotency via `shop_processed_payment_event` |
| Spike in `ShopPaymentWebhookError` with `retryable: true` | Transient DB or race | Stripe retries; confirm duplicate events return 2xx without double effects |

**Suggested alert:** 5xx ratio > 1% over 5 minutes on shop-api webhook route, or any sustained 5xx burst > 10 events.

## Stuck payouts

**Source:** payout eligibility scheduler (`run-payout-eligibility.handler`) and `shop_payout_ledger` status transitions.

| Signal | Meaning | Action |
| --- | --- | --- |
| Rows in `pending_refund_period` or `due` older than policy window + SLA | Eligibility job not running, compliance block, or refund/dispute hold | Verify `SHOP_PAYOUTS_ENABLED`, scheduler health, payee compliance fields |
| `blocked_reason` in (`refund_review`, `clawback`, `dispute`) without matching terminal refund/dispute | Stale block after webhook processing | Reconcile order/refund/dispute state; manual finance review |

**Suggested alert:** SQL or metric on payout ledger rows in `due` with `updated_at` older than 7 days (tune to cancellation policy).

## Dead identity merge inbox

**Source:** `process-identity-merge-inbox` scheduler (`process-identity-merge-inbox.runner`).

| Signal | Meaning | Action |
| --- | --- | --- |
| `shop_identity_merge_inbox` rows with `processed_at` null and `created_at` > 1h | Domain event consumer lag or handler failure | Inspect linked `domain_events` row; replay merge after fixing identity/subject mapping |
| Repeated failures for same `event_id` | Poison message | Quarantine event; manual merge via ops procedure |

**Suggested alert:** count of unprocessed inbox rows older than 1 hour ≥ 1 (warn at 1, page at 10).

## Stale in-flight admin commands

**Source:** `shop_admin_command` table and `admin-command-prune` scheduler.

| Signal | Meaning | Action |
| --- | --- | --- |
| Rows with `status = 'in_flight'` and `started_at` older than 15 minutes | Worker crash mid-command or hung transaction | Prune job should mark failed; verify handler idempotency before retry |
| High rate of `idempotency_conflict` (409) on admin API | Clients reusing keys with different payloads | Client bug; audit `request_hash` mismatches |

**Suggested alert:** any `in_flight` command older than 30 minutes (page ops); weekly report of prune job deletions.

## Related configuration

- `SHOP_OPS_ALERT_EMAIL` on shop-api for enquiry and ops email paths (Phase 1+).
- Stripe webhook signing secret rotation: update env and verify delivery success rate after deploy.

See also [shop-v1-phase-gates.md](./shop-v1-phase-gates.md) and [shop-stripe-setup.md](./shop-stripe-setup.md).
