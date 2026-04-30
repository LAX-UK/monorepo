# Implementation Plan: Category Hierarchy Integrity

**Branch**: `001-category-hierarchy` | **Date**: 2026-04-28 | **Spec**: `specs/001-category-hierarchy/spec.md`  
**Input**: Feature specification from `/specs/001-category-hierarchy/spec.md`

## Summary

Harden category hierarchy integrity by enforcing parent-child invariants across schema, repository/service validation, and API contracts. The implementation focuses on preventing invalid parent references, rejecting self/circular relationships on writes, and documenting behavior for downstream consumers.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js  
**Primary Dependencies**: Hono, Drizzle ORM, Zod, pnpm/Turbo monorepo tooling  
**Storage**: PostgreSQL 16 via Drizzle schema in `packages/db`  
**Testing**: Vitest (API and package tests)  
**Target Platform**: Backend services in `apps/api`  
**Project Type**: Monorepo web backend + shared packages  
**Performance Goals**: No measurable latency regression on category reads/writes for normal admin usage  
**Constraints**: Preserve existing API compatibility for `GET /categories`; keep delete semantics (`onDelete: set null`)  
**Scale/Scope**: Single feature slice touching categories and dependent validation/docs

## Constitution Check

Gate status against `.specify/memory/constitution.md`:

- **Spec-first compliance**: Pass (spec created before implementation).
- **Domain correctness**: Pass with planned explicit hierarchy invariants.
- **Contract-driven boundaries**: Pass; update docs/contracts where behavior changes.
- **Verifiable by default**: Pass; tests included in tasks.
- **Monorepo consistency**: Pass; scoped to `apps/api`, `packages/db`, `packages/validators`, docs.

## Project Structure

### Documentation (this feature)

```text
specs/001-category-hierarchy/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── category-hierarchy.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/api/src/
├── routes/categories.ts
├── services/category.service.ts
└── repositories/drizzle-category.repository.ts

packages/db/src/schema/
└── categories.ts

packages/validators/src/
└── (category validation additions if needed)

docs/
└── openapi.yaml
```

**Structure Decision**: Keep changes in existing API and shared package boundaries; no new top-level modules.

## Implementation Phases

### Phase 0 - Confirm Current Behavior

- Audit current category CRUD surface and identify write paths.
- Determine where to enforce self/cycle checks (validator vs service vs repository).
- Confirm DB migration needs (likely none for FK, possible check constraint migration).

### Phase 1 - Design And Contracts

- Define final invariants: valid parent reference, no self-parent, no cycles.
- Document behavior for invalid/legacy rows and API response guarantees.
- Update or annotate contract docs in `docs/openapi.yaml` and feature contract notes.

### Phase 2 - Execution

- Implement validation/guard logic in selected write path(s).
- Ensure list/read paths never expose unresolved parent references.
- Add/adjust tests for positive and negative hierarchy scenarios.
- Update docs and feature artifacts.

## Risks And Mitigations

- **Risk**: Hidden write paths bypass new checks.  
  **Mitigation**: centralize validation in service/repository boundaries and add regression tests.

- **Risk**: Legacy data may violate stricter invariants.  
  **Mitigation**: document cleanup strategy and fail safely with clear errors.

- **Risk**: Over-constraining category updates could block valid admin operations.  
  **Mitigation**: include practical update scenarios in tests and quickstart validation.

## Verification Strategy

- Run targeted tests for category repository/service/routes.
- Run workspace checks relevant to touched modules:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
