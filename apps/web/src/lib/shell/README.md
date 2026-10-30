# Dashboard shell architecture

Programmable app chrome for staff (`/admin`), finance, and client (`/dashboard`) shells.

## Layers

| Layer | Path | Role |
|-------|------|------|
| Contract | [`contracts.ts`](contracts.ts) | `ShellConfig`, nav types — no React |
| Builder | [`build-shell-config.ts`](build-shell-config.ts) | Role → nav + mobile tabs |
| Organisation workspace | [`components/workspace/workspace-shell.tsx`](../../components/workspace/workspace-shell.tsx) | The 48px bar, the role-shaped sidebar, the content column, phone tabs and More, search |
| Staff frame | [`components/shell/bid-staff-frame.tsx`](../../components/shell/bid-staff-frame.tsx) | The staff kit's `StaffShell` for Bid admin |
| Module injection | `app/admin/layout.tsx`, `app/dashboard/layout.tsx` | Pass slots into `buildShellConfig` |

## Header slot semantics

`ShellConfig.header` exposes two extension points:

| Slot | Build input | Render order (staff) | Use for |
|------|-------------|----------------------|---------|
| `actionsSlot` | `headerActionsSlot` | Before theme toggle | Module actions (notification bell, badges) |
| `extraSlot` | `headerExtraSlot` | After actions, before theme | Rare overrides only |

**Staff header layout (fixed):**

```
leading: search (pill lg+, icon <lg) | trailing: actionsSlot → extraSlot → theme → account
```

Do **not** add module routes or data fetching inside the shells or their bars. The layout loads data and passes it in.

## UX surface tiers

| Surface | Purpose | Examples |
|---------|---------|----------|
| **Header** | Global utilities + cross-cutting alerts | Search, theme, attention bell |
| **Dashboard widgets** | Role-scoped shortcuts | Greeting CTAs, hub quick links, my-queue |
| **Sidebar / mobile tabs** | Canonical navigation | Sales, lots, submissions |
| **Command palette** | Power-user jump navigation | ⌘K search |

Avoid duplicating the same shortcut in header and dashboard unless intentional (theme: header + account menu is OK).

## Chrome primitives

Staff shell icons use [`ChromeSurface`](../lib/layout/chrome-surface.ts) = `"shell"`:

- [`ShellChromeIconButton`](../components/layout/shell-chrome-icon-button.tsx) — 44×44 icon controls
- [`ThemeToggle`](../components/layout/theme-toggle.tsx) with `surface="shell"`
- [`HeaderSearchTrigger`](../components/layout/header-search.tsx) with `surface="shell"` and `layout="both"`

Marketing/public header uses `surface="marketing"` (default) and `site-header-chrome` tokens.

## Staff header attention

Bell items are built server-side in admin layout:

```tsx
buildStaffHeaderAttentionItems(navCounts, userRole, staffRole)
```

Specs live in [`build-staff-header-attention-items.ts`](../lib/admin/build-staff-header-attention-items.ts). Subset of dashboard `ATTENTION_ROW_SPECS` — finance/compliance focus, **no submissions** in header.

To add a new bell item: append to `STAFF_HEADER_ATTENTION_SPECS`, gate with `CapabilityRequirement`, pass counts via `navCounts`.

## Scaling checklist — new global affordance

1. Decide tier: header vs sidebar vs palette (not all three).
2. Add UI in module layout via `headerActionsSlot` / `headerExtraSlot`.
3. Use `ShellChromeIconButton` or existing shell primitives for styling.
4. Add vitest beside the shell part you change (`components/workspace/*.test.tsx`).

## List pages

Every list page is built on the staff kit's `ListPage` template (`@auction/staff-ui`). Reference
implementation: [`/admin/payments`](../app/admin/(finance)/payments/page.tsx).

```
page.tsx → load*ListPage (server) → *-staff-list.vm.ts (rows, views, metrics) → *StaffList (ListPage)
```

| Piece | Payments example |
|-------|------------------|
| Loader | [`load-payments-list-page.ts`](../admin/finance/load-payments-list-page.ts) |
| View model | [`payments-staff-list.vm.ts`](../admin/finance/payments-staff-list.vm.ts) |
| List | [`PaymentsStaffList`](../../components/admin/payments/payments-staff-list.tsx) |
| Money actions | [`usePaymentMoneyActions`](../../components/admin/payments/payment-money-actions.tsx) |

`scripts/check-staff-list-template.mjs` lists the pages still to move onto `ListPage`; a new
list page that is not on it fails CI.

## Scaling checklist — new admin module page

- **List:** `ListPage` from `@auction/staff-ui` with a `*-staff-list.vm.ts` — see payments.
- **Detail tab:** `detail-board/` primitives + entity VM — see [`detail-board/README.md`](../components/admin/catalog/detail-board/README.md).
- **Entity attention:** `packages/domain` contributors (sale-scoped) or sidebar/header nav-count specs (`staff-nav.ts`, `build-staff-header-attention-items.ts`).

## Related docs

- Detail tabs: [`components/admin/catalog/detail-board/README.md`](../components/admin/catalog/detail-board/README.md)
- Status pipeline: `lib/presenters/status/`
- Delivery mode pipeline: `lib/presenters/delivery-mode/`

## Theme tokens

Shell chrome utilities (`bg-shell-page-bg`, `bg-shell-search-bg`, `border-shell-stroke`, `nav-active-*`) are declared in `app/globals.css` `@theme`. Every such token **must** have a matching override inside `html.dark` in `styles/tokens-dark.css` — see `lib/theme/shell-theme-tokens.test.ts`.
