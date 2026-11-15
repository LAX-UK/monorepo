Verdict: FIX FIRST

# Review of PR #1476 (motion-overlays, motion system 3/8)

Reviewed head `7172aab8` against `docs/design/motion.md` on origin/main. Blocking findings are marked **[BLOCKING]**.

## Findings

1. **[BLOCKING] Staff scrims (and any plain kit layer without `STAFF_LAYER`) run the public timings.** `packages/staff-ui/src/theme.css:230-232` applies the staff token values only to `[data-staff-ui]`, `[data-lax-ui][data-lax-density="staff"]` and `.lax-staff-layer`. The plain kit layers get only `data-lax-density="staff"` from `useDensityAttribute()` (`packages/ui/src/lax/density.tsx:595`), with no `data-lax-ui`. They are portalled to `<body>`, outside `[data-staff-ui]`. The staff overlays pass `STAFF_LAYER` to the panel but not to the overlay: `DialogOverlay` is rendered at `packages/ui/src/components/ui/dialog.tsx:45`, `SheetOverlay` at `packages/ui/src/components/ui/sheet.tsx:54`, and they are used by `command-palette.tsx`, `staff-dialog.tsx`, `detail-panel.tsx`, `filter-sheet.tsx` and the staff shell's phone sheet. I checked the computed styles in Chromium with lax-system.css, the staff token block and motion.css loaded:
   - The staff scrim fades in over `0.26s` and out over `0.18s`.
   - The staff panel over it runs `0.2s` (150ms on exit).
   - A plain staff popover without `STAFF_LAYER` runs `0.2s`.

   The spec asks for 200/150 and 150/100 in staff tools. Closing also takes 180ms instead of 150ms, because Radix keeps the portal mounted until the slower scrim finishes. Fix in one place: key the staff token block on `[data-lax-density="staff"]` (the attribute the kit already sets on every staff layer), or have the density hook emit the staff layer attribute. Then add a test that resolves the duration on a scrim.

