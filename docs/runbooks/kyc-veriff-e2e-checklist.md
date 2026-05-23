# Veriff KYC — manual E2E checklist (test.lax.bid)

Use this checklist before promoting Veriff KYC to production. Run against the **test** environment with Veriff Test integration webhooks configured.

## Prerequisites

- [ ] Migration `0069_kyc_veriff` applied on test database
- [ ] GitHub secrets `VERIFF_API_KEY` + `VERIFF_SHARED_SECRET` set in **test** environment
- [ ] Veriff Test integration webhooks point to:
  - `POST https://api.test.lax.bid/webhooks/veriff/decision` (required)
  - `POST https://api.test.lax.bid/webhooks/veriff/event` (optional UX progress)
- [ ] Obsolete Stripe Identity webhook removed from Stripe Dashboard (Connect webhooks unchanged)

## 1. Session creation and InContext flow

- [ ] Log in as a buyer with `kycStatus` unverified and exposure below threshold
- [ ] Open `/dashboard/verify-identity` — status panel shows **Not verified**
- [ ] Start verification — Veriff InContext opens (or redirect fallback)
- [ ] Complete Veriff test flow — return URL includes `?kyc=complete`
- [ ] Page shows **submitted** phase without manual refresh
- [ ] After decision webhook: status moves to **In review** then **Verified**

## 2. Decision webhook and progression

- [ ] Veriff decision webhook returns HTTP 200
- [ ] User `kycStatus` becomes `approved` in admin user detail
- [ ] Sole-trader legal entity in `lead` progresses after approval (if applicable)
- [ ] `CompleteRegistration` marketing event staged (check admin marketing replay if needed)

## 3. Threshold gate (bidding)

- [ ] User below threshold can bid without full approval (if exposure allows)
- [ ] User at/above threshold sees verify CTA on lot bid panel (desktop callout + mobile sticky bar)
- [ ] Verify links include `?next=` back to the lot page
- [ ] API bid rejection `kyc_required` shows verify link with `?next=`
- [ ] After approval, threshold-blocked bids succeed

## 4. Hard-approved gate (non-bid flows)

- [ ] Saleroom registration blocked until `kycStatus === approved`
- [ ] Condition report request blocked until approved
- [ ] Org onboarding identity step: submit disabled until approved; `?kyc=complete` shows submitted phase

## 5. Edge cases

- [ ] Approved user cannot start new session (API 409 `kyc_already_approved`)
- [ ] Late declined decision webhook does **not** downgrade approved user
- [ ] Webhook retry after successful decision still returns 200 (progression best-effort)
- [ ] Invalid webhook payload returns 400 (not 500)

## 6. Admin and dashboard

- [ ] Dashboard attention list shows KYC items with threshold copy when `requiresKyc`
- [ ] Admin KYC badges: **In review**, **Rejected**, **Not verified** (aligned with user labels)
- [ ] Stale KYC sessions appear on onboarding issues board when >48h in non-terminal state

## Sign-off

| Role | Name | Date | Pass |
|------|------|------|------|
| Engineering | | | |
| Operations | | | |
