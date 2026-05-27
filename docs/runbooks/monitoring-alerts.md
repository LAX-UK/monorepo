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
| `payout_reconciled_failed` | Payout moved to `failed` during Stripe reconciliation |
| `payout_clawback_required` | Negative-net payout path emitted `payout.clawback_required` |
| `payment_intent_amount_mismatch` | Stripe PI amount ≠ local payment row; webhook not claimed (Stripe retries) |
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
| **PI amount mismatch** | `payment_intent_amount_mismatch` | Metadata/amount drift on capture | Compare Stripe PI vs `payment.amount`; fix data; Stripe will retry unclaimed events. |

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

## Test environment: Postgres connection slot exhaustion

**Sentry issues:** `LAX-TEST-API-*` (e.g. `remaining connection slots are reserved for SUPERUSER`).

**Symptom:** API or auth requests fail in the **test** environment with Postgres error `53300` / “remaining connection slots are reserved for roles with the SUPERUSER attribute”. This is **not** a production bug — the test DB `max_connections` is exhausted.

**Mitigations:**

1. Lower per-app pool size in test env config (API, auth, worker) so total connections stay below `max_connections` minus the superuser reserve.
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
