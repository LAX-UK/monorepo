# Motion 7: staff tools, at rest

Still screenshots at 1440 and 375 px wide, light and dark, of the two staff tools at rest, taken
with reduced motion so nothing is mid-animation. Files are named `{tool}-{state}-{width}-{theme}.png`.

| Tool | State | What it shows |
|---|---|---|
| `bid-admin` | `tabs` | The real `AdminDetailTabs` (three tabs, first active, tab content marked `data-lax-motion="tabpanel"`) with a table |
| `bid-admin` | `drawer` | A kit `Sheet` (the drawer) open over a table |
| `lax-admin` | `list` | The real `staff-ui` `DataTable` |
| `lax-admin` | `panel` | The real `staff-ui` `DetailPanel` (the LAX Admin drawer) open over the table |

LAX Admin has no tab panels and never had a row stagger; its drawers and panels are the kit Sheet,
which takes staff timings from the staff scope (step 3). Nothing changes at rest in either tool.

## How they were made

No database, auth or API stack is available in a cloud run, so these use mocked data. The real
components are rendered by two opt-in Vitest captures that write HTML only when `MOTION7_OUT` is set:

```bash
MOTION7_OUT=/tmp/m7 pnpm --filter @auction/web exec vitest run src/components/dashboard/primitives/admin-detail-tabs.capture.test.tsx
MOTION7_OUT=/tmp/m7 pnpm --filter @auction/staff-ui exec vitest run src/motion-7.capture.test.tsx
```

The HTML is then loaded in Chromium (Playwright, 1440x900 and 375x812) with the production CSS of
each app (`apps/web` and `apps/shop-admin`, `.next/static/css`), the `dark` class on `<html>` for dark.
