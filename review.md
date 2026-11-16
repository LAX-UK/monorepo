Verdict: FIX FIRST

# Review of PR #1501 "Motion system 7/8: staff tools"

This is an independent review of head `5e48aee1` against `main` `697f2d8d`. I checked it against `docs/design/motion.md` (step 7, MO11, MO13, MO14, the staff column, Q5) and against the patterns of merged motion PRs #1470, #1475, #1476, #1486 and #1485. The PR branch was not changed.

The CSS work is clean. It uses tokens only, sets opacity only, keeps shared behaviour in the kit and adds no JS. The tests catch the change when it is removed. The problem is where it lands. The only tab change goes on a component that no route renders, so step 7 has no visible effect in Bid admin. The proof that MO14 asks for, for a moving state, is also missing.

## Blocking

### B1. The Bid admin tab fade is applied to dead code. The live staff tab panels are unchanged.

- `apps/web/src/components/dashboard/primitives/admin-detail-tabs.tsx:133` is where the PR's only TSX change goes (`data-lax-motion="tabpanel"`). Nothing in the repo imports `AdminDetailTabs`. The only importers are its own `admin-detail-tabs.test.tsx` and the new `admin-detail-tabs.capture.test.tsx`:
  `grep -rn "admin-detail-tabs\|AdminDetailTab\b" apps packages --include=*.ts --include=*.tsx`
  The old `admin-tab-crossfade` (and the `admin-data-table-stagger` CSS the PR removes) were dead on `main` too. No Bid admin user sees any difference with this PR merged.
- Here is how tabs really work in the staff tools:
  - **Route tabs.** These are kit `TabNav` / `SecondaryTabNav` (`packages/ui/src/lax/tabs.tsx:140-160`), used for example by `apps/web/src/components/admin/sale-detail/sale-detail-section-nav.tsx:8` and by LAX Admin `apps/shop-admin/src/components/delivery-quotes/delivery-quotes-view.client.tsx`. Their content changes by navigation, so it already takes the staff page cross-fade from step 2 (`packages/staff-ui/src/theme.css:253-265`, `:root[data-view-transition="admin"]`). That part is fine.
  - **In-place tab panel in Bid admin.** This is the sale cover slot picker: `apps/web/src/components/admin/sale-cover/cover-slot-tabs.tsx:33-47` (`role="tablist"` / `role="tab"`) and `apps/web/src/components/admin/sale-cover/sale-cover-tab.tsx:111-128` (`role="tabpanel"`). It gets no marker and swaps with no motion at all.
  - The kit's in-place `Tabs` (`packages/ui/src/lax/tab-panels.tsx:137-146`) has no marker either. Today only the public home uses it (`home-live-now-section.tsx:7`).
- The PR body ("Bid admin tabs: tab content fades…") and the `bid-admin-tabs-*` screenshots both present the dead component as "the Bid admin tabs".

**Fix (keep the kit owning the behaviour, so the app only applies it):**
1. Put the marker on the live in-place staff panel. On the cover panel wrapper in `sale-cover-tab.tsx:111`, add `data-lax-motion="tabpanel"`, `data-state="active"` and `key={selected}`, so it remounts and fades on each switch. The alternative is to add the marker and a `data-state` to the kit `Tabs` panels in `tab-panels.tsx` (if public tab panels are meant to fade too, this needs a decision first, because public would then take 200ms).
2. Either delete `AdminDetailTabs` or say plainly in the body and README that it is unused and is only a reference.
3. Say in the PR body that route tabs take the step 2 staff cross-fade.
4. Replace `bid-admin-tabs-*` with a real Bid admin tab screen, such as the cover tab.

### B2. MO14 proof for the moving state is missing.

- MO14 asks for "short recordings of moving states in the PR". There are none.
- `docs/DESIGN_SYSTEM.md:317` says "add a test for the new interaction next to it" (the Playwright motion check for layout shift, INP at 4x CPU and reduced motion). Step 7 asks for "staff e2e screenshots". #1476 set the pattern: opt-in specs `apps/web/e2e/overlay-motion-bid-admin.spec.ts` and `apps/shop-admin/e2e/overlay-motion.spec.ts`. This PR has neither:
  - no spec for a staff tab switch or panel open
  - no recording
