Verdict: FIX FIRST

# Final recheck: PR #1475 `motion-bid-page-changes` (motion system PR 2 of 8)

This recheck covers head `56570d1e` (the fixer commit on top of `b988b87a`). The head was unchanged from 21:42 UTC until the review was written, and the PR branch was not changed. The spec is `docs/design/motion.md` (line 36 and MO13/MO14). The first review is in this file's history (`a8e6d1ad`).

The fixer resolved most of the first review. The race guard, browser-level e2e proof, median timing, postcss-based CSS tests and dead-branch removal are all in, and every mutation I re-ran fails the unit tests. One blocker remains: route JS still grows on every apps/web marketing route group. The fixer's isolated minify-and-gzip measurement doesn't show this, but CI's real build does.

## Findings

1. **BLOCKING: route JS still grows (MO14: zero growth, no 1 KB noise allowance).** `apps/web/src/components/layout/theme-toggle.tsx:9,72`, `apps/web/src/lib/view-transition-runtime.ts:1-53`
   PR CI ran the `build` job (132968737308) on `pull/1475/merge`, which is main `2504b5e2`, not the merge-base. Main's own build of `2504b5e2` only built apps/shop, so it can't serve as a baseline. The clean apps/web baseline at `2504b5e2` comes from PR #1461's build (132966911342, merge onto `2504b5e2`), because that PR touches no file in apps/web. The `check:route-js-budget` table, gzip largest / frame / duplicates:
   | group | main `2504b5e2` (via #1461) | this PR | delta |
   |---|---|---|---|
   | public (Home) | 402.0 / 344.2 | 402.1 / 344.3 | +0.1 |
   | listing | 470.8 / 344.2, dup 121 (32.0 KB) | 470.9 / 344.3, dup **122** (32.1 KB) | +0.1, +1 duplicated module |
   | lot | 481.4 / 349.6 | 481.5 / 349.7 | +0.1 |
   | sale | 485.3 / 346.1 | 485.4 / 346.2 | +0.1 |
   | account | 549.9 / 448.5 | 549.9 / 448.6 | frame +0.1 |
   | checkout | 476.2 / 446.2 | 476.3 / 446.2 | +0.1 |
   The tracked routes (Home, Sales list, Sale, Lot, About, Terms) are all up by +0.1 to +0.2 KB. This isn't noise. The public frame is exactly 344.2 KB in all four other builds I checked: the merge-base, #1474, #1461 and #1473.
   Likely cause: the theme toggle now imports the shared helper, so the helper sits in the layout frame and still sits in the lot-link page chunk. That's one new duplicated module (listing dup 121 → 122). The fixer's "1606 B vs 1611 B" compared the files on their own and can't see chunk placement or duplication.
   Fix options: keep the theme toggle self-contained (set and clear `data-view-transition="theme"` inline, as main did for its own transition code), or otherwise make the helper exist in one chunk only. Then compare the CI table against a clean main baseline. The budget check passes only because these sizes are under the budgets and ratchets. It does not prove zero growth.

2. **Non-blocking: the OS reduced-motion CSS backstop still does not cancel the theme wipe. The claim in the PR text and the code comment is wrong.** `packages/marketing-ui/src/marketing-header.css:52-59`, `apps/web/src/lib/view-transition-runtime.test.ts:169-177`
   A `(*)` argument gives a view-transition pseudo-element zero specificity, while `(root)` counts like a type selector. So `:root[data-view-transition]::view-transition-new(*)` is (0,2,0) and loses to `:root[data-view-transition="theme"]::view-transition-new(root)` at (0,2,1).
   Checked in Chromium (Playwright, this head's CSS, `reducedMotion: "reduce"`): a started theme transition still runs `::view-transition-new(root):theme-reveal:900` and takes about 930 ms. Lot and admin are cancelled. The `force-reduce` rule does work: the `html` type selector brings it to (0,2,1), and it comes later in the file. Theme, lot and admin all finish in about 30 ms with no animations.
   Users don't see this today, because the JS gate at `view-transition-runtime.ts:35` doesn't start transitions under OS reduce. But the unit test only checks the selector text and passes for the wrong reason. Fix: name `(root)` in the reduce rules, or add a type selector (`html:root[...]`), and assert the outcome in a browser rather than the selector text.

3. **Non-blocking: under the in-app switch, a transition now starts and is then cancelled, rather than being skipped.** `apps/web/src/lib/view-transition-runtime.ts:29,35`, `packages/marketing-ui/src/marketing-header.css:62-66`
   The JS no longer reads `lax.reduceMotion`, so under `force-reduce` the browser still snapshots and starts a transition, and CSS cancels every animation (verified: about 30 ms, no animations). The result is visually instant, and it's better than main, where the wipe played under `force-reduce`. But motion.md line 36 says to skip transitions, and the summary table at the top of the PR body still says "no view transition starts" for the in-app switch. The "Changes after review" section does say it supersedes that. `force-allow` no longer overrides OS reduce for transitions, which differs from `useReducedMotion`. That matches main. The e2e has no in-app-switch case (first-review finding 11, partly open).

4. **Non-blocking: a transition superseded by one of a different kind never runs its own cleanup.** `apps/web/src/lib/view-transition-runtime.ts:30-34`, `apps/web/src/components/layout/theme-toggle.tsx:72-74`
   `done()` returns early for any older transition. So a theme toggle followed within 900 ms by a lot or admin navigation leaves `--theme-toggle-x/y/radius` on `<html style>`. The newer transition's `onFinished` is a different callback. Nothing visible at rest, because only the `theme-reveal` keyframes read these properties. But the doc comment ("leaves the cleanup to the newer one") is only true for same-kind overlaps. Run the older callback when the kinds differ, or document the leak.

5. **Non-blocking (carried over): the package depends on the app's attribute name.** `packages/staff-ui/src/theme.css:230-231`, `packages/marketing-ui/src/marketing-header.css`
   First-review finding 7 was deliberately not done, and the PR says so. It's fine to leave it for a later motion PR.

## First-review findings: status

| # | Finding | Status |
|---|---|---|
| 1 | Route JS growth (blocking) | **Not fixed.** Smaller, but still +0.1 KB on every marketing group and one more duplicated module (finding 1 above) |
| 2 | Same-kind overlap loses styling (blocking) | Fixed. Latest-token guard at `view-transition-runtime.ts:31`; removing it fails the new overlap test |
| 3 | e2e doesn't prove scoping (blocking) | Fixed. `observeViewTransitions` reads `document.getAnimations()` pseudo-element animations: theme-reveal on the toggle, none on a lot navigation, 360 ms groups. Second-toggle case added |
| 4 | Single-sample timing of the press (blocking) | Fixed. `medianInputToTransitionReady`: median of 5, input `timeStamp` to transition `ready` |
| 5 | Reduce backstop specificity | **Not effective** for OS reduce (finding 2 above); works for `force-reduce` |
| 6 | `force-allow` vs CSS | Moot. JS no longer honours `force-allow`; JS and CSS now agree |
| 7 | Shared home for the attribute and CSS | Deferred (finding 5 above) |
| 8 | Regex CSS tests | Fixed. postcss parse; every wipe selector is scoped to `theme` |
| 9 | Lot rule re-times the root cross-fade | Fixed. Stated in the comment |
| 10 | Dead branch | Fixed |
| 11 | Thin reduced-motion e2e | Partly fixed. Lot under OS reduce added; no in-app-switch case; the spec is still `@optin` and has not been run against an app |

## Verified OK

- **Spec behaviour, in Chromium** (this head's CSS plus the tokens):
  - Theme: `::view-transition-new(root)` runs `theme-reveal` for 900 ms.
  - Lot: every group/old/new runs at 360 ms (`--lax-motion-morph`, `--lax-ease-emphasize`), with no `theme-reveal`.
  - Admin: old(root) 100 ms and new(root) 150 ms (staff `--lax-motion-page-out/in` via `:root[data-view-transition="admin"]`). Other named groups keep the UA's 250 ms, as on main.
  - `pointer-events: none` is on the transition layer.
- **Tokens only.** No literal durations or easings were added. The `900ms` fallback in `var(--motion-duration-xl, 900ms)` was already on main.
- **No change at rest.** Every rule needs `data-view-transition`, which is only set while a transition runs. Focus, aria and the toggle's label are unchanged. Lenis isn't in the diff. No budget, baseline, ratchet or allowlist file was touched.
- **Mutation checks, re-run by me:**
  - Remove the latest-token guard: 1 test fails.
  - Revert `marketing-header.css` to main: 5 fail.
  - Hard-code the kind to `"theme"`: 2 fail.
  - `pointer-events: auto`: 1 fails.
  - Drop the OS-reduce JS check: 1 fails.
  - Drop the `force-reduce` CSS block: 1 fails.
- **No attribution lines.** There are no `Co-Authored-By`, `Claude-Session` or generated-by lines in either commit message (`b988b87a`, `56570d1e`) or in the PR title or body.

## Checks run (local, head 56570d1e)

- `corepack enable; pnpm install --frozen-lockfile; pnpm -r --filter './packages/**' build`: ok.
- apps/web vitest (`src/lib/view-transition-runtime.test.ts`, `src/components/layout`, `src/components/marketing`, `--maxWorkers=2`): 89 files, 506 passed, 10 skipped.
- `tsc --noEmit` (apps/web): only the unrelated `Cannot find module '@auction/api/app'` in `src/lib/data/http/rpc-app.ts`, because the api app isn't built locally.
- biome on the 10 changed files: clean. `lint:client-copy`, `lint:compositor`, `lint:ui-guardrails`, `lint:web-guardrails`, `lint:client-boundary`, `lint:e2e-tags`, `lint:test-mocks`, `lint:bid-public-kit`, `lint:e2e-portfolio`: all pass.
- `scripts/check-route-js-budget.mjs`: not run locally. There's no production build, and a full `next build` of apps/web was not run, as instructed. Its CI output was read instead (finding 1).
- Opt-in Playwright spec: not run (no running app). The behaviour was checked in a standalone Chromium harness.

## CI (REST check-runs on 56570d1e)

At the time of writing: 35 success, 1 skipped (`shop-v1-phase-smoke`, a matrix placeholder), and 1 still running (`browser-gates`). None failed. `static-checks` and `build` (including `check:route-js-budget`) pass. A passing budget check does not mean zero growth (finding 1).
