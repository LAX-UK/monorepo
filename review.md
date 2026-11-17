Verdict: SHIP

# Final recheck: PR #1538, shop-api orientation and framing facets

Reviewed head `e2375142` (`shop-filters-orientation-framing-api`), which adds the fix commit on top of
`bc26dcf9` (the head of the previous FIX FIRST review) and a merge of `main` (`f5202f46`). Checked against
`docs/design/decision-pack-2026-11-17.md` section 4, option A. That section is the same on the branch
and on `main`.

The blocking finding from the last review is fixed. Nothing blocks.

## Previous blocker: fixed

1. **The framing predicate is now built from semi-joins.**
   - `apps/shop-api/src/infrastructure/catalogue-shape-framing-sql.ts:45`: "No framing row" is
     `not exists (select 1 from shop_edition_framing where artwork_id = shop_artwork.id)`.
   - `catalogue-shape-framing-sql.ts:67`: The mode lists are
     `exists (… where artwork_id = shop_artwork.id and mode in (…))`.
   - `catalogue-shape-framing-sql.ts:82`: Where the rule needs it, the mode list is ANDed with the
     existing active-option `exists` (`:54`).
   - No scalar subquery is left, so the mode is no longer read twice per row.
   - `shop_edition_framing` is keyed on `artwork_id`, so there is at most one row per work.
     `exists … mode in (…)` therefore means the same thing as the old `(select mode …) in (…)`, and
     `not exists` means the same as `… is null`.
2. **A second cause is also fixed: the size band was compared on an expression.**
   - The size band filter and its counts now compare the columns, not
     `CASE … greatest(h, w)` (`drizzle-artwork-catalogue.repository.ts:89`, used at `:207` and `:577`).
   - The rewrite is equivalent. With both sides positive, `greatest(h,w) >= x` is the same as
     `h >= x or w >= x`, and `greatest(h,w) < y` is the same as `h < y and w < y`. The `> 0` guards
     carry over the old "both known" `CASE`.
   - Without this change, `framing=framed&orientation=portrait&size=medium` still went back to the
     nested loop (see the mutation check below).

### Planner: the nested loop is gone

I ran the PR's guard on a freshly migrated Postgres 16.15 with default settings (JIT on). The guard
seeds the review's catalogue: 400 artists, mixed dimensions, about 75 % with a framing row across the
three modes, and 2 active options. It runs every query that `countFacets` and `listPublicArtworks`
send (15 per request) through `EXPLAIN ANALYZE`. With the fix, no query has a `Seq Scan` of
`shop_artist` or `shop_party` that runs more than once, and no nested loop discards join rows.

The table gives the slowest of the 15 queries per request, in ms. "No JIT" means execution time minus
JIT time.

| Works | Filter | Previous review (old SQL) | PR's "After" | This recheck | This recheck, no JIT |
| --- | --- | --- | --- | --- | --- |
| 3,000 | `size=medium` (baseline) | 9 | 9 | 16 | 16 |
| 3,000 | `framing=unframed` | 135 | 47 | 46 | 21 |
| 3,000 | `framing=framed` | n/a | 61 | 83 | 34 |
| 3,000 | `framing=framed&orientation=portrait&size=medium` | 193 (without `size`) | 8 | 7 | 7 |
| 20,000 | `size=medium` (baseline) | 59 | 103 | 130 | 105 |
| 20,000 | `framing=unframed` | 925 | 574 | 583 | 138 |
| 20,000 | `framing=framed` | n/a | 717 | 600 | 146 |
| 20,000 | `framing=framed&orientation=portrait&size=medium` | 1,029 | 803 | 730 | 42 |

