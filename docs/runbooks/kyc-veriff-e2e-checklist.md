# Veriff KYC — manual E2E checklist (test.lax.bid)

Use this checklist before promoting Veriff KYC to production. Run against the **test** environment with Veriff Test integration webhooks configured.

## Prerequisites

- [ ] Migration `0069_kyc_veriff` applied on test database
- [ ] Migration `0070_notification_kyc_type` applied on test database (`kyc_resubmission_required` notification type)
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
- [ ] User in **pending / in review** cannot start a new session — launcher hidden/disabled while panel shows **In review**

## 2. Decision webhook and progression

- [ ] Veriff decision webhook returns HTTP 200
- [ ] User `kycStatus` becomes `approved` in admin user detail
- [ ] Sole-trader legal entity in `lead` progresses after approval (if applicable)
- [ ] `CompleteRegistration` marketing event staged (check admin marketing replay if needed)

## 3. Resubmission feedback, email, and in-app notification

- [ ] Trigger Veriff **resubmission_requested** decision (e.g. reason code 201–622)
- [ ] `GET /kyc/status` returns `feedback` with headline, detail, `action: continue`, `needsResubmit: true`
- [ ] Verify-identity panel and lot threshold callout show Veriff reason detail (not generic copy)
- [ ] Transactional email **kyc-resubmission-required** enqueued with issue detail + verify link
- [ ] In-app notification row type `kyc_resubmission_required` created (title matches feedback headline)
- [ ] Re-delivering the **same** decision webhook (same session + attemptId) does **not** send duplicate email/notification
- [ ] `POST /kyc/session` reuses the same Veriff session URL for `requires_input` (not reason code 539)
- [ ] Reason code **539** (resubmission limit): feedback tells user to start new verification; `POST /kyc/session` creates a **new** session (does not reuse old URL)

## 4. Threshold gate (bidding)

- [ ] User below threshold can bid without full approval (if exposure allows)
- [ ] User at/above threshold sees verify CTA on lot bid panel (desktop callout + mobile sticky bar)
- [ ] Mobile sticky bar shows compact KYC CTA when bid card is in view and user is threshold-blocked
- [ ] Verify links include `?next=` back to the lot page
- [ ] API bid rejection `kyc_required` shows verify link with feedback detail when available
- [ ] After approval, threshold-blocked bids succeed

## 5. Hard-approved gate (non-bid flows)

- [ ] Saleroom registration blocked until `kycStatus === approved`; CTA shows Veriff feedback detail when pending/resubmit/rejected
- [ ] Condition report request blocked until approved; CTA shows Veriff feedback detail when available
- [ ] Org onboarding identity step: submit disabled until approved; `?kyc=complete` shows submitted phase

## 6. Edge cases

- [ ] Approved user cannot start new session (API 409 `kyc_already_approved`)
- [ ] Late declined decision webhook does **not** downgrade approved user
- [ ] Webhook retry after successful decision still returns 200 (progression best-effort)
- [ ] Invalid webhook payload returns 400 (not 500)

## 7. Admin and dashboard

- [ ] Dashboard attention list shows KYC items with threshold copy when `requiresKyc`
- [ ] Admin KYC badges: **In review**, **Rejected**, **Not verified** (aligned with user labels)
- [ ] Stale KYC sessions appear on onboarding issues board when >48h in non-terminal state

## Sign-off

| Role | Name | Date | Pass |
|------|------|------|------|
| Engineering | | | |
| Operations | | | |
