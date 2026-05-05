# Spec Kit Workflow In Cursor

This repository is configured to follow a Spec Kit-style flow for AI-assisted development.

## What Was Added

- Shared Spec Kit scaffolding under `.specify/`
- Cursor skills under `.cursor/skills/speckit-*/SKILL.md`
- Workflow rule hint at `.cursor/rules/specify-rules.mdc`
- Project constitution at `.specify/memory/constitution.md`

## Canonical Project Inputs

Use these files as primary context when creating specs and plans:

- `docs/architecture/01-overview.md` and the rest of `docs/architecture/`
- `docs/SYSTEM_ANALYSIS.md` (auction-domain runtime today)
- `docs/openapi.yaml`
- `docs/FORMS.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/DIAGRAMS.md`
- `docs/V1_PRODUCT_SPEC.md`

## Standard Phase Order

For any non-trivial feature, run phases in this order:

1. `/speckit-specify`
2. `/speckit-clarify`
3. `/speckit-checklist` (optional but recommended)
4. `/speckit-plan`
5. `/speckit-tasks`
6. `/speckit-implement`

Use `/speckit-constitution` only when governance principles need an explicit update.

## How To Use In This Monorepo

### 1) Create the spec (what/why)

Prompt should define user intent and business outcomes, not implementation details.

Expected output: `spec.md` for the active feature scope.

### 2) Clarify risky or ambiguous areas

Focus prompts on:

- domain invariants (sale/lot lifecycle, bidding rules)
- security and permission boundaries
- realtime and payment side effects

Expected output: clarified assumptions and resolved requirement gaps.

### 3) Generate technical plan (how)

Plan prompt should include stack constraints from this repo:

- pnpm workspace + Turborepo
- Hono API + Next.js web + Socket.IO ws
- Drizzle/Postgres + Redis
- Biome + TypeScript + Vitest

Expected output: implementation strategy plus impacted files/packages.

### 4) Break into tasks

Tasks should be small and independently verifiable. Each task should map to specific files and test updates.

Expected output: ordered `tasks.md` with dependency-aware steps.

### 5) Implement from tasks

Implement in narrow slices, then run relevant checks:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

Use targeted package/app checks when practical for faster iteration.

## Review Checklist

Before merge, verify:

- Spec acceptance criteria are fully addressed.
- Contract changes are reflected in `docs/openapi.yaml` and validators/types when needed.
- Domain invariants are preserved across API, jobs, and realtime events.
- Tests cover happy path plus critical edge cases.
