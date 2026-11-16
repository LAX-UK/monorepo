Verdict: FIX FIRST

# Final recheck (round 2) of PR #1476 (motion-overlays, motion system 3/8)

This recheck covers head `ceb55a72`. The head had not changed for more than 30 minutes when the review started. I checked it against the previous recheck (head `e0451666`), the PR body's latest "Changes after review" section and `docs/design/motion.md`. CI built the merge commit `268546a2` (`ceb55a72` into main `a54b584f`). Blocking findings are marked **[BLOCKING]**.

## Findings

1. **[BLOCKING] The `browser-gates` e2e fails on every head of this PR, and the overlay exit animation is the cause.** `apps/web/e2e/org-roles-owner.spec.ts:120` fails with `strict mode violation: getByRole('menuitem', { name: /^Remove from/ }) resolved to 2 elements`. The failure is identical on check run 132998347176 (`ceb55a72`), 132968064586 (`e0451666`) and 132959940510 (`7172aab8`). The same gate passes on main `a54b584f` (132990971930) and on the merge base `67443083` (132946490980). The previous recheck missed this because the gate was still running at the time.

   **Mechanism.** At `:114`, the test presses Escape to close Maya Okafor's menu. That menu (`apps/web/src/components/legal-entity/members/member-row.tsx:70-80`) also contains "Remove from {organisation}…". Radix now keeps the closed menu mounted while `[data-lax-motion][data-state="closed"]` plays its 140ms exit (`packages/ui/src/lax/motion.css:160-162`). The test immediately opens the invitee's menu, so two menus, each with a "Remove from" item, are in the DOM and the accessibility tree at once.

   **What users notice.** For the length of the exit, the closing menu stays exposed to assistive technology. It also still takes clicks, because nothing sets `pointer-events: none` on a closing layer.

   **Fix.**
   - Make the spec wait for the old menu to unmount, for example `await expect(page.getByRole("menu")).toHaveCount(0)` after the Escape at `:114`. Alternatively, scope the locator to the open menu.
   - Consider adding `pointer-events: none` to `[data-lax-motion][data-state="closed"]`. It is compositor-safe and invisible at rest, and it stops clicks landing on a fading layer.
   - Run `browser-gates` again and confirm it is green.

   Do not skip or quarantine the test.

2. **[BLOCKING] Tooltips are not at 400ms everywhere, but the PR body and the spec now say they are.**
   - `docs/design/motion.md:40` says "`delayDuration={400}` on every `TooltipProvider`".
   - The PR body says "Tooltip providers all open after 400ms: each passes `delayDuration={400}`".

   Three providers still use other delays:
   - `packages/staff-ui/src/shell/staff-shell.tsx:121`: `<TooltipProvider delayDuration={300}>`. This provider wraps every staff page. `StaffTooltip` (the `@auction/ui/lax` `Tooltip`, which brings no provider of its own) and the raw kit tooltips in `packages/staff-ui/src/data/cells.tsx` therefore open at 300ms in Bid admin and LAX Admin.
   - `packages/staff-ui/src/display/relative-time.tsx:38`: 300ms.
   - `packages/staff-ui/src/display/truncated-text.tsx:14,51` and `packages/staff-ui/src/data/data-table.tsx:672`: `STAFF_TRUNCATION_TOOLTIP_DELAY_MS = 500`.

   These values predate the PR. The previous wrapper's default never applied to them either, because they pass an explicit value. Set them to 400. If staff is meant to keep 300 and 500, the spec and the PR body must name those exceptions, and the brief for this work says 400ms everywhere.

3. The first "Changes after the first review" section of the PR body still says the Chromium suite "installs it in the `test` job". The "Tests" section and the latest "Changes after review" section are correct, so this is only a stale historical line. Update or strike it. Minor.

