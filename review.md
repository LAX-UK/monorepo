Verdict: SHIP

# Review: PR #1539, Orientation and Framing groups in the filter rail

Reviewed head `5df2f4d0` (`shop-filters-orientation-framing-rail`): the new commit on top of
#1538 (`bc26dcf9`), against `docs/design/decision-pack-2026-11-17.md` section 4, option A.

This PR's own changes have no blocking defects. **Merge order:** the branch also contains the
#1538 commit, and the #1538 review is FIX FIRST. That fix is a query-plan problem in
`apps/shop-api/src/infrastructure/catalogue-shape-framing-sql.ts`, where scalar-subquery framing
predicates give a quadratic plan; see `review.md` on `review-notes-pr1538-review`. Merge #1538
with that fix first, then rebase this branch onto it. Don't merge this branch on its own while it
still carries the unfixed commit. The fix doesn't change the API or the counts, so nothing in this
PR needs to change.

## Checked and correct

- **Rail order** is Artist, Price, Size, Orientation, Framing, Technique
  (`apps/shop/src/lib/catalogue/artwork-catalogue-filter-config.ts:11-17`). Both new groups are
  open by default like the others (`:26-27`). A unit test and the e2e spec check the order.
- **Labels** follow option A: "Portrait", "Landscape", "Square"; "Available framed", "Available
  unframed" (`artwork-catalogue-filter-config.ts:53-62`).
- **Hiding under `MIN_FILTER_GROUP_OPTIONS` (2)**: both groups go through the shared
  `keepUseful` (`catalogue-filter-groups.ts:85`, `:216`). A group with fewer than two options that
  have works is hidden unless one of its options is applied. Tested with one option, without
  counts, and with applied options.
- **Counts only**: like Size, the groups are left out when the counts don't load
  (`catalogue-filter-groups.ts:139`, `:153`). An applied filter can still be removed with its chip.
- **Chips**: added in rail order, and each removes only its own filter
  (`catalogue-active-chips.ts:55-58`). Tested.
- **Selected chips use the Shop accent only**: no component or style changes. The screenshots show
  the accent tint on the applied chips only; checkboxes and counts stay neutral.
- **Mobile sheet**: uses the same group builder. The e2e spec covers it on `chromium-mobile`, and
  the 375 px sheet screenshots show both groups and the "Show N editions" footer.
- **Route-JS budget**: `budgets.json`, `lighthouserc.json` and `scripts/` are unchanged on the
  branch. No budget, baseline or allowance was raised.
- **E2E**: `apps/shop/e2e/artworks-filters.spec.ts:25-79` covers rail state, group order, chip
  removal and URL (desktop), and the phone sheet. It drives the groups through the URL, so it
  doesn't depend on seed data. The spec runs in `shop-staging-acceptance.yml`.
- **Screenshots**: desktop rail, 375 px catalogue and 375 px sheet, light and dark, are in
  `docs/design/screenshots/gap-51/`. No horizontal overflow at 375 px, and the chips wrap.

## Not blocking

- The e2e order check (`artworks-filters.spec.ts:41-56`) only asserts relative order for the
  groups that are present. That's fine for seed-independence, but it can't catch a missing
  Artist/Price/Size group. The unit test covers the full order.

## Test evidence (this review)

- `apps/shop`: `vitest run`, 120 files, 742 tests passed.
- `packages/shop-domain`: 49 files, 1,336 tests passed.
- `apps/shop-api`: full suite against a migrated Postgres 16: 336 files, 3,468 tests. 3,458 passed on the first full run. The 10 failures were in 6 unrelated files (checkout safety, delivery quotes, returns, reservation attribution, demo seed, admin order list), caused by data an earlier interrupted run left behind. On a freshly migrated database those 6 files pass (78 of 78). The catalogue suites (19 files, 256 tests) all pass, including the SQL-versus-domain orientation check at the 5 % bound.
- `turbo run typecheck` for shop, shop-api, shop-domain and art: 33 of 33 tasks passed.
- I didn't run the Playwright e2e or the route-JS build locally. The spec and the budget files
  were reviewed as described, and the PR reports the e2e at 2 passed and the budget check passing
  (`/artworks/(hub)` at 511.1 of 571 KB).
