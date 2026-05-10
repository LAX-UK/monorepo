# Buyer Payment Flow Verification (Xero + Stripe)

**Date:** 2026-05-10  
**Environment:** Test  
**Verifier:** _[Your name]_  
**Status:** PENDING

## Purpose

Verify that the existing Xero+Stripe integration works end-to-end in the test environment before deciding on the buyer payment UX path.

## Hypothesised Flow

1. Customer receives Xero invoice (verified — code creates it)
2. Customer clicks Pay Now on Xero hosted page
3. Payment goes through Stripe (UNVERIFIED — depends on Xero config)
4. Xero updates invoice/payment automatically (UNVERIFIED end-to-end)
5. Stripe payout reconciles in Xero (UNVERIFIED)

---

## Step 1: Xero Account Configuration Check

### 1.1 Stripe Payment Service

| Check | How to verify | Result | Notes |
|-------|---------------|--------|-------|
| Stripe connected as Payment Service | Xero → Settings → Payment services → Look for "Stripe" (not "Stripe ACH") | ⬜ WORKED / ⬜ BROKE / ⬜ NOT CONFIGURED | |
| Stripe OAuth to correct account | Check Stripe account shown matches test Stripe keys in env | ⬜ WORKED / ⬜ BROKE / ⬜ NOT CONFIGURED | |
| Stripe (cards) not Stripe ACH | UK card payments require "Stripe" not "Stripe ACH Bank Transfers" | ⬜ WORKED / ⬜ BROKE / ⬜ NOT CONFIGURED | |

### 1.2 Invoice Branding Theme

| Check | How to verify | Result | Notes |
|-------|---------------|--------|-------|
| Default/active branding theme identified | Xero → Settings → Invoice settings → Branding themes | ⬜ FOUND: _______ | Theme name |
| Stripe enabled on theme | Open theme → Payment services → Stripe checkbox enabled | ⬜ ENABLED / ⬜ DISABLED | |
| Pay Now button visible on theme | Preview online invoice or test invoice | ⬜ VISIBLE / ⬜ HIDDEN | |

### 1.3 Xero Webhook Configuration

| Check | How to verify | Result | Notes |
|-------|---------------|--------|-------|
| Webhook endpoint registered | Xero Developer → App → Webhooks → URL | ⬜ CONFIGURED / ⬜ NOT SET | Expected: `https://[test-api-url]/webhooks/xero` |
| Webhook key matches env | Compare Xero developer portal key to `XERO_WEBHOOK_KEY` in test env | ⬜ MATCH / ⬜ MISMATCH | |
| Invoice events subscribed | Events include `INVOICE` category updates | ⬜ YES / ⬜ NO | |

### 1.4 Environment Variables (Test)

Check these are set in the test DigitalOcean App Platform or `.env.test`:

| Variable | Status | Notes |
|----------|--------|-------|
| `XERO_CLIENT_ID` | ⬜ SET / ⬜ MISSING | |
| `XERO_CLIENT_SECRET` | ⬜ SET / ⬜ MISSING | |
| `XERO_REDIRECT_URI` | ⬜ SET / ⬜ MISSING | Should point to test API callback |
| `XERO_WEBHOOK_KEY` | ⬜ SET / ⬜ MISSING | Required for webhook signature verification |
| `XERO_DEFAULT_REVENUE_ACCOUNT_CODE` | ⬜ SET / ⬜ MISSING | Default: 200 |
| `XERO_DEFAULT_TAX_TYPE` | ⬜ SET / ⬜ MISSING | Default: NONE |

---

## Step 2: Trigger the Flow with Test Data

### 2.1 Prepare Test Scenario

| Step | Action | Result | Notes |
|------|--------|--------|-------|
| Find/create a won lot | Query DB: `SELECT * FROM lots WHERE status = 'ended' AND winner_id IS NOT NULL LIMIT 1` | ⬜ FOUND: lot_id = ______ | |
| Identify buyer user | From lot's `winner_id`, get user email for login | ⬜ USER: ______ | |
| Verify legal entities set | Lot has `buyer_legal_entity_id` and `seller_legal_entity_id` | ⬜ BOTH SET / ⬜ MISSING | |

**If no ended lot with winner exists:**
1. Create a test sale with a lot
2. Bid on it with a test buyer account
3. End the lot (or wait for scheduled end)

### 2.2 Trigger Payment Creation

