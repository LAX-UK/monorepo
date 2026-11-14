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

### Bid payments to Books (Finance › Accounting)

- **Card, or a bank transfer once all of it is applied** (`payment.captured`): one customer payment
  into the Stripe clearing account, `LAX-BID-PAY-<payment>`, applied in full to its invoice.
- **Pay several** (`payment_group.settled`, written in the settlement transaction, references only):
  ONE payment, `LAX-BID-PAY-grp-<group>`, applied to each invoice by its own payment row's amount.
  The allocations must equal the group's stored total to the penny, or the event goes to the failed
  deliveries (`allocation_mismatch`).
- **Order.** An invoice or credit note is sent only once its contact is issued in the same books,
  and a payment only once every invoice it pays is. Until then it waits in **Waiting** without using
  an attempt; a refused invoice keeps its payment waiting with it, and trying the invoice again lets
  the payment follow.
- **Parked, in Needs a person** (never sent, no Try again). The recovery is **Release** on the row
  (finance write permission, like Try again). Release checks the reason against what Bid holds now
  and, only if it is settled, queues the same document under the same LAX reference; otherwise it
  says why and nothing changes. The decision and the move are one: if the rows it was decided on
  change before the move commits (say the invoice is voided again in Bid), it is refused as "no
  longer matches" and stays parked; press Release again once it is settled. Each release is in the
  document's history (`release`, who asked) and the staff audit log ("Parked accounting document
  released"). Do not cancel a parked document to recover it: a cancelled document keeps its
  reference and is never sent.
  - **Rolling back** `0382_rollback.sql` (after `0383_rollback.sql`, if 0383 is applied) keeps
    every parked document parked: nothing is cancelled. While rolled back, no one can move a parked
    document (the earlier release knows nothing of parking); apply 0382 again and Release works as
    before. It refuses to run once 0383 has written `apply_remainder` history: then roll back 0383
    only.
  - **Waiting for the accountant** (VAT on delivery): a courier quote paid with the lots makes a
    delivery invoice, `LAX-BID-INV-dlv-<quote>`; it and the Pay several payment that includes it are
    parked until the accountant says how delivery is booked (`DELIVERY_BOOKING` in the accounting
    domain). The lots' invoices go as usual. When the answer is in: an engineer sets
    `DELIVERY_BOOKING` and deploys; then press Release on each delivery invoice (it is rebuilt from
    the stored rows with the booking; what was charged must not change), then on the payment. The
    payment is sent once its invoices are in Books.
  - **The invoice this pays was cancelled after it was paid**: refund the buyer (then cancel the
    parked payment), or reinstate the invoice in Bid and press Release on the payment. A payment
    whose invoice was cancelled in Accounting cannot be released: refund the buyer.
