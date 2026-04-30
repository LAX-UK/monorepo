# Tasks: V1 Product Rules

**Input**: Design documents from `/specs/002-v1-product-rules/`  
**Prerequisites**: `spec.md`, `plan.md`

## Phase 1: Policy Documentation Baseline

- [ ] T001 Create and finalize `docs/V1_PRODUCT_SPEC.md` as V1 target source of truth.
- [ ] T002 Update `docs/SYSTEM_ANALYSIS.md` to label current-state scope and link V1 target spec.
- [ ] T003 Add `docs/V1_PRODUCT_SPEC.md` to `.specify/memory/constitution.md` normative sources.

---

## Phase 2: Feature Spec Packaging

- [ ] T004 Create `specs/002-v1-product-rules/spec.md` with user stories and acceptance criteria.
- [ ] T005 Create `specs/002-v1-product-rules/plan.md` with implementation scope and known gaps.
- [ ] T006 Create `specs/002-v1-product-rules/tasks.md` with rollout checklist.
- [ ] T007 Create supporting notes:
  - `specs/002-v1-product-rules/role-matrix.md`
  - `specs/002-v1-product-rules/auction-policy.md`
  - `specs/002-v1-product-rules/invite-flow.md`

---

## Phase 3: Consistency And Readiness Review

- [ ] T008 Cross-check role definitions between V1 product spec and existing analysis docs.
- [ ] T009 Cross-check English-only and sale-mode policy statements for consistency.
- [ ] T010 Document explicit current-vs-target implementation gaps for future engineering specs.
- [ ] T011 Run diagnostics/lint checks on touched files and resolve introduced issues.

---

## Future Implementation Follow-Up (Out Of Scope Here)

- [ ] T012 Create implementation feature spec for role model updates (accountant support and authz matrix).
- [ ] T013 Create implementation feature spec for invitation workflow.
- [ ] T014 Create implementation feature spec for V1 strategy gating (English-only exposure).
- [ ] T015 Create implementation feature spec for onsite engagement behavior parity (backend/frontend).
