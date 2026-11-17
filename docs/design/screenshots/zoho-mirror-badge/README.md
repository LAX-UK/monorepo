# Zoho badge on the order page

Playwright screenshots of the "Mirrored to Zoho" badge (GAP-18, Z1–Z3 in
`docs/design/staff-gaps-delivery-zoho-alerts.md`) on the order page header, rendered from the real
`OrderDetailView` and the app's compiled styles with a fictional order. Named
`{state}-{width}-{theme}.png`: 1440 is the top 1440 x 380 of the page, 375 the 375 x 812 viewport.

- `mirrored`, `pending`, `failed`, `dry_run`: the badge pressed, its details open (a popover at
  1440, a bottom sheet at 375).
- `not_applicable`: an order with nothing to mirror has no badge.
- `mockup-z2-{theme}.png`: the approved mockup's badge row
  (`docs/design/mockups/staff-gaps/index.html`), for comparison.

No horizontal scroll at 375 px in any of them.