- The screenshots are HTML that a Vitest run in jsdom produced, viewed in Chromium. They are not e2e, and they have no `main`-side pair, so "unchanged at rest" is asserted rather than shown.

**Fix:**
1. Add an opt-in motion-check spec next to the #1476 ones for the live staff interaction from B1 (a tab switch, plus a LAX Admin `DetailPanel` open). Assert layout shift, INP and `movingAnimations` under reduced motion.
2. Attach a short recording of the tab fade and the panel open.
3. Add before/after (main vs head) resting shots, or a diff ratio from `restingScreenshotParity`.

## Non-blocking

1. **The `AdminDetailTabs` underline is not instant**, although the new docs say it is (`docs/DESIGN_SYSTEM.md:316`, `docs/design/staff-design-standard.md:1293`).
   - The kit `TabsTrigger` has `transition-colors` (`packages/ui/src/components/ui/tabs.tsx:31`). The underline is `border-b-2` with `data-[state=active]:border-accent-brand` (`admin-detail-tabs.tsx:113-115`).
   - In Chromium, with the compiled `apps/web/src/app/globals.css`, the trigger resolves to `transition-property: color, background-color, border-color, …` at `0.15s cubic-bezier(0.4, 0, 0.2, 1)`. That is Tailwind's default literal, not a token, and not instant. Under reduced motion it is about 0.
   - The live `TabNav` and kit `Tabs` underlines are `::after` backgrounds and do switch instantly.
   - If `AdminDetailTabs` stays, limit its transition to `color` on `--lax-motion-hover`.
2. **The staff guard test is weak and reaches across layers.**
   - `packages/staff-ui/src/motion-staff.test.ts:6,16` reads `apps/shop-admin/src` from a package test, so a package depends on an app. A test inside shop-admin would be the cleaner home.
   - Its "literal" regex (`:36`) misses Tailwind literals such as `duration-100`.
   - Older staff literals remain, for example `packages/staff-ui/src/data/data-table.tsx:887` (`duration-100` on the row tint), `shell/sidebar-nav.tsx:80`, `display/image-gallery.tsx:89`, `forms/file-dropzone.tsx:87` and `display/checklist.tsx:34`. They are outside this PR's scope; track them as a follow-up toward "tokens only".
3. **Reduced-motion coverage for tab panels is thinner than #1476's.** `packages/ui/src/lax/motion-resolved.test.ts:412-418` covers the OS setting only. Add Bid `force-reduce` (staff and Account instant) and `force-allow` over OS reduce, to match the overlay matrix. The rule is generic (`motion.css:183-205`), so the behaviour is right today.
4. **Screenshot tooling lives in two test files** that are skipped unless an env var is set (`*.capture.test.tsx`). Consider `scripts/` or e2e instead, so the vitest suites carry no dormant tests.
5. **Craft notes on the screenshots** (they come from mock data, not regressions):
   - `bid-admin-drawer-375-light.png`: the mock table has no cell padding, so columns run together ("Approved£4,140.00").
   - `lax-admin-panel-*`: "Order details" sits directly under the summary with no gap.
   - None of the shots shows the staff shell (sidebar and top bar), so they do not read as the real tools.
   - The images themselves are real renders: 1440x900 and 375x812, light and dark (blue accent in light, gold in dark), and the scrim and drawer render correctly.
6. **Radix keeps the first panel still on load, which is good; worth a code comment.** `TabsContent` sets an inline `animation-duration: 0s` on a panel that is active when it first mounts (`@radix-ui/react-tabs` `isMountAnimationPreventedRef`). So the kit fade runs on a switch, not on page load. I saw this in Chromium: the captured HTML's active panel resolves to `0s`, and removing the inline style gives `0.15s`.

## Verified

