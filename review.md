Verdict: SHIP

# Review of PR #1512: "Fix connectivity banner overlapping sale page; solid Up next pill"

Reviewed head `9a9c6b00f8fe07b04073e4f5165f93a41ac4570d` (`fix/banner-overlap-up-next-pill`) against `main`.

## What I checked, and how

- **Tests fail without the change: confirmed.** I reverted only the five source files to `origin/main` and kept the PR's tests. Two tests failed:
  - `marketing-live-connectivity-banner.test.tsx > takes up space in the flow…` failed with `expected 'fixed inset-x-0 top-[var(--header-off…' to contain 'sticky'`.
  - `saleroom-lot-catalog-overlay.test.tsx > Up next uses a solid…` failed with `expected 'pointer-events-none absolute bottom-3…' to contain 'bg-brand-900/85'`.
  - With the PR's source restored, all 8 tests in the 3 related files pass. To run them, first build `@auction/domain` with `pnpm turbo run build --filter=@auction/domain`.
- **Biome:** clean on all 7 changed files. `scripts/check-test-mocks.mjs` passes.
- **Route JS, budgets, baselines:** the PR touches none of them (7 files, +65/-8, class names and tests only). Pass.
- **`role="status"` and `aria-live="polite"`:** kept. The banner has no transition or animation, so reduced motion is not affected. The banner's light/dark tone tokens are unchanged.
- **Leftover references:** no `fixed-top` references remain anywhere in the repo.
- **Screenshots of the real app: not possible in this run.** The sale page needs the API, Postgres and seed data, and this container has no Docker daemon (`docker compose up -d postgres redis` cannot run).
- **Layout harness instead.** I measured the positioning in real Chromium (Playwright) with a harness that copies the DOM order and CSS involved:
  - the fixed site header;
  - the banner as the first child of `<main>`, using the PR's `sticky` and `top:var(--header-offset)`;
  - the detail shell's `pt-[header-height+…]`;
  - the sticky `SaleAnchorTabs` at `STICKY_UNDER_HEADER_TOP` with `z-30`;
  - for admin, the root-layout offline banner in `<body>` before a staff shell with a sticky `top-0` top bar of 52px.

  The harness and its PNGs are in `review-pr1512/` (`page.html`, `run.js`). Measured rects (top, bottom) in px:

| Viewport | Variant | Scroll 0: banner / hero | Scrolled past tabs: banner / tabs | Tabs covered? |
|---|---|---|---|---|
| 375 | main (`fixed`) | 57–88 / 73–373 (hero under banner) | 57–88 / 57–102 | yes |
| 375 | PR (`sticky`) | 57–88 / **104–404** (pushed down) | 57–88 / 57–102 | **yes** |
| 1440 | main (`fixed`) | 109–140 / 125–425 | 109–140 / 109–154 | yes |
| 1440 | PR (`sticky`) | 109–140 / **156–456** | 109–140 / 109–154 | **yes** |
| 375 staff | main (`fixed`) | banner 57–88, staff bar 0–52 | n/a | n/a |
| 375 staff | PR (`sticky`) | banner 57–88, staff bar **31–83** (pushed down 31px, overlapped by banner) | n/a | n/a |
| 1440 staff | PR (`sticky`) | banner 109–140, staff bar **31–83**, empty 31px strip at top | n/a | n/a |

## Findings

