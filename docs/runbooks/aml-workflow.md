# AML operational workflow (UK MLR 2017 alignment)

This runbook describes **operator steps** for KYC / KYB on the platform. It is **not** legal advice — counsel must approve thresholds and retention.

## Roles

| Role | Responsibility |
|------|------------------|
| **MLRO / Compliance officer** (`compliance_officer` staff role) | Reviews flagged watchlist screenings and Source-of-Funds cases; final clear/block; SAR decisions. Holds `aml.review` + `compliance.mlro` capabilities. |
| **Ops reviewer** | Day-to-day queue (`requires_manual_review`, Veriff resubmission / review) |
| **Engineering** | Maintains audit logs, access controls, data exports |

Three-lines-of-defence: AML capabilities live on a **dedicated** `compliance_officer` role, not bundled into money-path roles (`finance_ops`, `auction_manager`).

**Two-stage maker–checker (enforced in code).** Disposition is split into a *triage* (maker) and a *decision* (checker):

- **Triage** (`aml.review` → `AML_REVIEW_ACCESS`): a first-line analyst records an advisory recommendation (`recommend_clear`/`recommend_block`, or `recommend_approve`/`recommend_reject` for SoF). Triage does **not** change the hold or case status.
- **Decision** (`compliance.mlro` → `MLRO_DECISION_ACCESS`): the MLRO makes the binding clear/block (or approve/reject) call.

The service enforces three distinct users: the **subject** ≠ the **triager** ≠ the **decider**, and a decision requires a prior triage (`aml_triage_required` / `source_of_funds_triage_required`; same-user attempts → `aml_review_same_as_triager` / `source_of_funds_review_same_as_triager`). `compliance_officer` holds both capabilities, so any two distinct compliance officers can complete the flow; a fresh provider result clears prior triage so it must be re-triaged.

## Customer due diligence (CDD)

1. **Registration** — collect legal name, address, contact; tie activity to `legal_entity` + `user`.
2. **Identity (buyers)** — Veriff IDV when `KYC_THRESHOLD_AMOUNT` / currency exceeded (`apps/api` KYC services).
3. **Organisation KYB** — document upload + admin review per organisation onboarding flow.

## Sanctions / PEP / adverse-media screening (CDD Section 5)

Screening rides the Veriff Premium **PEP & Sanctions** add-on and runs at **two moments**: at onboarding (the verified session is screened) and again **prior to settlement** (the settlement gate re-checks the AML hold).

Pipeline (event-driven, idempotent — see `apps/api/src/services/aml/`):

1. **Ingest** — Veriff posts to `POST /webhooks/veriff/watchlist-screening`. The route verifies HMAC, claims idempotency (`tryClaimProcessedWebhookEvent`, content-hashed so genuine monitoring updates still apply), persists `kyc_watchlist_screening`, and publishes domain events in the same transaction.
2. **Decide** — a pure policy (`DefaultAmlDecisionPolicy`) maps `(matchStatus, categories, hits) → clear | review | block`:
   - `clear` → no hold; subject enrolled into ongoing monitoring.
   - `review` (possible match / PEP / adverse media) → **soft hold** (`user.aml_hold_status = hold`): blocks settlement, escalates to MLRO; account otherwise usable (**bidding allowed**).
   - `block` (confirmed sanctions / OFSI) → **hard block** (`aml_hold_status = blocked`): freeze + OFSI reporting path; **bidding blocked** (`aml_blocked` on `POST /bids` and `PUT /lots/:id/auto-bid`).
3. **Escalate** — the worker projector `processAmlMatchReview` consumes `aml.match_flagged`, creates an `admin_review_task` of kind `aml_screening_review` (idempotent per screening id), **and** enqueues an MLRO escalation email (`aml-compliance-review-notice`) to compliance recipients (`listComplianceRecipients` → `compliance_officer` + `super_admin`; falls back to `ADMIN_EMAIL_ADDRESS`). The email is idempotent (`idempotencyKey` per screening + recipient), so retries never double-send.
4. **Triage then decide (two-stage)** — analyst triages via `POST /admin/compliance/aml/screenings/:id/triage`; the MLRO finalises via `POST /admin/compliance/aml/screenings/:id/decide`. Clearing lifts the hold and re-enrolls monitoring; blocking is terminal.

## Ongoing monitoring