| Step | Action | Result | Notes |
|------|--------|--------|-------|
| Log in as buyer | Use test buyer credentials | ⬜ DONE | |
| Navigate to Collection | `/dashboard/collection` | ⬜ DONE | |
| Click "Pay Now" on won lot | Opens checkout page | ⬜ OPENED | |
| Observe API call | `POST /payments` should be called | ⬜ CALLED | Check Network tab |

### 2.3 Verify Xero Invoice Creation

| Step | Action | Result | Notes |
|------|--------|--------|-------|
| API returns `checkoutUrl` | Response from POST /payments | ⬜ RECEIVED / ⬜ NULL / ⬜ ERROR | |
| Redirect to Xero | Browser redirects to Xero hosted invoice | ⬜ REDIRECTED / ⬜ FAILED | |
| Invoice visible in Xero | Check Xero → Sales → Invoices | ⬜ FOUND: Invoice # ______ | |
| Invoice reference matches | Reference field shows `payment:[paymentId]` | ⬜ MATCH / ⬜ MISMATCH | |

**If `checkoutUrl` is null, check API logs for errors:**
- `Xero is not connected` → OAuth not completed
- `Buyer legal entity not found` → Missing legal entity
- `Xero did not return an online invoice URL` → Invoice created but URL missing

### 2.4 Verify Pay Now Button Appears

| Step | Action | Result | Notes |
|------|--------|--------|-------|
| Online invoice page loads | Xero hosted page renders | ⬜ LOADED | |
| Pay Now button visible | Blue "Pay Now" button appears | ⬜ VISIBLE / ⬜ HIDDEN | |
| Payment methods shown | Card option available | ⬜ CARD SHOWN / ⬜ BANK ONLY | |
| **SCREENSHOT CAPTURED** | Save as evidence | ⬜ SAVED: _filename_ | |

### 2.5 Complete Payment with Test Card

| Step | Action | Result | Notes |
|------|--------|--------|-------|
| Click Pay Now | Opens Stripe payment form | ⬜ OPENED | |
| Enter test card | `4242 4242 4242 4242`, any future expiry, any CVC | ⬜ ENTERED | |
| Submit payment | Process card | ⬜ SUCCEEDED / ⬜ FAILED: ______ | |
| Xero shows success | Return to invoice, status updated | ⬜ PAID / ⬜ STILL AUTHORISED | |

**Test card numbers:**
- `4242 4242 4242 4242` — Successful payment
- `4000 0000 0000 0002` — Declined
- `4000 0000 0000 9995` — Insufficient funds

### 2.6 Verify Xero Invoice Status

| Step | Action | Result | Notes |
|------|--------|--------|-------|
| Invoice status in Xero | Xero → Sales → Invoices → Find invoice | ⬜ PAID / ⬜ AUTHORISED | |
| Payment recorded | Invoice shows payment attached | ⬜ YES / ⬜ NO | |
| Payment method shown | Should show Stripe/card | ⬜ STRIPE / ⬜ OTHER | |
| `fullyPaidOnDate` set | Invoice marked fully paid | ⬜ YES / ⬜ NO | |

### 2.7 Verify Webhook Fires

| Step | Action | Result | Notes |
|------|--------|--------|-------|
| Check API logs | Look for `POST /webhooks/xero` request | ⬜ RECEIVED / ⬜ NOT RECEIVED | Timestamp: ______ |
| Webhook returns 200 | Response status code | ⬜ 200 / ⬜ OTHER: ______ | |
| Event processed | Log shows `syncInvoiceFromProvider` called | ⬜ CALLED / ⬜ NOT CALLED | |
| `markCapturedFromProviderSync` called | Payment status transition triggered | ⬜ CALLED / ⬜ NOT CALLED | |

**If webhook not received:**
1. Check Xero developer portal → Webhooks → Delivery log
2. Verify webhook URL is correct and reachable from internet
3. Verify `XERO_WEBHOOK_KEY` matches

### 2.8 Verify Database Payment Status

| Step | SQL/Action | Result | Notes |
|------|------------|--------|-------|
| Query payment row | `SELECT id, status, stripe_payment_intent_id, stripe_charge_id FROM payments WHERE lot_id = '[lotId]'` | | |
| Payment status | Should be `captured` | ⬜ captured / ⬜ pending / ⬜ OTHER: ______ | |
| External ref row | `SELECT * FROM payment_external_refs WHERE payment_id = '[paymentId]'` | | |
| Xero invoice ID stored | `xero_invoice_id` populated | ⬜ SET / ⬜ NULL | |
| Sync status | `sync_status` should be `synced` | ⬜ synced / ⬜ OTHER: ______ | |

