# Money-path monitoring and alerts

This runbook ties **Prometheus metrics** (admin `/metrics` on `apps/api`) to **operational response**. Sentry org-level alert rules for bespoke filters are configured in the Sentry UI when Terraform issue alerts are insufficient — use this doc as the checklist.

**Primary inboxes:** `support@lax.bid` and `OPS_ONCALL_EMAIL` (production env).

---

## Prometheus counters (`auction_api_money_path_events_total`)

Emitted from `apps/api/src/middleware/metrics.ts` via `recordMoneyPathEvent`. Labels are the `event` string.

| `event` value | Meaning |
|---------------|---------|
| `veriff_webhook_decision_4xx` / `_5xx` | Veriff KYC decision webhook errors |
| `veriff_webhook_event_4xx` / `_5xx` | Veriff KYC event webhook errors |
| `stripe_webhook_connect_4xx` / `_5xx` | Connect webhook errors |
| `stripe_webhook_payments_4xx` / `_5xx` | Payments (dispute/refund) webhook errors |
| `stripe_connect_transfer_failed` | Stripe `transfer.failed` received |
| `stripe_connect_account_create_failed` | `POST /stripe-connect/account` rejected by Stripe |
| `stripe_connect_account_orphan_created` | Stripe account created but DB persist failed (retry ensure or reconcile) |
| `stripe_connect_account_deauthorized` | Seller revoked Connect access (`account.application.deauthorized`) |
| `payout_transfer_status_cas_miss` | Stripe transfer created but payout row status CAS failed — finance reconcile |
| `stripe_connect_webhook_unhandled_event` | Connect webhook received unsupported event type |
| `payout_reconciled_failed` | Payout moved to `failed` during Stripe reconciliation |
| `payout_clawback_required` | Negative-net payout path emitted `payout.clawback_required` |
| `payment_intent_amount_mismatch` | Stripe PI amount ≠ local payment row; webhook not claimed (Stripe retries) |
| `stripe_succeeded_for_terminal_payment` | Stripe took money for a payment already `cancelled` or `refunded`; finance gets a work-inbox item |
| `stripe_checkout_revoke_failed` | Closing an open Stripe checkout failed (also reported to Sentry as `stripe_checkout_revoke_failed`) |
| `blocked_capture_reinstate_failed` | Finance reinstated a blocked capture and recording the payment failed; it was put back as cancelled |
| `refund_db_persist_failed` | Stripe refund succeeded but local DB txn failed; row enqueued in `payment_refund_reconcile` |
| `xero_payment_record_failed` | Stripe capture OK but Xero bank payment sync failed |
| `xero_refund_credit_note_failed` | Admin refund OK locally but Xero credit note failed |

### Example PromQL (Grafana / Mimir)

```promql
sum(rate(auction_api_money_path_events_total{event=~"stripe_webhook_.*_5xx"}[5m])) > 0.1
```

```promql
sum(increase(auction_api_money_path_events_total{event="payout_reconciled_failed"}[1h])) > 0
```

```promql
sum(increase(auction_api_money_path_events_total{event="payout_clawback_required"}[24h])) > 0
```

```promql
sum(increase(auction_api_money_path_events_total{event="refund_db_persist_failed"}[1h])) > 0
```

```promql
sum(increase(auction_api_money_path_events_total{event="xero_payment_record_failed"}[1h])) > 0
```

```promql
sum(increase(auction_api_money_path_events_total{event="stripe_succeeded_for_terminal_payment"}[15m])) > 0
```

```promql
sum(increase(auction_api_money_path_events_total{event="stripe_checkout_revoke_failed"}[1h])) > 0
```

```promql
sum(increase(auction_api_money_path_events_total{event="invoice_pdf_total_mismatch"}[1h])) > 0
```

`invoice_pdf_total_mismatch`: a stored Bid invoice's lines do not add up to its total, so its PDF was refused (the member sees "we can't show this invoice just now"). Open the invoice in admin, find which line or total is wrong and correct it through finance; the PDF works again once the record is consistent.

```promql
sum(increase(auction_api_money_path_events_total{event="invoice_pdf_refund_exceeds_total"}[1h])) > 0
```

