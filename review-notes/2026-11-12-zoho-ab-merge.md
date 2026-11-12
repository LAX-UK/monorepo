# Review: Zoho A/B merge of main (2026-11-12)

Independent review of only the merge-of-main and follow-up commits on:

- **#1284** `ic-a-zoho-status-compare-and-set` @ `41078e91`
- **#1285** `ic-b-zoho-sold-while-live` @ `85a351f9`

Base: `origin/main` @ `628af257`. Both branches already contain it, so their merge base is `628af257`.

## Verdicts

| PR | Verdict |
|---|---|
| #1284 | **SHIP**. Two follow-ups below are optional and don't block. |
| #1285 | **SHIP**. The conflict resolution didn't break the sold-while-live pause. |

## Scope reviewed

- #1284 merges: `f09156ce`, `5df215c4` and `28d1d2f5` (journal and migration-upgrade test only), plus `41078e91`, which contains the real work: 14 files changed in the combined diff. Unifying the Zoho Status rule with main's sync health page happens there.
- #1285: `b7d31c59` (A merged into B; 11 files in the combined diff, which includes the 10-file conflict set) and `85a351f9` (puts back the `readFileSync` import in `migration-main-upgrade.integration.test.ts`).
- `git merge-tree --write-tree origin/main origin/<branch>` is clean for both branches.

## Single source: `packages/artwork-register-contracts/src/zoho-status.ts`

- `ZOHO_STATUS_FOR_PLACE` covers all 8 `WhereItIsKey`s. `zohoStatusFor` is `deriveWhereItIs` followed by a place lookup. `zohoStatusByOfferState(withdrawnShows)` is built by calling `zohoStatusFor` once per state with `ref: null` and `from: null`. That is sound for this purpose:
  - Within a state, the place depends only on `ref`, `hasLaxArtDraft` and `hasBidDraftLot` for `held` and expired `withdrawn`. Every place they can produce (not_offered, draft_lax_art, draft_bid_lot) maps to Available.
  - `withdrawn.from` affects only the label.
  - The contract test "is where only Withdrawn changes" pins this.
- Main's `ZOHO_STATUS_FOR_OFFER` and `zohoStatusForOffer` are gone. No code reference is left (grep), and the worker, shop-api and shop-admin all typecheck.

## Worker `wantedStatus` vs drift reader SQL

The worker (`apps/worker/src/integrations/zoho/artwork/status/zoho-status-sync.ts:290`) uses the **newest** `offer_moved` event (`DrizzleZohoListingSourceReader.latestMoves`: `DISTINCT ON register_id ORDER BY created_at DESC, id DESC`, and keeps it only when `payload.to.state` parses). It treats the item as withdrawn only when that newest move is `to = withdrawn`, and otherwise passes `withdrawn: null`, so Withdrawn shows.

The reader (`drizzle-zoho-drift.reader.ts`) does the same thing in SQL. It takes a `LEFT JOIN LATERAL` on the newest `offer_moved` row (same ORDER BY), uses `payload->'to'->>'state' = 'withdrawn'`, and treats a NULL `withdrawn_at` as inside the window. The two agree on ordering, on tie-breaks and on what counts as no history.

The boundary rule also matches: TS shows Withdrawn while `now < at + 30·24h`, and SQL while `at + 30 days > now`. At exactly 30 days, both say Available.

### Parity probe (my own script; real `DrizzleZohoDriftReader` and `DrizzleZohoListingSourceReader` against PG16)

17 originals were seeded with `catalogue_status='nonsense'`, so every row appears in the mismatch list. For each row I compared the SQL `expectedStatus` with the worker's `wantedStatus(readStatusSources(...))`, using `now = 2026-11-12T12:00Z`.

| case | UTC | Europe/London | America/Los_Angeles |
|---|---|---|---|
| withdrawn, no history | ok | ok | ok |
| withdrawn 5d | ok | ok | ok |
| withdrawn exactly 30d | ok | **DIFF** | **DIFF** |
| withdrawn 30d − 1 ms | ok | ok | ok |
| withdrawn 30d + 1 ms | ok | **DIFF** | **DIFF** |
| withdrawn 30d, event stored +500 µs | **DIFF** | **DIFF** | **DIFF** |
| several moves, newest into withdrawn 2d ago | ok | ok | ok |
| several moves, newest into withdrawn 31d ago (an earlier withdraw was recent) | ok | ok | ok |
| state withdrawn but newest move is into lax_art (inconsistent history) | ok (both Withdrawn) | ok | ok |
| two moves with the same `created_at` | ok | ok | ok |
| `payload.to` is a bare string | ok (both Withdrawn) | ok | ok |
| held (old withdraw), held, lax_art, bid_sale, private_sale, sold (after withdraw) | ok | ok | ok |

For every offer state, with no history, with several moves, and at the 30-day boundary, the SQL computes what the writer writes **when the DB session is UTC**. It is **not** timezone-safe when the session isn't UTC, and the follow-up below covers this.

## #1284 findings (non-blocking)

