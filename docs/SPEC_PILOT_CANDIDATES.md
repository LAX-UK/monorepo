# Spec-Driven Pilot Candidates

This document proposes candidate first pilots for Spec Kit workflow adoption.

Source context: `docs/SYSTEM_ANALYSIS.md` known gaps and current architecture.

## Candidate Options

## 1) Category Hierarchy Integrity (Recommended First Pilot)

Goal:

- Confirm and implement category hierarchy integrity rules (for example, `category.parent_id` relationship and validation behavior).

Why this is a strong first pilot:

- Narrow scope with low operational risk.
- Limited blast radius compared to payments or bidding lifecycle changes.
- Good fit for end-to-end spec flow: schema/validation/API/docs/tests.

Likely touchpoints:

- `packages/db/src/schema/*`
- `packages/validators/src/*`
- `apps/api/src/routes/*` and/or services
- `docs/openapi.yaml` (if contract behavior changes)

## 2) Bid Retraction Flow

Goal:

- Add buyer/admin bid retraction semantics with strict policy controls and audit behavior.

Risk profile:

- Medium to high.
- Directly impacts auction fairness and winner resolution.
- Requires explicit policy and replay/resolution handling.

## 3) Dutch Scheduling Precision

Goal:

- Improve precision of Dutch price decrements (for example, dedicated decrement scheduling behavior).

Risk profile:

- Medium.
- Affects lifecycle timing and realtime expectations.
- Requires careful testing under timing conditions.

## 4) Card Processing Integration

Goal:

- Add card payment gateway path where `clientSecret` and gateway settlement are first-class flows.

Risk profile:

- High.
- Financial and compliance sensitivity.
- Cross-cutting effects across payments, web checkout, and integrations.

## 5) Admin Override Breadth

Goal:

- Expand/adjust admin lot status override capabilities.

Risk profile:

- Medium.
- Can unintentionally bypass lifecycle invariants if under-specified.

## Recommendation

Start with **Category Hierarchy Integrity** as the first pilot.

Reason:

- It exercises full spec -> plan -> tasks -> implement flow without high business or financial risk.
- It creates repeatable patterns for schema + validation + contract alignment that later pilots can reuse.

## Suggested Next Step

Run `/speckit-specify` with a prompt scoped to category hierarchy behavior, explicit in-scope and out-of-scope boundaries, and measurable acceptance criteria.
