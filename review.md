Verdict: FIX FIRST

# Final recheck (round 3) of PR #1476 (motion-overlays, motion system 3/8)

This recheck covers head `4c273a4c`, pushed at 00:06 UTC. The head had not changed for more than 25 minutes when this review was written, and every CI check for it had finished. I checked it against the round 2 recheck (head `ceb55a72`), the PR body's "Changes after review (round 2 recheck)" section and `docs/design/motion.md`.

The code is ready. One documentation line contradicts the new tooltip delay, and that is the only thing left. Blocking findings are marked **[BLOCKING]**.

## Findings

1. **[BLOCKING, docs only] The staff design standard still says 500ms for truncation tooltips.**
   - The code now opens truncation tooltips at 400ms: `packages/staff-ui/src/display/truncated-text.tsx:14` sets `STAFF_TRUNCATION_TOOLTIP_DELAY_MS = 400`, which `truncated-text.tsx:51` and `packages/staff-ui/src/data/data-table.tsx:672` use.
   - TBL-14 in `docs/design/staff-design-standard.md` still says 500ms twice:
     - `docs/design/staff-design-standard.md:504`: "A truncated cell shows the full value in a tooltip after 500ms".
     - `docs/design/staff-design-standard.md:513`: "`TruncatedText` shows the full value in a tooltip after 500ms", under "Kit: `MET`".

   With this PR merged, two specs give different delays for the same tooltip, and TBL-14's "MET" no longer describes the kit. The 400ms delay is the intended one: `motion.md:40` and the PR body both say every provider opens after 400ms.

   **Fix:** change both lines to 400ms. Optionally, point them at `motion.md` so the delay is defined in one place. It is a two-line edit with no code or test impact.

2. **Minor, no action needed.** In the `toPass` retry loops of `apps/web/e2e/org-roles-admin.spec.ts:84-90` and `org-roles-owner.spec.ts:108-114`, Escape is followed at once by a click on the same row's "More for …" trigger. Because it is the same Radix menu instance reopening, no second menu is mounted, so the strict-mode clash from round 2 cannot recur there. I note it only because the reasoning is not obvious from the spec. It is fine as written.

## Round 2 findings: status

1. **`browser-gates`: fixed. [was BLOCKING]**
   - Check run 133009958046 on `4c273a4c` succeeded. The `@smoke|@roles` run shows "Running 69 tests", **62 passed, 7 skipped**, with no failures, retries or flaky tests. Main `a54b584f`'s own run (132990971930) has the same 62 passed / 7 skipped, with the same skip positions in the progress line, so no test was newly skipped.
   - `packages/ui/src/lax/motion.css:160-164`: `[data-lax-motion][data-state="closed"]` now has `pointer-events: none`, so a closing layer takes no clicks during its exit. It is not an animated property, and `static-checks` (which includes `lint:compositor`) is green.
   - `apps/web/e2e/org-roles-owner.spec.ts:116-117` waits for `getByRole("menu")` to reach count 0 after Escape, before the "remove the member" step opens the invitee's menu.
   - The same wait was added in `org-roles-admin.spec.ts:93-94` and `admin-dashboard-roles.spec.ts:92-93`.
   - I scanned every `press("Escape")` in `apps/*/e2e` that is followed within 12 lines by a menu, option or dialog lookup. The remaining cases are fine:
     - Dialogs are already awaited to hidden or count 0: `admin-collections-desk.spec.ts:60`, `org-roles-chrome.spec.ts:84`, `art-journeys.spec.ts:306`.
     - `toPass` loops reopen the same menu (finding 2).
   - No `skip`, `fixme`, `only` or quarantine was added to any existing test. The only `skip` lines in the PR diff are the new opt-in motion specs gated on `PLAYWRIGHT_E2E`, and the Chromium-availability skip in `motion-resolved.test.ts`, as before.
   - `motion.md:52` now states that a closing layer stays in the accessibility tree until it unmounts. That is accurate and acceptable for a 100–180ms window.

2. **Tooltip delay: fixed in code. [was BLOCKING]** I grepped every `TooltipProvider`, `TooltipPrimitive.Provider`, `delayDuration` and `STAFF_TRUNCATION_TOOLTIP_DELAY_MS` in `apps/` and `packages/`. Every explicit delay is 400:
   - `packages/staff-ui/src/shell/staff-shell.tsx:121`
   - `packages/staff-ui/src/display/relative-time.tsx:38`
   - `packages/staff-ui/src/display/truncated-text.tsx:14,51`
   - `packages/staff-ui/src/data/data-table.tsx:672`
   - `packages/ui/src/lax/tooltip.tsx:19,69`
   - `packages/ui/src/components/ui/button-disabled-reason.tsx:43`
   - `apps/shop/src/components/header/shop-header.client.tsx:122`
   - apps/web: `workspace-shell.tsx:157`, `client-website-frame.tsx:48`, `export-button.tsx:126`, `gallery-hero.tsx:84,132`, `press-coverage-card-actions.tsx:38`

   The bare `<TooltipProvider>` uses outside tests all import the kit wrapper `@auction/ui/lax/tooltip`, which sets 400: `lot-template.tsx:59`, `withdrawn-lot-page.tsx:24` and `app/dev/kit/page.tsx:20`.

   `motion.md:40` and the PR body match the code. The staff design standard does not (finding 1).

