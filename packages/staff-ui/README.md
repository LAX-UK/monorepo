# @auction/staff-ui

The LAX staff design system: one set of tokens, one shell and one set of components for
**LAX Admin** (`apps/shop-admin`) and **Bid admin** (`apps/web/src/app/admin`). Each tool keeps its
own pages and permissions; they look and behave the same.

The rules both tools are audited against, and which of them the kit meets, are in the
[staff design standard](../../docs/design/staff-design-standard.md). When a change here meets or
breaks a rule, update that rule's **Kit** line in the same pull request.

## Why a separate package

`@auction/ui` serves customer surfaces (Bid, Shop, Art, Account) at a 44px, marketing-led scale.
Staff tools are dense, keyboard-first and used all day, so they need their own scale. Keeping the
staff layer here means that scale never leaks into customer pages, while every Radix-backed widget
(sheet, dialog, menu, popover, command, select, checkbox, radio, switch, tooltip, toast) is still
the shared primitive from `@auction/ui`, restyled. The kit owns only what was missing: the visual
atoms (button, field box, badge), the shell, the data table and the record-page building blocks.

## Using it

```css
/* app globals.css, after tailwindcss */
@import "@auction/branding/brand-primitives.css" layer(base);
@import "@auction/branding/lax-system.css" layer(base);
@import "@auction/ui/lax-theme.css";
@import "@auction/staff-ui/theme.css";
@source "../../../../packages/staff-ui/src/**/*.{ts,tsx}";
```

```tsx
import { StaffShell, PageHeader, DataTable, StatusBadge } from "@auction/staff-ui";
import { Receipt } from "@auction/staff-ui/icons";
```

The kit never imports a router: pass your `Link` (e.g. `next/link`) and a `navigate` function.

## Tokens

The values live in the LAX system layer (`@auction/branding/lax-system.css`), which the client
workspace reads too. `src/theme.css` names them for Tailwind and keeps only the staff-only steps;
`src/tokens.ts` names the scales for code and tests, and `tokens.test.ts` fails if any of them
drift. The shell sets `data-lax-density="staff"`. Use the scales only; no ad-hoc values.

| Scale | Steps | Use |
| --- | --- | --- |
| Spacing | 4px unit, 4/8 rhythm: 4, 8, 12, 16, 20, 24, 32, 40, 48 | Tailwind `1 2 3 4 5 6 8 10 12`; `0.5` only for 2px optical nudges |
| Type | `text-staff-2xs` 11/16, `xs` 12/16, `sm` 13/20, `md` 14/20, `lg` 16/24, `xl` 20/28 | Outfit for the interface, Montserrat (`font-staff-display`) for page titles only; `tabular-nums` for money, counts and dates in tables. 12px is the floor for words; `2xs` is for digits in counters and `kbd` glyphs only |
| Weight | 400, 500, 600 | Body, interactive labels, titles |
| Radius | `rounded-staff-xs` 4, `sm` 6, `md` 8, `lg` 12 | One role per step: badges and checkboxes; controls and menu items; menus, popovers and toasts; cards, tables, notices, dialogs and sheets |
| Control height | `h-control-xs` 24, `sm` 32, `md` 36, `lg` 40 | Inline; compact (toolbars, filters); default (forms); the ⌘K field. Coarse pointers grow to 44 (`staff-target`) |
| Row height | 36 compact, 44 comfortable | "Rows" in the Display menu; comfortable for lists whose first cell has a second line |
| Border | 1px hairlines; focus ring 2px offset 2px (inset for rows) | `staff-focus`, `staff-focus-inset` |
| Elevation | flat + hairline; `shadow-staff-xs`; `md`; `lg` | Page, cards, tables; secondary buttons; menus, popovers, bulk bar; dialogs, sheets, ⌘K |
| Icons | lucide, 1.75 stroke; 14, 16, 20 | Badges and compact controls; controls and nav; empty states |
| Layout | nav 240 (56 collapsed), top bar 52, content max 1280, panel 480/640 | |
| Sticky layers | `--spacing-staff-top-bar` 52, `table-header` 36, `bulk-bar-clearance` 72 | The page's scroll padding while each is on screen, so focus is never hidden under them (WCAG 2.4.11) |

### Colour

