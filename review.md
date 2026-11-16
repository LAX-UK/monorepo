Verdict: FIX FIRST

# Last recheck of PR #1485 (motion-loading, motion system 5/8: loading)

- Head reviewed: `e77e5634`. Its main base is `46c9bdac` (motion 4/8 hover and press, #1486). Main has since moved one docs-only commit to `618ab329` (`docs/ui/art-figma-inventory.md`).
- Previous recheck: `ee21fa31` on this branch.
- Judged against `docs/design/motion.md` MO12–MO14 and the PR body's "Changes after review (round 2)".

The previous blocker (staff route JS) is fixed: every route, including `/admin` and `/dev`, is equal to or lower than main by code. One new blocking item comes from round 2 itself. The new `sales-live` e2e case fails in CI on every viewport and scheme, so `browser-gates` is red. It also stops the gates that come after it, including the Shop loading screens.

## Blocking

1. **BLOCKING: the new `sales-live` loading case fails in CI, so `browser-gates` is red.**
   - Case: `apps/web/e2e/loading-screens.spec.ts:21-23` (`/terms` → `/sales?tab=live`).
   - CI: run 43853085965, job 133250553534 (`browser-gates`), step "Run Bid loading screens" (`.github/workflows/e2e-pr.yml:304-307`).
   - Result: **4 failed, 28 passed.** Every failure is `sales-live` (1440/375 × light/dark), each after a retry.
   - Error: `locator.waitFor: Test timeout of 90000ms exceeded … waiting for locator('.lax-skeleton').first()` at `packages/e2e-utils/src/loading-check.ts:178`. After the navigation, no loading screen ever appears.
   - The PR body says the author "could not run the seeded stack here; CI's `browser-gates` runs the new case". CI ran it, and it fails.
   - **The failure stops the later gates.** These steps in the same job did not run on this head:
     - "Run Shop loading screens" (`e2e-pr.yml:308-312`)
     - Shop buyer flow (`:313`)
     - Shop V1 portal smoke (`:322`)
     - Shop home without JavaScript (`:329`)
     - LAX Admin accessibility and role checks (`:334-340`)

     So the Shop basket and Shop swap assertions have no CI result on this head.
   - The other Bid cases pass, and their numbers are now in the log (non-blocking item 4 from the last recheck works):
     - `home`, `results`, `artists`, `press`, `search` and `about`: `swapShift=0.0000 skeletonShift=0.0000` at all four combinations.
     - `sales` (not asserted): 1.42 / 0.71 / 2.0 / 2.0.
   - Likely cause, not verified:
     - The hold matches on pathname (`loading-check.ts:58-73`), and the `/sales` case passes with the same helper. That suggests the router does not show `sales/(index)/loading.tsx` for a navigation to the same pathname with a query.
     - The likely reason is that the `kind: "auto"` prefetch of `/sales?tab=live` (`:85-104`) either does not answer before the navigation, or answers with the full page.
     - The case needs one run on the seeded stack with a trace (the trace and screenshot are in the `web-pr-playwright-report` artifact of that run).
   - Fix, either of:
     - Make the case show the loading screen and pass on CI, for example by navigating to a pathname the redirect does not cover.
     - Remove the case, and keep the `/sales` swap as `swapNotAsserted` with the follow-up, as it was in the previous head.

     Then `browser-gates` must be green with the Shop loading step run.

## Non-blocking

2. **The policy hub loading screen's links are plain anchors** (`apps/web/src/components/marketing/policy-hub-loading-shell.tsx:23`). This keeps `next/link` out of the `loading` entry (−1.4 KB). A click on a policy link while the skeleton is up does a full document load instead of a client navigation. The window is short and the markup and classes match `LegalHub`, so this is fine. Note it in case someone "fixes" it back to `LegalHub`.
3. **The `/sales` redirect follow-up stands.** It is listed in the PR body, and the `/sales` case stays `swapNotAsserted` (`loading-screens.spec.ts:14-15`). If `sales-live` is dropped (blocking 1), the sales list loading screen's swap is again unasserted in CI, as it was in the last recheck.
4. **MO14 recordings and Lighthouse** are still not attached. The PR names the post-deploy Lighthouse workflow as the check. This is unchanged from the last recheck, and acceptable for a loading-only PR.
5. **Hand-rolled `animate-pulse` placeholders** in palette, lot queue, quick-look, lot-card bidder state and three LAX Account cards. These are listed follow-ups, as before.

## Verified

- **(1) Staff route JS: fixed. Every route is equal to or lower than main.**
  - **Builds.** I built main `46c9bdac` and head `e77e5634` one after the other in the same worktree path (`/home/user/rbuild`).
    - Command: `turbo run build --force --env-mode=loose` for `@auction/web`, `@auction/shop`, `@auction/art` and `@auction/account`.
    - Pinned: `SENTRY_RELEASE=review-pinned` and one `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, plus CI's placeholder DSNs (`ci.yml:1028-1031`) and `NODE_OPTIONS=--max-old-space-size=6144`.
    - 41/41 tasks on both.
  - **Method.** Gzip bytes (level 9) summed per entry over every JS file in each app's `app-build-manifest.json`. That is 774 entries on both sides, the same set, with every `/admin` and `/dev` route included.
  - **Previous blocker:**

    | Entry | Main | Head | Δ |
    |---|---|---|---|
    | `/admin/(platform)/compliance/source-of-funds/[id]/page` | 312,807 | 312,786 | **−21** |
    | `…/source-of-funds/[id]/loading` | 244,321 | 244,299 | −22 |
    | `/admin/(platform)/legal-entities/[id]/layout` | 327,836 | 327,820 | −16 |
    | `/admin/(platform)/artists/[id]/layout` | 195,987 | 195,988 | +1 (runtime, see below) |
    | `/admin/(platform)/categories/[id]/layout` | 195,988 | 195,989 | +1 (runtime) |
    | `/admin/(platform)/venues/[id]/layout` | 195,991 | 195,992 | +1 (runtime) |
    | `/dev/kit/page` | 306,127 | 306,119 | −8 |

  - **The shared chunk is gone.** Only one chunk file exists on one side alone: main's `static/chunks/58710` (3,332 B). It is used only by the five `/(marketing)/sell/*` pages. On head, webpack inlines it into those page chunks, and the routes net −252 to −256 B. No new shared chunk appears on head.
  - **All 774 entries.**
    - Raw sums: 362 at +1 B, 344 lower, 68 equal.
    - With the webpack runtime left out: **0 higher, 344 lower, 430 equal.**
    - Every +1 B is Bid's `webpack-*.js` runtime (3,721 → 3,722 B gzip). It is byte-for-byte the same length on both sides (7,908 B raw), with the same chunk-ID set. It differs only in:
      - the Sentry debug ID;
      - one async chunk's content hash (`31249`);
      - the order of two entries in the chunk-URL map;
      - one minifier-local name (`u` → `b`).

      That is build-ID noise, not code. Only one other file is higher than on main: the five `/sell/*` page chunks that absorbed `58710`, a net decrease as above.
  - **`check-route-js-budget.mjs --all` from the same builds:** no group, route or ratchet is higher.
    - Home 394.4 → 394.4, Sales list 442.7 → 442.7, Sale page 478.7 → 478.6, Lot page 467.3 → 467.3, About 344.8 → 344.8, Terms 341.8 → 341.8 KB.
    - Shop public 520.4 → 520.3; LAX Account 436.0 → 435.9; Bid listing duplicates 22.2 → 22.1 KB.
  - **Untouched:** `scripts/`, `route-js-budgets.json`, `scripts/route-js-baseline.json` and `scripts/compositor-allowlist.json` have no diff between `46c9bdac` and `e77e5634`.
- **(2) How the fix works.**
  - The LAX `Skeleton` is back to a one-line module: `packages/ui/src/lax/skeleton.tsx:5` renders `lax-skeleton lax-bar`. The kit `SparklineSkeleton` renders `lax-skeleton lax-wave` (`packages/ui/src/lax/sparkline.tsx:124`).
  - `.lax-bar` and `.lax-wave` sit in `@layer components` (`packages/ui/src/lax/skeleton.css:63-75`), so a caller's utility still wins.
  - The values match the old utilities. `--lax-radius-badge` and `--lax-neutral-bg` are the same variables `rounded-lax-badge` and `bg-lax-neutral-bg` resolved to (`packages/ui/src/lax/theme.css:50,94`).
  - Every app that renders these components loads `skeleton.css` through `@auction/ui/lax-theme.css`: web, shop, art, account and shop-admin `globals.css` / `base.css`.
  - **Mutation (my run):** removing the `@layer components` wrapper makes `skeleton-resolved.test.ts` fail (1 of 16). The case is at `skeleton-resolved.test.ts:303`.
- **(3) Main merge (motion 4/8).** `2b9dd568` is a normal two-parent merge (`debb8274`, `46c9bdac`). Both intents are kept in every conflict:
  - `packages/ui/src/lax/theme.css:19-20` imports both `skeleton.css` and `hover-press.css`.
  - `packages/ui/src/test/motion-browser.ts` exports both `SKELETON_SOURCE` and `HOVER_PRESS_SOURCE`.
  - The `ci.yml` `ui-chromium` job runs `motion-resolved`, `hover-press-resolved` and `skeleton-resolved` (`ci.yml:414`).
  - `docs/DESIGN_SYSTEM.md` keeps the `--lax-motion-lift` row, the hover/press paragraph, the skeleton token rows and the skeleton paragraph.
  - The diff against main removes no `lax-card*`, `lax-press`, `MARKETING_CARD_*` or `hover-press` usage.
- **(4) Kit tests are green.**
  - Locally, with `LAX_REQUIRE_CHROMIUM=1`, `motion-resolved`, `hover-press-resolved`, `skeleton-resolved` and `loading-screens` pass: **176/176**.
  - `@auction/ui` `src/lax/`: 33 files, 342 tests passed.
  - CI on `e77e5634`: `ui-chromium`, `test`, `static-checks`, `build`, all `web vitest (1–8/8)`, `api`, `shop-api`, `docker-images` and `ci-result` succeeded. `art-browser-gates` and `account-browser-gates` succeeded. `browser-gates` failed (blocking 1).
- **(5) The e2e helper is out of the kit's exports.**
  - `packages/ui/package.json` no longer exports `./e2e/loading-check`.
  - The helper is in the private, test-only `@auction/e2e-utils` package (`packages/e2e-utils/package.json`, `./loading-check` → `src/loading-check.ts`).
  - It is a `workspace:*` devDependency of web, shop and art (`apps/web/package.json:89`, `apps/shop/package.json:39`, `apps/art/package.json:40`).
  - The specs import `@auction/e2e-utils/loading-check` (each `e2e/loading-screens.spec.ts:1`).
  - The stale `motion-check.ts` header reference is gone (`packages/e2e-utils/src/loading-check.ts:3-18`).
- **(6) `swapShift` is printed.** `packages/e2e-utils/src/loading-check.ts:297-298` logs `[loading-check] <product> <case> <viewport> <scheme>: swapShift=… skeletonShift=… blocks=…`, and the lines are in the CI log (see blocking 1). `swapNotAsserted` cases are tagged and annotated (`:303-306`); every other case still asserts swap ≤ 0.1 (`:308`).
- **(7) `/sales?tab=live` case.** It was added as asked (`apps/web/e2e/loading-screens.spec.ts:17-24`), but it fails in CI (blocking 1).
- **Lenis untouched.** No Lenis file is in the diff from `46c9bdac` to `e77e5634`, and no `lenis` string either.
- **Compositor lint passes.** `pnpm lint:compositor` reports "compositor-only motion: ok" and its rule tests pass 17/17. `pnpm lint:e2e-tags` reports ok, and the `@optin` describes are intact.
- **Commits.** The four new PR commits (`b3216742`, `fd80388d`, `3f3a965f`, `e77e5634`) and the merge have no Co-Authored-By, Claude-Session or generated-by trailers.

## Commands run

- `git worktree add /home/user/rbuild` (both builds at this one path); `pnpm install --frozen-lockfile`.
- `turbo run build --force --env-mode=loose --filter=@auction/{web,shop,art,account}`, pinned as above, at `46c9bdac`, then at `e77e5634`.
- `node scripts/check-route-js-budget.mjs --all` after each build.
- A Python per-entry gzip sum over `app-build-manifest.json` for all four apps, with the runtime left out and debug IDs and hashes normalised. A per-file diff to find the +1 B source and `58710`.
- In a head worktree:
  - `pnpm lint:compositor`
  - `pnpm lint:e2e-tags`
  - `pnpm --filter @auction/ui exec vitest run src/lax/`
  - `LAX_REQUIRE_CHROMIUM=1 vitest run` on the four Chromium suites
  - the `@layer` mutation, reverted
- `git show --cc 2b9dd568` for the conflict resolutions.
- CI check runs for `e77e5634` and the failed `browser-gates` job log (run 43853085965, job 133250553534).
