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

## Screenshots

### record

![record-1440-light](record-1440-light.png)
![record-1440-dark](record-1440-dark.png)
![record-375-light](record-375-light.png)
![record-375-dark](record-375-dark.png)

### lax-owns

![lax-owns-1440-light](lax-owns-1440-light.png)
![lax-owns-1440-dark](lax-owns-1440-dark.png)
![lax-owns-375-light](lax-owns-375-light.png)
![lax-owns-375-dark](lax-owns-375-dark.png)

### no-agreement

![no-agreement-1440-light](no-agreement-1440-light.png)
![no-agreement-1440-dark](no-agreement-1440-dark.png)
![no-agreement-375-light](no-agreement-375-light.png)
![no-agreement-375-dark](no-agreement-375-dark.png)

### empty

![empty-1440-light](empty-1440-light.png)
![empty-1440-dark](empty-1440-dark.png)
![empty-375-light](empty-375-light.png)
![empty-375-dark](empty-375-dark.png)

### loading

![loading-1440-light](loading-1440-light.png)
![loading-1440-dark](loading-1440-dark.png)
![loading-375-light](loading-375-light.png)
![loading-375-dark](loading-375-dark.png)

### error

![error-1440-light](error-1440-light.png)
![error-1440-dark](error-1440-dark.png)
![error-375-light](error-375-light.png)
![error-375-dark](error-375-dark.png)

### no-permission

![no-permission-1440-light](no-permission-1440-light.png)
![no-permission-1440-dark](no-permission-1440-dark.png)
![no-permission-375-light](no-permission-375-light.png)
![no-permission-375-dark](no-permission-375-dark.png)

### change-dialog-errors

![change-dialog-errors-1440-light](change-dialog-errors-1440-light.png)
![change-dialog-errors-1440-dark](change-dialog-errors-1440-dark.png)
![change-dialog-errors-375-light](change-dialog-errors-375-light.png)
![change-dialog-errors-375-dark](change-dialog-errors-375-dark.png)

### set-dialog-one-error

![set-dialog-one-error-1440-light](set-dialog-one-error-1440-light.png)
![set-dialog-one-error-1440-dark](set-dialog-one-error-1440-dark.png)
![set-dialog-one-error-375-light](set-dialog-one-error-375-light.png)
![set-dialog-one-error-375-dark](set-dialog-one-error-375-dark.png)

### list-column

![list-column-1440-light](list-column-1440-light.png)
![list-column-1440-dark](list-column-1440-dark.png)
![list-column-375-light](list-column-375-light.png)
![list-column-375-dark](list-column-375-dark.png)

### list-filter

![list-filter-1440-light](list-filter-1440-light.png)
![list-filter-1440-dark](list-filter-1440-dark.png)
![list-filter-375-light](list-filter-375-light.png)
![list-filter-375-dark](list-filter-375-dark.png)

### list-filtered

![list-filtered-1440-light](list-filtered-1440-light.png)
![list-filtered-1440-dark](list-filtered-1440-dark.png)
![list-filtered-375-light](list-filtered-375-light.png)
![list-filtered-375-dark](list-filtered-375-dark.png)
