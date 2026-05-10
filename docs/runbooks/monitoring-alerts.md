# Money-path monitoring and alerts

This runbook ties **Prometheus metrics** (admin `/metrics` on `apps/api`) to **operational response**. Sentry org-level alert rules for bespoke filters are configured in the Sentry UI when Terraform issue alerts are insufficient — use this doc as the checklist.

**Primary inboxes:** `support@lax.bid` and `OPS_ONCALL_EMAIL` (production env).

---

## Prometheus counters (`auction_api_money_path_events_total`)

Emitted from `apps/api/src/middleware/metrics.ts` via `recordMoneyPathEvent`. Labels are the `event` string.

| `event` value | Meaning |
|---------------|---------|
| `stripe_webhook_identity_4xx` / `_5xx` | Identity webhook returned client/server error |
| `stripe_webhook_connect_4xx` / `_5xx` | Connect webhook errors |
| `stripe_webhook_payments_4xx` / `_5xx` | Payments (dispute/refund) webhook errors |
| `stripe_connect_transfer_failed` | Stripe `transfer.failed` received |
| `payout_reconciled_failed` | Payout moved to `failed` during Stripe reconciliation |
| `payout_clawback_required` | Negative-net payout path emitted `payout.clawback_required` |

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

---

## Sentry (manual fine-tuning)

Terraform (`infra/terraform/modules/sentry-alerts`) provisions baseline per-project issue alerts when `SENTRY_AUTH_TOKEN` is set. For **message/tag-scoped** money alerts:

1. Sentry → **Alerts** → **Create Alert** → **Issues**.
2. Filter: `transaction:/webhooks/stripe/*` OR `message:*payout*`.
3. Action: email `support@lax.bid`, CC on-call distro.

Re-test with Stripe CLI (`stripe trigger charge.dispute.created`) after changing webhook code.

---

## Stripe dashboard checks

- **Developers → Webhooks:** delivery success rate &gt; 99%.
- **Connect → Transfers:** failed transfers list empty after settlement window.

## Related

- [Scale monitoring](./scale-monitoring.md)
- [On-call](./on-call.md)
- [Buyer payment flow](./buyer-payment-flow.md)
