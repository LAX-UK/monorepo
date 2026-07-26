# Staff UI architecture (SOLID)

Staff surfaces under `apps/web/src/app/admin` follow a layered composition model. This document is the enforcement contract for the staff dashboard redesign program.

## Layer boundaries

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Route | `app/admin/**/page.tsx` | Authorize, parse search params, compose shell + board. No column defs, label maps, or multi-source orchestration. |
| Loader | `lib/admin/**/load-*-page.ts` | Fetch, failure handling, pagination model assembly. |
| Page model | `lib/admin/**/build-*-page-model.ts` | Pure URL/query → filter state. |
| View model | `lib/admin/**/*.vm.ts`, `lib/data/view-models/**` | Domain/API → stable UI row contracts. |
| Shell | `components/admin/catalog/*-shell.tsx` | Layout landmarks, sticky chrome, KPI slot, empty/error contracts. |
| Board | `components/admin/*-board/` | Tables, drawers, mobile cards — view-model rows only. |

## Dependency rules

1. `lib/admin` must **never** import `@/components/**`.
2. Contracts live in `lib/admin/**/*.types.ts`, `lib/data/contracts`, `@auction/types`.
3. Domain policy stays in `@auction/domain`; UI formats only.
4. Shell variants extend through typed slots (`catalog`, `queue`, `people`, `finance`, `hub`) — not route-name conditionals inside shared components.

## Shell variants

| Variant | Shell component | Routes |
|---------|-----------------|--------|
| `catalog` | `CatalogListShell` | Sales, lots, submissions, categories, artists, venues |
| `queue` | `CatalogListShell variant="queue"` | Finance queues, compliance, fulfilment, onboarding |
| `people` | `CatalogListShell` (via `PeopleListShell` alias) | Clients, staff, invitations, legal entities |
| `finance` | `CatalogListShell variant="queue"` | Payments, payouts, disputes |
| `hub` | `StaffHubShell` | Dashboard data widgets, finance home, Xero, event RSVPs, saleroom, onboarding |

Detail hubs use **`CatalogDetailShell`** with registered tabs.

Typed contracts: `lib/admin/staff-shell-variants.types.ts`.

## Hub loaders (orchestration boundary)

| Route | Loader |
|-------|--------|
| `/admin` | `load-admin-dashboard-page.ts` |
| `/admin/finance` | `finance/load-finance-hub-page.ts` |
| `/admin/integrations/xero` | `finance/load-xero-integration-page.ts` |
| `/admin/payouts/settlement` | `finance/load-settlement-page.ts` |
| `/admin/event-rsvps` | `events/load-event-rsvps-hub-page.ts` |
| `/admin/saleroom` | `saleroom/load-saleroom-hub-page.ts` |
| `/admin/onboarding-issues` | `load-onboarding-issues-list-page.ts` |
| `/admin/categories/[id]` | `categories/load-category-overview-page.ts` |

List routes use `loadAdmin*ListPage` or `load-*-list-page.ts`.

## Presenter adapters

Central registry: `lib/admin/staff-presenter-adapters.ts`

- Status labels/variants → `lib/presenters/status/admin-status-registry.ts`
- Delivery mode, lot auction type → presenter registries under `lib/presenters/**`
- Capability labels → `lib/admin/capability-presenter.ts`

Routes and boards import presenters through the adapter registry or VMs — never inline label maps.

## KPI bands

Use **`AdminTrendKpiBand`** everywhere. `AdminListKpiStrip` is deprecated.

## Board cards

Use **`CatalogBoardCard`** / `catalogBoardCardClassName` for list boards — neutral border + `--shadow-rest`.

## Automated checks

```bash
pnpm lint:lib-admin-boundaries      # lib/admin → components
pnpm lint:staff-legacy-shell        # AdminListKpiStrip ban
pnpm lint:staff-route-composition   # routes → loaders; no inline orchestration/display policy
pnpm lint:ui-guardrails             # UI primitives
```

`check-staff-route-composition.mjs` enforces:

- List/hub/detail/form routes must not import `@/lib/data/http/*` without a loader (metadata-only HTTP in `generateMetadata` is allowed).
- No inline `Promise.all` / `build*PageModel` orchestration in routes without a loader.
- No inline `columns` / `statusLabels` display policy in routes.
- Route `page.tsx` files over 120 lines require a loader.

## Intentional exceptions

Document any exception in `docs/ui/redesign-program.md` with owner and removal condition. Do not add permanent allowlist entries without a tracked removal issue.

Contract tests: `staff-presenter-adapters.test.ts`, `load-*-page.test.ts`.
