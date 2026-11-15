Verdict: SHIP

Security review of PR #1462 (fix/public-lot-reserve-strip -> main), head dfd392d2.

Scope checked: sale detail, sale lots, /me/bids, /me/account/bids, /me/watchlist, /me/portfolio, /me/account/purchases; plus a read-only sweep of other non-staff outputs (lot writes, bidding responses, realtime messages, saleroom display, artists, exports/CSV/PDF, buyer purchases/checkout, emails and notification fanout, web SSR/OG/JSON-LD inputs, public cache headers). No non-staff path was found that returns a reserve amount after this change. Seller-owned views (consignment, agreement, after-sale, reoffer requests) still show the seller their own reserve, as intended.

Local results: affected API tests 43 files / 366 passed; persistence lot tests 17 passed (1 env-gated skip); `tsc --noEmit` clean for apps/api and packages/persistence; biome clean on the 18 changed files. GitHub checks: ci-result success, all api/web/shop vitest shards, build, role-contract and browser gates green (two gates skipped by path filter).

Confirmed behaviour:
- Non-staff (anonymous, client, missing role) receive `hasReserve` / `reserveMet` and no `reservePrice`; `maskLotForPublicView` treats an undefined role as non-staff.
- Staff with `auction.manage` / `catalogue.write` (and `canPreview` readers on sale reads) receive the lot as stored; unchanged.
- Open sealed lots are shown at the starting price on every changed path, using the same mapper as lot detail; checkout pricing is computed after masking.
- Price sorts (sale page priceAsc/priceDesc, list hammerDesc, watchlist SQL and in-memory sort) use the shown price for open sealed lots; sale page sort keeps lot-number and id tie-breakers, so ordering among sealed lots does not depend on bids.
- No schema, migration or web changes. Web list parsers accept rows without `reservePrice`; reserve badges on the lot page still come from lot detail (`hasReserve` / `reserveMet`).

Mutation check (each hunk reverted on its own, affected tests re-run):
- killed: sale-detail mask, sale-lots mask, dashboard enrich mask, purchase-row mask, /me/bids, /me/portfolio, /me/account/bids, /me/watchlist viewer wiring, `publicSortPrice`, `shownPriceOrder` (persistence test).
- survived: see findings 1-3.

Findings

1. (non-blocking, test gap) apps/api/src/routes/users/dashboard.routes.ts:107 and apps/api/src/services/user/user-dashboard-http-application.service.ts:131 - the viewer wiring for `/me/account/purchases` has no test. Treating the caller as staff at either point leaves all tests green. The shared row mask is covered through /me/portfolio. Add an account-purchases case to `public-lot-reserve.routes.test.ts`.

2. (non-blocking, test gap) packages/persistence/src/repositories/drizzle-watchlist.repository.ts:93 - reverting the watchlist page sort to `current_price` is not caught by any test. The path is reached only when a `limit` is passed (the current `/me/watchlist` route does not pass one), so the risk is low. A rendered-SQL assertion like the lot-list one would cover it.

3. (non-blocking, defensive) apps/api/src/services/user-dashboard-read.service.ts:110 - the fallback mask (when a lot is missing from the enriched map) is not reachable in tests and survives removal. The code is correct. Keep it, and consider a unit test.

4. (non-blocking, consistency) apps/api/src/lib/lot-public-view.ts:89 vs packages/persistence/src/repositories/lot/lot-list-filters.ts:121 - the SQL shown-price order also sends an ended lot with an open result to its starting price. `publicSortPrice`, used by the in-memory watchlist sort (apps/api/src/services/watchlist.service.ts:115, the path `/me/watchlist` uses today), does not. Raw lots from `findByIds` carry no `resultPending`, so those lots are ordered by a price the viewer cannot see. This predates the PR, but the helper should match the SQL expression. Suggest a follow-up.

5. (non-blocking, pre-existing, out of scope) apps/api/src/lib/lot-public-view.ts:36 - for an open sealed lot, `reserveMet` is computed from the real price, so non-staff learn whether hidden bids have reached the reserve. This matches lot detail and the realtime messages, so the PR is consistent. Product should confirm that this is intended for sealed lots.

6. (non-blocking, pre-existing, out of scope) apps/api/src/services/sale-list-read.service.ts:125 with apps/api/src/lib/mappers.ts:38 - `GET /sales` preview summaries copy `currentPrice` without the sealed mask. They carry no reserve, but an active sealed lot in a preview would show its stored price rather than the starting price. Suggest a follow-up that applies the same sealed mask before `mapLotToSummary`.

7. (non-blocking, latent) apps/api/src/services/sale/sale-read.ts:121 - `listSalesForPublicApi` returns full lots without the mask. It has no route caller today. Mask or remove it so that wiring it up later cannot reintroduce the field.

8. (non-blocking, note) apps/api/src/services/sale/sale-read.ts:71 - sale reads give the stored lot to any `canPreview` reader (this includes `admin.read`), while lot detail masks for anyone without `auction.manage` / `catalogue.write`. Staff only and unchanged by this PR; listed so the staff boundary is documented.

9. (non-blocking, note) apps/web/src/lib/data/http/dashboard.schema.ts:41 and apps/web/src/lib/data/http/sales.schema.ts:127 - the web list parsers use `lotSchema`, which drops `hasReserve` / `reserveMet`. No list view renders reserve status today, so nothing visible changes, but a future list badge would need `publicLotViewSchema`.

Overlap: the PR description notes #1456 (sealed mask on the same paths). Whichever merges second must keep a single mask per path, so that `reserveMet` is not computed from an already-masked price.
