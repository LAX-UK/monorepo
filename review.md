Verdict: SHIP

Security review of PR #1468 (hotfix/public-lot-reserve-strip-v2 -> release), head ab6abf94, one commit on top of release d68d5e6b (the current release tip, which includes #1456). This is the rebuild of #1463 after #1456 (sealed-lot price masking) merged.

Scope on release: sale detail, sale lots, `GET /sales` previews, /users/me/bids, /users/me/watchlist, /users/me/portfolio, lot detail, lot list and realtime messages. Release has no /me/account/bids or /me/account/purchases routes, so those do not apply on this line.

Local results (frozen lockfile, packages built): full API suite with --maxWorkers=2, 286 files / 1657 tests passed (11 files / 15 tests skipped, env-gated); `tsc --noEmit` clean for apps/api; `biome check .` clean at the repo root; apps/api `lint` (biome plus route and error-status scripts) clean.

GitHub: the CI workflow (`verify` job: migrate, biome, lint, typecheck, test, build, gitleaks) passed on head ab6abf94. No re-run was needed. The combined commit-status API reports `pending` with no statuses attached; that is the default when nothing posts a status, and it does not mean a check is outstanding.

Commit: a single commit; the message has no co-author or generated-by trailer.

Confirmed behaviour:
- Non-staff (anonymous, client, missing role) receive `hasReserve` / `reserveMet` and no `reservePrice` on sale detail, sale lots, /me/bids, /me/watchlist and /me/portfolio. Lot detail and the lot list already used `maskLotForPublicView` and are unchanged. `GET /sales` previews go through `mapLotToSummary`, which has no reserve field. Realtime lot events carry only `reserveMet`.
- A missing role normalises to client, which has no staff pricing capability, so it is treated as non-staff (mutation-checked, see below).
- Staff with `auction.manage` / `catalogue.write` read the lot as stored, as before. On release the sale-read `canPreview` gate and the mask's staff check are the same capability test, so skipping the mask when `canPreview` is true changes nothing for any viewer.
- #1456's sealed price masking still applies everywhere it did: sale detail and sale lots now mask through `maskLotForPublicView` (which includes the sealed mask); the dashboard masks each lot before `computeLotCheckoutPricing`; lot detail masks before pricing; `GET /sales` previews keep `maskSealedLotPriceForViewer`. Each path masks once, and `reserveMet` is derived from the real price as on lot detail.
- Open sealed lots are ordered by starting price on sale page priceAsc/priceDesc, list hammerDesc, the watchlist SQL page sort and the in-memory watchlist sort.
- The diff only masks and sorts: no schema, migration, payment, write-path or web change.

Mutation check (each hunk reverted on its own, 27 affected test files re-run):
- killed: sale-detail mask, sale-lots mask, dashboard mask before pricing, dashboard pricing from the unmasked lot, portfolio mask, /me/bids viewer wiring, /me/watchlist viewer wiring, `publicSortPrice`, `shownPriceOrder` expression, sale page priceAsc, list hammerDesc, and a staff check that treats a missing role as staff.
- survived: findings 1 and 2.

Findings

1. (non-blocking, test gap) apps/api/src/repositories/drizzle-watchlist.repository.ts:94 - reverting the watchlist page sort to `current_price` is not caught by any test. The path is reached only when a `limit` is passed to `listWithLots`. A rendered-SQL assertion like the one in `drizzle-lot.repository.price-order.test.ts` would cover it. Same as the #1463 review.

2. (non-blocking, defensive) apps/api/src/services/user-dashboard-read.service.ts:60 - the fallback mask for a lot missing from the enriched map is not reachable in tests and survives removal. The code is correct; keep it and consider a unit test.

3. (non-blocking, note) apps/api/src/routes/users.ts:237 and :243 - /me/portfolio computes checkout pricing before the mask. Portfolio lots are won lots, which are not open sealed lots, so the shown price and the stored price are the same and no hidden figure is involved. The `"reservePrice" in lotRow` guard is always true for `lotService.list` rows; it only narrows the type. If the order is ever touched, masking first would match the dashboard.

4. (non-blocking, pre-existing, out of scope) apps/api/src/lib/lot-public-view.ts:29 - for an open sealed lot, `reserveMet` is derived from the real price, as on lot detail and in realtime messages. The PR is consistent with that. Product should confirm it is intended for sealed lots.

5. (non-blocking, process) Merging to release deploys production. CI is green on the current release tip; merging needs the owner's go-ahead.

No blocking findings.
