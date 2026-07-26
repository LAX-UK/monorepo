# Admin detail board

Entity-agnostic presentation layer for catalog **detail tabs** (sale, lot, category, submission, venue, artist).

## Layers

| Layer | Path |
|---|---|
| Contracts (no React) | `apps/web/src/lib/admin/detail-board/types.ts` |
| KPI mapping | `apps/web/src/lib/admin/detail-board/map-kpi-tiles.ts` |
| Presentation | `apps/web/src/components/admin/catalog/detail-board/` |
| Entity VMs | `apps/web/src/lib/data/view-models/*-tab.vm.ts` |
| Tab adapters | `apps/web/src/components/admin/*-detail/tabs/` |

## Rules

1. **`detail-board/` must not import** sale-, lot-, or category-specific modules.
2. Tab files **wire VMs → board components**; no inline card/table chrome.
3. New entity tabs implement `DetailBoardKpiTile`, `DetailAttentionRow`, etc. in a VM, then compose board primitives.

## Components

- `DetailBoardShell` — card header, count, actions, toolbar slot
- `DetailBoardToolbar` — search + `FilterChipGroup`
- `DetailBoardKpiStrip` — dashboard KPI row
- `DetailEntityTable<TRow>` — configurable columns
- `DetailCardGrid` — media/press cards
- `DetailAttentionTable` — overview attention rows
- `DetailActivityFeed` / `DetailStatCard` / `DetailSectionGrid`
- `DetailNoticeBanner` — warning cards
- `DetailQualityGapCard` — field-level quality gap callouts (submission review, catalogue checks)
- `DetailStatValue` — supports `verified` checkmarks on entity table rows

`CatalogDetailTabCard` is a thin alias over `DetailBoardShell` for backward compatibility.

## KPI trends

List and detail KPI strips use `AdminKpiTrendEngine` for **creation- or event-timestamp** metrics (e.g. new lots/sales, lots ended by `endTime`, hammer value by `endTime`). **Point-in-time status counts** (live/draft/needs-attention snapshots) require a daily-snapshot mechanism — see `apps/api/src/services/admin/README-kpi-trend-snapshots.md`. Ship those tiles with flat values until snapshot infra exists.

## Adopting in another module

1. Add `lib/data/view-models/<entity>-<tab>.vm.ts` returning contract types.
2. In the tab adapter, import from `@/components/admin/catalog/detail-board` only.
3. Do not copy sale tab JSX.

### Suggested next migrations

| Module | Tab | Status |
|---|---|---|
| Lot detail | Overview | ✅ detail-board |
| Lot detail | Bids | ✅ detail-board |
| Lot detail | Images | ✅ detail-board |
| Lot detail | Documents | ✅ detail-board |
| Category detail | Children lots | ✅ `DetailBoardShell` + `DetailEntityTable` |
| Submission detail | Documents | ✅ `DetailBoardShell` |

## UI primitives (`packages/ui`)

- `DotStatusPill` — status chips with dot indicator
- `FilterChipGroup` — filter chip row (used by `DetailBoardToolbar`)
