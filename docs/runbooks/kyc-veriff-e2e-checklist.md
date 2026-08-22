# Veriff KYC — manual E2E checklist (test.lax.bid)

Use this checklist before promoting Veriff KYC to production. Run against the **test** environment with Veriff Test integration webhooks configured.

## Prerequisites

- [ ] Migration `0069_kyc_veriff` applied on test database
- [ ] Migration `0070_notification_kyc_type` applied on test database (`kyc_resubmission_required` notification type)
- [ ] GitHub secrets `VERIFF_API_KEY` + `VERIFF_SHARED_SECRET` set in **test** environment
- [ ] Veriff Test integration webhooks point to:
  - `POST https://api.test.lax.bid/webhooks/veriff/decision` (required)
  - `POST https://api.test.lax.bid/webhooks/veriff/event` (optional UX progress)
  - `POST https://api.test.lax.bid/webhooks/veriff/watchlist-screening` (Premium PEP & Sanctions)
- [ ] Migrations `0090_kyc_extraction_fields`, `0091_aml_watchlist_screening`, `0092_admin_review_task_aml_kinds`, `0093_source_of_funds` applied on test database
- [ ] Veriff Premium add-ons enabled: **Data Extraction (10 fields)** + **PEP & Sanctions** with watchlist lists covering the CDD Section 5 set (UK Consolidated Sanctions, OFSI asset freeze, PEP, adverse media)
- [ ] `SOF_THRESHOLD_AMOUNT` / `SOF_THRESHOLD_CURRENCY` confirmed with MLRO/counsel (fixed GBP, no FX)
- [ ] `SOF_APPROVAL_VALIDITY_DAYS` (default 365) confirmed with MLRO for SoF approval re-validation window
- [ ] Obsolete Stripe Identity webhook removed from Stripe Dashboard (Connect webhooks unchanged)
- [ ] `KYC_ONBOARDING_ENABLED` enables the `/onboarding/identity` experience and typed entry URLs; it does **not** force KYC on every login
- [ ] `FULL_BUYER_ONBOARDING_ENABLED` enables the one-time interests → recommendations → optional KYC path for newly verified individuals
  - Docker Compose: set both in the production environment file consumed by `docker-compose.prod.yml`
  - Terraform: apply both flags as false initially; they are web-only runtime switches
- [ ] `STRICT_BID_ELIGIBILITY_ENABLED` has the same explicit value on API and web
  - Test defaults to `true`; production defaults to `false` for a dark launch
  - Enable production only after migrations, Veriff credentials/webhooks, and the strict-on scenarios below pass; update API and web in one Terraform apply

## 1. Session creation and InContext flow

- [ ] With `FULL_BUYER_ONBOARDING_ENABLED=true`, a newly verified individual completes interests → recommendations (or skips recommendations when no active lot exists) → optional KYC; abandoned interests resume on login until submitted
- [ ] With `KYC_ONBOARDING_ENABLED=true`, a newly verified individual reaches `/onboarding/identity` after optional personalization; staff, consumed invitations, and organisation users retain their existing destinations
- [ ] Normal login by an email-verified unapproved individual reaches the originally requested safe destination; KYC is not forced on every login
- [ ] Restricted actions (bid, registration, telephone, and threshold-gated condition report) route to `/onboarding/identity` with the attempted action preserved in `next`
- [ ] Approved, staff, organisation, suspended, and email-unverified accounts retain their existing post-login destinations
- [ ] Why verify → Get ready → Verify preserves a safe `next` destination
- [ ] Skip / Finish later returns to `next`; dashboard shows a proactive resume prompt to an unapproved individual
- [ ] With `KYC_ONBOARDING_ENABLED=false`, post-verify, post-login, and dashboard behavior match the previous release while `/dashboard/verify-identity` and threshold enforcement remain available
- [ ] Log in as a buyer with `kycStatus` unverified and exposure below threshold
- [ ] Open `/dashboard/verify-identity` — status panel shows **Not verified**
- [ ] Start verification — Veriff InContext opens (or redirect fallback)
- [ ] Complete Veriff test flow — return URL includes `?kyc=complete`
- [ ] Page shows **submitted** phase without manual refresh
- [ ] After decision webhook: status moves to **In review** then **Verified**
- [ ] User in **pending / in review** (session `processing`) cannot start a new session — launcher hidden/disabled while panel shows **In review**
- [ ] Start Veriff → close modal (X) or leave site without submitting → return → panel shows **Verification started**, **Continue verification** button works and reopens the same session URL
- [ ] Dashboard **Account readiness** strip Identity pill shows **Started** (not In review), matching verify page
- [ ] After true submit: strip shows **In review**; launcher hidden/disabled

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

- [ ] With `STRICT_BID_ELIGIBILITY_ENABLED=false`, threshold behavior below is unchanged
- [ ] User below threshold can bid without full approval (if exposure allows)
- [ ] User at/above threshold sees verify CTA on lot bid panel (desktop callout + mobile sticky bar)
- [ ] Mobile sticky bar shows compact KYC CTA when bid card is in view and user is threshold-blocked
- [ ] Verify links include `?next=` back to the lot page
- [ ] API bid rejection `kyc_required` shows verify link with feedback detail when available
- [ ] After approval, threshold-blocked bids succeed

