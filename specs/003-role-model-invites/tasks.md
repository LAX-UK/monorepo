# Tasks: Role Model And Invitations (V1)

**Input**: Design documents from `/specs/003-role-model-invites/`  
**Prerequisites**: `plan.md`, `spec.md`

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Create role/invite feature notes: `role-migration-notes.md` and `invite-contract.md`.
- [ ] T002 Map current role usage and touchpoints in API, web, auth, and DB packages.
- [ ] T003 [P] Define migration/backfill strategy for existing users to V1 role model.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T004 Add role model updates in shared types/auth packages (`packages/types`, `packages/auth`).
- [ ] T005 [P] Add/adjust DB schema and migrations for role support and invitation persistence.
- [ ] T006 [P] Add validators/schemas for invitation create/accept and role assignment.
- [ ] T007 Introduce invitation service interfaces and repository contracts.
- [ ] T008 Implement centralized role-policy guard abstractions in API middleware/services.

**Checkpoint**: Core role/invite primitives exist and are reusable by routes/UI.

---

## Phase 3: User Story 1 - Enforce V1 Role Access (P1) 🎯 MVP

**Goal**: Enforce administrator/accountant/client authorization matrix.

**Independent Test**: Protected actions allow/deny correctly by role.

- [ ] T009 [P] [US1] Add authz middleware/service tests for admin/accountant/client matrix.
- [ ] T010 [US1] Update API route guards for finance-only accountant access.
- [ ] T011 [US1] Align web admin navigation and page guards with new role policy.

---

## Phase 4: User Story 2 - Role-Based Invitations (P1)

**Goal**: Admin invites staff/clients with role assignment and token lifecycle.

**Independent Test**: Admin can create invite, invitee can accept, account role matches invite target.

- [ ] T012 [P] [US2] Add invitation API contract tests (create/accept/expire/reuse).
- [ ] T013 [US2] Implement invite create/accept routes and service logic.
- [ ] T014 [US2] Add admin invite UI flow and status feedback.
- [ ] T015 [US2] Add invitation audit logging and reporting hooks.

---

## Phase 5: User Story 3 - One Client Identity For Buy/Sell (P2)

**Goal**: Maintain one-account buyer/seller behavior; admin-driven catalogue artist assignment on submission approval (`{ artistId } | { newArtist }`) with later admin override on `lot.artist_id` via `<ArtistPicker />`.

**Independent Test**: Same client account can submit and bid in allowed contexts; submission approval and admin lot edit both resolve to a canonical `artist_profile`.

- [ ] T016 [P] [US3] Add tests covering admin-driven artist resolution at submission approve (existing `artistId`, inline `newArtist`, missing-decision rejection).
- [ ] T017 [US3] Implement/align admin override of `lot.artist_id` on the admin lot edit screen via the shared `<ArtistPicker />`.
- [ ] T018 [US3] Validate no regressions in own-lot bidding restrictions and existing buyer guardrails.

---

## Phase 6: User Story 4 - V1 English-Only Exposure (P2)

**Goal**: Keep V1 user-facing strategy exposure English-only.

**Independent Test**: Creation/configuration UI/API only expose English in V1 flows.

- [ ] T019 [P] [US4] Add tests ensuring non-English strategy options are hidden/blocked in V1 paths.
- [ ] T020 [US4] Enforce English-only strategy gating in web admin creation/edit flows.
- [ ] T021 [US4] Enforce API-side validation for V1 strategy policy where applicable.

---

## Phase N: Polish & Cross-Cutting Concerns

- [ ] T022 [P] Documentation updates in `docs/` and `specs/`.
- [ ] T023 Code cleanup and refactoring.
- [ ] T024 SOLID review pass (SRP/OCP/LSP/ISP/DIP) across touched modules.
- [ ] T025 Security and audit pass for invitation and role escalation risks.
- [ ] T026 Run lint/typecheck/test validations for touched packages.
