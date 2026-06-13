# Xero accounting + Stripe platform

Buyer payments use the **LAX self-created Stripe Connect platform account** for card checkout and seller Connect payouts. Xero is used for **Accounting API** only (invoices, contacts, payout bills) — not for enrolling the platform Stripe account.

> **Historical note.** LAX previously had a separate Stripe account created via **Xero → Payment services**. That account was removed and must not be re-linked. All `STRIPE_*` secrets point at the self-created platform account only.

## Do not

- OAuth the Connect **platform** account through **Xero → Payment services**. That enrolls Stripe under Xero’s Connected Account Agreement and **blocks Connect sub-account creation** (`this kind of account cannot create connect accounts`).

## Account mapping

| System | Role | Used for |
|--------|------|----------|
| **Stripe platform** (self-created) | Connect platform | `STRIPE_*` env vars, seller Express onboarding, buyer Stripe Checkout, disputes/refunds webhooks, seller transfers |
| **Xero org** | Accounting | ACCREC invoices (bank transfer URL), OAuth admin, payout bills, invoice-paid webhooks |

## Identifying the active **test** Stripe account

If you have more than one Stripe account in **Test mode**, keep the one wired to **`test.lax.bid`** / **`test-api.lax.bid`**. The others are safe to delete once confirmed unused.

### 1. Webhooks (fastest)

In each candidate account: **Developers → Webhooks** (Test mode). The live test stack registers three destinations on **`test-api.lax.bid`**:

| Destination | URL |
|-------------|-----|
| Connect | `https://test-api.lax.bid/webhooks/stripe/connect` |
| Transfers | `https://test-api.lax.bid/webhooks/stripe/transfers` |
| Payments | `https://test-api.lax.bid/webhooks/stripe/payments` |

**Keep the account that has these endpoints.** Delete any other test account that does not.

### 2. Publishable key match

Canonical test keys live in (values are not readable back from GitHub/DO after set — use 1Password or your password manager):

- GitHub → **Environments → test** → `STRIPE_PUBLISHABLE_KEY` / `STRIPE_SECRET_KEY`
- DigitalOcean App Platform → **`lax-test-app`** → `STRIPE_*` on the `api` service
- 1Password (see [secrets-management](../security/secrets-management.md))

In each Stripe test account: **Developers → API keys**. The account whose **`pk_test_…`** matches 1Password is the one in use.

### 3. Resolve platform account id from the secret key

```bash
curl -s https://api.stripe.com/v1/account \
  -H "Authorization: Bearer ${STRIPE_SECRET_KEY}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'], d.get('email'))"
```

Use the test secret from 1Password (see section 2 above); do not paste keys into shell history or docs.

Compare the printed `acct_…` with the account switcher in the Stripe dashboard.

### Before deleting the unused account

- [ ] No webhooks pointing at `test-api.lax.bid`
- [ ] `pk_test_…` does not match 1Password / the key used when Terraform test apply last ran
- [ ] **Connect → Connected accounts** is empty or only contains stale sandboxes you no longer need

## Buyer pay-in (Stripe-only checkout)

All buyer checkout URLs come from **Stripe Checkout** on the platform account (tiered card / UK bank transfer). Xero provides ACCREC invoices and payment ledger sync only.

1. **Card** (≤ `STRIPE_CARD_CHECKOUT_MAX`, default £10k) — Stripe card Checkout.
2. **UK bank transfer** (above card max, below `STRIPE_MANUAL_REVIEW_MIN`) — Stripe `gb_bank_transfer` via Customer Balance.
3. **Manual review** (≥ manual review min or archived seller) — finance **Release for checkout** before buyer gets a URL.

**Invoice gate:** `POST /payments` calls `ensureInvoiceForPayment` when issuing a checkout URL so every payment has an ACCREC invoice row (`payment_external_ref.xero_invoice_id`) for `XeroPaymentRecorder` after capture.

After Stripe capture, `XeroPaymentRecorder` marks the linked Xero invoice paid via Accounting API (no Xero Pay Now OAuth on the platform account). Failed capture sync persists `syncStatus=error` on the external ref; replay via `POST /internal/jobs/retry-xero-stripe-capture-sync`.

Admin refunds optionally emit Xero ACCREC credit notes via `recordRefundCreditNote`.

## Env vars

| Variable | Purpose |
|----------|---------|
| `STRIPE_CARD_CHECKOUT_MAX` | Card Checkout ceiling (major GBP, default `10000`) |
| `STRIPE_MANUAL_REVIEW_MIN` | Finance review floor (major GBP, default `500000`) |
| `STRIPE_ABSOLUTE_MAX` | Hard online cap (major GBP, default `999999.99`) |
| `XERO_PAYMENT_BANK_ACCOUNT_CODE` | Chart account for recording Stripe captures in Xero (default `090`) |
| `XERO_WEBHOOK_KEY` | Required in production when Xero OAuth is configured |

## Verification

1. Staging: `POST /stripe-connect/account` creates Express account on platform test keys.
2. Staging: `POST /payments` returns Stripe Checkout URL; confirm `payment_external_ref` row has `xero_invoice_id` **before** buyer pays.
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