- **Row stagger removed (MO11).** `apps/web/src/styles/tokens-motion.css` loses `admin-data-table-stagger`, `admin-row-enter` and `admin-tab-crossfade` (dead on main). There are no row staggers or `nth-child` animations in `packages/staff-ui/src` or `apps/shop-admin/src`. The returned-row tint is kept: `packages/staff-ui/src/theme.css:268-270`, and under reduce it holds as a static tint (`:272-278`).
- **Kit rule is tokens only and opacity only.** `packages/ui/src/lax/motion.css:158-164` sets `lax-fade-in var(--lax-motion-enter) var(--lax-ease-out)`. It has no literals and no `transition-all`. `pnpm lint:compositor` passes.
- **Panels and drawers in LAX Admin.** `DetailPanel` and `FilterSheet` are the kit `Sheet`, which on staff pages is a 200/150 fade with no slide (`motion.css:150-153`, step 3). This is unchanged and correct.
- **No lift, press scale or zoom is added.** The diff adds none.
- **Reduced motion (MO13).** In Chromium, staff and Account tab panels resolve to `none` / 0ms under the OS reduce setting, and public resolves to a 120ms fade (`motion-resolved.test.ts:412-441`, 5/5 pass).
- **Mutation testing.**
  - Removing the `[data-lax-motion="tabpanel"][data-state="active"]` rule fails 3 of 5 Chromium cases.
  - Replacing the token with `150ms ease-out` fails the public case.
  - Restoring `main`'s `tokens-motion.css` and `admin-detail-tabs.tsx` fails both `admin-motion.test.ts` cases.
  - Adding `animation-delay` to the staff theme fails `motion-staff.test.ts`. All mutations were reverted.
- **Q5.** No saleroom or clerk console file is touched. The new kit rule only matches `data-lax-motion="tabpanel"`, which nothing else uses.
- **Lenis.** No Lenis config is in the diff.
- **Route JS.** The only TSX change is in a module no route imports, and the rest is CSS and tests, so the change adds 0 bytes to every route, `/admin` and LAX Admin included. No budget, baseline or allowance file is touched. I did not rerun a production build; the PR body's table (0 routes higher, 6 lower) agrees.
- **Suites and typecheck.**
  - `@auction/staff-ui`: 696 passed.
  - `@auction/ui` `src/lax`: 352 passed, including the Chromium suite.
  - `apps/web` `src/styles` and `src/components/dashboard/primitives`: 32 passed.
  - `tsc --noEmit` passes for `packages/ui`, `packages/staff-ui`, `apps/web` and `apps/shop-admin`.
- **CI.** Every check on head `5e48aee1` is green (`ci-result`, `browser-gates`, `ui-chromium`, `static-checks`, web vitest 1–8, and the rest), apart from one skipped smoke job.
- **PR body.** It has MO14 sections for route JS, screenshots, tests and reduced motion, and no AI footer. It does not include recordings or an INP/e2e spec (see B2).

## Final recheck

Head `c508f5de` (10 commits, base `03f90056`), rechecked on 2026-11-16. The PR branch was not changed. Short version: every blocking and non-blocking item from the review is fixed and verified. One gate is still open: the Art browser gate on this head was cancelled, not passed, so CI is not fully green.

### Blocking items

**B1. Fade on dead code: fixed.**
- **The fade is on the live panel.** It is the Bid admin cover slot panel, `apps/web/src/components/admin/sale-cover/sale-cover-tab.tsx:113-120`. The panel has `key={selected}`, `role="tabpanel"`, `data-lax-motion="tabpanel"` and `data-state="active"`. The key moved here from `CoverSlotPanel`, so the marked element itself remounts on every switch.
- **No other in-place staff panels exist.** `grep -rnE 'role="(tabpanel|tablist)"|role=\{?"tab"'` over `apps/web/src`, `apps/shop-admin/src` and `packages/staff-ui/src` finds only `cover-slot-tabs.tsx:34,42` and `sale-cover-tab.tsx:115`.
  - Kit `<Tabs>` / `TabsContent` has one non-test importer: the public `home-live-now-section.tsx:42`.
  - In LAX Admin, `SegmentedControl` appears in `artwork-editor.client.tsx:1240` and `link-lax-art-report.client.tsx:280`. These are a form field and a URL filter, not tab panels.
  - The PR body's "LAX Admin has no in-place tab panels" holds.