4. **Minor.** On a staff page, every portalled layer now takes the staff timings, including those opened from a region drawn at client density. Today the only such region is the admin kit reference (`apps/web/src/components/admin/kit/sheet-frame.tsx:37-40`, `AtDensity density="client"`), where overlays in the "client" column now fade at staff timings. If the kit page is meant to show client motion, note the limitation in `motion.md:52`.

## Previous recheck findings: status

1. **CI test job: fixed.**
   - `ui-chromium` (`.github/workflows/ci.yml:347-412`) runs on `ubuntu-24.04` (runner image ubuntu24/20261111.127).
   - It caches `~/.cache/ms-playwright`, installs Chromium only when the suite is affected, and runs `motion-resolved.test.ts` with `LAX_REQUIRE_CHROMIUM=1`: 32/32 passed in check run 132998113888.
   - It runs only when turbo marks `@auction/ui#test` as affected or `lax-system.css` / the staff theme changed.
   - `ci-result` needs it (`ci.yml:1192`) and fails on `failure` or `cancelled`.
   - The `test` job is byte-identical to the merge base (the diff only adds the new job and the `ci-result` need). There, the suite skips (32 skipped), and the job passed.

2. **Route JS: fixed, no growth.** I compared CI `build` `check:route-js-budget` for this head (check run 132999164532) against main's own build of apps/web at `a54b584f` (132991501522):

   | apps/web group | largest (main → PR) | frame | duplicate modules |
   |---|---|---|---|
   | account | 550.1 → 543.5 | 448.7 → 440.9 | 155 → 133 |
   | checkout | 476.4 → 469.9 | 446.4 → 439.3 | 114 → 94 |
   | listing | 470.8 → 462.2 | 344.2 → 337.3 | 121 → 90 |
   | lot | 481.4 → 467.4 | 349.7 → 343.1 | 139 → 93 |
   | public | 402.0 → 394.5 | 344.2 → 337.3 | 110 → 79 |
   | sale | 485.4 → 478.9 | 346.1 → 341.4 | 144 → 121 |

   Every tracked route fell. For example, Sales list went from 454.8 to 442.8 KB (frame 344.2 → 337.3, duplicates 102 → 67).

   Main's own build did not cover Shop, lax.art or LAX Account, so for those I used PR builds merged onto main (`b1817ecf`→`a54b584f`, `c66cc7ba`→`8f8da613`):
   - Shop and lax.art: largest and frame are equal or lower in every group, and duplicate counts are equal.
   - LAX Account: CI showed `/account/profile` at 436.2 KB against 436.1 KB, while every other route fell 0.1 KB. I built apps/account locally at main `a54b584f` and at `a54b584f` + this head, in the same environment with the CI placeholder DSNs. Every route of the PR build is at or below main: profile 436.3 → 436.0 KB, frame 405.2 → 405.0 KB, duplicates 6 → 6. The CI difference is build noise, not growth.

   No budget, ratchet or baseline file changed, and the 1 KB tolerance is not used.

   - **`KIT_PRIMITIVE_MODULES` (`apps/web/next.config.ts:144,215-227`).** All seven matched modules were already loaded at start-up by every apps/web route. I walked the root layout's static import graph: `app/layout.tsx` → `consent-shell` → `consent-bar` → `lax/button` → `lax/button-variants`, `lax/tooltip` → `components/ui/tooltip`, `lax/density`, `lax/styles`, `lib/utils`. The forced chunk therefore moves no code onto sign-in, error pages or any other apps/web route. In CI, the public frame (sign-in and error pages included) fell 344.2 → 337.3. The cache group is in apps/web only, so LAX Account, Shop and lax.art are untouched. It uses the same `shell-routes` mechanism as the two existing entries (one chunk, `enforce`, priority 20), so route-level splitting of page code is unchanged. The cache cost is that a change to these kit primitives now re-hashes `shell-routes`, the same class of churn as the button already in it. The comment and `docs/engineering/route-js-budgets.md:303` explain it.
   - **`:root:has([data-lax-density="staff"])`.** Only the staff shell sets `data-lax-density="staff"` (`packages/staff-ui/src/shell/staff-shell.tsx:122-128`), plus the admin kit reference. No public, Account, Shop or lax.art page renders it, so staff timings cannot leak there. On a client-side navigation away from `/admin`, the shell unmounts and the scope drops.

     Selector cost is acceptable:
     - The subjects are `[data-lax-motion]` and `[data-sonner-toaster]`, so the rule is matched only on overlay layers.
     - Chromium invalidates `:has()` on insertions or attribute changes involving `data-lax-density`, which happen on shell mount only.
     - Browsers without `:has()` drop the rule and fall back to public timings, which is graceful.

   - **Staff timings per layer type.** These are still correct, and the Chromium suite resolves each kind for a plain layer on a staff page: scrim, dialog, side dialog and sheet at 200/150, float at 150/100, tip at 100, toast at 150/100 with no rise.
   - **Other recheck items.** The Sonner rule, fill modes (entry `none`, exit `forwards`) and `force-allow` are unchanged and still pass.
   - **Mutations I re-ran myself** against `motion-resolved` + `motion` + `overlay-motion` (55 tests), restoring the file after each:
     - Staff float rule back to `[data-lax-density="staff"][data-lax-motion="float"]`: 3 failed.
     - Staff toast rise rule back to `.lax-staff-layer`: 1 failed.
     - Staff token scope in `theme.css` replaced with `.lax-staff-layer`: 3 failed.

     All were caught.

