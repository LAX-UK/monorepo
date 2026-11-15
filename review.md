Verdict: FIX FIRST

# Recheck of PR #1476 (motion-overlays, motion system 3/8)

Rechecked head `e0451666` (unchanged for more than 5 minutes before the review started) against the first review (head `7172aab8`), the PR body's "Changes after review" and `docs/design/motion.md`. Blocking findings are marked **[BLOCKING]**.

## Findings

1. **[BLOCKING] CI `test` job fails at the new Chromium install step, so no affected-package tests run in CI.** `.github/workflows/ci.yml:333-334` runs `pnpm --filter @auction/ui exec playwright install --with-deps chromium` in the `test` job, which is `runs-on: ubuntu-latest` (`ci.yml:260`). That runner is now Ubuntu 26.04, and the job log (check run 132968681907) stops with `ERROR: Playwright does not support chromium on ubuntu26.04-x64`. The step fails, so "Test affected packages" never runs, including the new `motion-resolved.test.ts` that `LAX_REQUIRE_CHROMIUM=1` is meant to enforce. The browser-gate workflows already pin `runs-on: ubuntu-24.04` for this reason (`.github/workflows/e2e-pr.yml:125`). Fix: pin the `test` job to `ubuntu-24.04`, or run the Chromium suite in a small job of its own on `ubuntu-24.04`. Consider caching `~/.cache/ms-playwright` the way `e2e-pr.yml:230-234` does, because as written every `test` run downloads Chromium even when `@auction/ui` is not affected.

2. **[BLOCKING] Route JS grew: CI `build` fails the Sales list ratchet.** `scripts/check-route-js-budget.mjs` in CI `build` (check run 132968682066) reports: `Sales list (apps/web /(marketing)/sales/(index)/page) loads 456.4 KB of JavaScript (gzip), over its ratchet of 455.0 KB (+1.4 KB)`. On the merge base `67443083` the same route was 454.7 KB, with frame 344.2 KB and 102 duplicated modules (28.5 KB). On this PR it is 456.4 KB, with frame 345.8 KB and 108 duplicated modules (30.3 KB). Current main (`2504b5e2`) builds green. The build for `7172aab8` failed in the same way. The first review missed this because `build` was still running then. The increase is in the shared frame, so the likeliest causes are the client modules this PR adds to every page:
   - `packages/ui/src/components/ui/tooltip.tsx:2-16`: the `TooltipProvider` wrapper, plus the `lax/density.js` import that every overlay now pulls in.
   - The `useDensityAttribute` calls in dialog, dropdown-menu, select, sheet, popover and hover-card.

   Find the cause by comparing the frame chunks against the merge base. Do not raise the ratchet: the task requires route JS unchanged.

3. The PR body's "Tests" section is out of date. It still says `motion.test.ts` checks "reduced-motion rules", and it describes a "Mutation check: the same test removes the reduced-motion rule…". Both checks were removed in `e0451666`, and `motion.test.ts:93-94` now points to `motion-resolved.test.ts`. Update the section so that it describes the Chromium suite.

4. `packages/ui/src/test/motion-browser.ts:13-24` resolves the stylesheets from `process.cwd()` (`../branding/...`, `src/lax/motion.css`, `../staff-ui/...`). The suite therefore only works when vitest starts in `packages/ui`. That is true for turbo and for `pnpm --filter`. Running `vitest` from the repo root with a root config would throw at import time. Resolving the files from `import.meta.url` would be sturdier. Minor.

5. `docs/design/motion.md:41` (Dialogs row) still says "Reduced: fade 150ms", but the reduced panel fade is now `--lax-motion-fade` (120ms). The PR's own token table describes `--lax-motion-fade` as "the fade under reduced motion". This still meets the ≤150ms ceiling, but the dialog and sheet rows should say 120ms, or "≤150ms", to match the code. Minor.