- **`AdminDetailTabs` is deleted**, along with its test and `admin-sticky-layout.ts`. `grep -rn "admin-detail-tabs\|AdminDetailTab\|admin-sticky-layout" apps packages` returns nothing.
- **Kit public `Tabs` timing is unchanged.** `packages/ui/src/lax/tab-panels.tsx` and `tabs.tsx` have no diff. The public case in `motion-resolved.test.ts` stays at 200ms, and 120ms under OS reduce.
- **Route tabs are documented as taking the step 2 cross-fade.** See the PR body ("Route tabs take the step 2 staff cross-fade"), `docs/DESIGN_SYSTEM.md:316` and `docs/design/staff-design-standard.md:1293`.
- **The live screens are captured.** The `bid-admin-tabs-*` jsdom shots are replaced by `bid-admin-cover-*` real renders.

**B2. MO14 proof: fixed.**
- **Specs.** There are two opt-in specs:
  - `apps/web/e2e/tab-motion-bid-admin.spec.ts` covers the cover slot switch. It checks:
    - the panel resolves to `lax-fade-in 0.15s`;
    - the tab's `transitionProperty` is `none`;
    - INP at 4x CPU (`throttleCpu`, `medianInteractionToPaint`) is within budget;
    - `layoutShiftScore` is within budget;
    - under reduced motion, `movingAnimations(…, { includeFades: true })` returns `[]`.
  - `apps/shop-admin/e2e/panel-motion.spec.ts` covers the LAX Admin audit `DetailPanel`. It checks the same things, with the panel at `lax-fade-in 0.2s`.
- **Wiring.** Both are wired into `test:e2e:motion` (`apps/web/package.json:21` and `apps/shop-admin/package.json:18`). The web spec sets `test.use({ storageState: roleAuthState.staff })` at file level, so it does not repeat #1476's missing-session problem. I did not run them: they need the seeded stack.
- **Recordings.** These are committed in `docs/design/screenshots/motion-7/` and named in the README and the PR body.
  - `bid-admin-cover-slot-switch-realtime.webm` runs 5.1s, and `…-slowed-10x.gif` runs 9.3s.
  - `lax-admin-record-panel-realtime.webm` runs 5.5s, and `…-slowed-10x.gif` runs 7.0s.
  - A frame grid of the cover GIF shows the selected border switching at once while the new panel comes in faded.
- **Screenshots.** There are 12 main/head pairs: 3 screens at 1440x900 and 375x812, light and dark.
  - They are real staff-shell renders: the Bid admin sidebar and top bar, and the LAX Admin `DetailPanel`.
  - Ten pairs are byte-identical.
  - `lax-admin-audit-list-375-{dark,light}` differ in 4 and 8 pixels, with a maximum RGB delta of 3. That is under `screenshotDiffRatio`'s 24 threshold (`apps/web/e2e/helpers/motion-check.ts:272`), so its 0.00000 is correct.

### Non-blocking items

1. **The underline is instant: fixed.**
   - The rule is `[data-staff-ui] [role="tab"] { transition: none; }` (`packages/staff-ui/src/theme.css:272-276`). It uses no token, no literal, and no Tailwind default duration.
   - `theme.css` is imported unlayered (`apps/web/src/app/globals.css:10`), so it beats the layered `transition-colors` utility.
   - `data-staff-ui` is set by `StaffShell` (`packages/staff-ui/src/shell/staff-shell.tsx:125`), which Bid admin (`app/admin/layout.tsx`) and LAX Admin use.
   - The web e2e checks the computed `transitionProperty` is `none`.
2. **The guard is split per package and catches Tailwind literals: fixed.**
   - The guards are `packages/staff-ui/src/motion-staff.test.ts` and `apps/shop-admin/src/motion-staff.test.ts`, so no package reads app source any more.
   - `LITERAL` now matches `\bduration-\d+\b`. Existing offenders sit in a list that only shrinks.
