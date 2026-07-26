# View-model conventions

Canonical rules for presentation logic in `apps/web` before and during UI redesign.

## Where logic lives

| Layer | Location | Use for |
|-------|----------|---------|
| **App view-models** | `apps/web/src/lib/data/view-models/*.vm.ts` | Admin lists, detail tabs, dashboard boards — pure functions from API DTOs to UI props |
| **Admin page models** | `apps/web/src/lib/admin/**` | List filters, KPI tiles, tab specs, route helpers — no React imports |
| **Marketing VMs** | `apps/web/src/lib/marketing/*` | Public catalogue/detail page assembly |
| **Section presenters** | `apps/web/src/components/sections/*-view-models.ts` | Legacy; do **not** add new logic here — migrate to `lib/data/view-models` when touched |

## Rules

1. **`lib/admin` must not import `@/components/**`.** Shared contracts live in `lib/admin/**/*.types.ts` or `lib/**` (enforced by `node scripts/check-lib-admin-boundaries.mjs` in CI).
2. **Components consume VMs; VMs do not import components.** KPI tiles use `KpiRowTile` from `@/lib/admin/kpi-row-tile.types`, not from `@/components/dashboard/primitives/kpi-row`.
3. **Fetch stays at the data boundary.** HTTP only in `lib/data/http/**`, `*.server.ts`, `*.client.ts` (see `scripts/check-web-guardrails.mjs`).
4. **Domain derivations belong in `@auction/domain`.** Web VMs format and label; they do not encode business rules that belong in packages.
5. **Pair tests with VMs.** New or changed `*.vm.ts` files should have a colocated `*.vm.test.ts` when logic is non-trivial.

## Examples

```typescript
// Good — lib/admin builds tab specs from domain inputs
import type { CatalogDetailTabSpec } from "@/lib/admin/catalog/catalog-detail-tab.types";

export function buildSaleDetailTabSpecs(input: BuildSaleDetailTabSpecsInput): CatalogDetailTabSpec[] {
  // ...
}
```

```typescript
// Bad — lib/admin importing React component types
import type { CatalogDetailTabSpec } from "@/components/admin/catalog/catalog-detail-tab-nav";
```

## Related docs

- [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) — shells, status badges, import policy
- [redesign-program.md](./redesign-program.md) — phased rollout order
- [token-change-checklist.md](./token-change-checklist.md) — rebrand token touch points
