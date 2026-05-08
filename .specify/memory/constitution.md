# Auction Constitution

## Core Principles

### I. Spec-First, Then Code

Every non-trivial feature starts with a written specification before implementation. The specification is the source of truth for behavior and acceptance criteria, while implementation is a realization of that spec. Existing canonical project context must be reused instead of rewritten from scratch.

### II. Domain Correctness Is Non-Negotiable

Auction invariants are mandatory across all layers. This includes lot/sale status transitions, auction-type-specific bidding rules, reserve handling, winner resolution, and onsite-vs-online policy constraints. Any change that affects these invariants must explicitly document expected state transitions and failure cases.

### III. Contract-Driven Boundaries

Public behavior must be expressed through stable contracts:

- API contracts in `docs/openapi.yaml`
- Validation and input/output schemas in `packages/validators`
- Shared type boundaries in `packages/types`

Specs and plans must identify contract changes first, then list required code changes.

### IV. Verifiable By Default

Each task must define how correctness is proven before merge. At minimum this includes targeted tests and relevant workspace checks (`lint`, `typecheck`, and `test`) for touched apps/packages. Changes lacking a practical verification path are incomplete.

### V. Monorepo Consistency Over Local Convenience

Changes must respect existing monorepo standards: pnpm workspace boundaries, Turbo task model, Biome formatting/linting, and established package responsibilities (`apps/web`, `apps/api`, `apps/ws`, and `packages/*`). Do not duplicate logic across apps when shared packages can own it.

### VI. SOLID By Default

All implementation plans and code changes must apply SOLID principles unless a documented exception is approved:

- **Single Responsibility**: modules and services should have one clear reason to change.
- **Open/Closed**: extend behavior through composition/strategy/polymorphism before modifying stable core flows.
- **Liskov Substitution**: implementations must preserve contract expectations across interfaces and strategy families.
- **Interface Segregation**: avoid broad interfaces; expose narrowly scoped dependencies.
- **Dependency Inversion**: depend on abstractions at service boundaries and inject concrete adapters.

If a feature intentionally violates a SOLID principle for pragmatic reasons, the plan must record why and what simpler alternative was rejected.

### VII. Web UI Reuse And Form Standards

Any feature that ships or changes user-facing UI in `apps/web` MUST:

- Reuse **shadcn-compatible primitives** from `@auction/ui` (and established app wrappers) before introducing bespoke controls. Follow `docs/DESIGN_SYSTEM.md` for tokens, layout, accessibility, and dark mode.
- Implement **non-trivial forms** with **React Hook Form** for client state and submission orchestration, and **Zod** (or existing shared validators in `packages/validators` where appropriate) for input validation and typed defaults. Follow `docs/FORMS.md` for server actions, action/result patterns, and error handling.
- **Imperative toasts** in `apps/web` MUST use `{ notify }` from `@/lib/ui/notify`; do not import `sonner` directly (enforced by a Vitest contract test). See `docs/DESIGN_SYSTEM.md` (Toasts).
- Document any intentional deviation (e.g. native `<select>` only where justified) in the feature **spec** and **plan**, with rationale and review expectations.

### VIII. Public Auth Routes And Post-Auth Navigation

In `apps/web`, marketing auth surfaces and redirects MUST follow the centralized guard model:

- Pages that must bounce an **already authenticated** user away from sign-in / sign-up / forgot-password MUST use `redirectIfAuthenticated` from `@/lib/auth/guards.server` (or the paired `redirectIfVerifyPendingNotNeeded` for `/register/verify-pending`).
- **Token-bound** public pages (`/verify-email`, `/reset-password`, `/unsubscribe`, and `/register?invite=…`) MUST NOT apply `redirectIfAuthenticated` on session alone; token flows take precedence.
- Any post-login or post-guard destination (including `?next=`) MUST be validated with `isSafeNextPath` and resolved through `resolvePostAuthDestination` from `@/lib/auth/post-auth-destination` so open redirects and role defaults stay consistent.

## Source Of Truth And Constraints

The following project documents are normative inputs to specs and plans:

- `docs/SYSTEM_ANALYSIS.md` for architecture, domain model, and current behavior
- `docs/V1_PRODUCT_SPEC.md` for target V1 product rules and role/scope policy
- `docs/DIAGRAMS.md` for system topology and ERD context
- `docs/FORMS.md` for form architecture and action/result conventions
- `docs/DESIGN_SYSTEM.md` for UI and accessibility patterns
- `docs/openapi.yaml` for API-level contracts

When conflicts exist between documents and implementation, explicitly record the conflict in the current spec and choose a temporary source of truth for the feature scope.

## Workflow And Quality Gates

The default Spec Kit phase order for this repository is:

1. `/speckit-constitution` (only when principles need updates)
2. `/speckit-specify`
3. `/speckit-clarify` and/or `/speckit-checklist`
4. `/speckit-plan`
5. `/speckit-tasks`
6. `/speckit-implement`

Required output quality:

- `spec.md` must include clear in-scope/out-of-scope, acceptance criteria, and key edge cases.
- `plan.md` must map requirements to concrete files/packages and define verification.
- `tasks.md` must contain small, reviewable steps with dependency order and test expectations.
- Implementation must trace to tasks and preserve contract and domain invariants.
- Specs and plans must include an explicit SOLID impact/check section for code-affecting work.
- Specs and plans that change `apps/web` UI or forms must satisfy **principle VII** and use the spec/plan template prompts for concrete UI and form choices.

## Governance

This constitution supersedes ad-hoc workflow preferences for feature delivery.
Amendments require:

1. A short rationale.
2. Updated principle or section text.
3. Confirmation that existing specs/plans remain valid or a migration note.

During review, any constitutional violation must be resolved by changing the implementation, spec/plan/tasks artifacts, or this constitution explicitly.

**Version**: 1.2.0 | **Ratified**: 2026-04-28 | **Last Amended**: 2026-04-29
