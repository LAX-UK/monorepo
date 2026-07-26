# Catalog UI Standard

Gold-standard reference: **Lots list** (`/admin/lots`) and **Lot detail overview** (`/admin/lots/[id]`).

All catalog list pages (Lots, Sales, Submissions, Artists, Categories, and Venues) follow this
standard. Operational queues such as Condition Reports and Lot Fulfilment use the same shell,
board, status, and KPI visual language while retaining drawer-based workflows.

## Layout hierarchy

1. **Page shell** — `CatalogListShell` (list) or `CatalogDetailShell` + entity shell (detail)
2. **Sticky lens bar** — `CatalogFilterBar` / entity `*-filter-toolbar` (page-level segments only)
3. **KPI band** — `AdminTrendKpiBand` (6 tiles max, period toggle in toolbar when applicable)
4. **Board card** — `CatalogBoardCard` / `catalogBoardCardClassName`
5. **Table toolbar** — search → quick status segment (Lots only) → Filters → Export (inside board card)

### Elevation tokens

| Layer | Classes |
|-------|---------|
| Page bg | `bg-shell-page-bg` |
| KPI band | `AdminTrendKpiBand` → flat `KpiRow` grid (no hero wrapper) |
| Board card | `CatalogBoardCard` → `catalogBoardCardClassName` |
| Count badge | `bg-on-surface text-surface-container-lowest rounded-full` |

## KPI rules

- **One visual language:** `KpiTile variant="dashboard"` everywhere in catalog
- **Six tiles max** on list pages (standard 3×2 grid). No secondary metrics row on primary band
- **Every tile gets a sparkline:**
  - Real trend API → `buildTrendKpiTile`
  - Snapshot count → `buildSnapshotKpiTile` (flat series for visual parity)
  - Detail snapshot → `applyFlatKpiTrendOverlay`
- **Semantic emphasis:** use `semanticTone` (`emphasis` / `warning` / `danger`) sparingly for actionable counts
- **Period toggle:** lives in KPI band `toolbarEnd`, not floating below the band (Lots + Sales)
- **Operational queues:** use snapshot tiles when no trend endpoint exists; do not invent a period
  toggle or trend claim.

### List KPI builders

| Entity | Builder | Status |
|--------|---------|--------|
| Lots | `buildLotsListKpiTiles` | Done |
| Sales | `buildSalesListKpiTiles` | Done |
| Submissions | `buildSubmissionsListKpiTiles` | Done |
| Artists | `buildArtistsListKpiTiles` | Done |
| Categories | `buildCategoriesListKpiTiles` | Done |

| Venues | `buildVenuesListKpiTiles` | Done |

## Filter pattern

- **Page level:** lens tabs (`CatalogSegmentNav`) + active filter chips
- **Table level:** `CatalogBoardTableHeader` with `toolbarMid` for quick status segment (Lots only)
- **Advanced:** transactional filter sheet (`AdminFilterSheetRoot` + entity adapter)
- **Do not use:** deprecated `AdminListFilterSheet`

### Lots quick filter

- Component: `LotsBoardStatusQuickFilter` (desktop) + `LotsBoardStatusQuickFilterMobile`
- Chips builder: `buildLotsBoardStatusChips`
- Values: All / Live / Withdraw / Sold → `status` query param

## Table cells

Use shared cells in column definitions:

- Money: `AdminTableMoneyCell` (`emphasis="hammer"` for hammer prices)
- Date/time: `AdminTableDateTimeCell` (`mode="deadline"` with `live` for ending lots)

## Detail boards

Import from `@/components/admin/catalog/detail-board/` only:

- `DetailBoardKpiStrip` — hero KPI band (uses `AdminTrendKpiBand` internally)
- `DetailBoardShell` — card sections with count badge
- `DetailAttentionTable`, `DetailActivityPreviewSection`, `DetailEntityTable`

