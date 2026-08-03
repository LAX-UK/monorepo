# Staff route redesign matrix

Versioned evidence log for the staff dashboard redesign. Update a row when its route/state passes Figma reconciliation, architecture gates, and test evidence.

Legend:

| Column | Meaning |
|--------|---------|
| **Arch** | Architecture compliance: `pending` · `green` · `exception` |
| **Figma** | Canonical node(s) from file `LuoLMhFvg1cc4iPfHALEyv`, or `extend` when uncovered |
| **Visual** | Playwright PNG baseline under `apps/web/e2e/__snapshots__/admin-pages-visual.spec.ts/`: `pending` · `green` · `blocked` · `exception` |
| **Functional** | Loader unit, route composition, E2E, a11y: `pending` · `green` |
| **Owner** | Primary loader/shell owner in code |
| **Notes** | Behaviour preserved, exceptions, removal conditions |

**Wave 1 detail parity (2026-07-25):** Architecture and functional gates remain independent from visual baselines. A row is visually complete only when **Visual** is `green`. Saleroom clerk and invitation preview drawer remain explicit exceptions.

**No side rails (2026-07-25):** Client, Staff, Legal Entity, SoF, Artist, and Category detail pages now use a single full-width column. Former rail controls live in header actions (`CatalogDetailMobileMeta`, impersonation), overview/tab full-width cards (`UserDetailContextRail`, `LegalEntitySupportActionsSection`, `SofCaseReviewActionsSection`), permissions tab account controls (staff), and bottom danger/action sections. Legacy `AdminEntityDetailShell` rail mapping and `DetailRailLayout` removed.

**Side-rail visual verification (2026-07-25):** Refreshed Playwright baselines for 20 affected detail/tab slugs (120 captures: 3 viewports × 2 themes). **95 PNGs updated** for full-width layout delta; **25 unchanged** (pixel-identical at constrained/mobile breakpoints). Auth helper retries mid-run re-login with Redis `rl:auth:signin:*` clear. No login-page snapshot corruption observed.

**Figma reconciliation (2026-07-25 audit):** Migrated detail modules aligned to catalog `CatalogDetailShell` language before PNG baseline generation:
- **Clients/Staff (`PeopleDetailShell`):** KPI band moved from header to overview tab via `DetailBoardKpiStrip`; header now matches Figma order (title → email/persona description → status badges → last-active meta row). Profile/readiness sections use `CatalogDetailTabCard`.
- **Legal entities (`LegalEntityDetailShell`):** Header KPI strip removed; overview tab adds 6-tile `DetailBoardKpiStrip`, `DetailAttentionTable` blockers, `CatalogDetailTabCard` business summary, `DetailActivityPreviewSection`. Documents/compliance/stripe/activity tabs use `DetailBoardShell` + KPI/toolbar/table language (`407:40535`, `421:22893`, `421:24101`, `424:25192`). Compliance tab preserves lifecycle transition actions (Figma `421:22893` shows KYC/KYB checklist — deferred; no aggregate compliance-check API). Sales tab KPI frame `424:26310` remains placeholder until entity↔sale filter exists.
- **Sales detail tabs:** Overview/lots/registrations/documents/press/schedule use catalog board shells (`158:2182`, `179:3059`, `188:3692`, `195:5588`, `222:5415`); saleroom-only media tab (`201:8039`) stays visual-blocked.
- **Lots detail tabs:** Overview/images/documents/bids boards reconciled (`261:20532`, `263:8407`, `265:9266`, `267:9434`).
- **Submissions detail:** Overview/documents/decision tabs use catalog KPI + attention + board shells (`355:18153`, `359:20919`, `314:11647`).
- **SoF (`SofCaseDetailShell`):** Case KPI strip + `CatalogDetailTabPanel` wrapper added; header meta/status preserved.
- **Event RSVPs (`OperationsDetailShell`):** Already catalog-wrapped; no structural change (Figma frames `extend`).
- **Client commerce tabs:** Won-lots card grid (`333:15246`) uses `DetailCardGrid` with Figma `Lot#` title + fixed `Winning` badge; payments (`350:16894`) KPI strip + table; bids (`350:16177` / board `350:16509`) channel chips + Export CSV. Staff permissions tab (`374:18083`) uses `CatalogDetailTabCard` groups with Granted badges and tab counts; staff overview (`368:18793`) uses staff-specific KPI strip (not client commerce tiles) plus four profile cards — Recent Activity deferred (no user aggregate events API in web yet).
- **Visual auth:** Playwright global setup clears `rl:auth:signin:*`, defaults `admin@lax.bid`, retries login, and rejects login-page captures via `assertAuthenticatedStaffSession`.

