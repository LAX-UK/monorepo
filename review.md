Verdict: FIX FIRST

# Review of #1537: LA-4 "Price in Zoho"

Reviewed at `39d88a90` against `docs/design/decision-pack-2026-11-17.md` §2, option A (approved 2026-11-17).

## What was run

- `apps/shop-admin`: `vitest run src/components/from-zoho src/lib/zoho-price.test.ts`. 12 files, 144 tests passed.
- `apps/shop-api`: `vitest run src/application/artwork-register`. 13 files passed (1 skipped), 172 tests passed.
- `turbo run typecheck` for shop-admin, shop-api and shop-contracts. Passed.
- `biome check` on the changed TS/TSX files. Clean.

## Blocking

1. **The sort runs only on the current page, so it can't group unpriced works.**
   `apps/shop-admin/src/components/from-zoho/all-from-zoho-list.client.tsx:77` gives the column a `sortValue`. In staff-ui that means `DataTable` sorts the rows it already has, on the client (`packages/staff-ui/src/data/sort-rows.ts`, `types.ts:31`). The All list is paginated on the server at `ADMIN_REGISTER_PAGE_SIZE = 25` (`packages/shop-contracts/src/admin-artwork-register.ts:29`), always ordered by `zoho_modified_at DESC` (`apps/shop-api/src/infrastructure/drizzle-register-overview.ts:85`).
   - **What goes wrong:** with 300 works and 60 unpriced, clicking "Price in Zoho" only reorders the 25 rows on screen. Page 2 starts again with its own priced and unpriced works. Staff still can't get the list the pack's problem statement asks for ("list the works Zoho has not priced").
   - **Also:** the sort isn't in the URL, which the standard requires ("Filters, sort, view and page live in the URL", `staff-design-standard.md:177`). It's lost on reload and on Back from a record.
   - **Fix:** add a `sort` param (for example `zohoPrice` / `-zohoPrice`) to `AdminRegisterQueueQuerySchema` and `zohoQueueHref`. Order in `listAll` by `NULLIF(zoho_price, 0) ASC|DESC NULLS LAST, id`, so zero reads as unset (as in `zohoPriceMinor`). Pass `sort` / `onSortChange` to the table instead of `sortValue`. Add an API or repository test that unpriced works come last across a page boundary.

## Checked and fine

- **Information only.** `ZohoPriceValue` (`apps/shop-admin/src/components/from-zoho/zoho-price-value.tsx:11-15`) renders `StaffMoney` or "Not set in Zoho" in `text-staff-muted`, with no tone, badge or warning. Nothing is added to `CATALOGUE_GAPS` or `REGISTER_GAP_VALUES`, the Missing filter, or "Still missing". The record test checks there's no "Still missing" (`from-zoho-record.client.test.tsx:151-156`).
- **Record row.** "Price in Zoho" sits in "What Zoho says" (`from-zoho-record.client.tsx:289`), and the detail already carried `zohoPrice`.
- **Hidden by default (TBL-12).** `defaultHiddenColumns: ["zohoPrice"]` (`all-from-zoho-list.client.tsx:230`). Staff who saved column choices before this change also get it hidden, because `columns-menu.tsx:96-98` hides default-hidden ids missing from `known`. The test covers both the hidden default and the shown state.
- **Formatting.** `zohoPriceLabel` now goes through `zohoPriceMinor` (`apps/shop-admin/src/lib/zoho-price.ts:5-15`), so the dialogs, the record and the column all format the same way. Zero, empty and non-numeric values read as unset, as the worker does. Unit tests cover these cases.
- **Contract and read model.** `zohoPrice: string | null` is added to `AdminRegisterAllItemSchema` (`packages/shop-contracts/src/admin-artwork-register.ts:98`), the service maps it (`artwork-register-review.service.ts:202`), and the Fastify response schema is the same typed schema. The test validates the value against the schema (`artwork-register-review.service.test.ts:216-230`). The only consumers are shop-admin and shop-api, and both typecheck.
- **Kit reuse.** Uses `StaffMoney`, `formatStaffMoney` and staff-ui `DataColumn` options. No local styling beyond the `text-staff-muted` token.
- **Light and dark.** The 1440 screenshots read correctly in both themes, and the column is right-aligned as a number.

## Non-blocking

- **375 screenshots don't show the row.** `record-priced-375-*.png` and `record-unpriced-375-*.png` are byte-identical, and the crop ends at "Size", above the new row. Please re-crop so the 375 evidence shows "Price in Zoho". Likewise `list-column-shown-375-*` is identical to `list-default-375-*`, because the column is `mobile: "hidden"` (`all-from-zoho-list.client.tsx:75`). That's acceptable for an optional column, but the README should say the price is a desktop-only column on the list.
