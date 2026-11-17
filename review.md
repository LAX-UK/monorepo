Verdict: FIX FIRST

# Review: PR #1538, shop-api orientation and framing facets

Reviewed head `bc26dcf9` (`shop-filters-orientation-framing-api`) against
`docs/design/decision-pack-2026-11-17.md` section 4, option A (approved; Q6 square tolerance 5 %).

## Blocking

1. **The framing predicate makes the planner pick a quadratic plan for the whole catalogue query.**
   `apps/shop-api/src/infrastructure/catalogue-shape-framing-sql.ts:39` builds the framing mode as
   a correlated scalar subquery, then tests it with `in (...)` (`:61`) and `is null` (`:74`).
   Postgres can't estimate the selectivity of a scalar subquery, so it guesses `rows=1` for
   `shop_artwork`. With that guess it joins `shop_artist` and `shop_party` by nested loop with a
   sequential scan per row (`drizzle-artwork-catalogue.repository.ts:493` and every list/facet
   query that goes through `buildArtworkFilters`). The cost estimate also goes over
   `jit_above_cost`, so JIT compiles every query.

   Measured with EXPLAIN ANALYZE on the queries the repository actually sends (captured from
   `countFacets` and `listPublicArtworks`), on Postgres 16 with default settings. Seed: 400 artists,
   works with mixed dimensions, about 75 % with a framing row in each mode, 2 active options.

   | Works | Filter | Slowest of the 10 facet queries |
   | --- | --- | --- |
   | 3,000 | `size=medium` (baseline, no new filter) | 9 ms |
   | 3,000 | `framing=unframed` | 135 ms (each query removes 598,800 rows in the join filter) |
   | 3,000 | `framing=framed&orientation=portrait` | 193 ms |
   | 20,000 | `size=medium` (baseline) | 59 ms |
   | 20,000 | `framing=unframed` | 925 ms; every facet query 800 to 925 ms, 9 run in parallel |
   | 20,000 | `framing=framed&orientation=portrait&size=medium` | 1,029 ms (JIT on); 546 ms with JIT off |
   | 20,000 | same, `listPublicArtworks` (24 items) | 397 ms |

   Time grows with works × artists. The storefront gives shop-api 2.5 s
   (`SHOP_FETCH_TIMEOUT_MS`, `apps/shop/src/lib/shop-api.server.ts:34`), and the facet call fires its
   queries in parallel on one pool. The PR description says the plan "uses only index lookups";
   the index lookups are there, but they sit inside a misplanned outer join.

   **Fix, checked locally:** write the mode tests as semi-joins instead of a scalar subquery:
   `not exists (select 1 from shop_edition_framing where artwork_id = shop_artwork.id)` for
   "no framing row", and `exists (select 1 ... where artwork_id = shop_artwork.id and mode in (...))`
   for the mode lists. The rules in `CATALOGUE_FRAMING_RULES` and the counts stay the same. On the
   3,000-work seed this brings the slowest facet query from 135 to 193 ms down to 20 ms, with the
   same counts. Add a plan-shape guard if you want one: an integration test that asserts
   `EXPLAIN` of the framed facet query has no `Join Filter` nested loop over `shop_artist`.

## Checked and correct

- **Rules live once in shop-domain**, next to `catalogue-bands.ts`:
  `packages/shop-domain/src/catalogue-shape-framing.ts`. Portrait is `h*100 > w*105`
  (`:45`), landscape is `w*100 > h*105` (`:46`), otherwise square. Works without a positive
  height and width return null (`:41`) and the SQL requires both `> 0`
  (`catalogue-shape-framing-sql.ts:25`). The tolerance is the single constant
  `CATALOGUE_SQUARE_TOLERANCE_PERCENT = 5` (`:14`), used by the SQL. The domain compares in whole
  hundredths, which matches `numeric(8,2)` exactly; the integration test checks the bound.
- **Framing rules** (`catalogue-shape-framing.ts:74`): framed = `framed_by_artist`, or
  `framed_only` / `unframed_or_framed` with an active, non-placeholder offered option; unframed =
  no row or `unframed_or_framed`; a work can be in both. This matches option A ("framing options
  must be active"). Treating placeholder-priced options as not offered follows `isBuyerOffered`,
  which is stricter than the spec but correct for buyers.
- **Counts with other filters applied**: each group drops only its own filter
  (`drizzle-artwork-catalogue.repository.ts:476`, `:477`). Confirmed on the seed: with
  `framing=framed&orientation=portrait&size=medium`, the portrait count equals the framed count
  (2,370), and the size counts include both new filters.
- **API**: `orientation` and `framing` are typed unions on both `/v1/artworks` and
  `/v1/artwork-facets`, so unknown values return 400 (`artworks.routes.ts:69`, `:73`). The contract gains
  optional `orientations` and `framing`, so older clients are unaffected.
- **URL state round-trips**: `artwork-catalogue-params.ts:138` parses and drops unknown values,
  `:158` writes, and fetch query and active-filter count include both. Tests cover it.
- **Indexes**: `shop_edition_framing` PK, `shop_framing_edition_offer` PK and artwork index,
  `shop_framing_option_price` PK `(option_id, band)`. No migration is needed once the predicate
  is rewritten. Orientation needs no generated column: it is arithmetic on the row and showed no
  cost on its own.

## Not blocking

- `framingModeSql` runs twice per row in the framed predicate (SubPlan 1 and SubPlan 2 in the
  plan). The semi-join rewrite above removes this too.

## Test evidence (this review)

- `packages/shop-domain`: `vitest run`, 49 files, 1,336 tests passed.
- `apps/shop` (rail branch, which contains this commit): 120 files, 742 tests passed.
- `apps/shop-api`: full suite against a migrated Postgres 16 with `MIGRATION_TEST_DATABASE_URL`
  and `DATABASE_URL_SHOP` set: 336 files, 3,468 tests. 3,458 passed on the first full run. The 10 failures were in 6 unrelated files (checkout safety, delivery quotes, returns, reservation attribution, demo seed, admin order list), caused by data an earlier interrupted run left behind. On a freshly migrated database those 6 files pass (78 of 78). The catalogue suites (19 files, 256 tests) all pass, including the SQL-versus-domain orientation check at the 5 % bound.
- `turbo run typecheck` for shop-api, shop, shop-domain and art: 33 of 33 tasks passed.
- EXPLAIN ANALYZE as described above, on a separate seeded database.
