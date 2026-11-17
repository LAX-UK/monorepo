# Consignor field on the From Zoho record and the All list (ZI-5, PR 3)

Screenshots of the Consignor section on a From Zoho record (`from-zoho/[registerId]`) and the
Consignor column and filter on the All artworks list, light and dark, 1440 and 375 px, at 2x.
Named `{view}-{width}-{theme}.png`. Rendered from the real components with fixture data. Names
are made up. The page is read on 17 November 2026.

- `record`: a client consignor with an agreement in force, changed from LAX with a reason.
- `lax-owns`: LAX owns the work, so there is no agreement line.
- `no-agreement`: a client with no current agreement, linked to their page to add one.
- `empty` (no consignor set), `loading` (section skeleton while it streams in), `error` (Try
  again) and `no-permission` (Read-only, who cannot read consignor agreements).
- `change-dialog-errors`: Change consignor submitted unchanged and without a reason: two
  problems, listed at the top and beside each field.
- `set-dialog-one-error`: Set consignor with "A client" and no client chosen: one problem,
  beside its field only.
- `list-column`: the optional Consignor column turned on from Display (hidden by default; on a
  phone it stays off the card, like Price in Zoho).
- `list-filter`: the Consignor filter with its counts.
- `list-filtered`: the list narrowed to one consignor, with the removable chip.

None of the shots scrolls sideways.