Every colour is a `light-dark()` pair, so one declaration serves both themes; the scheme follows
`.dark` on `<html>` (both apps' theme switch) or `data-staff-theme="system"`.

- **Neutrals**: `canvas` (page), `surface` (cards, tables), `sunken` (nav, tracks), `raised`
  (menus, dialogs); `line-subtle`, `line`, `line-strong`, `line-hover`; `fg`, `muted`, `subtle`,
  `disabled`; `ink` and `on-ink` for primary buttons and selected controls.
- **Control border**: `control-border` and `control-border-hover` are the only edge of inputs,
  selects, pickers, the money input, checkboxes, radios and the switch's off track. They keep at
  least 3:1 against every surface in both themes (WCAG 1.4.11), which `tokens.test.ts` checks.
  The `line*` hairlines are decorative (cards, tables, secondary buttons) and stay faint.
- **Interaction** is translucent (`staff-overlay-hover`, `-pressed`, `-selected`) so hover reads
  the same on any surface.
- **Status tones**: neutral, info, success, warning, danger, each with `-bg`, `-fg` and `-dot`.
  Labels always name the state; colour is never the only cue. `danger` is red text, `danger-solid`
  the fill behind white text.
- **Product accent**: identity only (product mark, active-nav bar). Navy for Bid admin in light
  mode; neutral ink for LAX Admin, which has no accent yet. Buttons, links, focus and selection stay
  neutral in both products (LAX colour rule, `docs/DESIGN_SYSTEM.md`).

## Components

The primitives both audiences share live in the `@auction/ui` core (`@auction/ui/lax`): Button,
StatusBadge, Menu, Tabs, Count, TextInput and Field, Switch, Notice, Toaster, MetricCell and the
tooltip. Each reads the density its shell sets (`data-lax-density` and `LaxDensityProvider`), so
the client workspace gets the same element one step up the scale. This kit re-exports them under
the names staff pages use (`StaffButton`, `StaffMenu*`, `StaffSwitch`, `StaffToaster`) and adds
only what is staff: `requires` on buttons and menu items, read-only views, and everything below.

- **Shell**: `StaffShell` (grouped, collapsible nav; top bar with ⌘K; product switcher; account
  menu; the keyboard-shortcut registry), `PageHeader`, `StaffBreadcrumbs`, `RecordPager` ("‹ 3 of
  50 ›" with J and K), `OverflowMenu` (disabled reasons and shortcuts per action; steps aside
  while table rows are selected), `CommandPalette`, `AccountMenu`, `useStaffShortcut`,
  `ShortcutsDialog`.
- **Data**: `DataTable` (typed columns; a default sort that only toggles; selection from the
  whole checkbox cell, Shift+click ranges and "Select all N matching"; bulk-action bar; keyboard
  rows; sticky header and optional sticky first column; truncation with a full-value tooltip;
  loading/empty/error; stacked list below 768px), `DataTableToolbar`, `DataViews` (built-in and
  saved views), `TableSearch`, `FilterMenu`, `ActiveFilterChips`, `DensityToggle`,
  `TablePagination`, `ListPageSkeleton`, `DateRangeFilter` (presets plus two date fields, whole
  London days as `YYYY-MM-DD`).
- **Page templates**: every list page is a `ListPage`, every record page a `DetailPage`, so both
  tools read the same.
  - `ListPage`, in one fixed order: the page header (title, one line of purpose, actions with
    Export among the secondary ones); an `AttentionStrip` (one line per issue, linking to the
    filtered view, never dismissable); a `MetricStrip` (at most four numbers in one bordered row,
    with their period; each cell can carry an icon, a tone, a change chip and a sparkline of real
    daily data, and links to the list behind the number when given `href`); then one table surface: view tabs (overflowing into "More"), search ·
    `FilterSheet` · period · `DisplayMenu` (columns, rows, rows per page, reset), the applied
    filters as chips, the table with a `…` menu on every row (`table.rowActions`), and
    pagination. Only the search gets a row of its own: without it, Filter, period and Display join
    the tabs, or a slim row with `resultCount`. The four blocks sit 24px apart and share radius, hairline and fill; from 768px
    the toolbar and the column headers stick under the top bar. Export goes in `exportAction`,
    built from the same query as the rows. Loading, empty, no results, error with retry,
    read-only and no access are props of the template.
    `scripts/check-staff-list-template.mjs` fails CI for a new list page built without it.
  - `DetailPage`: breadcrumbs and the record pager, title with status, key facts and actions, a
    summary card, an optional notice and tabs, then sections beside a rail for activity.
  - Parts: `MetricStrip`, `AttentionStrip`, `FilterSheet`, `DisplayMenu` and
    `useColumnVisibility`, `RowActions` and `rowActionsColumn`, `AccessDeniedState`,
    `ViewOnlyBadge`, `OverflowTabs`.
  - Cells, so a value never looks two ways: `PrimaryCell` (the row's link, optional muted second
    line), `CellLink`, `StaffDate` (London date, exact time with BST/GMT on hover), `StaffMoney`
    in `numeric` columns, and one muted dash (`EmptyValue`) for anything empty, added by the
    table itself.
  - Record panel (`DetailPanel`) and `DetailPage` share one header: title, status, a `meta` line
    of facts, actions and the `…` (`overflow`), then a notice, the summary, sections and
    activity. The summary never repeats a meta fact or a `headerFacts` label (what the title,
    badges or description show), and focus starts on the title.
  - Menus (`StaffMenu`, so `OverflowMenu` and `DisplayMenu` too) are non-modal by default.

  ```tsx
  <ListPage
    title="Payments"
    description="Buyer payments for won lots."
    Link={Link}
    listKey="bid-admin.payments"
    exportAction={<ExportButton filters={controller.exportFilters(query)} … />}
    attention={[{ id: "review", count: 10, label: "payments need manual review", href }]}
    metrics={{ label: "Payments summary", period: "All payments", items }}
    views={<DataViews … />}
    search={<TableSearch fullWidth … />}
    filters={<FilterSheet sections={…} onApply={…} />}
    activeFilters={chips}
    onClearFilters={clear}
    filtered={filtered}
    empty={{ title: "No payments yet" }}
    table={{ columns, data, getRowId, defaultSort, rowActions: { label, actions } }}
    pageSize={{ value: 50, onChange: (size) => navigate(hrefWithLimit(size)) }}
    pagination={{ summary: "1–50 of 312 payments", prevHref, nextHref }}
  />
  ```
- **Overview**: `AttentionList` (queues that need someone, linking to the filtered list).
- **Record pages**: `Section`, `KeyValueList`, `Timeline`, `RelativeTime`, `TruncatedText`,
  `StatGrid`, `ProgressBar`, `StatusBadge` with
  `defineStatusMap` (one map per domain status), `Notice` (info, warning or danger line above
  the work it concerns), `DangerZone` and `DangerZoneAction`.
- **Panels**: `DetailPanel` (side sheet; asks before closing over unsaved changes), `StaffDialog`,
  `ConfirmActionDialog` (Cancel focused first; optional audited `reason` and
  `typedConfirmation`), `StepUpDialog`, `StepUpNotice` and `useStaffStepUp` (the
  `step_up_required` contract), `StaffToaster`, `toastUndo`, `useOptimisticState`.
- **Formatting**: `formatStaffDate`, `formatStaffTime`, `formatStaffDateTime` (with a BST or GMT
  label where the moment matters), `formatStaffRelative`, `formatStaffMoney` (minus sign, ISO code
  for other currencies), all in London time.
- **Forms**: `Field` (label, hint, inline error, wired by context), `TextInput`, `TextArea`,
  `MoneyInput` (pounds on screen, pence in data), `DateInput` and `DateTimeInput` (typed dates,
  an optional calendar, a 24-hour clock and a fixed London zone label), `useUnsavedChanges`,
  `UnsavedChangesGuard` and `confirmDiscardChanges` (ask before unsaved changes are lost),
  `FileDropzone` (drop or browse; the native
  file input stays inside, visually hidden), `EnumSelect` (closed lists, e.g. valid next
  states), `EntityPicker` (search records by name), `FormSection`, `FieldRow`, `FormActions`,
  `FormErrorSummary` (takes focus, links focus each field), `StaffCheckbox`, `StaffRadio`,
  `StaffSwitch`, `ChoiceRow`,
  `SegmentedControl`, `TabNav`.

## Keyboard

⌘K / Ctrl+K opens search from anywhere, and `?` lists every shortcut that works on the page. `/`
focuses the list's search and `f` opens its filters. J and K from anywhere on a list page land on
the rows. In tables: arrows or J and K move between rows, Enter opens the row,
Space or X selects it, Shift extends the selection, Escape clears it. On a record opened from a
list, J and K move to the next and previous record. Panels and dialogs trap focus, close on Escape
and return focus to what opened them.

Pages add keys with `useStaffShortcut({ id, keys, label, group, handler })`. Single-key shortcuts
never fire while typing in a field, and people can turn them off from the account menu.
