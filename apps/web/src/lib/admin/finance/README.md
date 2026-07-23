# Admin finance module — rollout contract

Finance list pages use the same SOLID list pipeline as catalog while preserving finance-specific
permissions, queues, money presentation, and mutation workflows.

## Reference and rollout order

1. Payments is the canonical finance reference.
2. Disputes is the first migration pilot.
3. Payouts follows the same list pipeline (`load-payouts-list-page`, `build-payouts-list-kpi-tiles`, `CatalogListShell`, board-contained pagination, URL-backed drawer, settlement preview).
4. Payouts + settlement must pass the browser stabilization gate before expanding to other finance/ops queues.

## Pipeline A — list

```
page.tsx
  → require finance capability
  → load<Module>ListPage(searchParams)
    → build<Module>ListPageModel(searchParams)
    → controller + summary/trend readers
    → serializable board model
  → CatalogListShell + <Module>Board
```

## Rules

| Principle | Finance rule |
|---|---|
| SRP | Route authorizes/composes; loader fetches; page model owns URL state; board renders |
| OCP | New queue/lens behavior extends page models and adapters, not `CatalogListShell` |
| LSP | Finance wrappers preserve catalog loading, error, pagination, and read-only contracts |
| ISP | Boards receive only capabilities and actions they render |
| DIP | Client boards never import HTTP readers or persistence services |

## Finance-specific behavior

- Use `AdminTableMoneyCell` for all monetary values.
- Use `AdminTableDateTimeCell` for captured, due, settlement, and deadline dates.
- Keep payment/dispute mutations capability-gated at both UI and server-action boundaries (`admin-finance-mutations.ts`, `resolveFinanceCapabilities`).
- Snapshot KPI tiles are valid when no trustworthy trend endpoint exists.
- Manual-review and dispute workflows may use drawers, but must be deep-linkable through URL state.

## Completion checklist

- `CatalogListShell`, finance breadcrumbs, board-contained pagination.
- Dedicated page model, loader, KPI builder, and tests.
- Transactional filters and URL-owned active chips.
- Catalog list loading/error factories.
- Desktop/mobile, light/dark, permission, axe, and visual regression coverage.
