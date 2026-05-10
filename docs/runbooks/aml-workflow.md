# AML operational workflow (UK MLR 2017 alignment)

This runbook describes **operator steps** for KYC / KYB on the platform. It is **not** legal advice — counsel must approve thresholds and retention.

## Roles

| Role | Responsibility |
|------|------------------|
| **Compliance lead** | Sets thresholds, approves policy changes, SAR decisions |
| **Ops reviewer** | Day-to-day queue (`requires_manual_review`, Stripe Identity fallback) |
| **Engineering** | Maintains audit logs, access controls, data exports |

## Customer due diligence (CDD)

1. **Registration** — collect legal name, address, contact; tie activity to `legal_entity` + `user`.
2. **Identity (buyers)** — Stripe Identity when `KYC_THRESHOLD_AMOUNT` / currency exceeded (`apps/api` KYC services).
3. **Organisation KYB** — document upload + admin review per organisation onboarding flow.

## Ongoing monitoring

- Weekly export of **new high-value bids** over threshold without verified Identity → compliance inbox.
- Re-screen entities when **beneficial ownership** changes (admin membership edits).

## Escalation to human review

Triggers (tune with counsel):

- Identity session `requires_input` repeatedly.
- Mismatch between document name and legal entity name.
- Sanctions / PEP list match (when integrated) — **halt** account pending review.

## Record retention

- Keep KYC artefacts and decision logs **5 years** after relationship end (typical MLR expectation — confirm with counsel).
- Store Stripe / Postmark correlation IDs in domain events for traceability.

## Suspicious activity

- If structuring or layering suspected: **Compliance lead** files SAR per NCA guidance; **do not** tip off the customer.

## Related

- [Deletion request](./deletion-request.md) — GDPR vs AML retention tension
- [Security threat model](../security/threat-model.md)
