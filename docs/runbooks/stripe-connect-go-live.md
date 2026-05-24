# Runbook: Stripe Connect (UK) — go-live checklist

Use this before enabling seller payouts in production.

## 1. Stripe Dashboard — webhook destinations (Live mode)

Stripe allows **one scope per destination** ([Connect webhooks](https://docs.stripe.com/connect/webhooks)). Register **four** destinations (replace `https://api.yourdomain.com`):

| Destination | Scope | URL | Events |
|-------------|-------|-----|--------|
| Veriff decision | **Veriff Customer Portal** | `https://api.yourdomain.com/webhooks/veriff/decision` | Session decision (required for IDV) |
| Veriff event (optional) | **Veriff Customer Portal** | `https://api.yourdomain.com/webhooks/veriff/event` | Session progress (`started`, `submitted`) |
| Connect accounts | **Connected accounts** | `/webhooks/stripe/connect` | `account.updated`, `capability.updated` |
| Transfers | **Your account** | `/webhooks/stripe/transfers` | `transfer.created`, `transfer.updated`, `transfer.reversed` |
| Payments | **Your account** | `/webhooks/stripe/payments` | `payment_intent.succeeded`, `charge.dispute.created`, `.funds_withdrawn`, `.closed`, `charge.refunded` |

Optional (subscribe only if you add handlers later): `account.application.deauthorized` (Connect), `radar.early_fraud_warning.created` (Payments), `payout.failed` (Connected accounts).

- [ ] **Connect** application settings: UK capabilities, branding, and redirect URLs include production `WEB_ORIGIN` paths (`/dashboard/seller/connect`, team flows if applicable).
- [ ] All four destinations send **Test** events → API returns `200` with `{ ok: true }`.
- [ ] **Restricted keys** or live secret key stored only in secrets manager / Terraform, not in repo.

## 2. Application environment

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Live secret (`sk_live_…`) |
| `STRIPE_PUBLISHABLE_KEY` | Live publishable (`pk_live_…`) |
| `VERIFF_API_KEY` | Veriff Live integration API key |
| `VERIFF_SHARED_SECRET` | Veriff Live integration shared secret (webhook HMAC) |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Connect (Connected accounts) destination |
| `STRIPE_TRANSFERS_WEBHOOK_SECRET` | Transfers (Your account) destination |
| `STRIPE_PAYMENTS_WEBHOOK_SECRET` | Payments destination |
| `STRIPE_CHECKOUT_ENABLED` | `true` in production after QA — buyer Stripe Checkout on platform account |
| `XERO_PAYMENT_BANK_ACCOUNT_CODE` | Xero chart account for Stripe capture payments (default `090`) |

- [ ] Platform Stripe account is **self-created (Account B)**, not Xero Payment services OAuth — see [xero-stripe-payment-setup](./xero-stripe-payment-setup.md).
- [ ] Stripe + Veriff webhook secrets and keys set in production (Terraform / App Platform secrets).
- [ ] Migrations **0072** (`payout_line_sale_payment_uidx`), **0073** (legacy Connect backfill), and **0074** (`payment_refund_reconcile`) applied before settlement scale-up.
- [ ] `DISABLE_PAYOUT_SETTLEMENT` is **unset** or `false` when finance is ready to run settlement crons (keep `true` for first 24h after cutover if desired).
- [ ] `SENTRY_DSN_API` set if error reporting is required for Connect onboarding failures.

## 3. Smoke tests (staging, then live-mode test accounts)

### KYC (Veriff)

- [ ] `POST /kyc/session` → complete InContext or redirect verification on staging.
- [ ] Veriff decision webhook → `user.kyc_status=approved`, `processed_webhook_events` row `source=veriff_decision`.
- [ ] Replay decision from Veriff portal → idempotent (no duplicate marketing outbox / retry increment).

### Connect onboarding

- [ ] `POST /stripe-connect/account` (individual) → same account id on second call (idempotency).
- [ ] Onboarding link → Express complete → `account.updated` updates entity, may set `status=approved`.
- [ ] `GET /stripe-connect/status` live-syncs from Stripe (`accounts.retrieve`) when configured — not cache-only.
- [ ] Org admin **approve** when Connect already complete during onboarding → entity promotes to `approved` without waiting for a new webhook.
- [ ] Org **submit for review** re-syncs Connect when the connect onboarding step is marked complete.
- [ ] `POST /stripe-connect/dashboard-link` returns Express login URL.

### Buyer payment + refund

- [ ] Buyer pays via **Stripe Checkout** (when `STRIPE_CHECKOUT_ENABLED`) → `payment_external_ref.xero_invoice_id` exists **before** pay → `payments` row has `stripeChargeId`, status captured.
- [ ] Xero invoice marked paid after Stripe capture (`XeroPaymentRecorder`).
- [ ] Buyer pays via Xero bank transfer → Xero webhook → captured with charge backfill when available.
- [ ] Partial refund before settlement → seller net debited once (gross sale line + aggregated refund clawback line).
- [ ] Second partial refund on same open payout succeeds (no unique-index 500 loop).
- [ ] Admin refund → `charge.refunded` webhook → `payments.status=refunded`, payout line if open payout exists.
- [ ] Admin refund with DB persist failure → `payment_refund_reconcile` row; `POST /internal/jobs/retry-refund-reconciles` recovers.

### Dispute

- [ ] Test dispute → `payment.dispute_opened` domain event, ops/seller notifications.
- [ ] Dispute lost → negative payout line `kind=dispute`.
- [ ] Dispute `warning_closed` → **no** seller clawback line.

### Payout transfer

- [ ] Settlement cron (`DISABLE_PAYOUT_SETTLEMENT=false`) → `payout.transfer_initiated`, `transfer.*` on `/webhooks/stripe/transfers` → `payout.paid`.
- [ ] Transfer initiation live-syncs Connect readiness from Stripe before checking cached flags.
- [ ] Re-run settlement for same payout → no duplicate Stripe transfer (idempotency key `payout:transfer:{payoutId}`).

## 4. Operational

- [ ] Finance knows how to use **Legal entities → Stripe Connect requirements** admin queue.
- [ ] Support macro for “Connect incomplete” links sellers to `/dashboard/seller/connect` (individuals) or team onboarding for organisations.

## 5. Cutover sequence

1. Deploy API with this release.
2. Create/update four Stripe destinations (table above); copy each `whsec_…` into the matching env var.
3. Send test event from each destination.
4. Run section 3 checklist on staging.
5. Set `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` to live keys.
6. Monitor `stripe_webhook_*` metrics and Sentry for 1 hour.
7. Enable payout settlement cron after 24h if it was disabled.

## 6. Rollback

- Set `DISABLE_PAYOUT_SETTLEMENT=true` to stop bulk payout jobs without taking the site offline.
- Set `DISABLE_BIDDING=true` only if you must freeze auctions (wide blast radius).
- Revert deploy and disable the **Transfers** destination if rolling back webhook split.