### Strict self-service bid eligibility

- [ ] With `STRICT_BID_ELIGIBILITY_ENABLED=true`, an unverified email sees **Email verification required** before KYC state
- [ ] **Send verification email** reports success/failure and returns to the same lot
- [ ] Email-verified users with non-approved KYC see identity-approval copy
- [ ] Identity links preserve `next`, `source=bid_gate`, and lot id
- [ ] Manual, auto, full/compact sticky, and video-compact surfaces expose no enabled bid action while blocked
- [ ] Structured `email_not_verified` and `kyc_required` API errors show matching recovery controls
- [ ] An email-verified, KYC-approved user can bid
- [ ] Organisation `admin`, `finance`, `owner`, and `buyer_agent` members are blocked unless the acting user has verified email and approved personal KYC
- [ ] `connect_pending` organisations remain bid-eligible when the actor is approved; unfinished Stripe Connect does not block buying

## 5. Non-bid KYC gates

- [ ] Saleroom registration blocked until `kycStatus === approved`; CTA shows Veriff feedback detail when pending/resubmit/rejected
- [ ] Condition report request remains threshold-gated when strict bidding is on; above-threshold unapproved users see the KYC CTA, while below-threshold behavior is unchanged
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
- [ ] Admin KYC history panel surfaces new extraction fields (gender, nationality, place of birth, document validity, risk score / IP country)

## 8. Watchlist screening (PEP & Sanctions)

- [ ] Watchlist-screening webhook with **no match** returns 200; no AML hold set; subject enrolled into ongoing monitoring
- [ ] Webhook with a **possible match / PEP / adverse media** sets `aml_hold_status = hold` and creates an `aml_screening_review` task
- [ ] Webhook with a **confirmed sanctions / OFSI** match sets `aml_hold_status = blocked`
- [ ] Re-delivering the **same** watchlist payload does not double-process (content-hash idempotency)
- [ ] Invalid / unsigned watchlist payload returns 400 / 401 (not 500)
- [ ] An MLRO escalation email (`aml-compliance-review-notice`) is enqueued to compliance recipients (idempotent per screening + recipient)
- [ ] MLRO (`compliance_officer`) sees pending screenings at `GET /admin/compliance/aml/screenings`
- [ ] **Two-stage maker-checker**: analyst triages via `POST /admin/compliance/aml/screenings/:id/triage` (no hold change); MLRO decides via `POST /admin/compliance/aml/screenings/:id/decide`
- [ ] MLRO **clear** (decide) lifts the hold and re-enrolls monitoring; **block** is terminal
- [ ] `decide` without a prior triage → 409 `aml_triage_required`; same user triaging then deciding → 403 `aml_review_same_as_triager`
- [ ] A user cannot triage/decide their **own** screening (403 `aml_triage_self_forbidden` / `aml_review_self_forbidden`)

## 9. Settlement gate + Source of Funds

- [ ] Winning a lot while on an AML hold blocks checkout with reason `aml_hold` (payment `requires_manual_review`)
- [ ] Reaching `SOF_THRESHOLD_AMOUNT` (single or aggregated linked transactions) blocks checkout with reason `source_of_funds_required`
- [ ] A `source_of_funds` case is opened (`pending`), a `source_of_funds_review` admin task is raised, and an MLRO escalation email is enqueued (idempotent)
- [ ] **Two-stage maker-checker**: analyst triages via `POST /admin/compliance/source-of-funds/:id/triage`; MLRO/finance decides via `POST /admin/compliance/source-of-funds/:id/decide`; buyer can then re-initiate checkout
- [ ] A **rejected** SoF case keeps blocking and is **not** reopened on checkout retries (no case/task churn)
- [ ] An **approved** case re-triggers SoF once exposure grows by another full threshold or after `SOF_APPROVAL_VALIDITY_DAYS`
- [ ] A user cannot triage/decide their **own** SoF case (403 `source_of_funds_triage_self_forbidden` / `source_of_funds_review_self_forbidden`); `decide` without triage → 409 `source_of_funds_triage_required`

## 10. Onboarding rollout, monitoring, and rollback

- [ ] Record the pre-launch registration → KYC session created → submitted → approved baseline
- [ ] Enable the flag for internal/test accounts; verify no increase in session-start or webhook failures
- [ ] Confirm analytics contain only step/source/event metadata—no user IDs, provider URLs, tokens, document data, or other PII
- [ ] Monitor onboarding views, skips, recommendation continues, contextual gate triggers/returns, Veriff cancel/reload, session creation, submission, approval, decision latency, and support reports
- [ ] Expand to all eligible users only after the internal cohort passes the checks above
- [ ] Configuration rollback: set `FULL_BUYER_ONBOARDING_ENABLED=false` first, then `KYC_ONBOARDING_ENABLED=false`, redeploy/restart web, then verify old post-verify and dashboard behavior
- [ ] Code rollback is required only if shared routing, KYC launcher behavior, threshold enforcement, or webhook processing regresses

## Sign-off

| Role        | Name | Date | Pass |
| ----------- | ---- | ---- | ---- |
| Engineering |      |      |      |
| Operations  |      |      |      |
