Verdict: FIX FIRST

# Review of PR #1486 (motion-hover-press): motion system 4/8, hover and press

Reviewed head `a3e90acf` against `docs/design/motion.md` (Build item 4, MO9, MO10, MO13, MO14, MO15, "What moves"), not against the PR description. The PR branch was not changed.

## Findings

1. **BLOCKING: the hang's hover shadow sticks on touch devices.** `packages/marketing-ui/src/marketing-ui.css:297`
   `a:hover .marketing-hang-art::after { opacity: 1 }` is plain CSS with no `(hover: hover)` gate. The old rule was Tailwind v4 `group-hover:shadow-[…]`, which Tailwind wraps in `@media (hover: hover)`, so touch never saw it. Now a tap sets `:hover` on the link and the deeper shadow stays on. Chromium check (phone emulation: `hasTouch`, `isMobile`, `matchMedia("(hover: hover)")` false), tapping the link: the `::after` opacity is `1` after the tap (expected `0`). The brief requires "touch devices get no sticky hover", and MO9 makes hover mouse-only.
   Fix: wrap the hover rule in `@media (hover: hover) and (pointer: fine)` like the kit's card hover. Add a touch case to `describe("hang hover shadow layer")` in `packages/ui/src/lax/hover-press-resolved.test.ts:325`. Today that block has no phone case, so the suite passes with this bug.

2. `lax-card-zoom` / `lax-card-media img` cancel an image's own load fade under a mouse. `packages/ui/src/lax/hover-press.css:37`
   The kit rule `transition: scale …` is not in a layer, so it beats every Tailwind utility in `@layer utilities`. It replaces the whole transition list on the image, including `MediaImage`'s own `transition-opacity duration-300` load fade (`packages/marketing-ui/src/media/media-image.tsx:139`). Chromium check: an image with an opacity fade utility runs `["opacity"]` when it loads. The same image with `lax-card-zoom` runs nothing, so it pops in. Most converted cards already lost the fade on main, because their old `transition-transform` did the same. The onboarding recommendations page did not: it deliberately had `transition-[opacity,transform]`, so it regresses (`apps/web/src/app/(task)/onboarding/recommendations/page.tsx:106`). The PR's claim that the image "keeps its own load fade" is true only where the fade sits on a wrapper.
   Fix (should fix): put the zoom on a wrapper or picture layer rather than on the `<img>` that fades, or add the image fade to the kit's transition list using a token. Add a resolved test either way.

3. Hand-written card hovers remain, although motion.md now says the kit "drives every card" (`docs/design/motion.md:36`) and DESIGN_SYSTEM says "Never write a card zoom or lift by hand" (`docs/DESIGN_SYSTEM.md:311`):
   - `apps/web/src/components/sections/saleroom/day-gallery/day-media-thumbnail.tsx:91`: zoom 1.03 over a literal 500ms (MO9: 1.02 over `--lax-motion-media`, mouse only).
   - `apps/web/src/components/onboarding/buyer-interests-form.tsx:117,141`: 2px lift and zoom 1.025 over a literal 500ms, plus an animated `box-shadow`.
   - `apps/web/src/components/dashboard/auction-interests-settings-form.tsx:182`: 2px lift and animated `box-shadow`.
   The PR description treats the interest pickers as form controls, not cards. That is a defensible call, but the 1.025 image zoom inside them is exactly the zoom this PR removed from the recommendations page. Either convert these three or narrow the doc wording. Non-blocking.

4. The PR rewrites the approved spec. MO9 said "frame lift 1px over 300ms". The PR edits `docs/design/motion.md:36` to say `--lax-motion-panel` (260ms). Using the nearest token instead of adding a 300ms token follows "tokens only", and the PR flags the choice. Still, the approved doc is being edited to match the code, so the design owner should confirm it. Non-blocking.

5. Minor: the hang's hovered shadow now stacks the hover layer on top of the resting shadow, so it is deeper than the old swap (acknowledged in the PR). The header still uses literal `duration-300 ease-out` for its colour and shadow transition (`packages/marketing-ui/src/header/use-header-chrome.ts:132`). That is not new in this PR, but it is the one header line the PR touches. Non-blocking.

## Checked and fine

- **One shared card hover in the kit**: `packages/ui/src/lax/hover-press.css`, mouse only under `@media (hover: hover) and (pointer: fine)`.
  - Zoom is 1.02 over `--lax-motion-media`, lift is 1px (`translate`), and the title is underlined.
  - Bid lot tile (1.05), lot queue (1.05), sale card (1.03) and recommendations (1.025) now go to 1.02, and the grid lot card's double zoom is gone.
  - Shop's 4px print lift is now on `--lax-motion-panel` / `--lax-ease-out` and mouse only (`apps/shop/src/app/edition-card.css`, `home.css`).
