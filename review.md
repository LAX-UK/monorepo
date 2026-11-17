Verdict: SHIP

# Final recheck of #1537: LA-4 "Price in Zoho"

Rechecked at `6252dbfd` (base `bd5ad5f5`) against `docs/design/decision-pack-2026-11-17.md` §2, option A. The earlier review's blocking finding (the sort ran only on the current page) is fixed. No defects remain that block.

## What was run

- `apps/shop-admin`: `vitest run src/components/from-zoho src/lib/zoho-price.test.ts src/server/domain/zoho-register.vm.test.ts`. 13 files, 193 tests passed.
- `apps/shop-api`: `vitest run src/application/artwork-register src/routes/admin/v1/admin-artwork-register src/infrastructure/drizzle-register-overview`. 14 files and 231 tests passed. The 2 integration files were skipped in this run because it had no DB.
- **Postgres 16** (migrated with `db:migrate` and `db:roles`, as CI does): `drizzle-register-overview.integration.test.ts`, 3 passed.
  - **The test fails against the old ordering.** I temporarily restored `zoho_modified_at DESC, id` in `listAll`, and "orders by Zoho's price across pages, with every unpriced work last either way" failed. I then reverted the change; the PR branch is untouched.
- `turbo run typecheck` for shop-admin, shop-api and shop-contracts. 30 tasks passed.
- `biome check` on the changed TS/TSX files. Clean.
- An independent pass against §2 and the staff design standard found no blocking defects. Its notes are below.

## Blocking finding from the last review: fixed

- **The sort runs on the server across every page.**
  - `orderOf` (`apps/shop-api/src/infrastructure/drizzle-register-overview.ts:67-77`) orders by `NULLIF(zoho_price, 0) ASC|DESC NULLS LAST, id ASC`, so unpriced works (null or 0) come last in both directions.
  - The `id` tie-break keeps offset paging stable.
  - The default order (`zoho_modified_at DESC NULLS LAST, id`) is unchanged.
  - `zoho_price` is `numeric(12,2)`, so `NULLIF(…, 0)` is well-typed.
- **A test proves the order across pages.** `drizzle-register-overview.integration.test.ts:224` inserts seven works out of price order, including null and `0.00`, and walks them in pages of three, ascending and descending.
- **Contract.** `sort` is an optional `zohoPrice | -zohoPrice` on `AdminRegisterQueueQuerySchema` (`packages/shop-contracts/src/admin-artwork-register.ts:35,72`). An unknown value is a 400, which the route test covers. The /new and /conflicts routes ignore it.
- **The sort is in the URL**, as the staff design standard requires (filters, sort, view and page in the URL).
  - `parseZohoQueueQuery` takes the price sorts only on `tab=all` (`apps/shop-admin/src/server/domain/zoho-register.vm.ts:116-119`), so the Link tab keeps `sort=artist`.
  - `zohoQueueApiQuery` forwards the sort to the API (`:174`).
  - `zohoAllSortHref` builds the link through `zohoQueueHref`, which drops `page`, so a new sort starts at page one.
  - Reload and Back keep the sort.
- **The table is wired with `sort` and `onSortChange`.** `apps/shop-admin/src/components/from-zoho/all-from-zoho-list.client.tsx:232-234` passes them, and `sortValue` is gone. When `onSortChange` is set, staff-ui `DataTable` uses the controlled sort and keeps the server's row order. `aria-sort` is drawn on the header, and the component test checks it.

## Non-blocking finding from the last review: fixed

- **The 375 record screenshots show the row.**
  - All four 375 record PNGs now differ from each other.
  - `record-unpriced-375-light.png` shows "Price in Zoho / Not set in Zoho" in muted text.
  - `record-priced-375-light.png` shows "£4,800.00".
- **The README says the column is desktop-only.** The list column is `mobile: "hidden"`, and `docs/design/screenshots/la-4-zoho-price/README.md` now says so.

## Still fine

The following are unchanged from the last review: information only (no tone, no "Still missing", no filter), hidden by default (TBL-12), the shared `zohoPriceMinor` formatting, and the kit components.

## Non-blocking

1. **No header control returns to the default order.** The default order (newest Zoho edit) belongs to "Zoho last edited", which isn't sortable. After staff sort by price, clicking the header only flips the direction. The way back is "Clear filters", which is shown only when a filter is active, or re-opening the tab. Making the edited column server-sortable would fix this, but that goes beyond option A, so it's a follow-up.
2. **The sort stays applied when its column is hidden.** If staff hide the price column after sorting, or view the list on a phone where the column is always hidden, the list stays in price order with no sort indicator.
3. **"Clear filters" also clears the sort.** `all-from-zoho-list.client.tsx:217` navigates to `{ tab: "all" }`. That's reasonable, but nothing says so.
4. **No index for the price sort.** `NULLIF(zoho_price, 0)` has no index, so a price sort sorts the filtered register in memory. That's fine at register scale.
