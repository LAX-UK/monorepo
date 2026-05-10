# Stripe incident (API, Connect, Identity, webhooks)

## Symptom

- Checkout or Connect onboarding fails with Stripe errors; webhooks show delivery failures; Identity sessions stuck; transfers not appearing.

## Diagnosis

1. **Stripe status page** — region/API outage?
2. **Dashboard → Developers → Webhooks** — which endpoint (`/webhooks/stripe/*`) fails? 401 = signing secret mismatch; 5xx = app bug or overload.
3. **Logs** — correlate `request_id` with Sentry (`lax-prod-api`).
4. **Connect** — account `requirements.currently_due` blocking payouts?

## Resolution

| Area | Steps |
|------|--------|
| **API down** | Scale App Platform instances; rollback deploy if regression; enable maintenance banner. |
| **Webhooks** | Rotate secret in Stripe + GitHub `STRIPE_*_WEBHOOK_SECRET` + Terraform apply; replay failed events from Stripe UI once handler fixed. |
| **Connect** | Seller completes outstanding KYC in Connect Express link; refresh account in admin. |
| **Identity** | Verify `STRIPE_IDENTITY_WEBHOOK_SECRET`; check session `last_error` in Stripe dashboard. |

## Escalation

- Stripe priority support for live-mode money stuck &gt; 1 hour.
- Internal: `#incident` + finance lead if payouts blocked.

## Related

- [Buyer payment flow](./buyer-payment-flow.md) (Xero + Stripe on invoice)
- [Dispute clawback](./dispute-clawback.md)
