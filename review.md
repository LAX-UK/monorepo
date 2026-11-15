Verdict: FIX FIRST

# Final recheck (round 2): PR #1475 `motion-bid-page-changes` (motion system PR 2 of 8)

This recheck covers head `51a241f9`, which is three commits on top of the previous recheck's `56570d1e`: `f72f7fe5`, `e735f9a0`, `77a73a0d` and `51a241f9`. The head's last commit is from 22:41 UTC. It was still unchanged at 23:02 when I started and when I finished, so it had been stable for well over 5 minutes. The spec is `docs/design/motion.md` (line 36, MO4/MO7/MO14). The earlier reviews are in this file's history (`a8e6d1ad`, `de4427bf`). I did not change the PR branch.

All four findings from the previous recheck are fixed and I verified each one, including the route-JS blocker. But this recheck found a new blocking regression that every earlier round missed. **The theme toggle's circle wipe no longer plays on LAX Shop or lax.art.** Both apps import the same `marketing-header.css`, and neither one marks its transition.

## Findings

1. **BLOCKING (new): Shop and lax.art lose the light/dark circle wipe. Their theme switch becomes a 360 ms cross-fade.**
   - CSS: `packages/marketing-ui/src/marketing-header.css:20-29,37-39,76,79`
   - Shop: `apps/shop/src/app/base.css:6`, `apps/shop/src/lib/theme/shop-theme-transition.ts:38-40,49`
   - lax.art: `apps/art/src/app/base.css:6`, `apps/art/src/lib/theme/art-theme-transition.ts:38-40,49`

   Shop and lax.art both `@import "@auction/marketing-ui/marketing-header.css"`. Their own theme toggles (`revealShopThemeFromToggle`, `revealArtThemeFromToggle`) call `startViewTransition(apply)` with no `data-view-transition` marker, and they set `--theme-toggle-x/-y`. After this PR:
   - The wipe rules only match `:root[data-view-transition="theme"]`, so they never match on Shop or lax.art.
   - Their unmarked transition matches the new `:root:not([data-view-transition])` rule, so it plays as the Bid lot-morph cross-fade (360 ms, `--lax-ease-emphasize`).
   - The keyframes now read `--theme-toggle-at`, so even a marked Shop or lax.art wipe would grow from the fallback `100% 0` instead of from the button.

   I checked this in Chromium with the real `lax-system.css`, the Shop/lax.art `--motion-*` aliases and their toggle code, and read `document.getAnimations()`:
   - With main's CSS: `::view-transition-new(root)` runs `theme-reveal` for 900 ms, and the transition takes about 930 ms.
   - With this head's CSS: the transition runs `-ua-view-transition-fade-in/out` at 360 ms with no `theme-reveal`, and takes about 390 ms.

   This breaks the claim that the theme toggle is "unchanged" and that there is "no visible change", and it goes against motion.md line 36 ("limit the circle wipe to the theme switch"): the Shop and lax.art toggles are theme switches. The tests miss it because the Shop and lax.art unit tests don't load CSS, and `view-transition-css.spec.ts` only covers apps/web's marking.

   This has been present since `b988b87a`, and `--theme-toggle-at` in `51a241f9` makes it worse.

   Fix options:
   - Mark `data-view-transition="theme"` inside the update in both Shop and lax.art helpers, and move them to `--theme-toggle-at`. Those apps are outside Bid's route-JS budget groups, but re-check their CI budget rows afterwards.
   - Or keep the shared CSS backwards compatible for unmarked theme toggles. This is harder, because unmarked now means the lot morph.

   Either way, add a browser case for a Shop/lax.art-style toggle to `view-transition-css.spec.ts`.

2. **Previous blocker 1 (route JS): fixed.** `apps/web/src/components/layout/theme-toggle.tsx`, `apps/web/src/lib/view-transition-runtime.ts`

   CI `build` (check-run 132988594599) ran on `cb7ad7de`, which merges `51a241f9` into main `3ad0a869`. The baseline is main's own `build` on `3ad0a869` (check-run 132980906066). That push build built apps/web, so it is an exact baseline with nothing else in between. Gzip largest / frame / duplicate count:

   | group | main `3ad0a869` | this PR | result |
   |---|---|---|---|
   | account | 550.2 / 448.7 / 155 | 549.8 / 448.5 / 155 | lower |
   | checkout | 476.5 / 446.4 / 114 | 476.2 / 446.2 / 114 | lower |
   | listing | 470.8 / 344.2 / 121 | 470.7 / 344.2 / 121 | lower / equal |
   | lot | 481.4 / 349.7 / 139 | 481.4 / 349.6 / 139 | equal / lower |
   | public | 402.0 / 344.2 / 110 | 402.0 / 344.2 / 110 | equal |
   | sale | 485.4 / 346.1 / 144 | 485.3 / 346.1 / 144 | lower / equal |

   Tracked routes:
   | route | main | this PR |
   |---|---|---|
   | Home | 402.0 | 402.0 |
   | Sales list | 454.8 | 454.7 |
   | Sale | 485.4 | 485.3 |
   | Lot | 481.4 | 481.4 |
   | About | 352.1 | 352.1 |
   | Terms | 349.1 | 349.0 |

   Parsed size is lower too (Home 1234.4 → 1234.1 KB). Every group is equal or lower, and the listing duplicate count is back to 121. This doesn't rely on the 1 KB noise allowance. The diff touches no budget, ratchet, baseline or `route-js-budgets.json` file.

