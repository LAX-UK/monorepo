# Admin Lots module — SOLID catalog pipeline

Reference implementation #2 after Sales. Every lots surface follows the same layering as sales/payments.

## Figma map

| Frame | Node | Route / target |
|---|---|---|
| Lots list | `248:7007` | `/admin/lots` |
| Lot overview | `261:20532` | `/admin/lots/[id]` |
| Lot media | `263:8407` | `/admin/lots/[id]/images` |
| Lot documents | `265:9266` | `/admin/lots/[id]/documents` |
| Lot bids | `267:9434` | `/admin/lots/[id]/bids` |
| Lot create | `117:2516` | `/admin/lots/new`, `/admin/lots/[id]/edit` |

**Catalogue IA:** catalogue fields live on Overview and `/admin/lots/[id]/catalogue` redirects to
the overview anchor. It is not a sixth navigation tab.

## Layer rules

| Principle | Rule | Lots example |
|---|---|---|
| **SRP** | One reason to change per file | `build-lots-list-page-model.ts` = URL state; `load-lots-list-page.ts` = fetch + presentation model; `lots/page.tsx` = compose; `lots-board` = render only |
| **OCP** | Extend via VMs/slots, not shell edits | New lens = `lots-lenses.ts` + VM; never add lot routes inside `CatalogDetailShell` |
| **LSP** | Boards accept VM row types only | `AdminLotsBoard` rows from `toAdminLotTableRow`; no raw API shapes in columns |
| **ISP** | Narrow shell props | `CatalogListShell` gets `filterBar` / `kpiStrip`; queue props only when needed |
| **DIP** | Pages depend on controllers/readers | HTTP via `admin-lots-summary.server.ts`, not inline `authedServerFetch` in components |
| **Contracts** | Row types + tab hrefs live in `lib/` | `lib/admin/catalog/lot-table-row.ts`, `lib/admin/lots/lot-detail-routes.ts` — VMs never import `components/` |

## Pipeline A — List (`/admin/lots`)

```
lots/page.tsx
  → loadAdminLotsListPage(sp)
    → buildLotsListPageModel(sp)
    → summaries, trends, controller, enrichment
  → CatalogListShell + AdminLotsBoard
```

Satellite modes:

- `?lens=attention` → `buildLotsAttentionQueueModel` → work queue sections

## Pipeline B — Detail (`/admin/lots/[id]`)

```
(detail)/layout.tsx
  → loadAdminLotDetail()
  → LotDetailShell (CatalogDetailShell)
    → LotDetailMetaRow
    → tab routes fetch readers → tab VMs → detail-board adapters
```

Overview stack (Figma `261:20532`):

```
CatalogKpiPeriodToggle → DetailBoardKpiStrip → DetailAttentionTable
→ DetailActivityFeed → Commercial DetailEntityTable
→ Artwork DetailCardGrid → Catalogue DetailEntityTable
```

## Pipeline C — Forms (`/admin/lots/new`, `/admin/lots/[id]/edit`)

```
lots/new/page.tsx
  → LotCreateWizard
    → buildLotSetupStepperViewModel()
    → CatalogFormShell + AdminFormWizard
    → step components
    → useLotFormSubmit → lib/actions/admin/admin-lots.ts
```

## Presenter pipeline

All status chips flow through shared presenters — never ad-hoc badge classes:

- `lib/presenters/status/lot-dot-status.ts` → `DotStatusPill`
- `lib/presenters/lot-auction-type-presentation.ts` → `LotAuctionTypeChip` → `LotAuctionTypePill`
- `lib/presenters/lot-status-badge-props.ts` → detail shell status
- `lib/admin/domain-event-labels.ts` → activity rows on lot detail (not list table)
- `lib/admin/lots/lot-catalog-presenters.ts` → shared with sale-lots tab

## Data boundary (API)

| Service | Endpoint |
|---|---|
| `AdminLotsListSummaryService` | `GET /admin/kpi/lots-summary` |
| `AdminLotDetailMetricsService` | `GET /admin/lots/:id/metrics` |
| `AdminLotOverviewKpiTrendService` | `GET /admin/lots/:id/overview-kpi-trends` |
| `AdminLotAttentionService` | `GET /admin/lots/:id/attention` |

Attention composition lives in `packages/domain/src/lot-attention/`.

## Intentional lots-only UX

- Split filter toolbar: sticky `CatalogLotsStickyFilterToolbar` (lenses + chips) + table header `CatalogBoardTableHeader` (search, Filters, Export)
- Pagination in `AdminLotsBoard` footer only (sales parity — not shell-level)
- Attention lens (withdrawals + drafts missing photos)
- Lens IDs: `all` / `live` / `draft` / `ending` / `attention`

## Legacy removal

Pre-migration lot components (`AdminLotOverviewPanel`, `AdminLotBidsTable`, `LotImageTab`, `LotContextRail`, `AdminLotDetailKpiStrip`, `LotDocumentsSection`, `build-lot-summary-items`) have been deleted. Overview shows an activity preview and `/activity` remains the full activity tab.
