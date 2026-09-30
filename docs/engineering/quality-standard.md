# Engineering quality standard

This document is the default design and review contract for production changes.
Apply it proportionally: SOLID protects change boundaries; it is not a reason to
invent abstractions before a real variation or dependency exists.

## Design principles

1. **Single responsibility:** modules have one reason to change. Routes compose,
   loaders orchestrate reads, services coordinate I/O, domain modules hold pure
   policy, and presenters map domain data to UI contracts.
2. **Open/closed:** add behavior through an existing stable seam when a genuine
   family of implementations exists. Prefer a direct function for one-off logic.
3. **Liskov substitution:** implementations preserve their port's inputs,
   outputs, errors, side effects, and transaction semantics.
4. **Interface segregation:** consumers depend on the smallest capability they
   need. Do not pass full containers, repositories, or broad service facades.
5. **Dependency inversion:** domain and application policy depend on ports;
   infrastructure adapters are selected in composition roots.

Canonical boundaries:

- [Domain logic placement](../architecture/domain-logic-placement.md)
- [Staff UI architecture](../ui/staff-ui-architecture.md)
- [Architecture decisions](../architecture/02-decisions.md)
- [Forms](../FORMS.md) and [design system](../DESIGN_SYSTEM.md)

## Scalability

- Scale from measured load, failure modes, and documented thresholds—not
  speculative microservices or caches.
- Keep request paths stateless where practical; move retryable external work to
  queues and use idempotency at write boundaries.
- Preserve transaction and outbox guarantees when introducing concurrency.
- Record architecture changes in the decision log and update operational docs
  in the same change.

## Test portfolio

- Unit/component tests own pure behavior, validation, state transitions, and UI
  interaction details.
- Integration tests own database, adapter, and service contracts.
- Browser tests own only critical cross-stack journeys and authorization.
- Visual tests own representative layout archetypes, responsive breakpoints,
  and theme rendering—not every route.
- A defect found high in the pyramid gets the lowest-level regression test that
  can reproduce it.

### Test admission (what belongs in CI)

1. A test must fail on a realistic bug and stay green on a correct refactor.
2. Prove each rule once at the lowest layer; higher layers only map outcomes
   (for example HTTP status), not restated policy.
3. Code-shape rules live in lint scripts (`lint:*`, `check-layers.mjs`, actionlint),
   not in Vitest files that read source text.
4. PR browser gates cover sign-in, role authorization, catalog visibility smoke,
   and Shop basket add-to-cart (`buyer-flow`). Layout, theme, viewport, and most
   `@journey` / `@a11y` specs run weekly via `e2e-stabilization.yml` or post-deploy
   Shop acceptance.
5. Migration and rollout tests expire after production has applied the change.

Pre-commit: `simple-git-hooks` runs Biome on staged files (`pnpm prepare` installs
the hook). Workflow YAML validity is actionlint only, not string-matching unit tests.

## Required evidence

Every production change must:

- pass formatting, lint, layer/dependency guardrails, and typechecking;
- add tests proportional to behavior and risk;
- pass affected unit/integration tests and a production build when applicable;
- run critical browser/visual gates for changed cross-stack or UI behavior;
- update architecture, API, runbook, or design docs when their contracts change.

The complete local gate is `pnpm ci:verify`. The focused pre-push gate is
`pnpm ci:pre-push`. While iterating, `pnpm ci:verify:fast` runs Biome, Turbo
`lint`, `typecheck`, and `test --affected` only (no custom lint gates, full web
shards, or build).

### Vitest and workspace UI packages

App Vitest configs (`apps/web`, `apps/shop`) resolve `@auction/ui` and
`@auction/marketing-ui` to **package source** via
`scripts/vitest/workspace-source-aliases.mjs`, not to prebuilt `dist/`. That
keeps `vi.mock("next/image")` and similar app-level mocks effective after shared
extracts, and lets local test runs reflect TSX edits without rebuilding those
packages. Turbo still runs `^build` before `test` in CI. `apps/web` also inlines
those packages via Vitest `server.deps.inline` so app-level `vi.mock("next/*")`
hooks apply inside shared UI code.

`pnpm lint:test-mocks` fails when a test file mocks `next/*` or `@auction/*`
modules that never appear in its static import graph (a common sign of a dead
mock after refactors).

## Browser test commands

Run with Node.js 22, seeded stack on `:3000` (web) and `:3001` (API), and
`PLAYWRIGHT_E2E=1`. Role setup projects write ignored state under
`apps/web/e2e/.auth/`.

| Tier | Command | Owner | CI |
|------|---------|-------|-----|
| Portfolio guard | `pnpm lint:e2e-portfolio` | all PRs | `ci.yml` static-checks |
| Tag taxonomy guard | `pnpm lint:e2e-tags` | all PRs | `ci.yml` static-checks |
| PR browser gates | `pnpm ci:e2e-pr` | cross-stack UI | `e2e-pr.yml` (`@smoke`, `@roles`; Shop `buyer-flow`) |
| Staff catalog smoke | `pnpm --filter @auction/web test:e2e:smoke` | navigation regressions | PR subset via `e2e-pr.yml` |
| Role contracts | `pnpm --filter @auction/web test:e2e:roles` | authorization | PR via `e2e-pr.yml` |
| Curated admin visuals | `pnpm --filter @auction/web test:e2e:visual` | layout/theme | **manual only** (`visual-baselines.yml`) |
| Broader stabilization | `pnpm --filter @auction/web test:e2e:stabilization` | a11y + journeys | weekly shard |
| Admin baseline refresh | `pnpm --filter @auction/web test:e2e:admin-visual-update` | explicit UI refresh | `visual-baselines.yml` |
| Marketing visuals | `UPDATE_MARKETING_VISUALS=1 pnpm ci:visual-baseline` | opt-in only | not in PR gates |
| Shop browser gates | `pnpm --filter @auction/shop test:e2e` | commerce + layout | PR: `buyer-flow`; staging acceptance: theme, home, viewport, catalogue |

Tag ownership in specs: `@smoke`, `@journey`, `@a11y`, `@roles`, `@visual`,
`@optin`. Every `test.describe` block must declare one tier tag; `pnpm lint:e2e-tags`
enforces the taxonomy. Prefer the lowest tier that proves the behavior; do not
expand the visual Cartesian product.
