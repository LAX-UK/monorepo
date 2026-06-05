# Stripe incident (API, Connect, Identity, webhooks)

## Symptom

- Checkout or Connect onboarding fails with Stripe errors; webhooks show delivery failures; Veriff KYC sessions stuck; transfers not appearing.

## Diagnosis

1. **Stripe status page** — region/API outage?
2. **Dashboard → Developers → Webhooks** — which endpoint fails?
   - `/webhooks/veriff/decision` — buyer KYC (Veriff)
   - `/webhooks/veriff/event` — KYC session progress (optional)
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
| **Connect account create 503** | Log mentions `platform-profile` or `managing losses` → complete **Settings → Connect → Platform profile** in the matching Stripe mode (Live/Test); no deploy required. API returns `stripe_platform_profile_incomplete`. |
| **Connect account orphan** | Metric `stripe_connect_account_orphan_created` — Stripe account exists but DB update failed; seller retry on `/dashboard/seller/connect` (idempotent ensure) or admin reconcile `stripeConnectAccountId`. |
| **Connect deauthorized** | Metric `stripe_connect_account_deauthorized` — seller revoked access; re-onboard via embedded Connect or admin onboarding link. |
| **Transfer CAS miss** | Metric `payout_transfer_status_cas_miss` — Stripe transfer created but payout status not updated; finance reconcile transfer id vs payout row before re-running settlement. |
| **Veriff KYC** | Verify `VERIFF_API_KEY` and `VERIFF_SHARED_SECRET` in env; check Veriff Customer Portal webhook delivery and session status; confirm `x-auth-client` + HMAC headers reach `/webhooks/veriff/decision`. |
| **Transfers** | Verify `STRIPE_TRANSFERS_WEBHOOK_SECRET` and that the destination uses **Your account** scope with `transfer.*` events. |

## Escalation

- Stripe priority support for live-mode money stuck &gt; 1 hour.
- Internal: `#incident` + finance lead if payouts blocked.

## Related

- [Stripe Connect go-live](./stripe-connect-go-live.md)
- [Buyer payment flow](./buyer-payment-flow.md) (Xero + Stripe on invoice)
- [Dispute clawback](./dispute-clawback.md)
