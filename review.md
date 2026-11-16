Verdict: FIX FIRST

# Review of PR #1485 (motion-loading, motion system 5/8: loading)

Head reviewed: `b053fa75`. Judged against `docs/design/motion.md` on main (Build item 5, MO12, MO13, MO14), not the PR description.

## Blocking

1. **BLOCKING: CI `static-checks` fails.** `check:e2e-tags` reports `loading-screens.spec.ts: no test.describe blocks found`. Reproduced locally (`pnpm --filter @auction/web check:e2e-tags`). The spec at `apps/web/e2e/loading-screens.spec.ts:6` calls `describeLoadingScreens`, and the `test.describe` sits in the helper (`apps/web/e2e/helpers/loading-check.ts:243`), where the tag checker cannot see it. Fix: put a tagged `test.describe` in each spec file, or teach the checker about the helper.

2. **BLOCKING: CI `test` fails in LAX Account.** `apps/account/src/components/time-zone-section.test.tsx:54` expects `animate-`, but the kit `Skeleton` (`packages/ui/src/components/ui/skeleton.tsx`) now renders `lax-skeleton`. Reproduced locally (1 failed / 1070 passed). The PR body says the affected tests pass, but Account's suite was not run. Fix: assert `lax-skeleton` instead.

3. **BLOCKING: route JS in CI is not equal or lower than main's own CI builds.** I compared this PR's CI `build` table (job 133088385341) with main's CI builds.
   - Against current main `fb5055f1` (job 133080530010):
     - apps/web lot: largest 467.4 → 467.5 KB, frame 343.1 → 343.2 KB
     - Tracked "Sales list": 442.8 → 442.9 KB
     - Tracked "Lot page": 467.4 → 467.5 KB
     - Shop checkout page column: 40.5 → 40.6 KB
   - Against the merge base `35d4735b` (job 133039916648):
     - apps/web listing and public frame: 337.2 → 337.3 KB
     - Home, About and Terms frame: 337.2 → 337.3 KB
     - lax.art public largest: 527.6 → 527.7 KB
     - Shop account frame: 514.5 → 514.6 KB

   The PR's own table (from pinned local builds) shows no change, and the PR traces an unpinned +0.02 KB to Sentry release and server-action IDs. That may well be the cause. But the bar is CI's table with no tolerance, and CI shows growth. Fix: show a CI build with equal or lower numbers, for example by pinning `SENTRY_RELEASE` and `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` for both sides, or by building main and head in the same job. A local claim is not enough. Budgets, ratchets, baselines and the allowlist are untouched.

4. **BLOCKING: the swap to content is not shown to be shift-free, and the CLS gate does not run.**
   - `describeLoadingScreens` is `@optin` and skipped in CI (`apps/web/e2e/helpers/loading-check.ts:243-247`). It asserts `swapShift <= 0.1` (`:280`).
   - In the PR's own run, that assertion fails on most cases. Bid home, sales, artists and search are 0.121 at 1440; about is 0.198 / 0.240; results is 0.095 / 0.091 (under the limit). Shop artworks is 0.137 at 375 and categories 0.160 / 0.261.
   - **Shop basket gets worse: 0.084 → 0.191 at 1440.** The PR's explanation, that a full basket would match the new two-column skeleton, is not measured.
   - Skeleton-phase shift is real and 0. The swap phase is unproven, because it was only run against empty or unavailable data.
   - Fix: run the spec against the seeded stack (at least Bid home and the Shop basket with items) and post the numbers, or give a reasoned exception for the empty states plus a seeded basket measurement.

   My own run, on a production `next start` of lax.art at this head with no API (an inline Playwright script that uses the same method as the helper: hold the RSC navigation, click, wait 2.2 s, release):
   - Every skeleton block had opacity 0 when it first appeared.
   - Skeleton-phase shift was 0 on every case.
   - Swap shift: `/` 0 / 0, `/how-to-buy` 0.007 / 0, `/art-hub` 0.006 / 0.070 (1440 / 375). These match the PR's numbers, so the measurement is real, not trivially passing.

## Non-blocking

5. **Gaps in mutation coverage.** I re-ran the Chromium behavioural suites (`skeleton-resolved.test.ts` and `loading-screens.test.ts`, with `LAX_REQUIRE_CHROMIUM=1`) under three mutations:
   - M1: dropped `backwards` from the reduced-motion fade-in in `packages/ui/src/lax/skeleton.css:37`, so the skeleton shows during the delay. **Caught** (3 failed).
   - M2: replaced `var(--lax-ease-pulse)` with `linear` in `skeleton.css:32`, a literal easing. **Not caught** (88/88 pass). Nothing checks the pulse easing or that it comes from the token.
   - M3: removed `@import "./skeleton.css";` from `packages/ui/src/lax/theme.css:19`. **Not caught.** Every product would silently lose the skeleton CSS (no delay, no pulse) and the suites would stay green, because they load `skeleton.css` directly. Add an assertion that `lax-theme.css` reaches `skeleton.css`, and resolve the easing in the timing test.