Without JIT, the new filters at 20,000 works now cost about the same as the baseline (42 to 146 ms
against 105 ms), down from 546 ms or more. The remaining wall time is JIT compilation (see "Not
blocking"). My numbers agree with the PR's table within its stated ±30 %.

### The guard catches the old SQL (mutation-checked)

The guard is `apps/shop-api/src/infrastructure/catalogue-shape-framing-plan.integration.test.ts`. It
checks plan shape at `:44`, `:49` and `:53`, and a 1 s limit at `:20`. I ran it three ways on the
3,000-work seed:

- **PR code:** 4 of 4 cases pass.
- **Mutation 1, the old scalar-subquery `catalogue-shape-framing-sql.ts` from `bc26dcf9`:** 3 of 4
  cases fail (`framing=unframed`, `framing=framed`, and the combined case). The failures report
  "Nested Loop removed 598,500 / 600,000 / 897,750 rows by `shop_artist.id = shop_artwork.artist_id`".
  The baseline case passes, as it should.
- **Mutation 2, only the size band put back on the `CASE … greatest()` expression:** the combined
  case fails, with "Nested Loop removed 171,570 rows". The other three pass. So the guard covers the
  second cause too.

The PR's files were restored after each mutation, and the worktree was clean afterwards. The guard
runs in CI: the `shop-api vitest` shards set `MIGRATION_TEST_DATABASE_URL` and `DATABASE_URL_SHOP`,
and that is the condition `vitest.config.ts:3` uses. CI on `e2375142` is green, including all four
shop-api shards.

### Results identical to the old predicate

I built a committed seed database: 3,000 works and 400 artists, with these edge cases added.

- **Dimensions:** zero and null height or width; 50 × 100 and 105 × 100 (the square bound at exactly
  5 %); a width of 49.99 (just under the small/medium bound).
- **Framing options:**
  - an active option on 60 % of the editions that have a mode;
  - a second active option on a subset;
  - a **paused** option as the only offer on 20 % of editions, so `framed_only` is in neither group;
  - a **draft** option as the only offer on another 20 %.
  - A placeholder price on an offered option can't be seeded: the trigger
    `shop_framing_option_placeholder_not_offered_ck` rejects it, so the database already rules that
    state out.

I called the real repository (`countFacets`, and `listPublicArtworks` for `totalCount` and the first
page of 50 slugs). I covered all 96 combinations of orientation (none plus 3 keys), framing (none
plus 2 keys), size (none plus 3 bands) and availability (unset or set). Once with the PR code, once
with the pre-fix repository and SQL from `f5202f46`. **The two JSON dumps are byte-identical.** As
spot checks on the seed: framed is 1,650 (750 by the artist plus 900 with an active offered option),
unframed is 1,500, and paused-only or draft-only `framed_only` editions are in neither group.

### Rules are still single-sourced

- The rules live in `packages/shop-domain/src/catalogue-shape-framing.ts`:
  `CATALOGUE_SQUARE_TOLERANCE_PERCENT` at `:14` and `CATALOGUE_FRAMING_RULES` at `:74`.
- The shop-api SQL imports both constants and builds every part from them
  (`catalogue-shape-framing-sql.ts:82`).
- The size band SQL reads `catalogueSizeBandRange` / `CATALOGUE_SIZE_BANDS`.
- No mode list or 1.05 ratio is hard-coded anywhere in shop-api or the storefront.
- The fix commit touches no domain file.

## Not blocking

- **JIT compile time at around 20,000 works.**
  - The estimated costs (the per-row availability subplan, plus the framing `exists`) go over the
    default `jit_above_cost`. JIT then takes up most of the 580 to 730 ms per query.
  - The baseline `size=medium` is already over the threshold (25 ms of JIT), so this comes from
    existing settings, not from this PR. The PR says so and leaves it for a separate decision.
  - Nothing in the repo turns JIT off or tunes it. If the catalogue is heading towards tens of
    thousands of editions, set `jit = off` (or a higher `jit_above_cost`) for the shop-api role. It's
    worth a follow-up ticket.
  - At today's catalogue size, and at 3,000 works, it costs no more than about 50 ms.
- **The guard's 1 s limit (`plan.integration.test.ts:20`) is generous.** The plan-shape assertions do
  the real work, and the mutation check shows they are enough.

## Test evidence (this recheck)

- `packages/shop-domain`: `vitest run`, 49 files, 1,343 tests passed.
- `apps/shop-api`, against a freshly migrated Postgres 16.15 with Redis:
  - The catalogue and artwork suites (`vitest run catalogue artwork`), including the new plan guard
    and the SQL-versus-domain orientation check at the 5 % bound: 41 files, 530 tests passed.
  - The plan guard with `CATALOGUE_PLAN_REPORT=1` at 3,000 and at 20,000 works: 4 of 4 passed both
    times. The timings are in the table above.
- Mutation runs and the old-versus-new equivalence dump are as described above.
- CI on `e2375142`: green (`ci-result` success).
