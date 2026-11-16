Verdict: FIX FIRST

# Final recheck of PR #1485 (motion-loading, motion system 5/8: loading)

Head reviewed: `debb8274` (merged locally with main `8ed75236` as `a4497ecc` for builds; not pushed). Judged against `docs/design/motion.md` on main: MO12, MO13, MO14 and Build item 5. Previous review: `e54eefa5` on this branch.

All four earlier blocking findings are fixed. One new blocking item remains: a staff route's JavaScript grows. The budget script does not measure `/admin`, so CI cannot see it. The PR body discloses it, but MO14 says "no growth on any route".

## Blocking

1. **BLOCKING: route JS grows on one Bid staff route.** It is outside the budget script's scope, but it is real.
   - I built main `8ed75236` and head merged with main, at the same path, with `SENTRY_RELEASE` and `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` pinned and the CI placeholder DSNs set. I then summed gzip bytes per route from `app-build-manifest.json`.
   - `/admin/(platform)/compliance/source-of-funds/[id]/page`: **312,888 → 313,797 B (+909 B gzip, about +0.9 KB)**. The same route measured with root main files plus page files gives +894 B.
   - Cause: a new shared chunk, `static/chunks/60472` (3,313 B gzip), holds the kit `Switch` and the LAX `Skeleton` (`lax-skeleton block rounded-lax-badge bg-lax-neutral-bg`, from `packages/ui/src/lax/skeleton.tsx:11`). The page's own chunk shrinks only 15,923 → 13,517 B. The same chunk is added to 4 staff detail layouts (artists, categories, venues, legal-entities; +681 to +924 B on the layout entry). Their pages net only +5 to +7 B.
   - Every other staff and dev route moves by at most +12 B (`/dev/kit` +1 B). That is consistent with build-hash noise.
   - The PR body says this itself ("webpack split some LAX kit modules (Switch, the LAX `Skeleton`) into a new shared chunk on 20 staff detail routes (+0.6 to 0.86 KB there); staff loading is motion PR 7"). MO14 (`docs/design/motion.md:63`) reads "Route JS: no growth on any route", and the brief for this recheck says any real growth is blocking.
   - Fix, either of:
     - Make the class change chunk-neutral: for example, keep the LAX `Skeleton` module's dependency shape as on main, or ensure the split does not happen, and show source-of-funds detail equal or lower.
     - Get an explicit owner decision that `/admin` is out of MO14's scope for this PR (the budget config already ignores it) and record it in the PR.

## Non-blocking

2. **Bid `/sales` swap is not asserted.** `apps/web/e2e/loading-screens.spec.ts:14` (`swapNotAsserted`).
   - The reason is real: `/sales` redirects to the live tab while a sale is live (`apps/web/src/lib/marketing/load-sales-browse-page.ts:140`). The PR measures the same 1.42 at 1440 on main.
   - But the sales list loading screen's swap now has no gate in CI at all. A second case targeting `/sales?tab=live` (`holdNavigation` matches on pathname, so the hold still applies) would measure the screen visitors actually get. Add it with the redirect follow-up.
3. **The kit exports test code.** `packages/ui/package.json:34` exports `./e2e/loading-check` (Playwright helpers) from the UI kit's public exports. It works and removes the cross-app import, but a dedicated test-utils entry or package would keep test code out of the kit surface. The helper's header comment still points at `apps/web/e2e/helpers/motion-check.ts` (`packages/ui/src/e2e/loading-check.ts:16`); it is a comment only, not an import.
4. **I could not measure the Shop basket swap on main myself.** CI asserts swap ≤ 0.1 on the seeded basket with an item at 1440 and 375, light and dark (16/16 passed). That makes 375 better than main's 0.205 by construction. At 1440, "not worse than main's 0.033" rests on the PR's own number (0 after). The CI annotation that holds the actual value is not in the log. Printing `result.swapShift` to stdout in `defineLoadingScreenTests` would make the numbers auditable from CI logs.
5. **Missing MO14 evidence.** There are no short recordings of moving states (MO14 "Looks") and no Lighthouse run. The PR names the post-deploy Lighthouse workflow as the check. Acceptable for a loading-only PR, but note it.
6. **Follow-ups listed in the PR body.** Hand-rolled `animate-pulse` placeholders remain in palette, lot queue, quick-look, lot-card bidder state and three LAX Account cards. Build item 5 names the loading screens only, so this is fine as a follow-up.