## First-review findings: status
- 1 (staff scrims and plain layers): **fixed.** `packages/staff-ui/src/theme.css:231` keys the staff block on `[data-lax-density="staff"]`. Only the staff shell and the staff toaster set that density (`packages/staff-ui/src/shell/staff-shell.tsx`, `packages/staff-ui/src/panels/toaster.tsx`), so public pages are not affected. In Chromium, the staff scrim, dialog, side dialog and sheet resolve to 200/150, floats to 150/100 and the tooltip to 100, for both plain and `data-lax-ui` layers. `overlay-motion.test.tsx:168-245` checks that every portalled layer type (scrim, dialog, sheet, popover, hover card, menu, select, tooltip) carries the staff density without `data-lax-ui`.
- 2 (Sonner exit): **fixed.** The rule now targets only `[data-front="true"][data-swipe-out="false"]` (`motion.css:219-224`). The tests compare transforms against Sonner's stylesheet alone, for expanded and collapsed stacks and for a swiped front toast.
- 3 (reduced-motion tests): **fixed.** `motion-resolved.test.ts` resolves the animation name, duration and keyframe properties in Chromium for 6 kinds × 4 audiences × 4 preferences, plus toasts. I re-ran mutations myself against `motion-resolved` + `motion` + `overlay-motion` (56 tests), restoring the file after each:
  - All `force-reduce` overlay rules deleted: 4 failed.
  - Toast rise 8px under OS reduce: 1 failed.
  - `[data-state="closed"]` exit rule deleted: 11 failed.
  - Public OS-reduce back to `lax-rise-in` at the panel duration: 1 failed.
  - Account removed from the OS-reduce instant rule: 4 failed.
  - Staff token block back to `[data-lax-ui][data-lax-density="staff"]`: 2 failed.

  All of them were caught.
- 4 (Select exit): documented as entry-only (`motion.md:39`).
- 5 (Sonner and Bid precedence): documented (`motion.md:57`). A test asserts that Sonner keeps toasts instant under the OS setting.
- 6 (fill mode): **fixed.** Entries use `none` and exits use `forwards`. Chromium confirms this (open `none`, closed `forwards`).
- 7 (`force-allow`): **fixed.** It is tested, for overlays and for the toast rise.
- 8 (hover token): **fixed.** The fade uses `--lax-motion-fade`.
- 9: covered by the resolved tests (both copies are mutated above).
- 10 (quick look test): **fixed.** It now asserts `quickLookOverlayBlur`.
- 11 (toaster default): **fixed.** The default is `"client"`. Every caller either passes a density (`apps/account/src/app/layout.tsx:48`, `StaffToaster`) or uses Bid's own toaster.
- 12 (tooltip delay): documented (`motion.md:40`).

## Verified OK
- Durations and easings come from tokens only. `lint:compositor` is green. Only transform and opacity animate.
- Exit animations play: closed layers run `*-out` with `forwards`, while Radix `Presence` keeps them mounted. Select is entry-only, as documented.
- Focus and ARIA are unchanged: the fix commit touches no component logic, only CSS, tests, docs, the toaster default and CI.
- Lenis is untouched. The only `data-lenis-prevent` lines in the diff are re-indentation from the first commit.
- No visible change at rest: the entry keyframes have only a `from` frame, and fill `none` ends at the resting style.
- No budget or baseline file changed (`git diff --name-only` shows none), but see finding 2.
- No Co-Authored-By, Claude-Session or generated-by lines in either commit message, the PR title or the PR body.

## Checks run locally
- Setup: `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build`: ok.
- Vitest (`--maxWorkers=2`):
  - `@auction/ui`: 605/605. `motion-resolved.test.ts` 32/32 ran in Chromium with `LAX_REQUIRE_CHROMIUM=1`, none skipped.
  - `@auction/staff-ui`: 632/632.
  - `@auction/branding`: 350/350.
  - Affected `apps/web` suites (lot-quick-look, gallery, press, shell, workspace): 83/83.
- Typecheck: ui, staff-ui and account pass.
- `biome ci` on the changed files: clean.
- Lints, all green: `lint:client-copy`, `lint:compositor`, `lint:route-js-budget` (rule tests), `lint:ui-guardrails`, `lint:deps`, `lint:test-mocks`, `lint:bid-public-kit`, `lint:staff-legacy-shell`.
- `scripts/check-route-js-budget.mjs` locally: no production builds, nothing to audit. A full `next build` was not run, per instructions; finding 2 comes from CI's build.

## CI (REST check-runs for `e0451666`, at review time)
35 succeeded. 2 **failed**: `test` (finding 1) and `build` (finding 2). `browser-gates` and `shop-v1-phase-smoke (admin-routes)` were still running.