1. **The root cause is only fixed at scroll 0. The sale tabs are still covered as soon as the user scrolls.**
   - **Where:** `apps/web/src/components/realtime/connectivity-banner-shell.tsx:40`, against `packages/branding/src/marketing-chrome.ts:58` (`STICKY_UNDER_HEADER_TOP`) and `apps/web/src/lib/marketing/chrome.ts:29-33`.
   - **Why:** the banner now sticks at `top: var(--header-offset)` with `z-50`. `SaleAnchorTabs` (`SALE_ANCHOR_STICKY_CLASS`, `z-30`) sticks at exactly the same `top`. Once the page is scrolled to the catalogue, the tabs pin underneath the banner. The table above shows this at 375 and 1440, and `review-pr1512/sale-375-sticky-scrolled.png` shows it visually.
   - **Other elements with the same defect:**
     - the catalogue toolbar (`SALE_CATALOG_TOOLBAR_STICKY_TOP`, header-offset + 2.75rem), whose top 2.75rem is behind the banner and tabs;
     - the lot page's sticky column (`components/lot-page/lot-template.tsx:73`);
     - `auction-session-header.tsx:21` and `onsite-session-header.tsx:20`;
     - `SALE_SECTION_SCROLL_MT`, so anchor jumps land under the banner.
   - **Why this is not a fix:** moving from `fixed` to `sticky` only adds a placeholder at the top of `<main>`. It is still a "who is on top" change, not a fix to the offset contract.
   - **Fix:** make the banner part of the measured header chrome, so every consumer of `--header-offset` and `--header-height` accounts for it automatically. Either:
     - (a) render the live/offline banner inside the fixed `SiteHeader`, in a slot under the top bar. `use-header-chrome` (`packages/marketing-ui/src/header/use-header-chrome.ts`, `header-offset.ts`) already measures the header and publishes both variables, so the shell's `pt-[--header-height]`, sticky tabs, toolbar and scroll-margin all move down by exactly the banner height in one layout shift; or
     - (b) have the shell publish `--connectivity-banner-height` with a ResizeObserver, and add it inside `publishHeaderVars` so it is not repeated at every call site.

   Then remove the `sticky` variant entirely. Add an e2e test asserting `banner.bottom <= tabs.top` after scrolling to `#catalog` at 375 and 1440 (see finding 6).

2. **Regression on non-sale pages: the global browser-offline banner now reserves space at the top of `<body>`.**
   - **Where:** `apps/web/src/app/layout.tsx:157` and `apps/web/src/components/pwa/browser-offline-banner.tsx:13`.
   - **What happens:** `BrowserOfflineBanner` sits in the root layout, before every app shell, including admin and staff. As `sticky`, it takes 31px of flow at document y=0 and then visually sticks at `--header-height`, which is the marketing header's 57px/109px, not the staff top bar's 52px. On staff and admin pages this means:
     - the staff top bar (`sticky top-0`) is pushed down 31px, leaving an empty strip at the top;
     - at <1024px the banner now overlaps the staff top bar (57–88 vs 31–83);
     - the page grows past `min-h-dvh`, which adds a scrollbar.
   - **Evidence:** `review-pr1512/staff-375-sticky.png` and `staff-1440-sticky.png`. On `main` with `fixed`, the staff bar was never moved.
   - **Fix:** do not change the global banner's positioning in a sale-page fix. Mount the offline banner through each shell's own banner slot instead:
     - `StaffShell` already renders a `{banner}` slot above its layout (`packages/staff-ui/src/shell/staff-shell.tsx:138`);
     - the Bid site would use the header slot from finding 1.

3. **The staff saleroom banner uses the marketing header offset inside the staff shell.**
   - **Where:** `apps/web/src/features/saleroom/components/saleroom-live-shell.tsx:33`, through `connectivity-banner-shell.tsx:40`.
   - **What happens:** in the staff shell `--header-offset` is normally unset (only the marketing header publishes it), so the banner sticks at `--header-height` (57/109px). The staff top bar is 52px (`--staff-sticky-top`). The banner therefore floats 5–57px below the bar and covers saleroom controls. This already happened on `main`, but the PR rewrote this exact line and claims to handle "every place the shell is used".
   - **Fix:** pass the sticky offset from the host (for example a `stickyTopClassName` prop, or `top-[var(--staff-sticky-top)]` for staff), or route it through the `StaffShell` `banner` slot as in finding 2.

