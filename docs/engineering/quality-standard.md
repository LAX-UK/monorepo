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

## Required evidence

Every production change must:

- pass formatting, lint, layer/dependency guardrails, and typechecking;
- add tests proportional to behavior and risk;
- pass affected unit/integration tests and a production build when applicable;
- run critical browser/visual gates for changed cross-stack or UI behavior;
- update architecture, API, runbook, or design docs when their contracts change.

The complete local gate is `pnpm ci:verify`. The focused pre-push gate is
`pnpm ci:pre-push`.

## Browser test commands

Run with Node.js 22 against a seeded database. Playwright starts the API on
`:3001` and web on `:3000` itself via `webServer` in
`apps/web/playwright.config.ts`, so CI and local runs exercise the same
processes. Set `PLAYWRIGHT_EXTERNAL_STACK=1` to target a stack you already run.

Stack environment lives in one file, `.github/e2e.env`, shared by `e2e-pr.yml`,
`e2e-stabilization.yml`, and `visual-baselines.yml`. Load it locally with
`set -a && . .github/e2e.env && set +a`. Do not redeclare these values in a
workflow: three drifting copies is what previously broke the PR gate.

Two constraints are easy to reintroduce and expensive to diagnose:

- Never set `PORT` for the whole job. A shared `PORT` binds the API and web to
  the same socket, and the second process dies with `EADDRINUSE`.
- Serve web with `next start`. The standalone server omits `.next/static` and
  `public/` unless they are copied beside it (see `apps/web/Dockerfile`); without
  them the client bundle 404s, the page never hydrates, and form submits fall
  back to a native GET. `apps/web/e2e/helpers/auth.ts` now fails fast and names
  this cause rather than timing out.

Role setup projects write ignored state under `apps/web/e2e/.auth/`.

| Tier | Command | Owner | CI |
|------|---------|-------|-----|
| Portfolio guard | `pnpm lint:e2e-portfolio` | all PRs | `ci.yml` static-checks |
| Tag taxonomy guard | `pnpm lint:e2e-tags` | all PRs | `ci.yml` static-checks |
| PR smoke + curated visuals | `pnpm --filter @auction/web test:e2e:pr` | UI cross-stack changes | `e2e-pr.yml` |
| Staff catalog smoke | `pnpm --filter @auction/web test:e2e:smoke` | navigation regressions | PR subset |
| Role contracts | `pnpm --filter @auction/web test:e2e:roles` | authorization | manual / stabilization |
| Curated admin visuals | `pnpm --filter @auction/web test:e2e:visual` | layout/theme | PR subset |
| Broader stabilization | `pnpm --filter @auction/web test:e2e:stabilization` | a11y + journeys | weekly shard |
| Admin baseline refresh | `pnpm --filter @auction/web test:e2e:admin-visual-update` | explicit UI refresh | `visual-baselines.yml` |
| Marketing visuals | `UPDATE_MARKETING_VISUALS=1 pnpm ci:visual-baseline` | opt-in only | not in PR gates |

Tag ownership in specs: `@smoke`, `@journey`, `@a11y`, `@roles`, `@visual`,
`@optin`. Every `test.describe` block must declare one tier tag; `pnpm lint:e2e-tags`
enforces the taxonomy. Prefer the lowest tier that proves the behavior; do not
expand the visual Cartesian product.

`e2e-pr.yml` is advisory until it records its first green run: treat a red
`browser-gates` as a signal to investigate, not as proof that a PR is unsafe, and
do not add it to required checks before it passes. Verify changes to it locally
first — it is in its own `paths:` trigger, so a workflow edit runs the gate.