- Cleared subjects are enrolled into Veriff ongoing monitoring (outbound PATCH, best-effort). Monitoring updates arrive on the **same** `watchlist-screening` webhook and re-run the pipeline, so a newly-listed person is automatically re-flagged and re-held.
- Re-screen entities when **beneficial ownership** changes (admin membership edits).
- **Reliance on perpetual monitoring**: the pre-settlement gate reads the persisted AML hold rather than forcing a fresh re-screen at settlement. This is sound *because* monitoring is perpetual — a new list hit re-flags and re-holds the subject before settlement can proceed. If ongoing monitoring is ever disabled, add an explicit staleness re-screen at the gate.

## Escalation to human review

Triggers:

- Identity session `requires_input` repeatedly.
- Mismatch between document name and legal entity name.
- **Sanctions / PEP / adverse-media match** → AML hold set automatically; settlement **halted** pending four-eyes MLRO review. Operators may never proceed past an unresolved flag.

## Pre-settlement gate (CDD Section 5 "prior to settlement")

`createPendingForWinner` consults `ISettlementCompliancePolicy` before issuing checkout. It reuses the existing `requires_manual_review` payment status + `payment.requires_manual_review` event rather than a parallel flow. Settlement is halted (with `ManualReviewReason`):

- `aml_hold` — buyer is on an AML/sanctions hold (screening `review`/`block`).
- `source_of_funds_required` — SoF threshold crossed without an approved case.

The block clears automatically once the MLRO lifts the hold / approves the SoF case; the buyer can then re-initiate checkout.

## Source of Funds (CDD Section 6)

For transactions at/above `SOF_THRESHOLD_AMOUNT` (a **fixed GBP** figure — no FX — per the 2026 sterling-threshold amendment) or where a risk indicator is present, SoF must be documented (bank statements, payroll, sale proceeds, inheritance/estate docs).

- **Aggregation**: the gate sums a buyer's in-flight + settled payments (`sumActiveBuyerSettlementPence`) plus the current transaction, so **linked/structured** transactions count toward the threshold, not just a single lot. When re-evaluating an **existing** payment (manual-review release or checkout retry), pass `excludePaymentId` so that payment is not counted twice in the linked sum.
- **Admin tasks**: `source_of_funds_review` / `aml_screening_review` tasks are created on first escalation. The worker projector `processSourceOfFundsReviewResolution` auto-resolves `source_of_funds_review` tasks when the MLRO decides (`source_of_funds.reviewed`). AML screening task resolution is not automated yet — use the compliance queues as the system of record until that lifecycle is wired.
- **Case lifecycle**: opening the gate creates a `source_of_funds` case (`pending`), publishes `source_of_funds.required`, and the worker projector `processSourceOfFundsReview` raises a `source_of_funds_review` admin task **and** enqueues an MLRO escalation email (same idempotent pattern as screening matches).
- **No churn**: a `rejected` case keeps blocking settlement and is **not** auto-reopened on checkout retries; re-opening is a deliberate compliance action.
- **Event-driven validity** (not "approved forever"): an `approved` case clears future settlements only until (a) the buyer's aggregated exposure grows by another full threshold beyond the approved exposure, or (b) the approval is older than `SOF_APPROVAL_VALIDITY_DAYS` (default 365). Either condition re-opens a fresh `pending` case. New screening hits are handled by the AML hold gate (evaluated before the SoF gate), so they need no separate SoF re-trigger.
- **Triage then decide (two-stage)**: analyst triages via `POST /admin/compliance/source-of-funds/:id/triage`; MLRO/finance finalises via `POST /admin/compliance/source-of-funds/:id/decide`. An `approved` case satisfies the settlement gate (subject to validity above). After triage, the admin UI shows **Awaiting MLRO decision** (distinct from untriaged **Pending review**); recently approved cases are visible on the Source of Funds page.
- **Evidence**: documents reuse the `upload-objects` pipeline as a sensitive class — access restricted to `compliance.mlro` / `aml.review` / finance, excluded from generic exports, 5-year retention, GDPR Art 17(3)(b) crime-prevention exemption.

## Record retention

- Keep KYC artefacts and decision logs **5 years** after relationship end (typical MLR expectation — confirm with counsel).
- Store Stripe / Postmark correlation IDs in domain events for traceability.

## Suspicious activity

- If structuring or layering suspected: **Compliance lead** files SAR per NCA guidance; **do not** tip off the customer.

## Related

- [Deletion request](./deletion-request.md) — GDPR vs AML retention tension
- [Security threat model](../security/threat-model.md)
