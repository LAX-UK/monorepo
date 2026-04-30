# Implementation Plan: Role Model And Invitations (V1)

**Branch**: `003-role-model-invites` | **Date**: 2026-04-28 | **Spec**: `specs/003-role-model-invites/spec.md`  
**Input**: Feature specification from `/specs/003-role-model-invites/spec.md`

## Summary

Implement V1 role model (`administrator`, `accountant`, `client`) and role-based invitation workflow while preserving one-account buyer/seller client behavior. This feature also gates V1 product flows to English-only strategy exposure.

## Technical Context

**Language/Version**: TypeScript (Node.js, Next.js)  
**Primary Dependencies**: Better Auth, Hono, Drizzle, Zod, pnpm/turbo  
**Storage**: PostgreSQL via `packages/db`  
**Testing**: Vitest + lint/typecheck in touched packages  
**Target Platform**: `apps/api`, `apps/web`, `packages/auth`, `packages/types`, `packages/validators`, `packages/db`  
**Project Type**: Brownfield monorepo enhancement  
**Performance Goals**: No significant authz overhead; maintain current request latency profile  
**Constraints**: Preserve existing domain invariants and online/onsite policy  
**Scale/Scope**: Role/authz + invitation + V1 strategy exposure gating

## Constitution Check

- Spec-first and contract-driven: pass.
- Domain correctness: pass if role/invite changes do not break auction invariants.
- Verifiable by default: pass with route/service/authz + invitation tests.
- Monorepo consistency: pass by keeping changes in package boundaries.
- SOLID by default: required and tracked below.

## SOLID Compliance Check

- **S (Single Responsibility)**: isolate invitation service, role-policy service, and route guards.
- **O (Open/Closed)**: extend role checks with policy map/strategy instead of route-by-route hardcoding.
- **L (Liskov Substitution)**: maintain interface-compatible authz/invitation adapters in tests and production.
- **I (Interface Segregation)**: split finance-access interfaces from global admin and client capabilities.
- **D (Dependency Inversion)**: high-level services depend on role/invite abstractions, injected repositories/providers.

## Project Structure

### Documentation (this feature)

```text
specs/003-role-model-invites/
├── spec.md
├── plan.md
├── tasks.md
├── role-migration-notes.md
└── invite-contract.md
```

### Source Code (repository root)

```text
packages/types/src/
packages/auth/src/
packages/validators/src/
packages/db/src/schema/
packages/db/drizzle/

apps/api/src/middleware/
apps/api/src/routes/
apps/api/src/services/
apps/api/src/repositories/

apps/web/src/lib/
apps/web/src/components/
apps/web/src/app/
```

**Structure Decision**: implement role and invite domain logic in shared/auth packages first, then enforce via API middleware/routes, then align web UI exposure and admin flows.

## Complexity Tracking

|Violation|Why Needed|Simpler Alternative Rejected Because|
|---|---|---|
|None expected initially|N/A|N/A|
