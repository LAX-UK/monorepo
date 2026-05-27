# Form controls

Use `@auction/ui` primitives for all **visible** form controls in `apps/web`. Do not use raw `<select>`, `<textarea>`, native date/time/range inputs, or `<progress>` in feature code.

## Allowed exceptions

- Hidden `type="file"` only inside `@auction/ui/components/file-upload-trigger` (consumed via upload field components)
- Hidden `type="hidden"` for form state and GET filter preservation
- Native `type="time"` only inside `@auction/ui/components/time-picker` (styled wrapper; cross-browser OS picker)

## Pickers and datetime

| Use case | Component | Notes |
|----------|-----------|-------|
| Auction scheduling | `DateTimePicker` | London zone label; `ResponsivePickerShell` mounts **one** overlay (bottom sheet on small screens, popover on `md+`); I/O via `@auction/ui/lib/datetime` |
| Date-only fields | `DatePicker` | Same responsive shell as `DateTimePicker` |
| Analytics ranges | `DateRangePicker` | Uses `DEFAULT_AUCTION_ZONE` |
| Quiet hours | `TimePicker` | UTC copy in form labels; native time input encapsulated in UI package |
| Static long lists | `Combobox` / `RhfCombobox` | Searchable; use when options > ~20 |
| Async entity search | `AsyncCombobox` / `RhfAsyncCombobox` | Admin pickers (users, lots, legal entities); selected state keeps summary + **Change** (reopens search) + **Clear** |

Datetime I/O must use `@auction/ui/lib/datetime` (`toDatetimeFormString`, `instantFromDatetimeFormString`, etc.) — not ad-hoc `new Date(formString)`.

**Responsive overlays:** `DateTimePicker` and `DatePicker` use `ResponsivePickerShell`, which conditionally mounts either `Popover` (desktop) or `BottomSheet` (mobile) based on viewport — never both at once. Do not hide portaled drawers with CSS alone.

Copy guide:

- **Auction schedule fields**: label as London time; picker shows `Europe/London (GMT/BST)`
- **Quiet hours**: label as UTC; helper text on the section

## RHF wrappers (`apps/web/src/components/ui/`)

- `RhfSelect`, `RhfDateTimePicker`, `RhfTimePicker`, `RhfCombobox`, `RhfAsyncCombobox`, `RhfUserPicker`, `RhfLegalEntityPicker`, `RhfLotPicker`
- Wrappers forward `id`, `aria-invalid`, and `aria-describedby` to the focusable control via `useFormField`
- Entity pickers (`UserPicker`, `AdminLegalEntityPicker`, `AdminLotPicker`) fetch via server actions by default; optional `searchHits` / `resolveHit` overrides for tests

## Filters

- URL-synced filters: `FilterSelect`, `FilterCheckboxGroup`
- `FilterSelect` uses `useTransition` for pending/disabled feedback during navigation (or inject `usePendingNavigation` for shared marketing catalog pending state)
- Optional `serializeValue`, `resetParams`, `clearParams`, and `defaultValue` for marketing/admin param rules (e.g. delete default sort param)
- Long option lists (>20): `FilterSelect` auto-switches to `Combobox`
- Shared trigger styling: `filterSelectTriggerClassName`

## Buttons

- Import `Button` from `@auction/ui/components/button` only (no direct `@radix-ui/*` in `apps/web`)
- Legacy app variants: `primary`, `secondaryOutline`, `tertiary`, `ctaLink`

## CI enforcement

- Root: `pnpm lint:ui-guardrails` (raw buttons, Radix leaks, native controls)
- Web lint: `check-native-form-controls.mjs` (native form control scan)

## Admin auction scheduling workflow

Staff should treat **Save**, **Publish lot**, and **Publish sale** as three different actions:

1. **Draft sale** — build the catalogue in setup, then **Publish sale** on the review step. That schedules the sale and all draft lots together.
2. **Scheduled sale** — each remaining **draft** lot must be **Published** individually once catalogue readiness passes (images, description, seller, sale-window fit).
3. **Save lot form** — persists catalogue fields only; it does **not** change lot status to scheduled.

Schedule validation compares lot open/close times to the sale window at **London minute** precision (form fields use `HH:mm`; database timestamps may include seconds).

If publish is blocked with *"This lot can't open before the sale starts"*, use **Sync to sale window** on the lot schedule section or shrink the sale window in setup, then save and publish again.

### Flagship / production timing audit

When investigating schedule mismatches in production, run:

```sql
SELECT
  s.title, s.status, s.start_time AS sale_start, s.end_time AS sale_end,
  l.id, l.title, l.status AS lot_status,
  l.start_time AS lot_start, l.end_time AS lot_end,
  (l.start_time < s.start_time) AS lot_before_sale,
  EXTRACT(EPOCH FROM (s.start_time - l.start_time)) AS start_diff_sec
FROM sales s
JOIN lots l ON l.sale_id = s.id
WHERE s.title ILIKE '%Flagship Launch%'
ORDER BY l.lot_number NULLS LAST;
```

Interpret `start_diff_sec`:

- Between **0 and 60** (lot slightly before sale) with matching London minutes in the admin UI → sub-minute drift; fixed by minute-precision validators.
- **≥ 60** or UI minutes clearly differ → real window mismatch; sync lot times to the sale window and save before publish.