---

## Step 3: Timing Measurements

| Hop | Observed Time | Notes |
|-----|---------------|-------|
| POST /payments → Xero invoice created | _____ seconds | API latency + Xero API |
| Buyer completes Pay Now | _____ seconds | User interaction + Stripe |
| Xero shows invoice as PAID | _____ seconds/minutes | After Stripe confirms |
| Webhook received at API | _____ seconds after PAID | Xero webhook delivery |
| DB payment status → `captured` | _____ seconds total | End-to-end |

**Total time from "click Pay Now" to "payment captured in DB":** _____ minutes

---

## Step 4: Findings Summary

### Each Step Status

| Step | Status | Category |
|------|--------|----------|
| 1. Xero config check | ⬜ WORKED / ⬜ BROKE / ⬜ COULDN'T VERIFY | |
| 2.1 Test scenario prep | ⬜ WORKED / ⬜ BROKE / ⬜ COULDN'T VERIFY | |
| 2.2 Payment creation API | ⬜ WORKED / ⬜ BROKE / ⬜ COULDN'T VERIFY | |
| 2.3 Xero invoice creation | ⬜ WORKED / ⬜ BROKE / ⬜ COULDN'T VERIFY | |
| 2.4 Pay Now button | ⬜ WORKED / ⬜ BROKE / ⬜ COULDN'T VERIFY | |
| 2.5 Test card payment | ⬜ WORKED / ⬜ BROKE / ⬜ COULDN'T VERIFY | |
| 2.6 Xero invoice status | ⬜ WORKED / ⬜ BROKE / ⬜ COULDN'T VERIFY | |
| 2.7 Webhook received | ⬜ WORKED / ⬜ BROKE / ⬜ COULDN'T VERIFY | |
| 2.8 DB status captured | ⬜ WORKED / ⬜ BROKE / ⬜ COULDN'T VERIFY | |

### Configuration Gaps

_List any Xero/Stripe settings that need to be fixed:_

1. _[Gap]_: _[Fix required]_
2. ...

### Code Gaps

_List any platform code issues surfaced by the test:_

1. _[Issue]_: _[File/function affected]_
2. ...

### Integration Issues

_List any Xero+Stripe behaviour different from expected:_

1. _[Issue]_: _[Expected vs Actual]_
2. ...

---

## Step 5: Issue Classification

For each broken step, classify:

| Issue | Type | Description | Fix Required |
|-------|------|-------------|--------------|
| _[Issue 1]_ | ⬜ Configuration / ⬜ Code / ⬜ Integration | _[Detail]_ | _[Action]_ |
| _[Issue 2]_ | ⬜ Configuration / ⬜ Code / ⬜ Integration | _[Detail]_ | _[Action]_ |

---

## Appendix: Code References

### Payment Creation

```typescript
// apps/api/src/services/payment.service.ts
PaymentService.createPendingForWinner()
  → accounting.createCheckoutForWinner()  // XeroAccountingProvider
  → returns { paymentId, clientSecret: null, checkoutUrl }
```

### Xero Invoice Creation

```typescript
// apps/api/src/services/accounting/xero-accounting.provider.ts
XeroAccountingProvider.createCheckoutForWinner()
  → xero.accountingApi.createInvoices()  // Creates ACCREC invoice
  → xero.accountingApi.getOnlineInvoice()  // Gets hosted URL
  → stores onlineInvoiceUrl in payment_external_refs
```

### Webhook Handler

```typescript
// apps/api/src/routes/xero-webhook.ts
POST /webhooks/xero
  → verifyXeroWebhookSignature()
  → container.accountingProvider.syncInvoiceFromProvider()
    → checks invoice status in Xero
    → if PAID: onInvoicePaid(paymentId) → markCapturedFromProviderSync()
```

### Callback on Payment Captured

```typescript
// apps/api/src/container.ts (line 548-552)
onInvoicePaid callback wired to:
  → PaymentService.markCapturedFromProviderSync(paymentId)
    → payments.updateStatus(paymentId, "captured")
    → dispatchPaymentReceived() // notifications
```

---

## Related Documents

- [Buyer Payment Flow Runbook](../runbooks/buyer-payment-flow.md)
- [Xero + Stripe Payment Setup](../runbooks/xero-stripe-payment-setup.md)
- [Xero Token Loss Recovery](../runbooks/xero-token-loss.md)
