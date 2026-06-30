# Domain logic placement

Convention for where business rules, validation, orchestration, and presentation live in the monorepo.

## Layers

| Concern | Location | Examples |
|---|---|---|
| Pure cross-app business rules | `packages/domain` | Lot status transitions, submission state machine, reserve derivation |
| Input/shape validation + policy helpers | `packages/validators` | Zod schemas, request DTO parsers, guard helpers |
| Orchestration + I/O | `apps/api` services | DB writes, Stripe calls, event recording, transition orchestrators |
| Presentation mapping | `apps/web` `lib/presenters` | Status badges, table row view-models, admin list labels |

## Rules

1. **`packages/domain` is pure.** No I/O, no framework imports, no Zod. Functions take typed inputs and return typed outputs. Safe to import from API, worker, and web (read-only derivations only on web).
2. **`packages/validators` validates shapes.** Event payload schemas, route body/query parsers, and reusable policy checks that depend on Zod belong here—not in `apps/api/src/domain`.
3. **`apps/api` orchestrates.** Services coordinate repositories, external APIs, and domain functions. Keep transition guards in domain; keep “load row, check guard, persist, emit event” in services.
4. **`apps/web` presents.** Map API/wire types to UI labels, dates, and badge variants in `lib/presenters` and list view-models. Do not duplicate domain transition rules in the web app.

## Examples

- **Lot status transitions** (`canLotTransition`, `canAdminOverrideLotStatus`) → `packages/domain/src/lot-transitions.ts`
- **Lot event payload schemas** (Zod) → stay in `apps/api` or move to `packages/validators` when shared
- **Submission quality / lot readiness** → `packages/domain`
- **Admin dispute table rows** → `apps/web/src/lib/data/view-models/admin-disputes-table.vm.ts`

## Adding new domain logic

1. If the rule is pure and may be reused across apps → add to `packages/domain`, export from `packages/domain/src/index.ts`, add unit tests beside the module.
2. If it only validates HTTP/event shapes → add to `packages/validators`.
3. If it touches the database or network → add a service under `apps/api/src/services/`.
4. If it only affects UI copy or formatting → add a presenter or view-model under `apps/web`.

See also [02-decisions.md](./02-decisions.md) for numbered architectural decisions.
