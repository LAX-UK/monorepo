# Saleroom (`/sales/:id`) data sources

Where marketing UI text comes from and what is not wired yet.

## Hero date line

`formatHeroDateLine` in `apps/web/src/components/sections/saleroom/mappers.ts` appends:

- **Online** — `Online` for `sale.deliveryMode === "online"`.
- **Onsite** — first of `locationCity`, `locationName`, or `locationCounty` (non-empty, trimmed), then the rest of the line is the usual date range and start time.

## Preview / “registration”

There is no separate `registrationCloses` field. When `previewStartTime` is set, the hero’s left cell uses that instant with a relative “Preview opens” label. Otherwise the left cell is hidden.

## Bidding row

- **Scheduled** — relative time until `sale.startTime` (“Bidding starts”).
- **Active** — fixed copy `Live now` with label “Bidding”.

**Ended** / **cancelled** / **draft** do not set the bidding short row.

## Catalog pagination

The public lots endpoint caps `limit` at **48** (`listSaleLotsQuerySchema` in `packages/validators/src/sale.ts`). The first page size is **40** on the sales route; “Load all” requests at most **48** items in one response.

## Lot cards: bids and artist

- **Bid count** — not included on the public `Lot` type; `bidsCountLabel` in `SaleLotCardVM` remains `null` until the API exposes a reliable count.
- **Artist** — the mapper uses `medium` on the lot today; `marketingDetails` and seller profile resolution are not hooked up for the grid.

## Global header and footer

Shell height and layout (nav / footer) are shared with other marketing pages. Tuning them to a specific Figma is a **site-wide** change, not a saleroom-only tweak.