## Verified

- **(1) e2e tag check.**
  - Each spec has its own tagged `test.describe`: `apps/web/e2e/loading-screens.spec.ts:7`, `apps/shop/e2e/loading-screens.spec.ts:21`, `apps/art/e2e/loading-screens.spec.ts:6`.
  - `pnpm lint:e2e-tags` passes.
  - The checker is unchanged (no diff under `apps/web/scripts` or `scripts`).
  - Mutation: removing `@optin` from the Bid spec's describe makes the checker fail (exit 1), so it is not weakened.
- **(2) Unit suites.**
  - LAX Account run locally: 1071/1071 passed, 118 files (`apps/account/src/components/time-zone-section.test.tsx:54` now expects `lax-skeleton`).
  - CI `test`, all `web vitest (1–8/8)`, `api`, `shop-api`, `ui-chromium` and `static-checks` are green on `debb8274`, and `ci-result` is success. All 41 check runs succeeded.
- **(3) Route JS on budget routes: equal or lower.**
  - Same-job CI evidence (run 43825559224, job 133158461181, at `ff213b82`):
    - The workflow (`git show 49a5d5bf`) checks out main, then the PR merge commit, in one job at one path. It pins `SENTRY_RELEASE=route-js-same-job` and one `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (both visible in the step env), runs `turbo build --force` for web, shop, art and account, and runs `check-route-js-budget.mjs --all`.
    - I re-parsed both "All routes" tables from the log myself. Its column parsing is correct (size, frame, page, duplicate count and KB). Both sides have 216 routes with the same set, 0 higher on any column, and 74 lower.
    - The workflow file was removed again in `debb8274`.
  - Byte-level, my local build (pinned, same path): 331 routes on both sides. On every route in the budget table, gzip bytes are equal or lower (287 routes lower, down to −100 B).
  - The `check-route-js-budget.mjs --all` tables from these builds also show 216/216 routes with none higher. Tracked ratchets: Home 394.5 → 394.4, Sales list 442.8 → 442.8, Lot 467.4 → 467.4, About 344.9 → 344.5, Terms 341.9 → 341.4 KB.
  - Head's unpinned CI build (job 133166506669) shows +0.1 KB against main's earlier unpinned CI on some frames (listing/public frame 337.3, lot 467.5). The pinned comparisons on both CI and local show those are build-ID noise (the Sentry release defaults to the commit SHA, plus debug IDs), not code.
  - Budgets, baselines (`scripts/route-js-baseline.json`), `route-js-budgets.json` and `scripts/compositor-allowlist.json` are untouched (no diff).
- **(4) Swap shift against the seeded stack.**
  - The loading specs are no longer only opt-in in CI.
    - `e2e-pr.yml:300-312` runs the Bid and Shop specs after seeding the Shop catalogue.
    - `art-e2e-pr.yml:162-166` sets `PLAYWRIGHT_LOADING_CHECK=1`.
  - CI on `debb8274`:
    - Bid: 28/28 passed (`browser-gates`, job 133166319202).
    - Shop: 16/16 passed, including basket with an item at 1440/375, light/dark.
    - lax.art: 20/20 passed on chromium-desktop (`art-browser-gates`, job 133166157039). The 20 chromium-mobile duplicates are skipped by design (`loading-check.ts:265`).
  - Each test asserts:
    - skeleton-phase shift `=== 0` (`packages/ui/src/e2e/loading-check.ts:296`)
    - opacity-only keyframes
    - swap ≤ 0.1 (`:302`)
  - Method checked:
    - `holdNavigation` holds only the non-prefetch RSC request (`:58-73`).
    - The click is real input, so the old-page → skeleton swap is excluded as in a real visit.
    - Shift is counted from first skeleton through 2.2 s hold, release, the screen's own block detaching, network idle and 1 s settle.
    - The swap-end condition now tracks the loading screen's own block, not "no `.lax-skeleton` left".
    - The Shop basket fixture adds a real line (`apps/shop/e2e/loading-screens.spec.ts:11-19`) and fails if it cannot.
- **Mutation tests (my own runs, Chromium, `LAX_REQUIRE_CHROMIUM=1`, `skeleton-resolved` + `loading-screens`).** Every mutation below is caught:
  - Pulse easing `linear` instead of `var(--lax-ease-pulse)`: 7 failed.
  - `ease-in-out`: 7 failed.
  - The literal `cubic-bezier(0.4, 0, 0.6, 1)` (same value, not the token): 1 failed.
  - `@import "./skeleton.css"` removed from `packages/ui/src/lax/theme.css:19`: 1 failed.
  - The import pointed at a missing file: 1 failed.
  - `backwards` dropped from the fade-in (`skeleton.css:30`): 6 failed.
  - Pulse kept under OS reduce: 1 failed.
  - Kit `MediaPlaceholder` back to `animate-pulse`: 1 failed.
  - Connect shell back to `animate-pulse`: 1 failed.
  - `--lax-ease-pulse` value changed in `lax-system.css:164`: the branding drift test fails (1 of 32).
  - Unmutated: `skeleton-resolved`, `loading-screens` and `motion-resolved` pass 124/124 with none skipped.
- **Connect shell and media placeholder.** Both are on the shared skeleton: `apps/web/src/components/connect/connect-components-shell.tsx:28` and `packages/ui/src/components/ui/media-placeholder.tsx:68` (`loading && "lax-skeleton"`). `.lax-skeleton` has no infinite animation under reduce (`skeleton.css:34-44`, with Bid's `force-reduce` at `:47-54`), so neither loops under reduced motion.
- **No cross-app imports.** The Bid, Shop and lax.art specs import `@auction/ui/e2e/loading-check`. No file imports `../../web/e2e/...`.
- **Lenis untouched.** No Lenis file in the 55-file diff. No `blocking="render"`, Speculation Rules or new `transition-all`.
- **Compositor lint.** `pnpm lint:compositor` reports "compositor-only motion: ok" and its rule tests pass.
- **Spec match.**
  - MO12: one skeleton, a 150 ms delay with backwards fill, fade, a 1.6 s opacity-only pulse, no shimmer, no page spinners.
  - MO13: static under reduced motion; the public fade is ≤150 ms; staff and LAX Account are instant; `force-allow` and `force-reduce` are honoured.
  - Build item 5: Bid/Shop/lax.art loading screens, Bid home shaped like home, and the lax.art frozen shimmer and reduced-motion pulse fixed. All present.
- **Screenshots opened:**
  - After-review Bid policy hub and Shop basket at 1440 and 375, light and dark.
  - The Bid 1440 sheet and the lax.art 375 sheet.
  - The policy hub draws the real policy list beside a screen-tall document; the basket draws one line plus the summary panel in the checkout grid.
  - Dark mode has correct contrast. Every screen is in its page's shape.
- **Commits.** No Co-Authored-By, Claude-Session or generated-by trailers in the PR commits.

## Commands run

- `pnpm install --frozen-lockfile`; `pnpm -r --filter './packages/**' build`.
- `pnpm lint:e2e-tags` (plus the untagged-describe mutation); `pnpm lint:compositor`.
- `pnpm --filter @auction/account exec vitest run --maxWorkers=3`: 1071 passed.
- `LAX_REQUIRE_CHROMIUM=1 vitest run src/lax/skeleton-resolved.test.ts src/lax/loading-screens.test.ts src/lax/motion-resolved.test.ts`: 124 passed, plus the 10 mutations above, each reverted.
- `@auction/branding` `tests/lax-motion.test.ts` with the token mutation.
- Builds:
  - `turbo run build --force --env-mode=loose` for web, shop, art and account at main `8ed75236` and at head merged with main `a4497ecc`, same path, pinned release, server-action key and placeholder DSNs.
  - `check-route-js-budget.mjs --all` on both, plus per-route gzip byte sums from `app-build-manifest.json`.
  - A second main build of apps/web only, to diff chunks on the staff route.
- CI logs read: `build` (133166506669), the same-job comparison (133158461181), `browser-gates` (133166319202) and `art-browser-gates` (133166157039).