Detail KPI sparklines: real trend where API exists (Lot, Sale); flat overlay elsewhere (Submission, Category). Artist overview keeps `CatalogDetailSummaryStrip`.

## Responsive breakpoints

- Admin split at **`lg` (1024px)**, not `md`
- KPI strip: desktop only; `CatalogListMobileSummary` on mobile
- Filter sheet: bottom sheet mobile / right sheet desktop

## Adoption checklist (per entity)

| Entity | KPI builder | Hero band | Badge | Detail sparklines |
|--------|-------------|-----------|-------|-------------------|
| Lots | Done | Done | Done | Done |
| Sales | Done | Done | Done | Done |
| Submissions | Done | Done | Done | Done |
| Artists | Done | Done | Done | N/A (summary strip) |
| Categories | Done | Done | Done | Done |
| Venues | Route snapshot | Done | Done | N/A |
| Condition reports | Route snapshot | Done | Done | N/A |
| Lot fulfilment | Route snapshot | Done | Done | N/A |

## Detail navigation

- Entity adapters own tab visibility, capability rules, labels, counts, and hrefs.
- `CatalogDetailTabNav` is presentation-only and resolves the active tab from the supplied hrefs.
- Do not import entity route parsers or domain actions into shared catalog navigation.

## Intentional domain exceptions

- Artist overview uses `CatalogDetailSummaryStrip` rather than trend KPIs.
- Categories use a taxonomy tree board rather than forcing hierarchy into a flat table.
- Condition Reports and Lot Fulfilment use drawers for high-throughput queue work rather than
  synthetic detail routes.

## Required route architecture

Every migrated list route follows this dependency direction:

```
route authorization
  → list loader
    → URL/page model + controller/readers
    → serializable board view model
  → CatalogListShell + entity board
```

- Route files authorize and compose. They do not contain HTTP orchestration or row enrichment.
- Loaders own parallel reads, error containment, totals, and serializable presentation models.
- Shared catalog components depend on narrow props/callbacks and never import entity actions,
  readers, route parsers, or persistence services.
- Boards own table chrome and pagination. Shell-level pagination is reserved for non-board pages.

## Required states

Every rollout covers default, loading, empty, filtered-empty, degraded/error, read-only/forbidden,
dirty/saving, success, partial-failure, and destructive-confirmation states where applicable.

- Loading skeleton geometry mirrors the live page.
- Read-only users never see controls that fail only after activation.
- Immediate versus staged mutations are explicit in confirmation and status copy.
- Filters remain URL-driven and transactional.

## Accessibility and browser gate

- Use native or `@auction/ui` controls; never create nested interactive card controls.
- Keyboard behavior must be equivalent to pointer behavior, including reorder.
- Drawers/dialogs move focus inside and return focus to their trigger.
- Dynamic errors use an assertive announcement; progress and non-destructive status use polite live
  regions.
- Validate desktop, constrained desktop, tablet, and mobile at the `lg` split in light and dark
  mode.
- A migrated module is not complete until focused Vitest, Playwright functional, serious/critical
  axe, and visual-state checks pass.

## Rollout exceptions

- Exceptions must be documented at the module boundary and justified by user workflow, not by
  implementation convenience.
- Operational queues may omit period toggles and exports.
- Hierarchical taxonomies may use tree boards, but pagination/search totals must remain server
  truthful and parent pickers must use a separate full-tree source.

## Files to touch per rollout

| Concern | Path |
|---------|------|
| List page | `apps/web/src/app/admin/(platform)/{entity}/page.tsx` |
| KPI builder | `apps/web/src/lib/admin/{entity}/build-*-list-kpi-tiles.ts` |
| Board | `apps/web/src/components/admin/{entity}-board/index.tsx` |
| Detail overview | `apps/web/src/components/admin/{entity}-detail/tabs/overview-tab.tsx` |
| View model | `apps/web/src/lib/data/view-models/{entity}-overview.vm.ts` |
