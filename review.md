Verdict: SHIP

Security review of PR #1463 (hotfix/public-lot-reserve-strip -> release, "Hotfix: strip reserve amounts from public and bidder lot reads"), head 51fcabe1. This is a rebuild of #1462 for the release line, not a cherry-pick.

Scope on release: sale detail, sale lots, /me/bids, /me/watchlist, /me/portfolio. Release has no /me/account/bids or /me/account/purchases routes. Lot detail and the lot list already used `maskLotForPublicView`, and `GET /sales` previews go through `mapLotToSummary`, which has no reserve field. Realtime lot events carry only `reserveMet`.

Local results (release worktree, frozen lockfile, packages built): affected API tests 26 files / 182 passed; `tsc --noEmit` clean for apps/api; biome clean on the 10 changed files. GitHub: no check runs were reported on this PR when the review ran. Confirm CI is green before merging.

Confirmed behaviour:
- Non-staff (anonymous, client, missing role or staff role) receive `hasReserve` / `reserveMet` and no `reservePrice`. Release's `maskLotForPublicView(role, staffRole)` signature is used correctly, with `userRole` / `userStaffRole` from the auth middleware.
- Staff with `auction.manage` / `catalogue.write` (and `canPreview` readers on sale reads) are unchanged.
- Open sealed lots are shown at the starting price on every changed path, consistent with release lot detail. Checkout pricing is computed after masking.
- Sale page priceAsc/priceDesc, list hammerDesc, the watchlist SQL sort and the in-memory sort use the starting price for open sealed lots.
- No schema, migration or web changes. On release the seller dashboard reads seller lots from the seller-lots endpoint and uses sale reads only for titles, so sellers do not lose their own reserve figures.

Mutation check (each hunk reverted on its own, affected tests re-run):
- killed: sale-detail mask, sale-lots mask, dashboard enrich mask, portfolio mask, /me/bids and /me/watchlist viewer wiring, `publicSortPrice`, `shownPriceOrder`.
- survived: see findings 1-2.

Findings

1. (non-blocking, test gap) apps/api/src/repositories/drizzle-watchlist.repository.ts:93 - reverting the watchlist page sort to `current_price` is not caught by any test. It is reached only when a `limit` is passed. Add a rendered-SQL assertion.

2. (non-blocking, defensive) apps/api/src/services/user-dashboard-read.service.ts:60 - the fallback mask is unreachable in tests and survives removal. It is correct; keep it.

3. (non-blocking, pre-existing, out of scope) apps/api/src/lib/lot-public-view.ts:33 - for an open sealed lot, `reserveMet` is computed from the real price, as on lot detail. The PR is consistent with that. Product should confirm it is intended.

4. (non-blocking, pre-existing, out of scope) apps/api/src/services/sale-list-read.service.ts:99 - `GET /sales` preview summaries copy `currentPrice` without the sealed mask (no reserve involved). Same follow-up as on main.

5. (non-blocking, process) - no CI runs are attached to this PR yet. Merging to release deploys, so it needs green CI and the owner's go-ahead. Coordinate with #1456 so that each path keeps a single mask.

Residual: the broad non-staff endpoint sweep was done on main. On release only the changed paths plus lot detail, lot list, sales list and realtime were checked, together with a spot-check of route handlers that return data.