- **Bank transfers part received** are listed above the documents on the page. Nothing goes to
  Books for them until the whole amount has arrived; the payment then arrives through
  `payment.captured` (or the group's `payment_group.settled`). Money that could not be applied stays
  a finance task (unapplied money) and makes no Books document.

## Shop invoices to Books (London Art Exchange)

**What happens.** When a Shop order is paid, the Shop writes `shop.accounting.order_paid` in the
same transaction (references only: the order and its line ids). With the Shop aimed at Books, the
worker books, in London Art Exchange's organisation only:

- the buyer's contact;
- the order's invoice under the Shop's own number (`LAX-INV-…`, Books' automatic numbering off for
  it), its lines exactly as stored on the order: each print or product, each frame at the price it
  was sold for, and UK delivery (or the collection charge), VAT-inclusive with the VAT stored;
- the customer payment of the whole order into the Stripe clearing account, applied to that invoice.

Books' totals are checked against LAX's; a difference holds the invoice in **Needs a person** with
Books' figure, as for Bid. So does an invoice Books holds under another number than LAX's
(`zoho_books_number_differs`, an organisation setting that renumbers): check the organisation's
numbering, never edit the number by hand. Lines that are not the ones the event named, or that do
not add up to the order's total, are refused for a person, never booked.

**Order.** The Shop uses the same claim as Bid: an invoice is sent only once its contact is issued
in the same books, and a payment only once its contact and every invoice it pays are. Until then a
document waits in **Waiting** without using an attempt, whatever order it was stored in and however
many senders run.

**Delivery outside the UK.** A delivery quote's VAT waits for the accountant. It is never put on
the order's invoice and never sent as it stands: it is stored as its own invoice
(`LAX-SHOP-INV-<order>-delivery`, number `LAX-INV-…-D`), parked in **Needs a person** as "Waiting
for the accountant: VAT on outside-UK delivery", with no VAT stated, and it cannot be tried again.
The payment still books every penny the buyer paid, applied to the order's invoice; the quote's
part stays unapplied on the buyer's account in Books until the delivery invoice is issued.

**After the accountant answers** (outside-UK delivery). Do not cancel the parked invoice to
recover it: a cancelled document keeps its reference and is never sent.

1. The accountant states, in writing, how a Shop delivery outside the UK is booked (its VAT
   treatment). LAX does not choose one.
2. An engineer sets `SHOP_OUTSIDE_UK_DELIVERY_BOOKING` in the accounting domain to that answer
   (a treatment that takes VAT needs the VAT stored on the order; without it the release is refused,
   never worked out), and deploys. Until this is deployed, Release says "The accountant has not yet
   confirmed how outside-UK delivery is booked" and nothing changes.
3. In Finance › Accounting, press **Release** on each parked delivery invoice (finance write
   permission). Release rebuilds it from the order's stored delivery with the booking, under the
   same LAX reference and for the same amount, and queues it; it is in the document's history
   (`release`, who asked) and the staff audit log. If the order no longer charges that delivery,
   Release refuses ("no longer matches"): ask engineering.
4. The worker sends it once its contact is in Books. Then, by itself, it applies the order
   payment's unapplied rest to it (Books "apply credits", from `LAX-SHOP-PAY-<order>`), once: the
   step reads the payment first, so a repeat is "already applied", and it is recorded in the
   invoice's history as `apply_remainder`.
5. If the worker logs `accounting_remainder_refused` (the payment no longer holds enough
   unapplied, say it was applied elsewhere by hand), the history says why: apply the remainder by
   hand in Books, from that payment to that invoice, and note it on the order.
6. The step only looks at a delivery invoice once the order's payment is issued in the same
   books. If Books' answer cannot be read (`accounting_remainder_unknown`), nothing is recorded,
   the attempt is noted, and the invoice goes behind the others to be asked again next run. If a
   delivery invoice has been issued for more than six hours with no `apply_remainder`, the watch
   raises `accounting_shop_remainder_delayed` (delayed accounting, routed to finance on-call):
   check the order's payment in Books and the worker's `accounting_remainder_*` logs.

Rolling back migration 0383 (`0383_rollback.sql`) keeps every parked outside-UK delivery parked:
nothing is cancelled. While rolled back, api_app may not move one at all (no requeue, no release),
because the earlier release knows nothing of outside-UK delivery; apply 0383 again (with the release
that knows it) and Release works on them as before.

**The buyer's card and email.** On the Shop order page the buyer sees the same card as on a Bid
purchase (being prepared, late after 30 minutes, issued with "Download invoice (PDF)" from LAX's
stored copy, cancelled), only while the Shop is aimed at Books **live**. A refund does not cancel the
invoice (it is credited later): a refunded order keeps the issued card and its download, with "A
refund was made on [day].", and LAX's own document under "Help with this order" as "Order receipt
(PDF)". On an order delivered outside the UK the card also says "Delivery outside the UK is
invoiced separately." (the delivery invoice is issued on its own once released). In dry run or the
test organisation the page is unchanged and nobody is emailed. With Books live the worker emails
"Your invoice [number] from LAX Shop" once, with the stored copy attached and that invoice's own
total, to the order's owner now (the guest, or the account that claimed the order; an erased guest,
or an account that is disabled, being deleted or merged gets nothing, as nothing in LAX follows a
merge yet), settling every copy as queued or skipped exactly as for Bid. A released delivery
invoice is not emailed (`not_order_invoice`).

Before Shop goes live, set the worker's `SHOP_STOREFRONT_URL` to the Shop's public https address
(there is no default) and give the Shop API read access to the document storage's
`accounting/london_art_exchange/` keys. While the address is unset or local, no Shop invoice email
is sent: the Shop's copies are left out of each run's list, so they never hold Bid invoice emails
back, and each stays due. While any waits, every run raises `accounting_shop_invoice_email_refused`
(an error alert sent to Sentry, routed to finance on-call like the other accounting alerts). Set
the address and the waiting emails go on the next run.

## Books notices and the nightly status check (Zoho Books, rehearsal)

Books is still in rehearsal (dry run, or the test organisation only). Nothing below changes
production, and no Books credentials live in the repository.

### Books notices (`POST /webhooks/zoho-books/notices`, Bid API)

