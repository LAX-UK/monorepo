Verdict: FIX FIRST

# Final recheck of PR #1486 (motion-hover-press): motion system 4/8, hover and press

This review covers head `5cb2c92f` ("Hover and press: fixes from review"). It checks the code against `docs/design/motion.md` on main (MO9, MO10, MO13, MO14 and Build item 4) and against the previous review on this branch (`a3e90acf`, Verdict: FIX FIRST). The PR branch was not changed.

The design work is now right. Every finding from the previous review is fixed in code, and every motion check below passes. Two things still stop it shipping:

- CI is red.
- Route JS grows by 0.1 KB on two groups against main's own CI build.

The PR body also contradicts the code in several places.

## Blocking

1. **CI is red: `web vitest (6/8)` fails, and I reproduced the failure locally.**
   - The failing test is `apps/web/src/components/layout/site-header.test.tsx:283`, which expects `motion-reduce:transition-none` in the header class string.
   - `5cb2c92f` moved the header surface's transition out of the class string and into `.marketing-header-surface` (`packages/marketing-ui/src/header/use-header-chrome.ts:134`, `packages/marketing-ui/src/marketing-header.css:141-151`). It updated the marketing-ui test but not this Bid test.
   - CI run 43809082828, job 133106746951: 1 failed of 1369. Locally, `vitest run src/components/layout/site-header.test.tsx` fails with the same assertion.
   - The behaviour is fine (the CSS rule drops the transition under `prefers-reduced-motion`), so the fix is to assert the new contract: `marketing-header-surface` is present, and `transition` / `backdrop-filter` are absent from the class string.

2. **Route JS grows on two groups against main's latest CI build.** Main here is the merge-group `build` job of run 43805181198, at main's tip `5569ca0e`. The PR is the `build` job of run 43809082828, which is the PR merged with current main. Values are largest / frame / page in KB.

   | group | main CI (`5569ca0e`) | PR CI (`5cb2c92f`) | change |
   |---|---|---|---|
   | apps/web checkout | 471.7 / 441.0 / 30.7 | **471.8** / 441.0 / **30.8** | **+0.1** (`/(client)/purchases/collect`) |
   | apps/account account | 436.0 / 405.1 / 30.9 | **436.1** / 405.1 / **31.1** | **+0.1** (`/account/profile`); `/account/security/delete` 411.9 → **412.0** |
   | apps/web account | 545.2 / 442.6 / 102.6 | 545.2 / 442.6 / 102.6 | equal |
   | apps/web listing | 462.2 / 337.3 | 462.1 / 337.2 | lower |
   | apps/web lot | 467.4 / 343.1 | 467.4 / 343.1 | equal |
   | apps/web public | 394.5 / 337.2 | 394.4 / 337.2 | lower |
   | apps/web sale | 478.9 / 341.4 | 478.7 / 341.4 | lower |
   | Shop account / checkout / product / public | 520.4 / 551.8 / 552.8 / 520.4 | 520.3 / 551.8 / 552.8 / 520.4 | equal or lower (checkout page column 40.5 → 40.6) |
   | lax.art account / product / public | 522.0 / 524.0 / 527.7 | 522.0 / 524.0 / 527.6 | equal or lower |

   - Duplicates are equal on every group.
   - The tracked routes are equal or lower: Home 394.4, Sales list 442.8, Sale 478.7, Lot 467.4, About 344.9, Terms 341.8.
   - MO14 allows no growth on any route and no noise allowance for motion PRs, so the two +0.1 KB rows block.
   - The PR's own table measures against `bb60b42e` and a local build, not against main's current CI. Its checkout row already showed 471.4 → 471.6.
   - The PR explains this as Next's per-build server-action key reshuffling chunks. That may well be true, but the rule does not accept it. Either make these two groups come out equal or lower in CI against current main, or show that `main` itself reproduces 471.8 and 436.1 in CI.
   - Do not raise budgets or baselines. I checked: `git diff bb60b42e 5cb2c92f` touches no budget, ratchet or baseline file.