4. **"Up next" does not match Sold / In saleroom in the catalogue grid.**
   - **Where:** `apps/web/src/components/sections/saleroom/saleroom-lot-catalog-overlay.tsx:36-37` and `:58-62`.
   - **What happens:** the grid card renders the overlay with `useOverlayChrome` (`saleroom-lot-card.tsx:183`). Sold, In saleroom and Paused then get the adaptive glass (`--overlay-bg`: white 78% on light, black 45% on dark). The overlay-chrome branch is gated on `tone === "muted"`, so Up next is excluded and gets a different dark `bg-brand-900/85` (`dark:bg-black/80`). That gives three different pill surfaces side by side in one grid. The brief asks for the *same* solid pill as Sold / In saleroom.
   - **Note:** the PR test only renders the non-chrome path, so it cannot see this.
   - **Fix:** remove `tone === "muted" &&` from the overlay-chrome condition, so every saleroom label pill shares one surface. If Up next needs emphasis, express it only in the foreground (for example `text-white` vs `text-white/70`, or `font-semibold`) without restyling the others. Assert in a test that Up next and Sold have identical background/border classes with and without `useOverlayChrome`.

5. **Copy-pasted pill tokens (DRY / single source of truth).**
   - **Where:** `saleroom-lot-catalog-overlay.tsx:34-37`.
   - **What:** `SALEROOM_PILL_LIVE` is now byte-identical to `SHELL_LIVE` in `apps/web/src/components/lot-timer/lot-timer-pill.tsx:28`, and `SALEROOM_PILL_MUTED` is identical to `SHELL_MUTED` (`:31`). The shell string also duplicates `PILL_BASE_SHARED`.
   - **Fix:** export one pill-surface module (for example `lot-timer/pill-surface.ts` with `PILL_SHELL`, `PILL_SURFACE_LIVE`, `PILL_SURFACE_MUTED`, `overlayPillClasses`) and import it in both components. This also prevents a repeat of the `brand-600` drift.

6. **The tests pin class strings, not the behaviour the PR claims.**
   - **Where:** `apps/web/src/components/realtime/marketing-live-connectivity-banner.test.tsx:26-33` and `apps/web/src/components/sections/saleroom/saleroom-lot-catalog-overlay.test.tsx:36-47`.
   - **Problems:**
     - asserting that `className` contains `"sticky"` passes while finding 1 is still broken;
     - the overlay test mocks `resolveCatalogLotOverlay`, so it never exercises the real "Up next" resolution;
     - the overlay test never covers `useOverlayChrome`, the grid path;
     - the renamed test at line 19 ("renders a sticky-top banner") only checks text.
   - **Fix:** add a Playwright spec under `apps/web/e2e/` that:
     - forces degraded/offline state (`context.setOffline(true)` for the offline banner; the existing realtime-health test hooks for the live banner);
     - at 375 and 1440, asserts the banner rect does not intersect `SaleAnchorTabs` or the catalogue toolbar at scroll 0 and after `#catalog` is scrolled into view;
     - asserts the staff top bar's `top === 0` on an admin page while offline.

     In the unit test, render the real resolver (mock only the clock/provider), and add the `useOverlayChrome` case from finding 4.

7. **The PR body has no before/after screenshots.**
   - The "Screenshots" section says none were taken at 1440 or 375, in light or dark. This is a FIX FIRST item by itself.
   - **Fix:** attach 8 captures: before and after, at 1440 and 375, in light and dark. Each should show the sale page with the banner forced on, both at the top of the page and scrolled to the catalogue tabs, plus the Up next / Sold / In saleroom pills in the grid. Also attach one admin page with the offline banner to show finding 2 is resolved.
   - The repo keeps evidence under `docs/pr-evidence/<slug>/`, which can be used here.

8. **Possible extra layout jump while scrolled (verify on WebKit).**
   - **Where:** `connectivity-banner-shell.tsx:40`.
   - **What:** the sticky placeholder is inserted at the very top of `<main>`. When the banner appears while the user is scrolled down, everything below shifts by about 31px. Chromium hides this with scroll anchoring. Safari/WebKit has historically not had `overflow-anchor`, so the visible content will jump each time connectivity flaps ("Slow connection…" ⇄ hidden).
   - **Fix:** finding 1(a) keeps the shift in one place (header height) and makes it measurable. Check on WebKit (`npx playwright test --project=webkit` or iOS Safari). If the notice can flap, add a short show/hide hysteresis in `LiveConnectivityNoticeProvider`.

## What is good and should be kept

