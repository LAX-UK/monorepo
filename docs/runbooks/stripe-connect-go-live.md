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
| Payments | **Your account** | `/webhooks/stripe/payments` | `payment_intent.succeeded`, `payment_intent.processing`, `payment_intent.partially_funded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.dispute.*`, `charge.refunded` |

Optional: `radar.early_fraud_warning.created` (Payments), `payout.failed` (Connected accounts).
- [ ] **Connect accounts destination** also subscribes to `account.application.deauthorized` (seller revokes platform access).

- [ ] **Connect → Platform profile** (Live and Test): complete integration questionnaire; acknowledge **platform manages losses** for connected accounts (required because accounts are created with `controller.losses.payments=application`). Settings → Connect → [Platform profile](https://dashboard.stripe.com/settings/connect/platform-profile).
- [ ] **Connect** integration profile: platform collects payments → pays sellers (separate charges & transfers); individual payouts; embedded onboarding + Express dashboard fallback.
- [ ] **Connect → Onboarding**: **GB** enabled; upfront requirements preferred for auction sellers.
- [ ] **Settings → Branding** and **Connect → Express Dashboard → Branding** (platform name/icon/color).
- [ ] **Connect → Emails**: requirement URLs point to in-app Connect surfaces:
  - Individuals: `https://lax.bid/dashboard/seller/connect`
  - Organisations: `https://lax.bid/dashboard/organisations` (entity connect tab)
- [ ] **Restricted API key** scoped to **Account Sessions** write (optional; platform secret key also works).
- [ ] All four destinations send **Test** events → API returns `200` with `{ ok: true }`.
- [ ] **Restricted keys** or live secret key stored only in secrets manager / Terraform, not in repo.

## 2. Application environment

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Live secret (`sk_live_…`) |
| `STRIPE_PUBLISHABLE_KEY` | Live publishable (`pk_live_…`) — API + web (embedded Connect.js bootstrap) |
| `VERIFF_API_KEY` | Veriff Live integration API key |
| `VERIFF_SHARED_SECRET` | Veriff Live integration shared secret (webhook HMAC) |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Connect (Connected accounts) destination |
| `STRIPE_TRANSFERS_WEBHOOK_SECRET` | Transfers (Your account) destination |
| `STRIPE_PAYMENTS_WEBHOOK_SECRET` | Payments destination |
| `STRIPE_CARD_CHECKOUT_MAX` | Card tier ceiling (major GBP, default `100000`) |
| `STRIPE_MANUAL_REVIEW_MIN` | Manual review floor (major GBP, default `500000`) |
| `STRIPE_ABSOLUTE_MAX` | Online payment cap (major GBP, default `999999.99`) |
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

### Connect onboarding (embedded components)

- [ ] `GET /stripe-connect/client-config` returns `{ publishableKey, connectEnforced }`.
- [ ] `POST /stripe-connect/account` (individual) → same account id on second call (idempotency).
- [ ] New Connect accounts are created with `controller.fees.payer=application`, `controller.losses.payments=application`, `controller.stripe_dashboard.type=none` (embedded-only), and `transfers` capability only — **existing `acct_*` IDs in DB are not retrofitted** (controller settings are immutable after creation).
- [ ] `POST /stripe-connect/account-session` returns `clientSecret` for owner/admin (onboarding + management + notification_banner).
- [ ] Embedded onboarding on `/dashboard/seller/connect` completes without leaving LAX; `onExit` → `POST /stripe-connect/sync` → requirements clear.
- [ ] `GET /stripe-connect/status` returns cached DB flags; `POST /stripe-connect/sync` live-syncs from Stripe (`accounts.retrieve`).
- [ ] Org wizard connect step embeds onboarding; auto-advances only after sync confirms payout-ready.
- [ ] Org admin **approve** when Connect already complete during onboarding → entity promotes to `approved` without waiting for a new webhook.
- [ ] Org **submit for review** re-syncs Connect when the connect onboarding step is marked complete.
- [ ] Seller UI uses embedded Connect only (`showDashboardLink=false`); `POST /stripe-connect/dashboard-link` returns `dashboard_link_not_supported` (accounts use `dashboard:none`).
- [ ] `POST /stripe-connect/onboarding-link` still works for **admin ops** hosted recovery (`POST /admin/legal-entities/:id/stripe-connect/onboarding-link`).
- [ ] CSP report-only shows no violations for `js.stripe.com`, `api.stripe.com`, `m.stripe.network` on Connect pages.

### Buyer payment + refund

- [ ] Buyer pays via **Stripe Checkout** (card ≤ tier A, bank transfer tier B) → `payment_external_ref.xero_invoice_id` exists **before** pay → `payments` row has `stripeChargeId`, status captured.
- [ ] Xero invoice marked paid after Stripe capture (`XeroPaymentRecorder`).
- [ ] High-value lot (≥ manual review min) → `requires_manual_review` → finance release → buyer `POST /payments` again → bank transfer URL.
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
- [ ] Primary seller/org flows use **embedded Connect** (`ConnectWorkspace`); hosted redirect onboarding is **admin fallback only** (`POST /admin/legal-entities/:id/stripe-connect/onboarding-link`).

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