- **Press**: `lax-press` gives 0.98 over `--lax-motion-press` (100ms) on the public `Button` (filled, outlined, ghost) and the LAX system button (Account). There is no press on staff pages, on disabled or `aria-disabled` buttons, or on text-shaped variants. Staff rows now tint only (chevron nudges removed in staff-ui link-list, attention-list and attention-strip).
- **`transition-all`**: every one is gone. Grepping `apps`, `packages` and `scripts` for `transition-all` / `transition: all` outside tests finds none. The allowlist loses 11 entries, and a test keeps it free of them.
- **Header**: `backdrop-filter` is no longer transitioned. **Hang**: the shadow is no longer transitioned; it is an `::after` opacity layer over `--lax-motion-hover` (but see finding 1).
- **Reduced motion**:
  - Lift, zoom and press are off under the OS setting and under Bid's `force-reduce`, and `force-allow` keeps them on.
  - Fades that remain are at most 150ms (colour 150ms, hang layer 150ms).
  - Staff and Account get no press or lift.
- **Compositor-only**: `pnpm lint:compositor` is green. Only `translate`, `scale` and `opacity` are animated, and every duration comes from a token.
- **Lenis**: no Lenis file is in the diff.
- **Route JS** (CI `build` table, largest / frame / duplicates): equal or lower than main's own CI builds.
  - apps/web: compared with PR #1484's CI build, which is on the exact same main (`fb5055f1`) and changes only DB files. PR: account 545.2/442.7/133, checkout 471.7/441.1/94, listing 462.1/337.2/90, lot 467.4/343.1/93, public 394.4/337.2/79, sale 478.8/341.4/121. Main: 545.5/442.9/133, 471.9/441.3/94, 462.2/337.2/90, 467.4/343.1/93, 394.5/337.2/79, 478.9/341.4/121.
  - Shop, lax.art and Account: compared with PR #1482's CI build, which was main's tip before `fb5055f1` and is a demo-seed change only. Every group is equal or lower on largest, frame and duplicates. Account is 436.0 against 436.1. The only +0.1 is lax.art public's page column (11.1 against 11.0), and that column is not one of the three gated ones.
  - No change to budgets, ratchets or baselines, and no 1 KB tolerance used.
- **At rest**: the Chromium suite shows the card, media and title untouched at rest for public, staff and Account, with every fact visible without hover. The kit classes only act under `:hover` / `:active`, and the diff adds or removes no text, `href` or element (class names only). I did not take real-app screenshots at 1440 and 375, because the brief rules out a full `next build` of apps/web. I am relying on the suite's at-rest probes, plus the PR's 16 of 16 pixel-identical pairs, which I did not re-run.
- **Attribution**: none of the three commit messages or the PR body contains `Co-Authored-By`, `Claude-Session` or a "generated by" line.

## What I ran

- Setup: `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build`. All succeeded.
- `@auction/ui` motion suites: `hover-press-resolved`, `motion-resolved` and `hover-press` tests, 88 of 88 passed in Chromium.
- Mutation 1 (the `(hover: hover) and (pointer: fine)` gate replaced by `@media all`) was caught: "a phone (touch, no hover, coarse pointer) gets no lift, zoom or underline" failed.
- Mutation 2 (the staff `.lax-press:active { animation: none }` override removed) was caught: "button press > staff, none" and "staff, force-allow-os-reduce" failed. Both files were restored afterwards.
- A probe of my own: hang link tap on a phone shows `::after` opacity `1` (finding 1). A second probe: an image's load fade is removed by `lax-card-zoom` (finding 2).
- Lint and static checks all green: `lint:compositor`, `lint:client-copy`, `lint:ui-guardrails`, `lint:web-guardrails`, `lint:bid-public-kit`, `lint:brand-name`, `lint:route-js-budget`, `lint:staff-legacy-shell`, `lint:deps`, and Biome on the changed files.
- Affected tests (`--maxWorkers=2`): all passed. `@auction/ui`, `@auction/branding` and `@auction/staff-ui` ran in full; `@auction/marketing-ui` 710 of 710 passed; apps/web passed for the sale card, lot card, saleroom and lot tile tests; `scripts/compositor-rule.test.mjs` passed. On the first run, marketing-ui failed 3 tests and the apps/web typecheck failed. Both came from my setup, not the PR: the package build had started before I checked out the PR branch, so it built main's branding, and `@auction/api` had not been built. After rebuilding both, they pass.
- Typecheck: `@auction/ui`, `@auction/marketing-ui`, `@auction/branding`, `@auction/staff-ui`, `@auction/web`, `@auction/shop`, `@auction/art` and `@auction/account` all pass.
- CI on `a3e90acf` (REST check-runs; GraphQL is blocked here): every check passed, including `ui-chromium`, `static-checks`, `build`, `test`, all web vitest shards and the account and art browser gates. The exception is `browser-gates`, which was still running when I wrote this.