## Wave 0 baseline (2026-07-24)

Seed fixtures now include: open dispute (`dp_seed_amber_open`), closed dispute (`dp_seed_golden_closed`), AML pending/triaged, SoF pending case with two submitted documents, manual-review payment, payout failure/settlement/clawback, stable invitation id for preview drawers, buyer E2E defaults (`estate-owner@lax.bid` / `Password123!`).

Visual PNG baselines: **414 committed** (Wave 0 lists/forms + Wave 1 detail/tab); **12 PNGs blocked** (invitation drawer ×6, disputes drawer ×6). Regenerate with Node 22:

```bash
pnpm --filter @auction/web build && PORT=3000 pnpm --filter @auction/web start &
PLAYWRIGHT_E2E=1 PLAYWRIGHT_VISUAL=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  PLAYWRIGHT_STAFF_EMAIL=admin@lax.bid PLAYWRIGHT_STAFF_PASSWORD=Password123! \
  pnpm --filter @auction/web test:e2e:admin-visual-update
```

Use Node 22 (`nvm use 22`) — Playwright test discovery hangs on Node 25. Clear `rl:auth:signin:*` in Redis if global setup hits rate limits.

## Dashboard & shell

| Route | State | Figma | Owner | Arch | Visual | Functional | Notes |
|-------|-------|-------|-------|------|--------|------------|-------|
| `/admin` | home | extend | `load-admin-dashboard-page` | green | pending | green | Workspace redesign (2026-07-27): work inbox + sale readiness rail, inline/bulk actions, KPI anomaly tones, queue chips; Figma + Linux visual review pending — see `staff-dashboard-rollout-evidence.md` |
| `/admin/impersonation` | utility | extend | redirect → legal entities | green | n/a | green | Deep-link compatibility retained |

## Catalog lists

| Route | State | Figma | Owner | Status | Evidence | Notes |
|-------|-------|-------|-------|--------|----------|-------|
| `/admin/sales` | list | `3:133` | `load-sales-list-page` | green | loader unit, route composition, catalog E2E | CatalogListShell + AdminTrendKpiBand + CatalogBoardCard; PNG baselines blocked |
| `/admin/lots` | list | `248:7007` | `load-lots-list-page` | green | loader unit, route composition, catalog E2E | Attention lens + quick status segment |
| `/admin/lots` | attention lens | extend | `load-lots-list-page` | green | catalog E2E, route composition | `?lens=attention` withdrawal queue |
| `/admin/submissions` | list | `307:19512` | `load-submissions-list-page` | green | route composition, catalog E2E | Preview drawer URL state preserved |
| `/admin/categories` | list | `380:19482` | `load-categories-list-page` | green | loader unit, route composition | Tree board + full-page create CTA |
| `/admin/artists` | list | extend | `load-artists-list-page` | green | route composition, catalog E2E | Extended staff KPI language |
| `/admin/venues` | list | `400:37515` | `load-venues-list-page` | green | route composition | Tree board + full-page create CTA |

## Catalog forms

| Route | State | Figma | Owner | Status | Evidence | Notes |
|-------|-------|-------|-------|--------|----------|-------|
| `/admin/sales/new` | create | `82:764` | `load-sale-create-page` | green | loader unit, route composition | CatalogFormShell + SaleSetupWizard |
| `/admin/sales/[id]/setup` | wizard | `84:1488`+ | `load-sale-setup-page` | green | loader unit, route composition | Multi-step scheduling frames |
| `/admin/sales/[id]/edit` | edit | extend | `load-sale-edit-page` | green | loader unit, route composition | CatalogFormShell |
| `/admin/lots/new` | create | `290:9696`+ | `load-lot-create-page` | green | loader unit, route composition | CatalogFormShell |
| `/admin/lots/[id]/edit` | edit | extend | `load-lot-edit-page` | green | loader unit, route composition | LotEditFormLayout |
| `/admin/lots/[id]/edit/catalog` | edit catalog | extend | `load-lot-edit-page` | green | route composition | Section in edit layout |
| `/admin/lots/[id]/edit/documents` | edit docs | extend | `load-lot-edit-page` | green | route composition | Section in edit layout |
| `/admin/categories/new` | create | `384:21426` | `load-category-create-page` | green | loader unit, route composition, catalog E2E, admin-pages-visual | CatalogFormShell + sidebar wizard |
| `/admin/categories/[id]/edit` | edit | extend | `load-category-edit-page` | green | loader unit, route composition | CatalogFormShell |
| `/admin/artists/new` | create | extend | `load-artist-create-page` | green | loader unit, route composition, catalog E2E, admin-pages-visual | CatalogFormShell + sidebar wizard |
| `/admin/artists/[id]/edit` | edit | extend | `load-artist-edit-page` | green | route composition, admin-pages-visual | CatalogFormShell + sidebar wizard |
| `/admin/venues/new` | create | extend | `load-venue-create-page` | green | loader unit, route composition, admin-pages-visual | CatalogFormShell + sidebar wizard |
| `/admin/venues/[id]/edit` | edit | extend | `load-venue-edit-page` | green | loader unit, route composition, admin-pages-visual | CatalogFormShell + sidebar wizard |

