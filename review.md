Verdict: FIX FIRST

# Review: PR #1475 `motion-bid-page-changes` (motion system PR 2 of 8)

Reviewed head `b988b87a` against `docs/design/motion.md` on `origin/main`. The PR branch was not changed.

The approach is right: the transition kind goes on `<html>` and the CSS keys off it. The design spec is met: in real Chromium the theme wipe is the same as on main, the lot morph runs at 360 ms with the emphasize ease, the admin cross-fade runs at 100/150 ms, and the transition layer has `pointer-events: none`. Two things block it. Three things block it:

- Route JS grows by 0.1 to 0.6 KB gzip on every apps/web route group.
- When two transitions of the same kind overlap, the second loses its styling, so a quick second toggle drops the wipe.
- The browser test doesn't prove the scoping it claims to prove, and its paint timing uses a single sample.

## Findings

1. **BLOCKING: route JS grows on every apps/web route group.** `apps/web/src/lib/view-transition-runtime.ts:1-70`, `apps/web/src/components/layout/theme-toggle.tsx`
   MO14 allows no route JS growth and doesn't let motion PRs use the 1 KB noise allowance. The CI `build` job's `check:route-js-budget` table for this head (job 132958454541), compared with the merge-base build on main (job 132947086554), gzip largest / frame:
   | group | main | PR |
   |---|---|---|
   | account | 549.6 / 448.2 KB | 550.2 / 448.7 KB |
   | checkout | 475.8 / 445.9 KB | 476.4 / 446.3 KB |
   | listing | 470.8 / 344.2 KB | 471.0 / 344.3 KB |
   | lot | 481.4 / 349.6 KB | 481.5 / 349.8 KB |
   | public (Home) | 402.0 / 344.2 KB | 402.2 / 344.3 KB |
   | sale | 485.3 / 346.1 KB | 485.5 / 346.2 KB |
   The job passes because these sizes are under the budgets and ratchets, but the growth breaks the motion rule. Possible causes:
   - The helper gained `canPlayViewTransition`, the in-app override read, the attribute set/clear and an unreachable branch.
   - The theme toggle still calls `canPlayViewTransition()` before the helper checks it again.
   - The test-only `VIEW_TRANSITION_ATTR` export.
   Trim until the frame is back at or below main, for example by dropping the dead branch (finding 10) and the duplicate check. Then re-run the table. The race fix in finding 2 has to fit in the same budget.

