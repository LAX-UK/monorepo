# @auction/staff-ui

The LAX staff design system: one set of tokens, one shell and one set of components for
**LAX Admin** (`apps/shop-admin`) and **Bid admin** (`apps/web/src/app/admin`). Each tool keeps its
own pages and permissions; they look and behave the same.

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
@import "@auction/staff-ui/theme.css";
@source "../../../../packages/staff-ui/src/**/*.{ts,tsx}";
```

```tsx
import { StaffShell, PageHeader, DataTable, StatusBadge } from "@auction/staff-ui";
import { Receipt } from "@auction/staff-ui/icons";
```

The kit never imports a router: pass your `Link` (e.g. `next/link`) and a `navigate` function.

## Tokens

Defined once in `src/theme.css` (what the browser reads) and named in `src/tokens.ts` (what code
and tests read); `tokens.test.ts` fails if they drift. Use the scales only; no ad-hoc values.

| Scale | Steps | Use |
| --- | --- | --- |
| Spacing | 4px unit, 4/8 rhythm: 4, 8, 12, 16, 20, 24, 32, 40, 48 | Tailwind `1 2 3 4 5 6 8 10 12`; `0.5` only for 2px optical nudges |
| Type | `text-staff-2xs` 11/16, `xs` 12/16, `sm` 13/20, `md` 14/20, `lg` 16/24, `xl` 20/28 | Outfit for the interface, Montserrat (`font-staff-display`) for page, panel and dialog titles; `tabular-nums` for money, counts and dates in tables |
| Weight | 400, 500, 600 | Body, interactive labels, titles |
| Radius | `rounded-staff-xs` 4, `sm` 6, `md` 8, `lg` 12 | Badges and checkboxes; controls; cards, menus, tables; dialogs and sheets |
| Control height | `h-control-xs` 24, `sm` 32, `md` 36, `lg` 40 | Inline; compact (toolbars, filters); default (forms); the ⌘K field. Coarse pointers grow to 44 (`staff-target`) |
| Row height | 36 compact, 44 comfortable | Table density toggle |
| Border | 1px hairlines; focus ring 2px offset 2px (inset for rows) | `staff-focus`, `staff-focus-inset` |
| Elevation | flat + hairline; `shadow-staff-xs`; `md`; `lg` | Page, cards, tables; secondary buttons; menus, popovers, bulk bar; dialogs, sheets, ⌘K |
| Icons | lucide, 1.75 stroke; 14, 16, 20 | Badges and compact controls; controls and nav; empty states |
| Layout | nav 240 (56 collapsed), top bar 52, content max 1280, panel 480/640 | |

### Colour

Every colour is a `light-dark()` pair, so one declaration serves both themes; the scheme follows
`.dark` on `<html>` (both apps' theme switch) or `data-staff-theme="system"`.

- **Neutrals**: `canvas` (page), `surface` (cards, tables), `sunken` (nav, tracks), `raised`
  (menus, dialogs); `line-subtle`, `line`, `line-strong`, `line-hover`; `fg`, `muted`, `subtle`,
  `disabled`; `ink` and `on-ink` for primary buttons and selected controls.
- **Interaction** is translucent (`staff-overlay-hover`, `-pressed`, `-selected`) so hover reads
  the same on any surface.
- **Status tones**: neutral, info, success, warning, danger, each with `-bg`, `-fg` and `-dot`.
  Labels always name the state; colour is never the only cue. `danger` is red text, `danger-solid`
  the fill behind white text.
- **Product accent**: identity only (product mark, active-nav bar). Navy for Bid admin in light
  mode; neutral ink for LAX Admin, which has no accent yet. Buttons, links, focus and selection stay
  neutral in both products (LAX colour rule, `docs/DESIGN_SYSTEM.md`).

## Components

- **Shell**: `StaffShell` (grouped, collapsible nav; top bar with ⌘K; product switcher; account
  menu), `PageHeader`, `StaffBreadcrumbs`, `OverflowMenu`, `CommandPalette`, `AccountMenu`.
- **Data**: `DataTable` (typed columns, sorting, selection, bulk-action bar, keyboard rows,
  loading/empty/error, stacked list below 768px), `DataTableToolbar`, `DataViews` (built-in and
  saved views), `TableSearch`, `FilterMenu`, `ActiveFilterChips`, `DensityToggle`,
  `TablePagination`, `ListPageSkeleton`.
- **Record pages**: `Section`, `KeyValueList`, `Timeline`, `StatGrid`, `StatusBadge` with
  `defineStatusMap` (one map per domain status), `Notice` (info, warning or danger line above
  the work it concerns), `DangerZone` and `DangerZoneAction`.
- **Panels**: `DetailPanel` (side sheet), `StaffDialog`, `ConfirmActionDialog`, `StaffToaster`.
- **Forms**: `Field` (label, hint, inline error, wired by context), `TextInput`, `TextArea`,
  `MoneyInput` (pounds on screen, pence in data), `FileDropzone` (drop or browse; the native
  file input stays inside, visually hidden), `EnumSelect` (closed lists, e.g. valid next
  states), `EntityPicker` (search records by name), `FormSection`, `FieldRow`, `FormActions`,
  `FormErrorSummary`, `StaffCheckbox`, `StaffRadio`, `StaffSwitch`, `ChoiceRow`,
  `SegmentedControl`, `TabNav`.

## Keyboard

⌘K / Ctrl+K opens search from anywhere. In tables: arrows move between rows, Enter opens the row,
Space selects it, Escape clears the selection. Panels and dialogs trap focus, close on Escape and
return focus to what opened them.