- The diagnosis that `bg-brand-600` is not a real token is correct: there is no `--color-brand-600` in `apps/web/src/app/globals.css:24-33`. The pill did render with no background.
- The a11y semantics, the z-index token, and the banner's tone colours are unchanged.
- There is no growth in route JS and no change to budgets or baselines.

## Final recheck

Rechecked head `df724b3fcc5f49abe7ac4945e5acb6ad0accbf5c` (5 commits, 46 files) after the fixer's changes. This time I ran the real seeded stack locally, the same way the CI `browser-gates` job runs it: local Postgres 16 and Redis, `db:migrate` + `db:seed:dev` + roles + OIDC clients, production builds of api, auth-app and web, `scripts/ci/start-e2e-web.mjs`, and `prepare-e2e-auth-states.mjs`. The PR branch was not modified.

| # | Finding | Status | Evidence |
|---|---|---|---|
| 1 | Tabs covered while scrolled | **Fixed** | See "Sale tabs" below. |
| 2 | Global offline banner regresses other pages | **Fixed** | The banner is `fixed` again and reserves no space. Staff `/admin` and `/admin/saleroom/<hybrid>`, offline: the top bar stays at 0–52 at 1440 and 375, and `scrollHeight` is unchanged (PR e2e). |
| 3 | Staff saleroom banner uses the marketing offset | **Fixed** | `--connectivity-banner-top: var(--spacing-staff-top-bar)` on the staff root. Measured on `/admin/saleroom/<hybrid>`: banner top is 52 = staff bar bottom (1440: 52–85, 375: 52–101). `--staff-sticky-top` becomes `calc(52px + 33px/49px)`. The saleroom live notice uses the same shell, so it gets the same placement. |
| 4 | Up next differs from Sold / In saleroom in the grid | **Fixed** | The `tone === "muted"` gate is removed. The unit test asserts identical class lists for Up next, In saleroom and Sold with `useOverlayChrome`. The PR screenshots `after-pills-*` show the same pill for Sold, Unsold and Up next in light and dark. |
| 5 | Copied pill tokens | **Fixed** | `lot-timer/pill-surface.ts` (`PILL_SHELL`, `PILL_SURFACE_LIVE`, `PILL_SURFACE_MUTED`) is imported by both `lot-timer-pill.tsx` and `saleroom-lot-catalog-overlay.tsx`. The local copies are deleted and no `brand-600` remains. |
| 6 | Tests pin class strings | **Fixed** | Bounding-box Playwright specs plus real-resolver unit tests. Proven to fail without the fix (below). |
| 7 | No screenshots | **Fixed** | 26 real PNGs in `docs/pr-screenshots/pr-1512/`, embedded in the PR body: before/after × 1440/375 × light/dark for the top of the page, scrolled, and the grid pills, plus staff at 1440/375. I opened several. They are real app captures from the seeded stack, not mock-ups, and they show the tabs under the banner on `main` and clear of it on the PR. |
| 8 | Layout jump while scrolled | **Fixed in Chromium** | `publishBannerHeight` compensates explicitly with `scrollBy` and does not rely on `overflow-anchor`. The PR's no-jump e2e passes at 1440 and 375. WebKit was not exercised (not available here either). |

### Sale tabs: never covered at any scroll position (1440 and 375)

My own Playwright sweep on the PR build covered two seeded sales (hybrid and timed), the browser offline and online (the "Reconnecting to the saleroom…" live notice), and every ~40–65px from the top to the bottom of the page: about 900 samples.

- **Banner position:** in every sample the banner top equals the header bottom (±1px).
- **Tabs and toolbar, 1440:** 0 overlaps.
- **Tabs and toolbar, 375:** the only flags are the last 2–3 samples at the very bottom of the page, where the sticky tabs leave with their containing block. This happens at the same scroll y (5080) with and without a banner: with no banner the tabs also pass under the header (top 40 vs 57). It is normal sticky release, not a defect.
- **Pinned positions:**
  - offline at 1440: banner 73–106, tabs from 106;
  - offline at 375: banner 57–106, tabs from 106;
  - live notice at 375: banner 57–90, tabs from 90.
