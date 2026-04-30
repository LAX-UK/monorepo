# Tasks: Category Hierarchy Integrity

**Input**: Design documents from `/specs/001-category-hierarchy/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/category-hierarchy.md`

## Phase 1: Setup (Shared Context)

- [x] T001 [US1] Validate existing category read/write paths and record affected files in `specs/001-category-hierarchy/research.md`
- [x] T002 [US1] Align contract notes in `specs/001-category-hierarchy/contracts/category-hierarchy.md` and link expected API behavior

---

## Phase 2: Foundational (Blocking)

- [x] T003 [US1] Add/confirm category parent integrity constraints in `packages/db/src/schema/categories.ts`
- [x] T004 [US1] Add category hierarchy validator (self-parent and circular checks) in `packages/validators/src` (new `category.ts` if needed) and export via `packages/validators/src/index.ts`
- [x] T005 [US1] Wire hierarchy validation into category write path(s) in `apps/api/src/services/category.service.ts` and repository boundary

**Checkpoint**: No invalid parent links can be written through supported code paths.

---

## Phase 3: User Story 1 - Prevent Invalid Category Parents (P1)

**Goal**: Reject non-existent, self-parent, and circular category assignments.

**Independent Test**: Category write operations reject invalid hierarchy links with deterministic errors.

- [x] T006 [P] [US1] Add unit tests for category validation logic (new test file near validator/service)
- [x] T007 [US1] Update repository/service logic in `apps/api/src/repositories/drizzle-category.repository.ts` and `apps/api/src/services/category.service.ts` to enforce validation
- [x] T008 [US1] Add/adjust API error mapping in `apps/api/src/routes/categories.ts` if write endpoints are present or introduced

---

## Phase 4: User Story 2 - Serve Stable Category Trees (P2)

**Goal**: Ensure `GET /categories` never returns unresolved hierarchy references.

**Independent Test**: Category list response always contains `parentId = null` or valid category id.

- [x] T009 [P] [US2] Add route/service tests around `GET /categories` behavior in `apps/api/src/routes` or existing API test suites
- [x] T010 [US2] Harden list mapping in `apps/api/src/repositories/drizzle-category.repository.ts` for deterministic handling of legacy anomalies
- [x] T011 [US2] Validate consumer compatibility in lot/sale/submission tests where category assumptions exist

---

## Phase 5: User Story 3 - Document Category Invariants (P3)

**Goal**: Make hierarchy rules explicit for future feature work.

**Independent Test**: Contract/docs and feature artifacts clearly state allowed hierarchy rules and error behavior.

- [x] T012 [US3] Update `docs/openapi.yaml` category endpoint descriptions/responses for hierarchy constraints (if API surface changes)
- [x] T013 [US3] Update `docs/SYSTEM_ANALYSIS.md` known gap resolution note for category hierarchy
- [x] T014 [US3] Refresh `specs/001-category-hierarchy/quickstart.md` verification steps to include hierarchy checks

---

## Phase 6: Validation And Polish

- [x] T015 Run targeted tests for touched API/category modules
- [x] T016 Run `pnpm lint`, `pnpm typecheck`, and `pnpm test`
- [x] T017 Confirm spec-plan-task traceability and close open assumptions