6. **"One shared skeleton" is not complete outside `loading.tsx`.** Hand-rolled `animate-pulse` placeholders remain:
   - Bid:
     - `apps/web/src/components/connect/connect-components-shell.tsx:28` (a loading shell in the client area)
     - `apps/web/src/components/layout/palette/palette-skeleton.tsx:7`
     - `apps/web/src/components/sections/artwork/online/lot-queue-sidebar.tsx:98,118-119`
     - `apps/web/src/components/marketing/lot-quick-look/quick-look-dialog-sections.tsx:111,323`
     - `apps/web/src/components/lot-card/lot-card-bidder-state.tsx:98`
   - LAX Account:
     - `apps/account/src/components/collection-card.tsx:100`
     - `apps/account/src/components/home-needs-you-card.tsx:112-118`
     - `apps/account/src/components/product-cards.tsx:93`
   - Kit: `packages/ui/src/components/ui/media-placeholder.tsx:69`, an unguarded `animate-pulse` that also loops under reduced motion.

   Build item 5 names only the loading screens, so these can be a follow-up. At least the connect shell and the kit `media-placeholder` belong with this PR.

7. **The Bid home cover now pulses** (`apps/web/src/components/sections/home/skeletons/home-skeleton.tsx:16`). Main deliberately kept it as a still box ("no shimmer on the first screen"). The spec allows a pulsing skeleton, but this 640px block now pulses on the first screen of every cold Home load. Worth an explicit design sign-off.

8. **Cross-app imports.** `apps/art/e2e/loading-screens.spec.ts:2` and `apps/shop/e2e/loading-screens.spec.ts:2` import `../../web/e2e/helpers/loading-check`. A shared e2e helper package, or a test-utils export, would keep the app boundaries clean.

9. **Design doc edits.** The PR edits `docs/design/motion.md`, adding implementation detail and the three tokens. The text agrees with MO12 and MO13 (the delay stays under reduced motion; staff and LAX Account appear at once), so no objection. This review used main's text as the reference.

## Verified OK

- **One skeleton in the kit.** `.lax-skeleton` (`packages/ui/src/lax/skeleton.css`) is imported through `lax-theme.css`, which all of Bid, Shop, lax.art, LAX Account and shop-admin import. The kit `Skeleton` components, `TableSkeleton`, the marketing hang skeleton and Shop's bars all use it.
- **Delay, fade and pulse.** Hidden for 150ms with a backwards fill and no JavaScript, then a `--lax-motion-fade` fade-in, then an opacity-only pulse every 1.6s. No `background-position`. `@keyframes shimmer` and `.shimmer-sweep` are removed.
- **Reduced motion.** Static under the OS setting (unless `force-allow`) and under Bid's `force-reduce`. Bid's global 0.01ms rule leaves the delay intact.
- **lax.art fixes.** The frozen shimmer is fixed (the kit skeleton referenced a `shimmer` keyframe lax.art never had), and the reduced-motion `animate-pulse` loop is gone.
- **Spinners.** None on loading screens; button spinners unchanged.
- **Bid home loading** is now the home skeleton in the page's own frame (`HOME_PAGE_FRAME`).
- **Staff routes.** No file under `apps/web/src/app/admin` or `apps/shop-admin` changed. Staff screens change only through the shared `Skeleton` and `TableSkeleton`.
- **Tokens only.** `--lax-motion-skeleton-delay`, `--lax-motion-pulse` and `--lax-ease-pulse` are added in `lax-system.css` with the drift test updated; Bid's `--motion-duration-pulse` and `--motion-duration-2xl` alias them.
- **Compositor only.** `pnpm lint:compositor` passes and the allowlist is untouched.
- **Lenis untouched.** No Lenis file is in the diff, and there is no `blocking="render"`, Speculation Rules or `transition-all`.
- **Server HTML.** Real pages change only class names on placeholder blocks (Home's frame keeps the same classes through the constant). No text or links change, and nothing is hidden at rest.
- **Screenshots.** I opened the PR's sheets for Bid, Shop and lax.art at 1440 and 375, light and dark, plus individual shots for Bid home and the Shop basket. Each screen is laid out in its page's shape, dark mode has correct contrast, and the Shop basket now draws the two-panel checkout grid instead of a sliver.
- **Commit and PR text.** No Co-Authored-By, Claude-Session or generated-by lines in any of the 4 commit messages or the PR body.

## Commands run

- Setup: `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build`.
- Vitest (all `--maxWorkers=2`):
  - `@auction/ui`, the Chromium suites with `LAX_REQUIRE_CHROMIUM=1` (`skeleton-resolved`, `loading-screens`, `motion-resolved`): 120/120.
  - `@auction/branding` `lax-motion.test.ts`: 32/32.
  - Shop: 702/702.
  - lax.art: 798/798.
  - `@auction/marketing-ui`: 704/704.
  - apps/web affected folders: 595 passed, 10 skipped.
  - apps/web media and gallery: 26/26.
  - **LAX Account: 1 failed / 1070.**
- Typecheck:
  - Passes: `@auction/ui`, `@auction/marketing-ui`, Shop, lax.art.
  - apps/web: one error, `TS2307 '@auction/api/app'` in `src/lib/data/http/rpc-app.ts`. That file is not in the diff; the error comes from this environment, where the api app was not built.
- Lint and static checks:
  - Pass: biome (43 changed files), `lint:compositor`, `lint:client-copy`, `lint:ui-guardrails`, `lint:bid-public-kit`.
  - **Fails: `check:e2e-tags`.**
- CI check-runs (REST): `build`, `browser-gates`, `ui-chromium`, `art-browser-gates` and `account-browser-gates` pass. **`static-checks` and `test` fail**, so `ci-result` fails.
- CLS: production build and `next start` of lax.art at head, with an inline Playwright script in Chromium (numbers in finding 4). No full `next build` of apps/web was run.
