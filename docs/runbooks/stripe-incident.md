# Stripe incident (API, Connect, Identity, webhooks)

## Symptom

- Checkout or Connect onboarding fails with Stripe errors; webhooks show delivery failures; Identity sessions stuck; transfers not appearing.

## Diagnosis

1. **Stripe status page** — region/API outage?
2. **Dashboard → Developers → Webhooks** — which endpoint fails?
   - `/webhooks/stripe/identity` — KYC
   - `/webhooks/stripe/connect` — seller account status (Connected accounts scope)
   - `/webhooks/stripe/transfers` — platform → seller transfers (Your account scope)
   - `/webhooks/stripe/payments` — disputes and refunds
   - **401** = signing secret mismatch for that destination; **503** = secret missing in env; **5xx** = app bug or overload.
3. **Logs** — correlate `request_id` with Sentry (`lax-prod-api`).
4. **Connect** — account `requirements.currently_due` blocking payouts?

## Resolution

| Area | Steps |
|------|--------|
| **API down** | Scale App Platform instances; rollback deploy if regression; enable maintenance banner. |
| **Webhooks** | Rotate secret in Stripe for the failing destination + update the matching `STRIPE_*_WEBHOOK_SECRET` in secrets/Terraform + apply; replay failed events from Stripe UI once handler fixed. |
| **Connect** | Seller completes outstanding KYC in Connect Express link; refresh account in admin. |
| **Identity** | Verify `STRIPE_IDENTITY_WEBHOOK_SECRET`; check session `last_error` in Stripe dashboard. |
| **Transfers** | Verify `STRIPE_TRANSFERS_WEBHOOK_SECRET` and that the destination uses **Your account** scope with `transfer.*` events. |

## Escalation

- Stripe priority support for live-mode money stuck &gt; 1 hour.
- Internal: `#incident` + finance lead if payouts blocked.

## Related

- [Stripe Connect go-live](./stripe-connect-go-live.md)
- [Buyer payment flow](./buyer-payment-flow.md) (Xero + Stripe on invoice)
- [Dispute clawback](./dispute-clawback.md)