3. **The PR body contradicts the code.** It is the record a merge leaves behind, so it has to match.
   - It says "the lift runs over `--lax-motion-panel`" and, under "Lift timing", "uses `--lax-motion-panel` (260ms), the nearest token; no token was added. `motion.md` records this." The code does the opposite:
     - `--lax-motion-lift: 300ms` is added (`packages/branding/public/lax-system.css:154`).
     - The lift uses it (`packages/ui/src/lax/hover-press.css:37`).
     - `motion.md` keeps "frame lift 1px over 300ms" and lists the token.
   - It says the hang's hovered shadow is "slightly deeper than the old swap". The layer alphas are now chosen so that rest plus layer equals the old hover shadow (`packages/marketing-ui/src/marketing-ui.css:273-290`).
   - It says the interest-picker tiles were "left alone... this PR doesn't change them". `f5c0fe6b` converts them to `lax-card` / `lax-card-lift` / `lax-card-zoom`:
     - `apps/web/src/components/onboarding/buyer-interests-form.tsx:114-119,143`
     - `apps/web/src/components/dashboard/auction-interests-settings-form.tsx:179-184`
   - It does not mention the header-surface change (`marketing-header-surface`, shadow no longer transitioned, header leaves the compositor allowlist).
   - It says "All pass" for the tests and "35 tests" for the Chromium suite. In fact CI fails (finding 1), and the suite now runs 50 tests.
   - Its route JS tables are against stale `bb60b42e` (see finding 2).

## Non-blocking

4. The Lot quick-look thumbnail strip still has a hand-written hover scale with a literal duration, on a line this PR rewrote: `apps/web/src/components/marketing/lot-quick-look/quick-look-dialog-sections.tsx:133`.
   - It has `transition-[scale,opacity,border-color] motion-safe:duration-200`, with `scale-95` → `hover:scale-100` and no `(hover: hover)` gate.
   - It is a ghost `Button`, so it also gets `lax-press`. Pressing an inactive thumb animates its `scale` from 0.95 towards 0.98.
   - This is a selection strip rather than a card, and the `transition-all` replacement was the brief here. Still, the duration should be `--lax-motion-hover` and the hover scale should be mouse-only, in this PR or a follow-up.

5. The PR is based on `bb60b42e`. Main is now `5569ca0e`, three commits ahead. It merges cleanly (`git merge-tree`), but rebase it before re-measuring finding 2, so that the PR's own numbers and CI agree.

## Previous findings: status

| # | Previous finding | Status at `5cb2c92f` | Evidence |
|---|---|---|---|
| 1 (blocking) | Hang hover shadow sticks on touch | **Fixed** | `a:hover .marketing-hang-art::after` is now inside `@media (hover: hover) and (pointer: fine)` (`packages/marketing-ui/src/marketing-ui.css:304-308`). A phone case is in the Chromium suite, and mutation M2 below shows it is caught. |
| 2 | Kit zoom cancels the image's own load fade | **Fixed** | `:is(.lax-card-zoom, .lax-card-media img).transition-opacity` adds `opacity` with the utility's `--tw-duration` / `--tw-ease` (`packages/ui/src/lax/hover-press.css:46-50`). Under reduced motion it uses `transition: revert-layer` (`:95`, `:112`). Chromium cases cover mouse, phone, reduced motion and staff, and mutation M3 is caught. |
| 3 | Hand-written card hovers remain | **Fixed** | Day-gallery thumbnail and both interest pickers now use the kit classes. There is no literal 500ms or 1.025/1.03 zoom left in those files. |
| 4 | Lift on 260ms instead of the approved 300ms | **Fixed** (but see finding 3) | New token `--lax-motion-lift: 300ms`, public only. The drift test pins it (`packages/branding/tests/lax-motion.test.ts`). `motion.md` keeps the approved wording. |
| 5 | Header literal `duration-300 ease-out` | **Fixed** | `.marketing-header-surface` uses `--lax-motion-panel` / `--lax-ease-out` and fades only background and border. Shadow and blur switch at once. |

## Verified

- **Card lift (MO9):**
  - 1px: `translate: 0 -1px` (`packages/ui/src/lax/hover-press.css:53`).
  - Over `var(--lax-motion-lift) var(--lax-ease-out)` (`:37`).
  - The design value is intact at `--lax-motion-lift: 300ms` (`packages/branding/public/lax-system.css:154`; `docs/design/motion.md` table and MO9 line).
  - Chromium measures 300ms for public and Account. Mutation M1 below (token set to 260ms) fails 4 tests.
- **Zoom (MO9):** `scale: 1.02` (`hover-press.css:57`) over `--lax-motion-media` (700ms) (`:43`). Mutation M4 (1.03) fails 6 tests.
- **Mouse-only:** every lift, zoom and underline rule sits inside `@media (hover: hover) and (pointer: fine)` (`hover-press.css:35-63`), and so does the hang layer (`marketing-ui.css:304`). Shop's print lift is gated the same way. The phone cases pass.
- **Reduced motion (MO13) and staff:**
  - The OS setting, Bid's `force-reduce` and the staff scope (`:root:has([data-lax-density="staff"])`) each set `translate: none`, `scale: none` and `animation: none` on the press (`hover-press.css:70-117`). `force-allow` keeps motion.
  - All of these are Chromium-tested for public, staff and Account.
