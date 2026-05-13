# Xero + Stripe “Pay Now” (hosted invoice) setup

Buyer card collection uses **Stripe connected inside Xero**, not first-party Stripe Elements in `apps/web`. Our API creates a Xero **ACCREC** invoice and returns the **online invoice URL**; the buyer pays on Xero’s page where **Pay Now** appears when the payment service and branding are configured.

## Symptom

- Buyers reach the Xero invoice but there is **no Pay Now** button, or only bank transfer is offered.
- UK operations accidentally enabled **Stripe ACH (US bank transfer)** instead of **Stripe (cards)**.

## Diagnosis

1. In **Xero** (production org): **Settings** → **Payment services**.
2. Confirm **Stripe** is listed and **Connected** (OAuth to the correct Stripe account used for live charges).
3. If you see **Stripe ACH Bank Transfers** as the only Stripe option, that is the **US ACH** product — for UK card payments, add **Stripe** (card payments) per Xero’s regional offering, not ACH.
4. **Branding themes:** **Settings** → **Invoice settings** → **Branding themes** → open the theme applied to sales invoices (or the default). Under **Payment services**, ensure the **Stripe** service is **enabled** for online invoices.

## Resolution — connect Stripe to Xero (procedure)

1. Xero **Settings** → **Payment services** → **Add payment service** → choose **Stripe** (cards).
2. Complete Xero’s OAuth flow into Stripe; use the **live** Stripe account that matches production `STRIPE_SECRET_KEY` / Connect configuration.
3. **Do not** enable Stripe ACH for UK buyer card flow unless product explicitly requires US-style ACH.
4. Attach the Stripe payment service to the **branding theme** used for ACCREC invoices created by our integration (`XeroAccountingProvider.createCheckoutForWinner` in `apps/api/src/services/accounting/xero-accounting.provider.ts` uses standard invoice creation; ensure org default theme has Pay Now enabled).
5. Create a **£1.00 test invoice** in Xero (or sandbox org), open **Online invoice**, and verify **Pay Now** is visible.

### Screenshot (evidence)

Store under `docs/runbooks/_assets/` (git-tracked) or internal drive:

- Filename: `xero-online-invoice-pay-now.png`
- Must show: invoice header, line items, **Pay Now** button, Xero URL bar (redact unrelated PII if sharing externally).

_If this file is not yet in the repo, attach during the first verification drill and commit the image._

## Verification — disputes still hit our Stripe webhooks

Card charges initiated through Xero still settle in **Stripe**; dispute lifecycle events are standard Stripe objects.

1. Pay a **sandbox** Xero invoice with a Stripe [test card](https://docs.stripe.com/testing).
2. From a shell with `stripe` CLI logged into the same Stripe account:

```bash
stripe trigger charge.dispute.created
```

3. Confirm `POST /webhooks/stripe/payments` on **api** returns `200` and `StripePaymentWebhookService` logs show processing (`apps/api/src/routes/webhooks/stripe.ts`).

## Escalation

- Xero support: payment service stuck “Pending” or OAuth errors.
- Stripe support: charges visible but Xero not marking paid (sync delay &gt; 1 hour — check Xero invoice status first).

## Related

- [Buyer payment flow](./buyer-payment-flow.md) — end-to-end journey and reconciliation timings.
- [Xero token loss](./xero-token-loss.md) — OAuth disconnects.