## Catalog details

| Route | State | Figma | Owner | Arch | Visual | Functional | Notes |
|-------|-------|-------|-------|------|--------|------------|-------|
| `/admin/sales/[id]` | overview | `158:2182` | `load-sale-overview-page` | green | green | green | CatalogDetailShell |
| `/admin/sales/[id]/lots` | tab | `179:3059` | `load-sale-lots-page` | green | green | green | |
| `/admin/sales/[id]/registrations` | tab | `188:3692` | `load-sale-registrations-page` | green | green | green | |
| `/admin/sales/[id]/documents` | tab | `195:5588` | `load-sale-documents-page` | green | green | green | |
| `/admin/sales/[id]/media` | tab | `201:8039` | `load-sale-media-page` | green | blocked | green | Saleroom delivery only |
| `/admin/sales/[id]/press` | tab | `222:5415` | `load-sale-press-page` | green | green | green | |
| `/admin/sales/[id]/schedule` | tab | `84:1488`+ | `load-sale-schedule-page` | green | green | green | |
| `/admin/sales/[id]/operations` | tab | extend | `load-saleroom-operations-page` | green | exception | green | Realtime ops |
| `/admin/sales/[id]/telephone-bookings` | tab | extend | `load-sale-telephone-bookings-page` | green | pending | green | |
| `/admin/sales/[id]/activity` | tab | extend | redirect → overview | green | n/a | green | Legacy `#activity` anchor |
| `/admin/lots/[id]` | overview | `261:20532` | `load-lot-overview-page` | green | green | green | CatalogDetailShell |
| `/admin/lots/[id]/images` | tab | `263:8407` | `load-lot-images-page` | green | green | green | |
| `/admin/lots/[id]/documents` | tab | `265:9266` | `load-lot-documents-page` | green | green | green | |
| `/admin/lots/[id]/bids` | tab | `267:9434` | `load-lot-bids-page` | green | green | green | |
| `/admin/lots/[id]/catalogue` | tab | extend | `load-lot-catalogue-page` | green | n/a | green | Redirect to overview `#catalogue` anchor |
| `/admin/lots/[id]/activity` | tab | extend | `load-lot-activity-page` | green | green | green | |
| `/admin/submissions/[id]` | overview | `355:18153` | `load-submission-overview-page` | green | green | green | Shared detail context cache |
| `/admin/submissions/[id]/documents` | tab | `359:20919` | `load-submission-documents-page` | green | green | green | |
| `/admin/submissions/[id]/decision` | review | `314:11647` | `load-submission-decision-page` | green | green | green | Reuses `loadSubmissionReview` |
| `/admin/categories/[id]` | overview | extend | `load-category-overview-page` | green | green | green | Loader + KPI strip |
| `/admin/categories/[id]/children` | tab | extend | `load-category-children-page` | green | green | green | |
| `/admin/categories/[id]/lots` | tab | extend | `load-category-lots-page` | green | green | green | |
| `/admin/categories/[id]/sales` | tab | extend | `load-category-sales-page` | green | green | green | |
| `/admin/categories/[id]/activity` | tab | extend | `load-category-activity-page` | green | green | green | |
| `/admin/artists/[id]` | overview | extend | `load-artist-detail-context` + `artist-overview.vm` | green | green | green | DetailBoardKpiStrip |
| `/admin/venues/[id]` | overview | extend | `load-venue-detail` + `venue-overview.vm` | green | pending | green | DetailBoardKpiStrip |
| `/admin/artists/[id]/lots` | tab | extend | `load-artist-lots-page` | green | green | green | |
| `/admin/artists/[id]/duplicates` | tab | extend | `load-artist-duplicates-page` | green | green | green | |
| `/admin/artists/[id]/review` | review | extend | `load-artist-review-page` | green | blocked | green | Pending-only redirect preserved |
| `/admin/venues/[id]/sales` | tab | extend | `load-venue-sales-page` | green | pending | green | |
| `/admin/venues/[id]/activity` | tab | extend | `load-venue-activity-page` | green | pending | green | |