3. **PR body Tests section: fixed.** It describes the Chromium suite and where it runs in CI. See finding 3 for one stale line in an older section.
4. **Stylesheet paths: fixed.** `packages/ui/src/test/motion-browser.ts` and `motion-css.ts` resolve the files from `import.meta.url`.
5. **Dialog and sheet reduced fade: fixed.** `docs/design/motion.md:41-42` says 120ms (`--lax-motion-fade`, within the ≤150ms ceiling).

## Verified OK

- **Tokens only.** No literal durations or easings, and only transform and opacity animate.
- **Lenis is untouched.** There are no `lenis` changes apart from the existing `data-lenis-prevent` lines and the spec sentence.
- **No visible change at rest.**
- **Focus and ARIA are unchanged in code.** Against the merge base, the components differ only by `data-lax-motion`, `data-side` on the sheet, the removed dead classes and the tooltip delays. See finding 1 for the exit window.
- **Commit messages and PR text are clean.** None of the 5 new commits (`0d6bdfb7`, `9e575e94`, `a19dde52`, `170ccc35`, `ceb55a72`), all authored by mahmoudamrspace, contains a Co-Authored-By, Claude-Session or generated-by line. Neither do the PR title and body.

## Checks run locally

- **Setup:** `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build`: ok.
- **Vitest (`--maxWorkers=2`):**
  - `@auction/ui`: 604/604, including `motion-resolved.test.ts` 32/32 in Chromium with `LAX_REQUIRE_CHROMIUM=1`.
  - `@auction/staff-ui`: 632/632.
  - `@auction/branding`: 350/350.
  - apps/web suites related to the changed files: 80/80.
  - Shop header suites: 17/17.
- **Typecheck:** ui, staff-ui, account and shop pass. `@auction/web` fails locally only on `Cannot find module '@auction/api/app'`, because apps/api was not built here. This is unrelated, and CI `static-checks` is green.
- **Lints:** `biome ci` on the 40 changed files is clean, and `lint:client-copy` passes.
- **Builds:** production builds of LAX Account at main and at main + this head, measured with `scripts/check-route-js-budget.mjs --all` (finding 2 status above).

## CI (REST check-runs for `ceb55a72`)

39 succeeded, including `test`, `build`, `ui-chromium`, `ci-result`, `account-browser-gates` and all vitest shards. 2 failed:
- **`browser-gates`:** finding 1, caused by this PR.
- **`art-browser-gates`:** `page.goto` timeouts in the lax.art specs. Main `a54b584f` fails the same way (check run 132990973653), so this one is not caused by this PR.
