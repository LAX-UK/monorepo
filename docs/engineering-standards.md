# Engineering standards index

Use this page to find the repository's quality contract and enforcement
points. Detailed rules live in the linked SSOT documents — do not duplicate them
here.

## Quality contract

- [Engineering quality standard](./engineering/quality-standard.md) — SOLID,
  scalability, test pyramid, and release evidence
- [Pull request checklist](../.github/pull_request_template.md)

## Architecture boundaries

| Concern | Document | Enforcement |
|---------|----------|---------------|
| Backend layering | [domain-logic-placement.md](./architecture/domain-logic-placement.md) | `pnpm lint:layers` |
| Staff UI composition | [staff-ui-architecture.md](./ui/staff-ui-architecture.md) | `pnpm lint:lib-admin-boundaries`, `pnpm lint:staff-*` |
| Web fetch boundary | [view-model-conventions.md](./ui/view-model-conventions.md) | `pnpm lint:web-guardrails` |
| Data access | [apps/web/src/lib/data/README.md](../apps/web/src/lib/data/README.md) | `check-web-guardrails.mjs` |
| Architectural decisions | [02-decisions.md](./architecture/02-decisions.md) | Review + D-number log |

## Test tiers

| Tier | Command | When |
|------|---------|------|
| Unit/component | `pnpm --filter @auction/web test` | Every PR |
| PR browser smoke + visuals | `pnpm --filter @auction/web test:e2e:pr` | UI PRs (CI) |
| Role contracts | `pnpm --filter @auction/web test:e2e:roles` | Permission changes |
| Stabilization | `pnpm --filter @auction/web test:e2e:stabilization` | Weekly / manual |
| Visual portfolio guard | `pnpm lint:e2e-portfolio` | Every PR |

## Local gates

```bash
pnpm ci:pre-push    # focused pre-merge
pnpm ci:verify      # full release gate
```