2. **BLOCKING: a second transition of the same kind loses its styling.** `apps/web/src/lib/view-transition-runtime.ts:51-65`
   `done()` removes `data-view-transition` when the attribute still equals `kind`. If a second transition of the same kind starts before the first ends (a double tap on the theme toggle, or two quick lot clicks), the browser skips the first one. Its `finished` then resolves *after* the second call has set the attribute again, and the first call's `done()` removes it while the second transition runs.
   Checked in Chromium (Playwright, the PR's CSS, the same set/clear logic): toggle twice 50 ms apart and, 100 ms into the second transition, the attribute is `null`. The root then plays the UA default 250 ms `plus-lighter` cross-fade, not `theme-reveal`. On main the second toggle still wiped, so the theme switch no longer looks exactly as before in this case.
   Fix: give each call its own token, for example a module-level counter (`const id = ++generation; … if (id === generation) root.removeAttribute(…)`), and add a unit test with two overlapping same-kind calls. The theme toggle's `--theme-toggle-*` cleanup (`theme-toggle.tsx`, the `onFinished` callback) has the same overlap. It was already there before this PR, but the same guard fixes it.

3. **BLOCKING: the e2e test doesn't prove that the theme toggle wipes and lot navigation doesn't.** `apps/web/e2e/view-transitions.spec.ts:15-29, 42, 70, 83`
   `recordTransitions` only records the `data-view-transition` value at the moment `startViewTransition` is called. It never looks at what the browser animates. Mutation check: with `marketing-header.css` reverted to main (global wipe on every transition), all three e2e tests still pass, because the runtime still sets the attribute. The CSS unit tests do catch the revert (3 of 8 fail), but the browser test doesn't prove the behaviour.
   Fix: after `transition.ready`, read `document.getAnimations()` and filter on `effect.pseudoElement`. Assert that `::view-transition-new(root)` runs `theme-reveal` for the theme toggle. For a lot click, assert that no animation is `theme-reveal` and that the morph groups run at 360 ms. A scratch Chromium harness shows these values are observable: theme gives `new(root):theme-reveal:900`; lot gives `group(lot-image):…:360` and no `theme-reveal`; admin gives `old(root):100`, `new(root):150`.

4. **BLOCKING: the interaction-to-paint check uses one sample and times the press, not the page change.** `apps/web/e2e/view-transitions.spec.ts:57-67`
   `runs: 1` goes against the helper's own contract (`MOTION_BUDGETS.interactionToPaintMs`: "assert on the median of several presses … never a single sample"), so a single slow frame can fail it. It also measures `pointerdown` to the next frame. Navigation only starts on `mouse.up`, so the transition's first frame (MO14: "page change paint within 200ms") is never timed.
   Fix: take the median of 5 presses, each released off the tile so no click happens, then click once to navigate. Time that page change from the input `timeStamp` to the transition's `ready` (first transition frame).

5. **Non-blocking: the CSS reduced-motion fallback doesn't cover the theme wipe.** `packages/marketing-ui/src/marketing-header.css:51-62`
   `::view-transition-new(*)` and `html[data-reduce-motion="force-reduce"]::view-transition-new(*)` have lower specificity than `:root[data-view-transition="theme"]::view-transition-new(root)`. In Chromium with `reducedMotion: "reduce"`, a started theme transition still runs `theme-reveal` for 900 ms (lot and admin are cancelled correctly). JS stops this in practice, but the file comment and the PR text both say the CSS fallback cancels the animations. Raise the specificity, for example `:root[data-view-transition]::view-transition-*(…)`, and add a unit assertion.

6. **Non-blocking: the CSS fallback ignores `force-allow`.** `packages/marketing-ui/src/marketing-header.css:51`
   The runtime lets `force-allow` override the OS setting (and the unit test "lets the in-app switch re-allow motion" relies on this). The `@media (prefers-reduced-motion: reduce)` block then sets `animation: none` anyway. With OS reduce plus `force-allow`, the transition starts and snapshots, then swaps instantly. Scope the media rule with `:root:not([data-reduce-motion="force-allow"])` so CSS and JS agree.

7. **Non-blocking (SOLID / dependency direction): a package depends on an app's attribute name.** `packages/staff-ui/src/theme.css:229-231`, `packages/marketing-ui/src/marketing-header.css:1-62`
   `VIEW_TRANSITION_ATTR` and the kinds are defined in `apps/web`. Two shared packages hard-code `data-view-transition="admin"` and `"lot"`. Admin transition timing also lives in a file named `marketing-header.css`. Consider one shared home in a package for the attribute name, kinds and transition CSS (for example a `view-transitions.css` in `packages/ui` or `branding`), with `apps/web` importing the constant from it. This would also remove the `../../../../packages/...` path the unit test reads.

8. **Non-blocking: the CSS unit tests are regex-based and loose.** `apps/web/src/lib/view-transition-runtime.test.ts:98-102`
   Adding `:root[data-view-transition="lot"]::view-transition-new(root)` to the selector list of the wipe rule would still pass, because the block contains the `theme` selector. Parse the file with the CSS parser already used by `scripts/compositor-rule.mjs` and assert that *every* selector of the `theme-reveal` rule is scoped to `theme`.

9. **Non-blocking: the lot rule also re-times the root cross-fade.** `packages/marketing-ui/src/marketing-header.css:34-39`
   `:root[data-view-transition="lot"]::view-transition-group(*)` (and old/new `(*)`) also covers `root`, so the rest of the page cross-fades at 360 ms with the emphasize ease. The spec names only the image morph. This is probably intended, but it should be stated in the comment or limited to the image's transition name.

10. **Non-blocking: dead branch.** `apps/web/src/lib/view-transition-runtime.ts:59-63`
   `if (!transition)` can't be reached, because `canPlayViewTransition()` has already confirmed `startViewTransition` is a function. Call it directly, with no `?.`, and drop the branch.

11. **Non-blocking: reduced-motion e2e coverage is thin.** `apps/web/e2e/view-transitions.spec.ts:74-84`
    Only the theme toggle is tested under OS reduced motion. Add a lot navigation under OS reduce and a run with the in-app switch (`localStorage["lax.reduceMotion"]="force-reduce"`), both expecting `[]`. The spec is also `@optin`, so it isn't part of the PR gate (same as the existing motion smoke). The PR says so, but the proof only counts once someone runs it.

## Verified OK

- Theme wipe is unchanged on the theme switch. In Chromium, `::view-transition-new(root)` runs `theme-reveal` for 900 ms with `--motion-ease-emphasize` (the same rule as main), and old/new have `mix-blend-mode: normal`. Lot, admin and no-kind transitions no longer run it.
- Lot morph: `var(--lax-motion-morph)` (360 ms) with `var(--lax-ease-emphasize)`. Admin cross-fade: `var(--lax-motion-page-out/in)` = 100/150 ms through the staff scope. No literal durations or easings were added.
- `::view-transition` computes `pointer-events: none` (`auto` on main).
- The runtime skips the transition under `prefers-reduced-motion`, under `force-reduce`, and when `startViewTransition` is missing (instant swap, `onFinished` still runs). The `@supports (view-transition-name: root)` guard is still there.
- No new dependencies. No new client module: the theme toggle now uses the shared helper. But route JS still grows a little (finding 1). Lenis isn't in the diff. No budget, baseline or allowlist file was touched. Nothing changes at rest (rules only apply while a transition runs; the staff tokens on `:root` only apply while the attribute is set).
- Mutation checks: reverting the CSS to main fails 3 of 8 unit tests. Hard-coding the kind to `"theme"` in the runtime fails 1 unit test. The e2e test doesn't catch either (finding 3).
- No `Co-Authored-By`, `Claude-Session` or generated-by lines in the commit message or the PR body.

## Checks run (local, head b988b87a)

- `corepack enable; pnpm install --frozen-lockfile; pnpm -r --filter './packages/**' build`: ok.
- apps/web vitest (view-transition runtime, view-transitions, lot pending, site header, phone menu, user menu, `components/marketing`, `--maxWorkers=2`): 40 files, 225 passed, 10 skipped.
- packages/staff-ui 632 passed; packages/branding 350 passed; packages/marketing-ui 693 passed.
- `tsc --noEmit` (apps/web): one error, `Cannot find module '@auction/api/app'` in `src/lib/data/http/rpc-app.ts`. That file isn't touched by this PR, and the error comes from the api app not being built locally.
- biome on changed files: clean. `lint:client-copy` 21/0, `lint:compositor` 15/0, `lint:ui-guardrails`, `lint:web-guardrails`, `lint:bid-public-kit`, `lint:client-boundary`, `lint:e2e-tags`, `lint:e2e-portfolio`, `lint:test-mocks`: all pass.
- `scripts/check-route-js-budget.mjs`: no production build locally, so it audited nothing (a full `next build` of apps/web was not run, as instructed). The CI `build` job runs `check:route-js-budget` on a real build (see below).
- Opt-in Playwright spec: not run (no running app). The behaviour was checked instead with a standalone Chromium harness that loads the PR's CSS and `lax-system.css`.

## CI (`gh pr checks` via REST check-runs)

All 37 check-runs on `b988b87a` have finished: 36 success, 1 skipped (`shop-v1-phase-smoke`, a matrix placeholder), 0 failing. `static-checks` (biome, compositor lint, route-js lint) and `build` (`check:route-js-budget`) pass. As finding 1 explains, a passing budget check does not mean zero growth.