3. **The reduced-motion matrix is widened: fixed.** `motion-resolved.test.ts:412-451` now has 12 cases, including `force-reduce` and `force-allow-os-reduce`. I ran it: 12 of 12 pass in Chromium.
4. **The dormant capture tests are gone: fixed.** No `*.capture.test.tsx` remains.
5. **The mock-data shots are gone: fixed.** They are replaced by real renders.
6. **The Radix note is in place: fixed.** The comment is at `packages/ui/src/lax/motion.css:155-162`. The body says, accurately, that the hand-rolled cover panel also fades on first render.

### Rules

- **Tokens only, compositor only.** The new rules are `motion.css:163-169` (`lax-fade-in var(--lax-motion-enter) var(--lax-ease-out)`, opacity) and `theme.css` `transition: none`. The diff adds no literal duration, no `transition-all`, and no transform or layout property.
- **Lenis, budgets and allowances.** Lenis is untouched. No budget, baseline, ratchet or allowlist file is in the diff (`git diff --stat | grep -iE "lenis|budget|baseline|ratchet|allowlist"` is empty). The 1 KB allowance is not used.
- **Route JS.** The only source JS changes are `sale-cover-tab.tsx` and `cover-slot-tabs.tsx`. They are imported only by `app/admin/(platform)/sales/[id]/(detail)/cover/page.tsx`, apart from the deleted module, which had no importers. LAX Admin has test-only changes.
  - I built `apps/web` for production from main and from head, with the CI budget DSNs.
  - The cover page chunk (the only chunk containing "Cover pictures") is 100373 → 100329 bytes raw (-44). Its start-up total is 720751 → 720283 gzip.
  - Two head builds of the same commit differed by about 200 bytes on unrelated account routes (63 of 120 non-admin routes differed at 0.1 KB precision). So a per-route byte diff of single local builds is noise. The PR's own table (0 higher, 229 lower, 51 equal) is consistent with this, and the code that changed only got smaller.
  - The budget check in CI's `build` job passed.
- **Tests fail without the change.** Each mutation below was reverted afterwards.
  - Restoring `sale-cover-tab.tsx` from main fails `admin-motion.test.ts` and `sale-cover-tab.test.tsx` (2 failures).
  - Dropping the `[role="tab"]` rule fails `motion-staff.test.ts`.
  - Dropping the `tabpanel` active rule from `motion.css` fails 7 of 12 Chromium cases.
  - With the change in place, these suites pass: web 30/30, staff-ui 4/4, shop-admin 2/2, ui tab matrix 12/12.
- **PR body.**
  - "Changes after review" covers B1, B2 and N1–N6 accurately.
  - It discloses the cover panel's first-render fade.
  - It flags two #1476 spec problems that also reproduce on main, left for a separate fix.
  - It has no AI footer. No commit has a Co-Authored-By or generated-by trailer.
- **CI.** The CI workflow on `c508f5de` is green: `ci-result`, `build`, `static-checks`, `ui-chromium`, `browser-gates`, `account-browser-gates`, web vitest 1–8, shop-api vitest 1–4 (1/4 sat at checkout for an hour, then passed), and the rest. One smoke job was skipped.
  - **Art PR browser gates did not pass.** The job `art-browser-gates` (run 43904364751) was **cancelled** after the `art loading screens @optin` cases at 375 (`art-hub`, `collector-hub`, `visit`, `how-to-buy`) each timed out at 1.5 min, through retries.
  - This is very likely not caused by the PR. The only shared change Art loads is a rule that matches `data-lax-motion="tabpanel"`, which no Art page uses. The same gate also failed on main's merge-queue run for `dd81f7f2` (run 43897500023) and passed on other branches since.
  - It is still a red gate on this head.

### What is left

- Re-run Art PR browser gates on `c508f5de` until it passes, with no code change. If it fails the same way, show that it fails on main too and get it waived.
- Once that gate is green, this is ready to ship. Nothing else is open.