**What happens.** A Zoho Books workflow webhook tells LAX that a document changed. Books signs each
request with the webhook's secret token in `X-Zoho-Webhook-Signature`. The Bid API checks the
signature in constant time against `ZOHO_BOOKS_NOTICE_SECRET` and stores a good notice once, in
`webhook_event` (source `zoho_books`), keyed on Books' ids. It keeps only Books' ids and the change
time. A notice is never trusted for money: the worker reads that document's state from Books again
and records what Books says (below). Every answer has no body and `Cache-Control: no-store`.

- **Not configured.** Without `ZOHO_BOOKS_NOTICE_SECRET` the route refuses every notice (503) and
  stores nothing. Set it, 32 characters or more, to the same value as the secret token on the Books
  workflow webhook. Use the test organisation only while Books is in rehearsal.
- **Body.** The workflow sends JSON with `organization_id`, `module` (`invoice`, `creditnote` or
  `customerpayment`), `entity_id` and, optionally, `event_time`. A notice for another organisation,
  or for a document LAX did not issue, changes nothing.

### Notice signature refused (`zoho_books.notice_signature_failed`)

**What it means.** A request reached the Books notice route with no signature, or one that does
not match the configured secret. It was refused with a bare 401 and nothing was stored. The alert
gives only `reason` (`missing` or `invalid`), never anything from the request.

**What to do.** A few of these after the secret token changes in Books mean the two copies no longer
match: set the same value in Books and in `ZOHO_BOOKS_NOTICE_SECRET`. Rotate it in Books first, then
in the API. Until both match, notices are refused, and the nightly check still reads every document.
Sustained refusals with no change on our side go to security on-call. Error level, sent to Sentry,
routed to finance on-call with the other accounting alerts.

### The nightly status check (cron `accounting-reconcile`, 02:15 London)

**What happens.** The worker reads back from Books each issued Books invoice, credit note and
payment that is due. That is one read per document. Each run reads within a share of the day's
Books budget built for that run alone: at most 300 reads, and none once the day's count would leave
fewer than 400 calls for sending. It stops as soon as its share or the day's budget is spent, and
the rest is read the next night. A document a notice named is read first.

Reads a notice asks for during the day draw on a separate share: at most 50 a day, with the same 400
calls kept free, so notices can never spend the night's share or the sender's calls. A notice for a
document read in the last 10 minutes does not read it again: the mark stays and the night's run
reads it first. In the dry run no share is spent, because nothing is read. For each one the worker records the state Books shows (`accounting_books_status`) and
each change (`accounting_books_status_change`, append-only), such as an invoice voided or a document
deleted in Books. Each run is a row in `accounting_books_status_run`. In the dry run nothing is
read and each run says `rehearsal`.

**A payment recorded in Books by hand.** When Books shows a payment against one of LAX's invoices
that LAX did not send (a gallery sale or a cheque entered in Books), the check opens a **finance
task**: "Money received that could not be applied", reason `books_payment_recorded_by_hand`. The task
names the LAX invoice reference, the amount Books applied to that invoice, and Books' payment mode
and date. It is opened once per Books payment and LAX invoice: one cheque split across two invoices
is two tasks, one for each part. **Nothing in LAX is marked paid**, and the check cannot mark a lot, invoice or payment
paid.

A Books payment is LAX's own, and never a task, when its Books id belongs to any LAX payment
document, whatever state that document is in, or when it carries the reference of a LAX payment
whose Books id LAX never learnt. While any LAX payment applied to the invoice is not settled
(pending, sending, unknown, needs review or failed), the check opens no task for that invoice's
other Books payments and does not remember them: it logs `accounting_status_payments_held_back` and
looks again on the next read. A LAX payment stuck in needs review or failed therefore holds these
back until finance resolves it on the accounting attention list.

**What to do with the task.** First check that it is not a LAX card payment whose Books document is
still unresolved: look up the invoice reference on the accounting attention list and in Books, and
compare the payment's reference, amount and date with LAX's own payments for that invoice. If it is
LAX's own payment, resolve LAX's payment document and close the task; do not record it again. Only
then, for a real payment entered in Books, check that the money arrived and record the payment in
LAX the usual way, or correct Books if the payment was entered by mistake.

### Status check missed (`accounting_status_check_missed`)

**What it means.** While Books is aimed at for some product, no nightly status check has finished
for more than 26 hours. The check's Sentry cron monitor (`accounting-reconcile`) also shows the miss.

**What to do.** Look at the worker logs for `accounting_status_check_finished`, or for the job's
failure on Failed jobs. A run that keeps failing is recorded with outcome `failed`. A run stopped
by the budget (`budget_spent`) still counts as run: the rest is read the next night. Books being
unavailable for a while is not an error, and those documents are read again next time. Nothing
waits on this check: sending, invoices and payments go on without it.

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