`invoice_pdf_refund_exceeds_total`: the refunds recorded for a payment (Bid's `payment_refund` table, written in the same transaction as each `payment.refunded` event) add up to more than its invoice total. The sum is the raw one; nothing trims it before the alert. The PDF shows the total as refunded, never more, so the member sees a plausible figure. The API log line with the same `event` carries `paymentId`, `lotId`, `invoiceId`, `totalPence` and `refundedPence`; read the payment's rows in `payment_refund` (`source` says which path wrote each one), compare them with the refunds on the charge in Stripe, and correct the extra refund or the invoice through finance. For a "Pay several" charge the refunds are the ones naming this invoice.

```promql
sum(increase(auction_api_money_path_events_total{event=~"invoice_pdf_refund_currency|invoice_pdf_refund_missing"}[1h])) > 0
```

`invoice_pdf_refund_currency`: a refund is recorded for the payment in a currency other than GBP. The PDF is refused (the member sees "we can't show this invoice just now") rather than add pence of another currency to pounds. The log line carries the `currencies`; check the refund in Stripe and the payment's rows in `payment_refund`.

`invoice_pdf_refund_missing`: the payment is marked refunded but `payment_refund` holds nothing for it. It was refunded before refunds were recorded and the payout ledger had no refund line to copy (no seller to claw back from), or a refund the previous release processed has not been copied yet (see the backfill below). The PDF shows it as refunded with no amount.

There is no admin tool for this yet (a follow-up: an audited finance action that writes the row). Until then a database admin adds the row by hand, with a second person confirming the figures:

1. Re-run the backfill first; for each payment it adds one `payout_topup` row for the amount by which its refund payout lines exceed its `payment_refund` rows, and nothing else (nothing where the buyer side is already the higher). It is safe to repeat and to run beside live refunds: `SELECT payment_refund_backfill_from_payout_lines();`. Read the payment's rows again; if there is one now, stop.
2. In the Stripe dashboard (read only) open the payment's charge (`payment.stripe_charge_id`) and note each refund: its id (`re_...`), amount and currency. For a "Pay several" charge only the refunds whose metadata names this payment count. A payment staff marked paid has no charge and so no card refund to find: the amount is what finance repaid, from the bank record.
3. Add one row per refund as the database owner, in one transaction, taking the payment's lock first so a refund arriving at the same moment is measured against it:

```sql
BEGIN;
SELECT id FROM payment WHERE id = '<payment id>' FOR UPDATE;
INSERT INTO payment_refund (payment_id, idempotency_key, stripe_refund_id, amount_pence, currency, source)
VALUES ('<payment id>', 'manual:<payment id>:<re_... or a finance reference>', '<re_... or NULL>', <pence>, 'GBP', 'staff')
ON CONFLICT (idempotency_key) DO NOTHING;
COMMIT;
```

   The key makes the statement safe to repeat. Use `staff` as the source. Do not edit `payout_line` or `payment`: this row repairs the invoice record only, it never moves seller money.
4. Check the invoice PDF now shows the amount, and note the payment id, the row and who confirmed it on the incident.

Wire each to PagerDuty / email per your observability stack.

---

## Alert matrix (what / when / do what)

| Alert | Trigger | Meaning | Immediate action |
|-------|---------|---------|------------------|
| **Failed payout** | `payout_reconciled_failed` or DB `payout.status='failed'` | Stripe transfer did not complete | Open payout in admin; read `failureReason`; check Connect account; see [dispute-clawback](./dispute-clawback.md). |
| **Stripe webhook errors** | Any `stripe_webhook_*_5xx` sustained 5m | Signature OK but handler threw | Check API logs + Sentry for stack; replay event from Stripe dashboard if safe. |
| **Settlement queue backup** | Redis `LLEN bull:payout-settlement:wait` + `active` > 10 for 30m | Worker not draining settlement | Inspect worker logs; check `CRON_INTERNAL_SECRET` match; see [redis-queue-replay](./redis-queue-replay.md). |
| **Transfer failures** | `stripe_connect_transfer_failed` | Stripe reported transfer failure | Correlate `transfer.id` with payout; reconcile job. |
| **Dispute clawback** | `payout_clawback_required` | Manual money movement needed | Finance war room; [dispute-clawback](./dispute-clawback.md). |
| **Refund DB persist failed** | `refund_db_persist_failed` | Stripe refunded but ledger not updated | Check `payment_refund_reconcile` table; run `POST /internal/jobs/retry-refund-reconciles`. |
| **Xero capture sync failed** | `xero_payment_record_failed` | Invoice exists but Xero payment not recorded | Run `POST /internal/jobs/retry-xero-stripe-capture-sync`; check `payment_external_ref.last_error`. |
| **Money taken on a closed payment** | `stripe_succeeded_for_terminal_payment` (any, 15m) | The buyer was charged for a payment we had cancelled or refunded; the capture was blocked and nothing reached the purchase | Open the item in the admin work inbox (Finance, "Payment taken on a closed payment"). Choose **Reinstate payment** so the purchase goes ahead, or **Refund** to return the money. If the payment was already `refunded`, check the charge in Stripe by hand. |
| **Checkout revoke failed** | `stripe_checkout_revoke_failed` | A cancelled payment's Stripe intent could not be closed, so the buyer may still be able to pay it | Check the intent in Stripe; cancel it, or let finance handle a later blocked capture as above. |
| **PI amount mismatch** | `payment_intent_amount_mismatch` | Metadata/amount drift on capture | Compare Stripe PI vs `payment.amount`; fix data; Stripe will retry unclaimed events. |

---

## JWKS signing key age

The JWT signing key is rotated quarterly ([jwks-rotation.md](./jwks-rotation.md)). Auth exposes no metric for key age yet, so this rule runs as a scheduled read-only query against the auth database (daily, as a role that can read `jwks_key`) and notifies the on-call inbox.

```sql
SELECT kid, status, now() - created_at AS age, now() - rotated_at AS since_rotation
FROM jwks_key
WHERE status IN ('active', 'rotating');
```

| Alert | Trigger | Meaning | Immediate action |
|-------|---------|---------|------------------|
| **Signing key due** | `active` key older than 100 days | Quarterly rotation is due within about 10 days | Schedule the rotation; follow [jwks-rotation.md](./jwks-rotation.md) on test first. |
| **Signing key overdue** | `active` key older than 120 days | Rotation was missed | Rotate now, outside the quarterly slot. |
| **Rotation not finished** | `rotating` key with `rotated_at` older than 45 minutes (30-minute window plus one 15-minute tick) | The retirement schedule is not running | Check `jwks_retirement_tick` and `jwks_retirement_tick_failed` in `apps/auth` logs and the advisory lock; see the runbook's step 6. |
| **No active key** | No `active` row, or more than one | Rotation was interrupted | Treat as an incident: restore from the latest snapshot (`pnpm jwks:restore <env>`) or rerun the rotation. |

---

## Sentry (Terraform-managed)

Issue and metric alerts are defined in:

- `infra/terraform/modules/sentry-issue-alerts/` — new high-severity issues, regressions
- `infra/terraform/modules/sentry-metric-alerts/` — error rate, p95 latency, Stripe webhook 5xx, `payout_reconciled_failed`

Money-path filters previously tuned manually in the Sentry UI are now codified on the **api** project. After changing webhook handlers, re-test with Stripe CLI (`stripe trigger charge.dispute.created`).

### Sentry vs. App Platform logs

Sentry receives errors, `console.error`/`warn`, transactions, and cron check-ins. Raw structured log lines (`pino` stdout) remain in **DigitalOcean App Platform** component logs (~30 day retention) and are not searchable from Sentry.

**Web route error boundaries** (`apps/web` `error.tsx`, `global-error.tsx`, and shared `AppRouteError` / `AdminRouteError` / `DashboardRouteError`) call `useReportRouteError`, which reports to Sentry via `captureException`. Expect grouped issues when users hit recoverable UI failures (marketing, dashboard, admin, auth `(task)` segments).

---

## Stripe dashboard checks

- **Developers → Webhooks:** delivery success rate &gt; 99%.
- **Connect → Transfers:** failed transfers list empty after settlement window.

## Production: Postgres connection slot exhaustion

**Sentry issues:** `LAX-PROD-API-*`, `LAX-PROD-AUTH-*` (e.g. `remaining connection slots are reserved for SUPERUSER` during JWT / `getJwks`).

**Symptom:** Auth or API requests fail with Postgres error `53300` / “remaining connection slots are reserved for roles with the SUPERUSER attribute”. The cluster `max_connections` is exhausted — often after a deploy that raised per-process pool sizes or scaled API replicas.

**Connection budget (prod, `db-s-2vcpu-4gb`, ~97 `max_connections`):**

| Component | Pools | Per pool (`DATABASE_POOL_MAX`) | Max connections |
|-----------|-------|--------------------------------|-----------------|
| API ×2    | `db` + `authDb` | 8 | 32 |
| Auth ×2   | `authDb` | 8 | 16 |
| Worker ×1 | `db` | 8 | 8 |
| **Total** | | | **56** (headroom for admin/migrate) |

Lot/sale lifecycle runs once via **worker → `POST /internal/jobs/lot-lifecycle-tick`** (not per-API `setInterval`) when `CRON_INTERNAL_SECRET` is set.

**Mitigations:**

1. Confirm `DATABASE_POOL_MAX=8` on api, auth, and worker in Terraform (`infra/terraform/ephemeral/prod/main.tf`).
2. Restart api/auth/worker after changing pool env vars so idle connections drop.
3. If exhaustion persists at higher replica counts, lower `DATABASE_POOL_MAX` further or add **PgBouncer** (transaction pooling) in front of Postgres — required before scaling past ~2 API instances on the current cluster size.
4. Resolve Sentry issues after the fix is live and connection count is stable.

## Test environment: Postgres connection slot exhaustion

**Sentry issues:** `LAX-TEST-API-*` (e.g. `remaining connection slots are reserved for SUPERUSER`).

**Symptom:** API or auth requests fail in the **test** environment with Postgres error `53300` / “remaining connection slots are reserved for roles with the SUPERUSER attribute”. This is **not** a production bug — the test DB `max_connections` is exhausted.

**Mitigations:**

1. Lower per-app pool size in test env config (`DATABASE_POOL_MAX=4` on API, auth, worker in `infra/terraform/ephemeral/test/main.tf`) so total connections stay below `max_connections` minus the superuser reserve.
2. Ensure idle connections are released (restart test app pods/containers after heavy test runs).
3. If needed, bump `max_connections` on the DigitalOcean test Postgres cluster.
4. After infra is fixed, **resolve or ignore** these issues in Sentry — they should not recur.

## Post-deploy Sentry cleanup (2026-05 Sentry follow-up)

After the web vitals metrics + auth resend error-handling deploy is live, bulk-resolve stale issues in [Sentry unresolved](https://lax-bid.sentry.io/issues/?query=is%3Aunresolved):

| Issue | Action |
|-------|--------|
| `LAX-PROD-WEB-1` … `LAX-PROD-WEB-6` | Resolve — legacy `web-vitals.*` captureMessage noise (replaced by metrics) |
| `LAX-PROD-WEB-C` | Resolve after verify-pending try/catch deploy — `Failed to fetch (auth.lax.bid)` on resend |

Filter tip: `message:web-vitals.` selects all six web-vitals issues at once.

## Identity sign-in (`auction_auth_*`, scraped from the issuer)

```promql
sum(increase(auction_auth_social_policy_read_failures_total[10m])) > 0
```

`auction_auth_social_policy_read_failures_total`: the issuer could not read the staff, two-step or email facts a Google or Apple sign-in depends on (the identity database is unavailable or slow). The sign-in is stopped on purpose, so while this rises **Google and Apple sign-in fails for everyone**; password and email-link sign-in are unaffected. People see "Sign-in with Google or Apple isn't available just now" on the hosted sign-in page. Check the identity database first (`social_policy_read_failed` in the issuer log carries the reason), then the issuer's database pool.

## Re-offer sweep: re-awarded lot has no invoice (`reoffer_invoice_not_raised`)

The worker's re-offer sweep (every 15 minutes) raises the invoice of an accepted re-offer whose award went through but whose invoice did not. It never lists a buyer account that already has a payment on the lot, cancelled ones included (a buyer who relinquished the win, a stale checkout), unless the cancelled payment's invoice was voided by a default. When `ensureForLot` still does not raise the invoice, the sweep logs `reoffer_invoice_not_raised` and sends a Sentry warning (tag `reason`, tag `retry`), and only then marks the offer in `lot_reoffer.close_reason`:

- `retry: false`, marker `invoice_not_raised:<reason>`: an invoice already exists or the award has gone (`payment_already_exists`, `already_refunded`, `lot_moved`, `no_winner`, `lot_not_found`, `lot_not_ended`, `missing_buyer_legal_entity`). The offer is never listed again. Nothing to do unless the reason is unexpected.
- `retry: true`, marker `invoice_not_raised:retry:<reason>`: the invoice is owed but blocked (`missing_seller_legal_entity`, `payment_amount_exceeds_limit`, `invalid_payment_amount`, or a reason the sweep does not know). The sweep tries again 24 hours after the mark and warns once per try. Fix the cause (seller account, payment limit, lot amount); the invoice is raised on the next try.

To try again straight away after a fix, or to re-arm an offer marked for good by mistake:

```sql
UPDATE lot_reoffer
   SET close_reason = NULL, updated_at = now()
 WHERE id = '<reoffer id from the Sentry event>'
   AND status = 'accepted'
   AND close_reason LIKE 'invoice_not_raised:%';
```

## Failed jobs growing (`failed_jobs_growing`)

Failures can pile up on Bid admin › Failed jobs for weeks without anyone looking, many of them the same failure over and over. The worker's `failed-jobs-watch` job reads the Failed jobs stores every day at 08:00 London and raises **one** alert (Sentry warning `failed_jobs_growing`, logged at `warn`) when, in Needs review:

- **a new group appears**: a job type and error code first seen in the last 24 hours, or
- **a group grows**: one group gained 10 or more failures in the last 24 hours, or
- **the whole list grows**: Needs review gained 25 or more in the last 24 hours, whatever the groups.

A group is one job type (the Failed jobs **Job type** filter value, such as `send-email` or `delivery:zoho`, with the job name or event type) and one error code. The error code is the code the error starts with when it has one (`ZOHO_INVALID_DATA`), otherwise `err-` and a fingerprint of the error line Failed jobs shows. The alert carries no error text and no payload, only names, codes, counts and times.

**What the alert says.** `groups` lists up to 10 groups, most new failures first, each with `jobType`, `job` (label), `errorCode`, `count`, `newInWindow`, `firstSeen`, `lastSeen`, `reasons` (`new`, `grew`) and `page`, the Failed jobs link filtered to that job type; `moreGroups` counts the rest. `total` and `totalNewInWindow` are for all of Needs review; `totalGrew` says the whole-list threshold was crossed, and when only that fired, `groups` shows the groups that grew most.

**What to do.**

1. Open the `page` of the first group (Bid admin › Failed jobs, Needs review, filtered to the job type) and open one failure to read the full error.
2. Fix the cause first: a configuration or credential (Zoho, Xero, Postmark), a field the other side refuses, a bug in the handler. A failure that will fail again is not worth retrying.
3. Then retry the group (or select the rows and retry), or discard it with a reason when it should never run again, such as a test record. Either takes the rows out of Needs review.
4. If the cause needs a code change, open a ticket with the job type and error code from the alert and leave the rows in Needs review until it ships.

Zoho Books documents also show on Failed jobs but are not counted here: the accounting watch alerts on them (`accounting_needs_person_overdue`).

**When it alerts again.** A group, and the whole-list alert, stays quiet once it has alerted until its count is higher than when it alerted, or 7 days have passed. What was alerted is kept in Redis (`ops:failed-jobs-watch:alerted`); losing it costs at most one repeat alert.

**Thresholds.** Worker env, with these defaults: `FAILED_JOBS_ALERT_GROUP_GROWTH=10`, `FAILED_JOBS_ALERT_TOTAL_GROWTH=25`, `FAILED_JOBS_ALERT_WINDOW_HOURS=24`, `FAILED_JOBS_ALERT_REPEAT_DAYS=7`.

**Set-up.** Add a Sentry issue alert on the worker project for the message `failed_jobs_growing` routed to on-call. Add `failed-jobs-watch` to `SENTRY_MONITOR_SLUGS` and create the cron monitor (daily, 08:00 Europe/London, about 30 minutes margin); a missed check-in means the watch stopped. Without the entry the job runs unmonitored. The job has no heartbeat, like the alert digest: a daily job would fail a freshness check 23 hours a day.

## Bid invoice late for Books (`accounting_bid_invoice_delayed`)

**What it means.** A buyer's Bid invoice was queued for Zoho Books more than 30 minutes ago and is
still not issued with LAX's copy of its PDF stored. With Books live, the buyer's invoice card on
their purchase now reads "This is taking longer than usual. Our team has been told. Your payment is
not affected." (In dry run or the test organisation buyers keep LAX's own invoice and are told
nothing; the alert is then for staff only.) The accounting watch (cron `accounting-watch`, every 15 minutes) raises it at most once a run, with
`count`, `oldestSince`, the Books `modes` and the `page` (Finance › Accounting).

**What to do.** Open Finance › Accounting. A document in **Needs a person** says why (a totals
difference reads "Books worked out £…. The totals must match before it can be issued."); one in
**Waiting** for long means the sender or Books is stuck (see `accounting_sender_missed`). An invoice
issued in Books whose PDF could not be fetched shows as issued: the worker fetches it again every
tick (`accounting_copy_unavailable` in the logs names the document and the reason). Paying is never
blocked by any of this.

**Set-up.** Add a Sentry issue alert on the worker project for the message
`accounting_bid_invoice_delayed`, routed to finance on-call.

### The "Your invoice" email (Bid, Books live only)

Once LAX holds the stored copy of an invoice Books issued **live**, the worker emails it once to the
payer (an organisation's current member with the owner, admin or finance role; a former member gets
nothing) and to the account's billing inbox. Dry run and the test organisation email no one.

Each stored copy's email is settled exactly once in `accounting_document_copy`: queued
(`email_queued_at`, `email_outbox_id`) or skipped for good (`email_skipped_at`, `email_skip_reason`:
`invoice_cancelled`, `invoice_missing`, `no_recipient`, `unreadable_document`). A skip logs the
warning `accounting_invoice_email_skipped` with the document id and the reason; nothing is retried,
so a skipped invoice never holds up the ones behind it. An outbox error is not a skip: the copy stays
due and is tried next tick (`accounting_invoice_email_failed`). A trigger makes the four columns
write-once (NULL to a value, never changed or cleared), for every role.

The `no_rehearsal_email_ck` CHECK refuses to *record* a rehearsal as emailed. It does not stop a
send: the worker enqueues the email before it notes it, so the guards that keep a rehearsal (or a test
organisation's invoice) out of the outbox are the worker's due-list query (`target_mode = 'live'`,
`rehearsal = false`) and the service, which only sends while Bid is aimed at Books live.

## Related

- [Scale monitoring](./scale-monitoring.md)
- [On-call](./on-call.md)
- [Buyer payment flow](./buyer-payment-flow.md)

## Catalog Connect enforcement (Stripe)

When `STRIPE_SECRET_KEY` is **not** set in the API/web environment, Connect readiness checks are disabled and lots can be scheduled without seller payout setup. This is intentional for local/dev stacks without Stripe.

When Stripe **is** configured:

- Lots **with** a `sellerLegalEntityId` must have an approved legal entity with Connect payouts enabled and no outstanding requirements before publish/schedule (API + admin UI readiness).
- Lots **without** a `sellerLegalEntityId` skip Connect checks (platform-catalog / legacy inventory paths). New lot create requires a seller; attach and legacy rows may omit one by design.

If production shows unexpected publish without Connect, verify `STRIPE_SECRET_KEY` is present on API containers and the lot has a seller assigned.