3. **Previous finding 2 (OS reduced-motion backstop): fixed and proven in a browser.** `packages/marketing-ui/src/marketing-header.css:53-71`
   - In my own Chromium harness, a marked theme transition under `reducedMotion: "reduce"` runs no animations and finishes in about 32 ms. Under no-preference it runs `theme-reveal` for 900 ms.
   - The PR's `view-transition-css.spec.ts` passes 9 of 9. It needs Chromium at `/opt/pw-browsers` here; the repo pins another Playwright build.

4. **Previous finding 3 (in-app switch): fixed.**
   - `theme-toggle.tsx:58-68` and `view-transition-runtime.ts:28-39` resolve reduced motion the way `useReducedMotion` does. `force-reduce` skips starting the transition, and `force-allow` keeps it under OS reduce.
   - `use-view-transition-router.ts:22-24` clears the admin marker when no transition starts.
   - The unit tests cover helper, toggle and router.
   - The e2e cases exist in `apps/web/e2e/view-transitions.spec.ts:124,140`. They're opt-in, need a running app, and I didn't run them.

5. **Previous finding 4 (cross-kind supersede cleanup): fixed.** `theme-toggle.tsx:78-91`, `use-view-transition-router.ts:14-25`

   I checked this in Chromium with the PR's exact marking pattern. I started a theme switch, then superseded it with a page change and with an admin navigation, both in the same task and after 100 ms. In all four cases the order was themeUpdate → themeCleanup → new update. During the new transition the marker was `none` or `admin`, with no `--theme-toggle-*` style. After it, `<html>` had no marker and an empty style. The admin case ran at the staff-like durations and not the wipe. The unit tests use `src/test/fake-view-transitions.ts`, which follows the same ordering.

6. **Non-blocking (carried over): the package depends on the app's attribute name.** `packages/staff-ui/src/theme.css:230-231`, `packages/marketing-ui/src/marketing-header.css`. First-review finding 7 is still deferred, as the PR states. Finding 1 shows the cost of this coupling: other apps that import the shared CSS weren't updated to the new contract.

## Mutation checks (re-run by me on this head; reverted afterwards)

- Theme marker set before `startViewTransition` instead of inside the update: 2 unit tests fail.
- Helper ignores `force-reduce`: 2 fail.
- Admin router no longer clears at once when no transition starts: 1 fails.
- Toggle ignores `force-allow`: 1 fails.
- OS-reduce backstop without the `html` type selector: 1 browser test fails (`view-transition-css.spec.ts`).
- `force-reduce` backstop without the `html` type selector: 1 browser test fails.

## Verified OK

- Tokens only: durations and easings come from `--lax-motion-*`, `--lax-ease-*` and the existing `--motion-*` aliases. The `900ms` fallback was already on main.
- Lenis isn't in the diff.
- No change at rest on Bid: every rule needs a running view transition. On Shop and lax.art the only change shows while a theme transition runs (finding 1).
- Focus and aria: unchanged. The label, `aria-pressed` and the button components are the same. Dropping `ref` is safe because `event.currentTarget` is the pressed button, and both button components spread `onClick` to a native `<button>`. The removed `variant` prop has no callers.
- No attribution: none of the commit messages (`b988b87a`, `56570d1e`, `f72f7fe5`, `e735f9a0`, `77a73a0d`, `51a241f9`) or the PR title or body contains `Co-Authored-By`, `Claude-Session`, generated-by or similar lines.

## Checks run (local, head 51a241f9)

- `corepack enable; pnpm install --frozen-lockfile; pnpm -r --filter './packages/**' build`: ok.
- apps/web vitest (`src/lib/view-transition-runtime.test.ts`, `src/components/layout`, `src/components/marketing`, `src/lib/hooks`, `src/hooks`, `--maxWorkers=2`): 103 files, 548 passed, 10 skipped.
- apps/shop and apps/art `src/lib/theme` vitest: 8 + 8 passed. They don't load CSS, which is why they miss finding 1.
- `view-transition-css.spec.ts` (Chromium): 9 passed.
- `tsc --noEmit` (apps/web): only the unrelated `Cannot find module '@auction/api/app'` (`src/lib/data/http/rpc-app.ts`), because the api app isn't built locally.
- biome on the 12 changed files: clean.
- `lint:client-copy`: pass.
- Not run: the app-level opt-in `view-transitions.spec.ts`, because no running app is available.

## CI (REST check-runs on 51a241f9)

At the time of writing: 34 success, 1 skipped (`shop-v1-phase-smoke` matrix placeholder), and 2 still running (`browser-gates`, `art-browser-gates`). None failed. `build` (including `check:route-js-budget`) and `static-checks` pass.