- **No other sticky bar** sits within 200px of the top except the tabs. The faded "On the block … Bid now" visible behind the banner in the PR's 1440 "after" shots is non-sticky hero content scrolling under the 95%-opaque chrome, as it does under the header.
- **Anchor landing** (`scrollIntoView` on `#catalog` and `#overview`) moves down by exactly the banner height: 375 from 73 to 122 (+49), 1440 from 125 to 158 (+33). Relative to the tabs it is identical to the no-banner case, so the banner adds no overlap. The 29px under-tabs landing at 375 is the same with no banner, and it is already on `main`.

### The tests fail without the fix (proved by reverting)

I reverted only the 10 source files to merge-base `730028c9`, kept `pill-surface.ts` so the test imports resolve, and kept all tests and specs.

- **Unit tests:** 3 fail:
  - banner height not published (`expected [] to include <div role="status">`);
  - grid Up next ≠ In saleroom/Sold;
  - off-image Up next is missing `bg-brand-900/85`.
  - `header-offset.test.ts` / `use-header-chrome.test.tsx` fail as well (63/66).
  - With the PR source restored, 7/7 and 66/66 pass.
- **E2E**, on a web production build of the reverted source with a fresh server and `--retries=0`. Four fail:
  - `1440: sale tabs…` fails with `pinned sale tabs under the banner (top 73 vs 106)`;
  - `375: sale tabs…` fails with `top 57 vs 106`;
  - staff 1440 fails with `banner off the bar's bottom by 57`;
  - staff 375 fails with `off by 5`.
  - The two "does not move the content" tests pass on `main`, as the PR body says, because `main` has no shift to compensate.
- **E2E on the PR build:** all 6 pass. The 4 non-staff runs passed first time.
  - The 2 staff tests failed once on a cold server and then passed on retry. With `--retries=0` they then passed 3/3.
  - The cold failure was `scrollHeight` 900 vs 1792: the spec reads the "online" `scrollHeight` before the admin dashboard has finished loading.
- **CI:** CI's `test:e2e:pr` grep (`@smoke|@roles`) includes all six specs. In the CI log, 69 passed, 6 skipped, 0 failed and nothing flaky. The skipped positions are not the connectivity specs.

### Other gates

- **Route JS:** I ran `route-js-size-report.mjs` on local builds of the reverted source and of the PR. All 114 `apps/web` routes **shrink**, by −44 to −129 B gzip. The sale page is −129 B.
- **Budgets, baselines, allowances:** the diff touches no `scripts/route-js-*`, `route-js-budgets.json`, `route-js-baseline.json`, `budgets.json` or any allowance file.
- **CI:** all 38 check runs on `df724b3f` are success, plus 1 path-gated skip (`shop-v1-phase-smoke`). These include `ci-result`, `build`, `static-checks`, `ui-chromium`, `browser-gates`, `account-browser-gates`, `art-browser-gates` and all vitest shards. The PR is `mergeable_state: clean`.
- **AI footer / trailers:** none in the PR body or in any of the 5 commit messages.
- **a11y:** `role="status"` and `aria-live="polite"` are kept, and a unit test asserts them.

### Non-blocking follow-ups

1. **Staff pages:** the banner overlays the first ~33/49px of non-sticky staff content under the top bar (for example the saleroom breadcrumb). The staff shell does not add `--connectivity-banner-height` to its content padding or to `scroll-padding-top`. This is no worse than `main`, where the banner floated at 57/109px and covered content too. It is an optional polish.
2. **Dark-mode grid pills:** in dark mode the grid pills keep `dark:bg-black/70` from `PILL_SURFACE_MUTED`, which wins over the adaptive `--overlay-bg`. All three labels are still identical, which is what the brief asks for. This is the same behaviour Sold/In saleroom had on `main`.
3. **Admin spec:** wait for the dashboard to settle (for example `networkidle`, or a known heading) before taking the "online" `scrollHeight`, so the spec cannot flake on a cold server.
4. **WebKit:** the no-jump behaviour has not been run on WebKit. The compensation is explicit, so the risk is low.

**Verdict: SHIP.** All 8 findings are resolved, with evidence from the real seeded stack at 1440 and 375. CI is green and route JS goes down.