- **Press (MO10):**
  - Press is 0.98 (`@keyframes lax-press`, `hover-press.css:29-33`) over `--lax-motion-press`, only while `:active` and not on disabled, `aria-disabled` or loading buttons (`:65-67`).
  - It applies to the public `Button`: filled, outlined and ghost variants via `FILLED_STATES` / `OUTLINED_STATES` / ghost (`packages/ui/src/components/ui/button.tsx`). Text-shaped variants use `TEXT_STATES` and do not press.
  - It also applies to the LAX system button, i.e. Account (`packages/ui/src/lax/button-variants.ts:18`).
  - Staff pages get no press.
- **`transition-all`:** none left. Grepping `apps`, `packages` and `scripts` outside tests finds no `transition-all` or `transition: all`, and `scripts/compositor-rule.test.mjs` keeps it so.
- **Header blur:** not animated. Only `background-color` and `border-color` transition (`marketing-header.css:141-144`).
- **Hang shadow:** an `::after` layer fading `opacity` over `--lax-motion-hover`. No `box-shadow` transition (`marketing-ui.css:292-302`).
- **Compositor lint:** `pnpm lint:compositor` passes (17 pass). The allowlist diff against the base has only `-` lines (−70; `5cb2c92f` removes 5 more) and no `+` line, so it was only shrunk.
- **Tokens are the single source:**
  - Every duration and easing the PR adds in kit CSS, Shop CSS and components is a `--lax-motion-*` / `--lax-ease-*` token.
  - The interest-picker colour transitions use `duration-[var(--lax-motion-hover)] ease-[var(--lax-ease-out)]`.
  - The one remaining literal on a touched line is finding 4. Shop's untouched `--motion-duration-sm ease` lines are aliases from before this PR.
- **Lenis:** no Lenis file is in the diff.
- **`blocking=render` / Speculation Rules:** neither appears anywhere in `apps` or `packages` at the PR head.
- **Attribution:** none of the five commits or the PR body carries `Co-Authored-By`, `Claude-Session` or a "generated by" line.

## What I ran

- Setup: a worktree of `origin/motion-hover-press` at `5cb2c92f`, `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build`. All succeeded.
- Chromium behavioural suites with `LAX_REQUIRE_CHROMIUM=1`: `hover-press-resolved`, `motion-resolved` and `hover-press` tests, 103 of 103 passed.
- Mutation checks. Each was run against `hover-press-resolved.test.ts` and reverted afterwards (`git status` clean). All were caught:
  - M1: `--lax-motion-lift` 300ms → 260ms. 4 failed (public and Account, none and force-allow).
  - M2: the hang layer's `(hover: hover) and (pointer: fine)` gate removed. 1 failed (the phone tap case).
  - M3: the `.transition-opacity` load-fade rule removed. 5 failed (the load-fade cases).
  - M4: zoom 1.02 → 1.03. 6 failed.
- Package unit suites:
  - `@auction/ui`: 676 of 676 (with Chromium).
  - `@auction/marketing-ui`: 709 of 709.
  - `@auction/branding`: 350 of 350.
  - `@auction/staff-ui`: 662 of 662.
  - `scripts/compositor-rule.test.mjs`: 17 of 17.
- App unit suites:
  - `apps/shop`: 702 of 702.
  - `apps/art`: 798 of 798.
  - `apps/account`: 1071 of 1071.
  - `apps/shop-admin`: 1687 of 1687.
  - `apps/web`: in CI, shards 1–5, 7 and 8 pass and shard 6 fails 1 of 1369 (finding 1). Locally, shard 6/8 gives the same result: 1 failed (`site-header.test.tsx`) and 1371 passed of 1372.
  - The backend apps (`api`, `shop-api`, workers) are untouched by this diff. They pass in CI on this head (`api vitest` 1–2, `shop-api vitest` 1–4).
- CI on `5cb2c92f`:
  - Passing: `ui-chromium`, `static-checks`, `build`, the art and account browser gates, and every vitest shard except web 6/8.
  - Still running when I wrote this: `test`, `browser-gates` and `shop-v1-phase-smoke (admin-routes)`.
- Route JS: compared the CI `build` job tables of run 43809082828 (PR) and run 43805181198 (main `5569ca0e`) row by row (finding 2).
