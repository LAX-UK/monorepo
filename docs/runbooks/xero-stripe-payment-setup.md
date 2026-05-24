# Xero accounting + Stripe platform (Account B)

Buyer payments use the **self-created Stripe platform account (Account B)** for card checkout and seller Connect payouts. Xero is used for **Accounting API** only (invoices, contacts, payout bills) — **not** for OAuth-enrolling the platform Stripe account via Xero Payment services.

## Do not

- OAuth the Connect **platform** account through **Xero → Payment services**. That enrolls Stripe under Xero’s Connected Account Agreement and **blocks Connect sub-account creation** (`this kind of account cannot create connect accounts`).
- Point `STRIPE_SECRET_KEY` / webhooks at the Xero-created Stripe account (Account A).

## Account mapping (finance)

| Account | Role | Used for |
|---------|------|----------|
| **Account B** (self-created) | Connect **platform** | `STRIPE_*` env vars, seller Express onboarding, buyer Stripe Checkout, disputes/refunds webhooks, seller transfers |
| **Account A** (Xero onboarding) | Ignore for LAX keys | Do not use for app secrets; disconnect in Xero Payment services if linked |
| **Xero org** | Accounting | ACCREC invoices (bank transfer URL), OAuth admin, payout bills, invoice-paid webhooks |

## Buyer pay-in paths

When `STRIPE_CHECKOUT_ENABLED=true` (production default after QA):

1. **Stripe Checkout** on Account B — primary card path; webhook `payment_intent.succeeded` captures payment and sets `stripeChargeId`.
2. **Xero online invoice** — bank transfer / fallback when Stripe checkout unavailable; invoice reference `payment:{paymentId}` links accounting.

**Stripe-primary checkout:** `POST /payments` calls `ensureInvoiceForPayment` before redirect so every card payment has an ACCREC invoice row (`payment_external_ref.xero_invoice_id`) even when the buyer never visits the Xero online URL.

After Stripe capture, `XeroPaymentRecorder` marks the linked Xero invoice paid via Accounting API (no Xero Pay Now OAuth on the platform account). Failed capture sync persists `syncStatus=error` on the external ref; replay via `POST /internal/jobs/retry-xero-stripe-capture-sync`.

Admin refunds optionally emit Xero ACCREC credit notes via `recordRefundCreditNote`.

## Env vars

| Variable | Purpose |
|----------|---------|
| `STRIPE_CHECKOUT_ENABLED` | `true` → Stripe Checkout URL from `POST /payments` |
| `XERO_PAYMENT_BANK_ACCOUNT_CODE` | Chart account for recording Stripe captures in Xero (default `090`) |
| `XERO_WEBHOOK_KEY` | Required in production when Xero OAuth is configured |

## Verification

1. Staging: `POST /stripe-connect/account` creates Express account on Account B test keys.
2. Staging: `POST /payments` returns Stripe Checkout URL when checkout flag enabled; confirm `payment_external_ref` row has `xero_invoice_id` **before** buyer pays.
3. Pay test card → `payment_intent.succeeded` → `payments.status=captured`, `stripeChargeId` set.
4. Xero invoice shows paid (Accounting API sync via `XeroPaymentRecorder`).
5. If step 4 fails, check `xero_payment_record_failed` and run `POST /internal/jobs/retry-xero-stripe-capture-sync` (requires `X-Cron-Secret`).

## Internal cron replay (money path)

| Route | Purpose |
|-------|---------|
| `POST /internal/jobs/retry-xero-stripe-capture-sync` | Captured Stripe payments with Xero invoice but no `xero_payment_id` |
| `POST /internal/jobs/retry-refund-reconciles` | Admin refunds where Stripe succeeded but DB persist failed |
| `POST /internal/jobs/retry-xero-webhook-failures` | Xero invoice webhook rows that previously failed sync |

## Related

- [Buyer payment flow](./buyer-payment-flow.md)
- [Stripe Connect go-live](./stripe-connect-go-live.md)