2. **[BLOCKING] The Sonner exit rule overrides Sonner's position for removed toasts that are not in front.** The selector at `packages/ui/src/lax/motion.css:234-240` is `[data-sonner-toaster] [data-sonner-toast][data-styled][data-removed="true"][data-mounted][data-swipe-out]`. That is 6 attributes, against Sonner's 5 in its rules for removed toasts (`data-front="false"`, expanded and collapsed, in sonner/dist/styles.css:330-338). So when a toast behind the front one is dismissed or times out, it no longer stays in place. With the stack expanded on hover it jumps to `translateY(-8px * lift)`, near the front toast's position, while it fades; collapsed, it loses Sonner's `translateY(40%)`. The rule also changes `--y` while a toast is being swiped out. This changes existing behaviour that works today. Fix: limit the rule to `[data-front="true"][data-swipe-out="false"]` (the case Sonner's own rule at styles.css:325 covers) and leave the others to Sonner.

3. **[BLOCKING] The reduced-motion tests check text, not behaviour, and most mutations survive.** `reducedMotionProblems` (`packages/ui/src/test/motion-css.ts:17-46`) only checks that certain strings are present. I applied five mutations to `motion.css` and ran `motion.test.ts` plus `overlay-motion.test.tsx`. Only one was caught:
   - Public dialog/sheet/scrim under OS reduce changed back to `lax-rise-*` at `--lax-motion-panel` (260ms of movement): **passes**.
   - Every `force-reduce` overlay rule deleted (Bid's in-app switch): **passes**, because the string still appears in the toast section.
   - Toast rise left at 8px under reduce: **passes**.
   - The `[data-state="closed"]` exit rule deleted (no exit animation anywhere): **passes**.
   - Staff removed from the OS reduce rule: fails (caught).

   The Playwright specs cover only staff surfaces. Nothing checks that a public overlay fades for 150ms or less with no movement, or that LAX Account is instant. Fix: parse the stylesheet (postcss or css-tree is enough) and assert the resolved `--lax-anim-*` for each kind × staff/public/account × OS/force-reduce. Better still, add a computed-style check in Chromium like the one in finding 1. Also add one public and one Account reduced-motion e2e that uses `movingAnimations`.

4. The Select exit animation never plays. Radix Select has no `Presence`: when it closes, `SelectContent` unmounts straight away (`@radix-ui/react-select` dist/index.js:261), so `data-state="closed"` never reaches the layer and `lax-float-out` is dead for Select. The PR body lists Select under 200 in / 140 out. Either document Select as entry-only in motion.md, or leave Select out of the exit claim. Menus, popovers, hover cards, tooltips, dialogs and sheets do keep the layer mounted through Radix `Presence`, because the animation name changes from `*-in` to `*-out`.

5. Reduced-motion fades that never run:
   - Sonner's own `@media (prefers-reduced-motion) { [data-sonner-toast] { transition: none !important } }` beats the toast fade at `motion.css:242-253`, so under the OS setting toasts are instant everywhere. The rule only takes effect for Bid's `force-reduce`.
   - In Bid, `apps/web/src/app/globals.css:412-431` (existing code) forces `animation-duration: 0.01ms !important` under reduce and `force-reduce`, so the kit's 120/150ms public fade never runs in Bid.

   Both still meet the "≤150ms" ceiling. But the PR body and tests claim a fade, and the behaviour now differs between Bid and Shop/lax.art. State this in the docs, or decide which one is meant.

6. The entry animations use `animation-fill-mode: both` (`motion.css:75, 97, 102, 107, 115, 121, 143, 148`). That keeps the transform animation in effect for as long as the layer is open. The open menu, dialog or sheet then stays a separate compositor layer, and becomes the containing block for any `position: fixed` descendant. MO15 asks for no permanent `will-change`-like promotion. The entry keyframes have only a `from` keyframe and no delay, so the entry animations don't need `both`. Use `none` for entries and keep `both`/`forwards` on exits, so a closing layer does not flash before it unmounts.

7. `motion.css:165-205` ignores Bid's `force-allow` override. A user with the OS setting on who forces motion in Bid's settings still gets fade-only overlays. The global rule in `globals.css` has the same gap, but the new kit rules should match `use-reduced-motion.ts`, which treats `force-allow` as motion allowed.

8. The reduced-motion panel fade borrows `--lax-motion-hover` (`motion.css:177-178, 199-200`). That token means hover/focus colour, and is 100ms in staff. A token named for hover now also sets the reduced-motion dialog fade, which breaks single responsibility for tokens. Use `--lax-motion-fade` or add a dedicated reduced-panel token.

9. The `force-reduce` rules duplicate the `@media` rules by hand (`motion.css:165-205` and `242-268`). This is acceptable for CSS, but finding 3 shows one copy can be deleted without any test noticing. If the duplication stays, the parsed-CSS test from finding 3 should cover both copies.

10. `apps/web/src/components/marketing/lot-quick-look/lot-quick-look.test.tsx:399` is now vacuous. Its assertion is identical to the one at `:282`, and `useReducedMotion` now only switches the static `backdrop-blur`. Assert the blur instead (absent under reduce), or delete the test.

11. `packages/ui/src/lax/toaster.tsx:21` defaults `density` to `"staff"`, so any caller that omits it gets the staff toaster class (no rise, staff timings). Current callers pass it or use the Bid-local toaster, so nothing is broken today. A public default, or a required prop, would be safer.

12. The open delay `TOOLTIP_OPEN_DELAY_MS = 400` (`packages/ui/src/components/ui/tooltip.tsx:9`) is a JS constant, not a token. That is fine for a delay, but it sits outside the "tokens are the single source" rule. Mention it in motion.md next to the tooltip row.

## Verified OK
- Keyframes live once in `packages/ui/src/lax/motion.css`, are imported by `lax/theme.css`, and are loaded by web, account, shop, art and shop-admin. They are driven by `data-state` / `data-side` through `data-lax-motion`.
- Computed in Chromium (public): float 200ms ease-out in / 140ms ease-in out, with scale 0.97 and 4px from the trigger side; tooltip 120ms fade, `instant-open` → `none`; dialog 260ms emphasize in / 180ms out, rising 8px from 0.98; sheet slides from its edge 260/180. Reduced public: floats and tooltips 120ms fade, panels 150ms fade. Staff (with `STAFF_LAYER`) and Account under reduce: `none`.
- No literal durations or easings in motion.css. Only transform and opacity animate. `lint:compositor` is green.
- No dead `animate-in` / `fade-in-0` / `zoom-in-9x` / `slide-in-from-*` / `slide-out-to-*` classes left anywhere outside tests (grep).
- Tailwind v4 `translate-*` uses the `translate` property, so the centring and Select offsets compose with the keyframe `transform`.
- The vaul bottom sheet (`components/ui/bottom-sheet.tsx`) is untouched, so drag still works. Quick look's phone sheet loses only dead classes.
- Focus management and ARIA: no changes to `onCloseAutoFocus`, focus traps, roles or labels. Only `data-*` attributes were added.
- Lenis is not in the diff. No route-JS budget or baseline file changed. Only one TS hook was added per overlay, with no new dependency. `lint:route-js-budget` rule tests are green. A full `next build` was not run, per instructions.
- No visible change at rest: the keyframes have only `from`/`to` frames that resolve to the resting style. The removed `duration-300` / `transition-transform` classes had no effect without tw-animate.
- Commit `7172aab8` and the PR body contain no Co-Authored-By, Claude-Session or generated-by lines. The body ends with a stray `---` separator, which is cosmetic.

## Checks run locally
- Setup: `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build`: ok.
- Vitest (`--maxWorkers=2`): `@auction/ui` 573/573, `@auction/staff-ui` 632/632, `@auction/branding` 350/350, affected `apps/web` suites (lot-quick-look, gallery, press, shell, workspace) 82/82.
- Typecheck: ui, staff-ui and account pass. web fails locally only on `Cannot find module '@auction/api/app'`: apps were not built in this environment, it is unrelated to the PR, and CI static-checks is green.
- `biome ci` on the changed files; `lint:compositor`, `lint:client-copy`, `lint:route-js-budget`, `lint:ui-guardrails`, `lint:deps`, `lint:staff-legacy-shell`, `lint:bid-public-kit`: all green.
- Mutation check of the reduced-motion rule: see finding 3.
- Opt-in Playwright overlay specs: not run (they need a seeded deployment).

## CI (`gh pr checks 1476` via REST check-runs, at review time)
35 checks succeeded, including static-checks, build-packages, every web/api/shop-api vitest shard and the docker images. `build`, `test` and `browser-gates` were still running, with no failures so far.