## People & identity

| Route | State | Figma | Owner | Arch | Visual | Functional | Notes |
|-------|-------|-------|-------|------|--------|------------|-------|
| `/admin/clients` | list | `317:42786` | `load-clients-list-page` | green | green | green | Preview drawer `?client=` |
| `/admin/clients` | preview drawer | `317:42786` | clients board | green | green | green | URL-owned |
| `/admin/clients/[id]` | overview | `324:16598` | `PeopleDetailShell` | green | green | green | 6-tile KPI strip (`324:16688`) in overview tab |
| `/admin/clients/[id]` | won lots | `333:15246` | `AdminUserWonLotsPanel` | green | green | green | DetailBoardShell + card grid |
| `/admin/clients/[id]` | payments | `350:16894` | `AdminUserPaymentsPanel` | green | green | green | KPI strip + payments table |
| `/admin/clients/[id]` | bids tab | `350:16177` | `AdminUserBidsPanel` | green | green | green | Board table reconciled; remaining: channel filter chips + Export CSV per Figma `350:16509` |
| `/admin/staff` | list | `361:21695` | `load-staff-list-page` | green | green | green | CatalogBoardCard + AdminUserListShell |
| `/admin/staff/[id]` | overview | `368:18793` | `PeopleDetailShell` | green | green | green | Permissions tab `374:18083`; staff KPI strip + 4 profile cards + tab counts; Granted badges on permissions 2026-07-25 |
| `/admin/invitations` | list | `437:21628` | `load-invitations-list-page` | green | green | green | CatalogBoardCard |
| `/admin/invitations` | preview drawer | `439:22051` | invitations board | green | blocked | green | Stable seed id |
| `/admin/legal-entities` | list | `403:38686` | `load-legal-entities-list-page` | green | green | green | Preview `?entity=` |
| `/admin/legal-entities` | preview drawer | extend | legal entities board | green | green | green | Contextual impersonation |
| `/admin/legal-entities/[id]` | overview | `416:20661` | `LegalEntityDetailShell` | green | green | green | Route-segment tabs; overview KPI/blockers/activity reconciled 2026-07-25 |
| `/admin/legal-entities/[id]/documents` | tab | `407:40535` | `load-legal-entity-documents-page` | green | green | green | DetailBoardKpiStrip + filtered documents table |
| `/admin/legal-entities/[id]/compliance` | tab | `421:22893` | `load-legal-entity-compliance-page` | green | green | green | DetailBoardShell lifecycle actions |
| `/admin/legal-entities/[id]/stripe` | tab | `421:24101` | `load-legal-entity-stripe-page` | green | green | green | DetailBoardShell Connect summary |
| `/admin/legal-entities/[id]/activity` | tab | `424:25192` | `load-legal-entity-activity-page` | green | green | green | DetailBoardShell + domain events timeline |
| `/admin/legal-entities/[id]/sales` | tab | extend | `load-legal-entity-sales-page` | green | blocked | green | Placeholder until entity↔sale filter |

## Finance

| Route | State | Figma | Owner | Status | Evidence | Notes |
|-------|-------|-------|-------|--------|----------|-------|
| `/admin/finance` | hub | extend | `load-finance-hub-page` | green | loader unit, route composition | AdminTrendKpiBand + AdminFinanceKpiRows |
| `/admin/payments` | list | extend | `load-payments-list-page` | green | loader unit, route composition | CatalogBoardCard |
| `/admin/payments` | manual review | extend | `load-payments-list-page` | green | route composition | `?manualReview=1` seeded |
| `/admin/disputes` | list | extend | `load-disputes-list-page` | green | loader unit, route composition | Open + closed seeded |
| `/admin/disputes` | drawer | extend | disputes board | green | route composition | Local sheet state |
| `/admin/payouts` | list | extend | `load-payouts-list-page` | green | loader unit, route composition | CatalogBoardCard |
| `/admin/payouts/settlement` | workspace | extend | `load-settlement-page` | green | loader unit, route composition | Loader complete |
| `/admin/integrations/xero` | hub | extend | `load-xero-integration-page` | green | loader unit, route composition | Loader complete |

