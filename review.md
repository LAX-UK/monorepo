Verdict: SHIP

# Sanity pass: PR #1539, Orientation and Framing groups in the filter rail

Reviewed head `033fc310` (`shop-filters-orientation-framing-rail`). Since the previous review
(`5df2f4d0`), the only change is a merge of the updated #1538 branch (`e2375142`, the query-plan fix).
Checked against `docs/design/decision-pack-2026-11-17.md` section 4, option A. That section is the
same on the branch and on `main`.

No blocking defects.

## What changed since the last review

- **The rail commit is unchanged.** `git diff 5df2f4d0 033fc310 -- apps/shop` is empty.
- **The branch now carries the fixed #1538.** `e2375142` is an ancestor of the head. Compared with the
  #1538 head, this branch adds only the rail files:
  - `apps/shop/src/lib/catalogue/artwork-catalogue-filter-config.ts`
  - `catalogue-filter-groups.ts`
  - `catalogue-active-chips.ts`
  - `catalogue-filters.test.ts`
  - `apps/shop/e2e/artworks-filters.spec.ts`
  - the six `docs/design/screenshots/gap-51/` PNGs
- **The merge-order concern from the previous review is resolved.** The branch no longer carries the
  unfixed #1538 commit on its own. The #1538 final recheck is SHIP (`review.md` on
  `review-notes-pr1538-review`). The SQL fix doesn't change the API, the counts or the URL state:
  old and new SQL give byte-identical facet counts and results on a 96-combination seed. Nothing in
  the rail depends on the change.

## Still matches section 4, option A

- **Rail order** is Artist, Price, Size, Orientation, Framing, Technique
  (`apps/shop/src/lib/catalogue/artwork-catalogue-filter-config.ts:9-17`).
- **Labels:**
  - "Portrait", "Landscape", "Square" (`:54`).
  - "Available framed", "Available unframed" (`:60-61`).
- **A work can be in both Framing groups.** shop-api counts each key on its own, and the rail shows
  both counts.
- **Square tolerance is 5 % (Q6).** It is the single constant in shop-domain.
- **Chips:**
  - Chips come in rail order, and each one removes only its own filter
    (`catalogue-active-chips.ts`).
  - Selected chips take the Shop accent and nothing else does. There are no component or style
    changes.
- **Groups with too few options are hidden** when fewer than `MIN_FILTER_GROUP_OPTIONS` options have
  works, unless one is applied. Both groups are built from counts only, like Size
  (`catalogue-filter-groups.ts`).
- **PR plan item 2 is covered:** the mobile sheet, the e2e spec (desktop and phone), and the
  light/dark/375 screenshots.

## Not blocking (carried over)

- The e2e order check asserts only the relative order of the groups that are present. The unit test
  covers the full order.

## Test evidence (this pass)

- `apps/shop` at `033fc310`: `vitest run`, 120 files, 742 tests passed.
- `pnpm --filter @auction/shop typecheck`: passed.
- shop-api at the same SQL (`e2375142`), as described in the #1538 recheck:
  - catalogue and artwork suites: 41 files, 530 tests passed;
  - plan guard: 4 of 4 passed at 3,000 and at 20,000 works;
  - `packages/shop-domain`: 1,343 tests passed.
- CI on `033fc310`: green (`ci-result` success, `browser-gates` success, all shop-api and web shards).
- I didn't re-run Playwright or the route-JS budget locally. The merge touches only shop-api SQL and
  a shop-api test, and `budgets.json`, `lighthouserc.json` and `scripts/` are unchanged.
