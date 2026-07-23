# Admin Sales module — SOLID catalog pipeline

Reference implementation for catalog list/detail. Lots follows the same layering.

## Pipeline A — List (`/admin/sales`)

```
sales/page.tsx
  → loadAdminSalesListPage(sp)
    → buildSalesListPageModel(sp)
    → summary/trend readers + salesListController.fetch()
    → applySalesLensBadges(lenses, summary.lensCounts)
  → CatalogListShell + AdminSalesBoard
```

The list route delegates data loading and error containment to
`lib/admin/sales/load-sales-list-page.ts`; `sales/page.tsx` owns authorization and composition.

List chrome:

- Sticky `CatalogSalesFilterToolbar` — lens tabs + applied chips + KPI period (mobile summary)
- Shell `toolbarEnd` — KPI period toggle (desktop, post-KPI)
- Table card `CatalogBoardTableHeader` — search, Filters, Export
- Pagination in `AdminSalesBoard` footer only (serializable props — not shell-level)

## Pipeline B — Detail (`/admin/sales/[id]`)

```
(detail)/layout.tsx
  → loadAdminSaleDetail()
  → SaleDetailShell (CatalogDetailShell)
    → SaleDetailMetaRow
    → tab routes fetch readers → tab VMs → detail-board adapters
```

## Layer rules

| Principle | Rule | Sales example |
|---|---|---|
| **SRP** | One reason to change per file | `build-sales-list-page-model.ts` = URL state; `sales/page.tsx` = fetch + compose; `sales-board` = render only |
| **OCP** | Extend via VMs/slots, not shell edits | New lens = `sales-lenses.ts` + page model |
| **LSP** | Boards accept VM row types only | `AdminSalesBoard` rows from `toAdminSaleBoardRow` |
| **DIP** | Pages pass serializable props to client boards | `exportFilters`, `saleFilterSheet`, `pagination` — no RSC JSX slots |
| **Contracts** | Row types + tab hrefs live in `lib/` | `lib/admin/catalog/sale-table-row.ts`, `lib/admin/sales/sale-detail-routes.ts` |

## Presenter pipeline

- `lib/presenters/delivery-mode-presentation.ts` → `SaleDeliveryModeChip` → `DeliveryModePill`
- `lib/presenters/lot-status-badge-props.ts` → sale-lots tab status
- `lib/admin/sales/sale-detail-routes.ts` → tab hrefs

## Data boundary (API)

| Service | Endpoint |
|---|---|
| `AdminSalesListSummaryService` | `GET /admin/kpi/sales-summary` |
| `AdminSaleDetailMetricsService` | `GET /admin/sales/:id/metrics` |
| `AdminSaleOverviewKpiTrendService` | `GET /admin/sales/:id/overview-kpi-trends` |
| `AdminSaleAttentionService` | `GET /admin/sales/:id/attention` |

## Capability contract

- `SALE_CATALOG_ACCESS` can browse sale detail, Press, and Media in read-only mode and can work on
  lot/catalog preparation during setup.
- `SALES_ACCESS` enables sale lifecycle mutations, Press/Media edits, create, and full sale
  management.
- Sale setup intentionally accepts `LOTS_ACCESS` so catalogue managers can complete lot rows on an
  existing draft sale; it does not grant sale creation or lifecycle actions.