1. **The 30-day window in SQL follows the session TimeZone across a DST change.** At `packages/persistence/src/repositories/zoho-sync-health/drizzle-zoho-drift.reader.ts:32`, `timestamptz + make_interval(days => 30)` adds calendar days in the session TimeZone. The contract adds a fixed `30 × 86 400 000 ms` (`where-it-is.ts:139`).
   - **Scenario:** an artwork is withdrawn at 2026-10-13 12:00Z, and the 30 days span the 25 Oct BST→GMT change. Between 12:00Z and 13:00Z on 12 Nov, the worker has already written Available, but a Europe/London session still expects Withdrawn. The health page then lists a false Status mismatch for up to an hour. Across the March change, a real mismatch is missed for an hour instead.
   - **When it happens:** only if the DB or role TimeZone isn't UTC. The repo never pins it (the docker postgres image and this initdb default to UTC), and other readers use day intervals too. That's why this doesn't block.
   - **Fix:** compute the cutoff in JS and compare at millisecond precision:
     `w.withdrawn_at IS NULL OR date_trunc('milliseconds', w.withdrawn_at) > ${new Date(now.getTime() - WITHDRAWN_DISPLAY_DAYS * DAY_MS).toISOString()}::timestamptz`.
     `date_trunc` also closes the sub-millisecond gap in the next item. Add a test for the exact boundary that runs under `SET TimeZone='Europe/London'`.
2. **Sub-millisecond boundary.** `created_at` keeps microseconds, but the worker reads it truncated to a JS millisecond. For a withdrawal stored at `X.5 ms`, SQL still says Withdrawn during the last 0.5 ms of the window while the worker already says Available. This is cosmetic, and the `date_trunc` fix above removes it.
3. Nits:
   - `statusMismatches` calls `this.now()` twice, at `:165` via `mismatched()` and at `:181`. With a real clock, the WHERE and the reported `expectedStatus` can come from instants a few ms apart. Read `now` once and pass it to both.
   - `docs/integrations/zoho.md:250` still names `ZOHO_STATUS_FOR_OFFER`. It should point to `ZOHO_STATUS_FOR_PLACE` / `zohoStatusByOfferState` and mention the 30-day Withdrawn window.
   - The integration test (`zoho-sync-health.integration.test.ts`, "expects Withdrawn for 30 days…") covers 5d, 31d and no history. It does not cover the exact boundary or several moves.

## #1285: conflict resolution (`b7d31c59`, `85a351f9`)

- **container.ts:** `soldAttentionStore` is still passed to `ArtworkRegisterReviewService` (`soldAttention:`). `SoldAttentionReviewService` (queue + `DrizzleLotNumberReader`) and main's `ZohoSyncHealthService` are both wired. `runs` and `listingRuns` now use main's shared `zohoArtworkSyncRuns` / `zohoListingRuns` instances, which behave the same.
- **app.ts:** `registerAdminSoldAttentionRoutes` and `registerAdminZohoSyncHealthRoutes` are both registered in the admin scope.
- **admin-route-deps.ts and test-app-deps.ts:** both `soldAttention` and `zohoSyncHealth` are present.
- **zoho-register.vm.ts and from-zoho/page.tsx:** `AdminSoldAttentionItem` / `bidLotUrl` are kept, and main's `health` tab and `drift` query are added.
- **artwork-register-contracts index.ts:** exports `sold-while-live`, `money-pause` and `zoho-status`.
- **persistence interfaces/index.ts:** the sold-attention types sit alongside main's deal-artwork-search types.
- **migrate-roles.ts:** main's `zoho_sync_health` read grant sits alongside the sold-attention tables and column grants.
- I compared every #1285-only file between `b46ea2e0` and `85a351f9`. The only removed lines are ones replaced by main's additions: the tab list, the run-store constructors, the old journal stamps, and main's Europe/London-year removal in the register repository. No sold-while-live or money-pause logic was dropped.
- `85a351f9` correctly puts back the `readFileSync` import needed by the journal-derived final-stamp check.

## Journal

- `0359_artwork_register_status_written`: idx 356, `when` 1808467200000.
- `0360_artwork_register_sold_attention`: idx 357, `when` 1808553600000.
- Main's last entry, `0366_zoho_sync_health`, is idx 355 with `when` 1807776000000, so both new entries come after it.
- The `migration-0360` test expects `1808553600000`, which matches.

## Verification run

Setup: `pnpm install --frozen-lockfile` and the package build on main and both branches. Throwaway PG16 cluster: initdb under `/var/tmp/pg16`, port 55432, TimeZone `Etc/UTC`.

- **DB upgrade path:** I migrated `origin/main` (applied), then each branch on top: A to 356 entries, B to 357. `artwork_register_sold_attention` and `zoho_sync_health` are both present. `db:roles` reported "Application role grants applied." on both.

| suite | #1284 (A) | #1285 (B) |
|---|---|---|
| artwork-register-contracts | 17 files / 238 pass | 20 / 272 pass |
| persistence (with DB) | 137 / 730 pass | 138 / 734 pass |
| worker | 201 pass, 11 skipped (no worker-role URL) | 206 pass, 7 skipped (with `DATABASE_URL_WORKER=worker_app`, so the role probe ran) |
| shop-api | 217 pass, 77 skipped (needs the migration-test DB) | 219 pass, 78 skipped (needs the migration-test DB) |
| typecheck (worker, shop-api; B also shop-admin) | pass | pass |
| db: migration-main-upgrade, 0359, 0360 (`MIGRATION_TEST_DATABASE_URL` on a scratch DB) | — | 3 files / 31 pass |
