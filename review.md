Verdict: SHIP

# Final recheck (round 3): PR #1475 `motion-bid-page-changes` (motion system PR 2 of 8)

This recheck covers head `b1817ecf`, which is two commits on top of the round-2 head `51a241f9`: `26ec5d04` (one shared theme switch) and `b1817ecf` (browser proof for all three products). The head's last commit is from 23:21 UTC. It was still unchanged at 00:01 when I started and at 00:19 near the end, so it had been stable for well over 5 minutes. The spec is `docs/design/motion.md` line 36 (MO4/MO7). The earlier reviews are in this file's history (`a8e6d1ad`, `de4427bf`, `77d9f813`). I did not change the PR branch.

The round-2 blocker is fixed, and I proved it in Chromium with each app's real compiled CSS and the toggle code as bundled. Route JS doesn't grow on apps/web, LAX Shop or lax.art. Nothing is blocking. Findings 3 to 5 are non-blocking test gaps and notes.

## Findings

1. **Round-2 blocker (Shop and lax.art lost the circle wipe): fixed.**
   - Shared helper: `packages/marketing-ui/src/motion/theme-view-transition.ts:23-55`, exported at `packages/marketing-ui/package.json:336-339`.
   - Callers: `apps/shop/src/components/header/shop-theme-toggle.tsx:47`, `apps/art/src/components/header/art-theme-toggle.tsx:47`, `apps/web/src/components/layout/theme-toggle.tsx:52`.

   All three toggles now call one helper, `revealThemeFromToggle`. It sets `data-view-transition="theme"`, `--theme-toggle-at` and `--theme-toggle-radius` inside the update callback, and clears them when `finished` settles. The per-app copies are removed.

   My proof was stronger than the PR's own spec. I built Shop and lax.art in production mode with the CI Sentry placeholder DSNs, using the PR merged into main `a54b584f`. Then I took each app's real compiled CSS from `.next/static/css`, which keeps the `@import ... layer(base)` cascade and every other app rule. I also took the helper exactly as the bundler inlined it in each `app/layout` chunk. In Chromium I pressed a toggle wired to that bundled code and read `document.getAnimations()`. Shop and lax.art gave the same result:

   | OS setting | in-app switch | result |
   |---|---|---|
   | no-preference | none | marked `theme`, `::view-transition-new(root)` runs `theme-reveal` for 900 ms from `circle(0px at 120px 30px)` (the button's centre), about 930 ms in total, `<html>` clean afterwards |
   | no-preference | `force-reduce` | no transition, theme switched at once |
   | no-preference | `force-allow` | wipe as at rest |
   | reduce | none | no transition, theme switched at once |
   | reduce | `force-reduce` | no transition |
   | reduce | `force-allow` | wipe as at rest (about 940 ms) |

   This matches main's behaviour from round 2: `theme-reveal` for 900 ms and about 930 ms in total. Bid is covered by `apps/web/e2e/view-transition-css.spec.ts` (the Bid aliases with the same shared helper) and by the unit tests.

2. **BLOCKING criterion, route JS: met. Equal or lower on every group of all three apps. No budget, ratchet or baseline was touched, and no 1 KB allowance is used.**

   apps/web: CI against CI. The baseline is main's own `build` job 132991501522 on `a54b584f` (merge-group run 43772359259). The PR side is `build` job 132997375437, which ran on `c3cf9af7` (`b1817ecf` merged into that same `a54b584f`). Gzip largest / frame / duplicate count:

   | group | main `a54b584f` | this PR | result |
   |---|---|---|---|
   | account | 550.1 / 448.7 / 155 | 549.6 / 448.5 / 155 | lower |
   | checkout | 476.4 / 446.4 / 114 | 476.2 / 446.1 / 114 | lower |
   | listing | 470.8 / 344.2 / 121 | 470.8 / 344.2 / 121 | equal |
   | lot | 481.4 / 349.7 / 139 | 481.4 / 349.6 / 139 | equal / lower |
   | public | 402.0 / 344.2 / 110 | 402.0 / 344.2 / 110 | equal |
   | sale | 485.4 / 346.1 / 144 | 485.3 / 346.1 / 144 | lower / equal |

   Tracked routes: Home 402.0 = 402.0 (parsed 1234.4 → 1234.2), Sales list 454.8 → 454.7, Sale 485.4 → 485.3, Lot 481.4 = 481.4, About 352.1 = 352.1, Terms 349.1 → 349.0. The page column for checkout (30.0 → 30.1) and sale (139.2 → 139.3) is 0.1 higher, but those groups' largest and frame are lower, so the route total still drops.

   LAX Shop and lax.art: main's merge-group build skipped both apps, so there is no CI baseline. I built both myself from `a54b584f` and from the PR merged into it (`pnpm turbo run build --force`, CI DSN placeholders), then ran `pnpm check:route-js-budget --app ...`.

   - Shop, main → PR:
     - account 520.5/514.6 → 520.4/514.6
     - checkout 551.8/511.3 → 551.8/511.3
     - product 552.9/515.4 → 552.9/515.4
     - public 520.5/510.1 → 520.5/510.1
     - Duplicates are the same: 20, 7, 9, 5.
   - lax.art: main reads account 522.1/519.7, product 524.1/516.7, public 527.8/516.7, with duplicates 7, 5, 4. The PR matched this in my second PR build and in the PR's own CI. My first PR build read account 522.2/519.8.

     I checked that +0.1 KB and it is build noise, not growth. Two builds of the identical PR commit get different webpack chunk and module ids (for example chunk `7905` vs `601`). That reorders modules and moves gzip by a few bytes either way, and each build also embeds random Sentry debug ids. With the debug ids normalised, exact gzip bytes for the PR are 1 to 35 B smaller than main on every lax.art route I measured:
     - layout entry: 522617 → 522615
     - `/account/favourites`: 442062 → 442061
     - `/artworks/[slug]`: 453777 → 453776
     - `/for-artists/apply`: 493825 → 493790

     The one chunk this change touches, `app/layout`, is consistently smaller in both apps: about 110 B raw, and 1 B (lax.art) and 18 B (Shop) gzip.

3. **Non-blocking (test gap): the helper's main unit test reports "passed" when the marker is missing.** `packages/marketing-ui/src/motion/theme-view-transition.test.ts:72-74`

   The `expect(kind()).toBe("theme")` runs inside `apply`, which the fake calls from a `setTimeout`. When I removed `root.dataset.viewTransition = "theme"`, vitest showed "7 passed" with "Errors 1" (an unhandled error) and exited 1, so CI would still fail. But the failure isn't tied to the test. Recording the kind inside `apply` and asserting it after `flush()` would make the test itself fail. The browser spec catches the same mutation directly (3 failed).

4. **Non-blocking (test gap, already on main): nothing checks that the Shop and lax.art toggles pass their button.** `apps/shop/src/components/header/shop-theme-toggle.tsx:47`, `apps/art/src/components/header/art-theme-toggle.tsx:47`

   Changing Shop's call to `revealThemeFromToggle(null, apply)` makes the wipe grow from the `innerWidth - 32, 32` fallback instead of the button, and the Shop header tests still pass (27/27). Main's per-app tests didn't cover this wiring either, and the browser spec wires its own toggle, so this is not a regression. A one-line component test (spy on the helper, click, expect the button) would close it.

5. **Non-blocking (carried over, narrowed): coupling between the package and the app's attribute name.** `packages/staff-ui/src/theme.css:231`

   The theme marker and the CSS that reads it now both live in `@auction/marketing-ui`. Only the `admin` marker is still written by apps/web and read by staff-ui, and that stays deferred as stated (first-review finding 7).

## Mutation checks (re-run by me on this head; reverted afterwards)

- Removing `root.dataset.viewTransition = "theme"` from the shared helper: 3 browser tests fail (the Bid, Shop and lax.art wipe cases in `view-transition-css.spec.ts`). The helper's vitest run exits 1 through an unhandled error (finding 3).
- Putting the `theme-reveal` keyframes back on main's `--theme-toggle-x/-y` origin: 3 browser tests fail (origin `at 40px 30px` expected).
- Extra: the Shop toggle passes `null` instead of its button: not caught (finding 4).

## Repo-wide search for other users

- `marketing-header.css` is imported only by `apps/web/src/app/globals.css:7`, `apps/shop/src/app/base.css:6` and `apps/art/src/app/base.css:6`. All three now mark the theme switch through the shared helper. The other mentions are comments and tests.
- `startViewTransition` is called only from the shared helper and `apps/web/src/lib/view-transition-runtime.ts` (used by `lot-view-transition-link.tsx` and `use-view-transition-router.ts`). Nothing else uses `startViewTransition`, `@view-transition`, React `<ViewTransition>` or the old `--theme-toggle-x/-y`, apart from tests.
- Shop and lax.art have no page-change transitions, so the unmarked lot-morph rule can't match there.

## Verified OK

- Lot morph and admin cross-fade are unchanged. Between `51a241f9` and this head, `marketing-header.css` and `view-transition-runtime.ts` changed only in comments, and `use-view-transition-router.ts` and `staff-ui/theme.css` didn't change. The spec still passes the 360 ms unmarked morph and the 140/200 ms admin cross-fade, with no wipe.
- Reduced motion and the in-app switch still skip or cancel transitions as before: the helper's unit tests, the spec, and my bundled-code table above.
- Tokens only: no new literal durations or easings. The `900ms` fallback and the `innerWidth - 32, 32` origin fallback were already on main.
- Lenis isn't in the diff.
- No change at rest: every CSS rule needs a running view transition, and the helper runs only on a toggle press.
- No attribution: none of the 8 commit messages, the PR title or the PR body contains `Co-Authored-By`, `Claude-Session`, generated-by or similar lines.
- Dropped `try` around `startViewTransition` in the Shop and lax.art copies: acceptable. Cleanup runs on both outcomes of `finished`. Bid never had the wrapper.

## Checks run (local, head b1817ecf)

- `corepack enable; pnpm install --frozen-lockfile; pnpm -r --filter './packages/**' build`: ok.
- marketing-ui vitest `src/motion`: 9 files, 59 passed (`theme-view-transition.test.ts`: 7).
- apps/web vitest (`src/lib/view-transition-runtime.test.ts`, `src/components/layout`, `src/components/marketing`, `src/lib/hooks`, `src/hooks`, `--maxWorkers=2`): 103 files, 548 passed, 10 skipped.
- apps/shop vitest (`src/lib/theme`, `src/components/header`): 29 passed. apps/art: 16 passed.
- `view-transition-css.spec.ts` (Chromium 1243 at `/opt/pw-browsers`): 16 passed.
- `tsc --noEmit`: marketing-ui, shop and art are clean. apps/web shows only the unrelated `Cannot find module '@auction/api/app'` (`src/lib/data/http/rpc-app.ts`), because the api app isn't built locally.
- biome on the 17 changed files: clean.
- `lint:client-copy`, `lint:deps` and `lint:compositor`: pass.
- Production builds of Shop and lax.art (main and PR) plus `check:route-js-budget`: as in finding 2.
- Not run:
  - The app-level opt-in `view-transitions.spec.ts`, because no running app is available.
  - `next start` of Shop and lax.art, which needs production URLs and backends that this environment doesn't have. I used the compiled CSS and bundled helper instead (finding 1).

## CI (REST check-runs on b1817ecf)

All 40 check runs completed with success. That includes `build` (with `check:route-js-budget` for web, shop and art), `static-checks`, `browser-gates` and `art-browser-gates`.
