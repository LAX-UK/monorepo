# Implementation Plan: V1 Product Rules

**Branch**: `002-v1-product-rules` | **Date**: 2026-04-28 | **Spec**: `specs/002-v1-product-rules/spec.md`  
**Input**: Feature specification from `/specs/002-v1-product-rules/spec.md`

## Summary

Define and align V1 product policy across docs/specs for roles, identity, invitations, strategy constraints, and sale-mode behavior. This plan documents scope and implementation gaps without applying code changes yet.

## Technical Context

**Language/Version**: TypeScript monorepo (Node.js + Next.js)  
**Primary Dependencies**: Hono, Better Auth, Drizzle, Zod, pnpm/turbo  
**Storage**: PostgreSQL via Drizzle  
**Testing**: Vitest, package lint/typecheck/test workflows  
**Target Platform**: API (`apps/api`), web (`apps/web`), shared packages  
**Project Type**: Brownfield monorepo policy/spec alignment  
**Performance Goals**: N/A for spec-only work  
**Constraints**: Separate current-state analysis from target-state policy  
**Scale/Scope**: Product policy baseline for V1 roadmap

## Constitution Check

- Spec-first workflow: pass.
- Domain correctness: pass, V1 policy explicitly states auction and role constraints.
- Contract-driven boundaries: pass, policy references API/validators/types.
- Verifiability: pass, acceptance criteria and tasks include testability requirements.
- Monorepo consistency: pass, touched artifacts are docs/specs only.

## Project Structure

### Documentation (this feature)

```text
specs/002-v1-product-rules/
├── spec.md
├── plan.md
├── tasks.md
├── role-matrix.md
├── auction-policy.md
└── invite-flow.md
```

### Source And Policy References

```text
docs/
├── V1_PRODUCT_SPEC.md
├── SYSTEM_ANALYSIS.md
└── openapi.yaml

.specify/memory/constitution.md
```

## Delivery Steps

1. Capture confirmed V1 business rules in a single target-state document.
2. Link current-state analysis to target-state policy to avoid ambiguity.
3. Add V1 policy document to constitution normative sources.
4. Create a dedicated feature spec package (`002-v1-product-rules`) for traceable implementation planning.
5. Add supporting notes for role matrix, auction policy, and invitation flow.
6. Review consistency between new policy docs and known implementation gaps.

## Known Gaps (Documented, Not Implemented Here)

- Accountant role may not yet exist as first-class auth role in current code.
- Invitation workflow may be partially or not fully implemented.
- Non-English strategy types exist in schema/code and need V1 gating strategy.
- Onsite non-bid interactions must be consistently enforced and verified across API/UI.

## Verification

- Documentation consistency checks across:
  - `docs/V1_PRODUCT_SPEC.md`
  - `docs/SYSTEM_ANALYSIS.md`
  - `.specify/memory/constitution.md`
  - `specs/002-v1-product-rules/*`
- Lint diagnostics on touched markdown files.