## Compliance & operations

| Route | State | Figma | Owner | Status | Evidence | Notes |
|-------|-------|-------|-------|--------|----------|-------|
| `/admin/compliance/aml` | queue | extend | `load-aml-list-page` | green | loader unit, route composition | Maker/checker seeded |
| `/admin/compliance/source-of-funds` | queue | extend | `load-sof-list-page` | green | loader unit, route composition | Pending case seeded |
| `/admin/compliance/source-of-funds/[id]` | detail | extend | `SofCaseDetailShell` | green | green | green | KPI strip + tab panel wrapper; 2 documents seeded |
| `/admin/condition-reports` | queue | extend | `load-condition-reports-list-page` | green | loader unit, route composition | CatalogBoardCard |
| `/admin/lot-fulfilment` | queue | extend | `load-lot-fulfilment-list-page` | green | loader unit, route composition | Pagination seeded |
| `/admin/onboarding-issues` | queue | extend | `load-onboarding-issues-list-page` | green | loader unit, route composition | CatalogBoardCard |

## Events & saleroom

| Route | State | Figma | Owner | Arch | Visual | Functional | Notes |
|-------|-------|-------|-------|------|--------|------------|-------|
| `/admin/event-rsvps` | list | extend | `load-event-rsvps-hub-page` | green | green | green | Loader complete |
| `/admin/event-rsvps/new` | form | extend | `load-event-rsvp-create-page` | green | blocked | green | |
| `/admin/event-rsvps/[slug]` | detail | extend | `OperationsDetailShell` | green | green | green | Check-in scan preserved |
| `/admin/event-rsvps/[slug]/edit` | form | extend | `OperationsDetailShell` | green | blocked | green | |
| `/admin/event-rsvps/[slug]/check-in` | check-in | extend | `OperationsDetailShell` | green | green | green | Keyboard/mobile flow preserved |
| `/admin/saleroom` | hub | extend (not `447:23777`) | `load-saleroom-hub-page` | green | green | green | WIP Figma excluded |
| `/admin/saleroom/[saleId]` | clerk | extend | `load-saleroom-clerk-page` | green | exception | green | Realtime preserved; outer chrome only |

## Exceptions (tracked)

| Route / pattern | Reason | Owner | Removal condition |
|-----------------|--------|-------|-------------------|
| `/admin/invitations` preview drawer PNGs (6 variants) | Deep-link sheet does not always hydrate before screenshot in headless runs | invitations | Fix off-page invitation hydration or extend ready timeout; then capture 6 remaining PNGs |
| `/admin/disputes` open-case drawer PNGs (6 variants) | Strict-mode `getByRole('dialog')` matches multiple dialogs in headless runs | disputes | Scope drawer locator to dispute sheet; then capture 6 remaining PNGs |
| `/admin/impersonation` standalone page | Redirect-only compatibility path | legal entities | Remove redirect after bookmark grace period (2026-09-01) |
| Saleroom clerk in visual spec | Realtime/WebSocket flaky in CI snapshots | saleroom | Add deterministic mock session fixture before visual baseline |

## Wave 1 parity summary (2026-07-25)

| Tier | Count | Notes |
|------|-------|-------|
| Architecture green | 83/83 | Unchanged — loaders + route composition |
| Visual green (committed PNGs) | 414 | Wave 0 lists + Wave 1 detail/tab/theme variants |
| Visual pending (not in spec) | 4 routes | Venue detail tabs (3), sale telephone-bookings |
| Visual blocked PNGs | 12 | Invitation drawer (6), disputes drawer (6) |
| Visual exception | 3 | Saleroom clerk, sale media, invitation drawer policy |

## Matrix gaps (Wave 1)

- ~~Detail/tab PNG baselines require local stack regenerate (`pnpm ci:visual-baseline`).~~ Regenerated 2026-07-25 (414 PNGs).
- Invitation preview drawer PNGs skipped until hydration timing is fixed.
- Disputes open-case drawer PNGs skipped until dialog locator is scoped.
- Saleroom clerk excluded until deterministic mock session fixture exists.
- Legal entity sales tab placeholder until entity↔sale list filter exists.
- Venue detail tabs not yet in visual spec.
- Client bids tab: channel filter chips + Export CSV still outstanding vs Figma `350:16509`.

## Matrix gaps (Wave 0)

- Invitation preview drawer PNGs skipped in visual spec until hydration timing is fixed (functional URL state remains green).
- Saleroom clerk excluded from visual spec until deterministic mock session fixture exists.