3. **Stale PR-body line: fixed.** The first "Changes after the first review" section now says the Chromium suite runs in the dedicated `ui-chromium` job.

4. **Client-density limitation: fixed.** `docs/design/motion.md:52` names the page-level scope and the admin kit reference (`sheet-frame.tsx`) whose "client" column takes staff timings.

## Still holds from earlier rechecks

- **Route JS: no growth.** I compared CI `build` `check:route-js-budget` for this head (check run 133010415500, merge onto main `a54b584f`) against main's own build at `a54b584f` (132991501522):

  | apps/web group | largest (main → PR) | frame | duplicate modules |
  |---|---|---|---|
  | account | 550.1 → 543.7 | 448.7 → 441.1 | 155 → 133 |
  | checkout | 476.4 → 470.2 | 446.4 → 439.5 | 114 → 94 |
  | listing | 470.8 → 462.2 | 344.2 → 337.3 | 121 → 90 |
  | lot | 481.4 → 467.4 | 349.7 → 343.1 | 139 → 93 |
  | public | 402.0 → 394.5 | 344.2 → 337.3 | 110 → 79 |
  | sale | 485.4 → 478.9 | 346.1 → 341.4 | 144 → 121 |

  - Every tracked route fell: Home 402.0 → 394.5, Sales list 454.8 → 442.8, Sale 485.4 → 478.9, Lot 481.4 → 467.4, About 352.1 → 344.9, Terms 349.1 → 341.9.
  - LAX Account `/account/profile` is 436.0 KB, against main's 436.1 KB. Its existing warn-mode overage is unchanged and not enforced.
  - Shop and lax.art are 520.4–552.8 KB and 522.0–527.6 KB. The commit since round 2 changes only staff-ui delay literals, the `motion.css` stylesheet and e2e specs, none of which ship in those apps' JS. The round 2 comparison (equal or lower) therefore still applies.
  - No budget, ratchet or baseline file changed. `scripts/route-js-budgets.json` and the baselines are untouched, and the only matching path in the diff is the prose in `docs/engineering/route-js-budgets.md`.
- **Staff timings per layer.** `motion-resolved.test.ts` passes: scrim, dialog, side dialog and sheet at 200/150, float at 150/100, tip at 100, toast at 150/100 with no rise.
- **Sonner.** The front-toast-only exit rule, fill modes and `force-allow` are unchanged.
- **Reduced-motion suite and the `ui-chromium` job.** Check run 133009856193 on `ubuntu-24.04` with `LAX_REQUIRE_CHROMIUM=1` downloaded Chromium headless shell 140 and passed 32/32. `ci-result` succeeded.
- **Tokens only, Lenis untouched, focus and ARIA unchanged** apart from the documented exit window.
- **No AI attribution.** None of the 8 commits (`7172aab8` … `4c273a4c`), all authored by mahmoudamrspace, contains a Co-Authored-By, Claude-Session or generated-by line. Neither do the PR title and body.

## Checks run locally (head `4c273a4c`)

- **Setup:** `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build`: ok.
- **Vitest (`--maxWorkers=2`):**
  - `@auction/ui`: 604/604, including `motion-resolved.test.ts` 32/32 in Chromium with `LAX_REQUIRE_CHROMIUM=1`.
  - `@auction/staff-ui`: 632/632.
- **Typecheck:** `@auction/ui` and `@auction/staff-ui` pass. This commit touches no apps/web source, and CI `static-checks` covers the rest.
- **Biome:** `biome ci` on the 46 files changed against the merge base is clean, the three e2e specs included.
- **Seeded browser e2e:** not run locally, because it needs the seeded stack. CI `browser-gates` is the check (above).

## CI (REST check-runs for `4c273a4c`)

All checks completed and succeeded:
- All 35 jobs of the CI workflow, including `test`, `build`, `static-checks`, `ui-chromium`, all vitest shards and `ci-result`.
- `browser-gates`, `account-browser-gates` and `art-browser-gates` (art also passed this time).

None failed.
