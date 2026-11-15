Verdict: SHIP

# Final recheck of PR #1470: motion system 1/8 (tokens, compositor-only check, motion-check helper)

Rechecked head `1f8fe4f8` (branch `motion-tokens`, unchanged since 19:56 UTC) against the first review of `74e7246f`, the PR body's "Changes after review" section and `docs/design/motion.md`. The PR branch was not modified.

Both blocking items from the first review are fixed and have mutation-tested coverage. The no-visible-change guarantee still holds. Attribution is clean. All remaining findings are non-blocking follow-ups.

One condition on SHIP: three CI jobs were still running when this was written: `build` (which runs `check:route-js-budget`), `test` and `browser-gates`. All three must finish green before merge.

## Findings

None of these block merging.

1. **Should fix: Tailwind's bare `transition` is caught only in `.jsx`/`.tsx` files.** `scripts/compositor-rule.mjs:224` enables `bareTransitionRules` only for `/\.[jt]sx$/`, and the CSS path (`:218`) does not look for it in `@apply`. So both of these pass `pnpm lint:compositor` (mutation-checked):
   - `export const v = "rounded transition hover:shadow-lg";` in a `.ts` file, which is where `cva` variant maps usually live;
   - `.zz { @apply transition hover:shadow-lg; }` in a `.css` file.

   Nothing in the repo uses either form today. Run the class-list check on `.ts` files too, and add the bare utility to the `@apply` path, with a test for each.
2. **Should fix: `postcss` is an undeclared root dependency.** `scripts/compositor-rule.mjs:1` imports `postcss`, but the root `package.json` does not declare it. It resolves only because `.npmrc` sets `node-linker=hoisted` and `apps/web/package.json:101` depends on it. If the linker changes, or apps/web drops postcss, `lint:compositor` breaks in `static-checks`. Add `postcss` to the root `devDependencies`, matching apps/web's `^8.5.9` (the existing override covers the version).
3. **Minor: the JSDoc of `findCompositorViolations` does not match the code.** `scripts/compositor-rule.mjs:207` says that without a filename the source "is treated as CSS if it parses as CSS and holds no JSX/JS markers". The code (`:212`) treats it as CSS unless `options.kind === "script"`, and `kind` is not in the documented options. Document `kind`, or drop it and correct the sentence.
4. **Minor: the smoke spec still has no green run against a real Bid home.** The PR body says so too, and moves it to MO14's manual workflow. That is acceptable for PR 1.

   I ran it 3 times against a local `apps/web` dev server with no API. Each run:
   - "reduced motion leaves nothing moving" passed.
   - Layout shift was 0.137 (> 0.1) and the JS-off/JS-on diff ratio was 0.69. Both are from my environment: with no API, the session lookup fails (`SessionLookupTransientError`) and the page renders "We couldn't confirm your session" with JS on.

   Because the layout-shift assertion comes first, the timing part of that test never ran. I checked the timing with a separate probe instead (see "What was verified").

   Keep the MO14 workflow item. It should record a green run before PR 2 relies on the spec.
5. **Minor: the smoke spec passes only `baseURL` to `restingScreenshotParity`.** `apps/web/e2e/motion-check-smoke.spec.ts:49-51` uses `contextOptions: baseURL ? { baseURL } : {}`. The helper now accepts the project's options, but `storageState`, `locale`, `colorScheme` and `extraHTTPHeaders` are still dropped. Passing `test.info().project.use`, or the relevant fixtures, would make the example match what later PRs should copy.
6. **Minor: one comment still says "Cumulative layout shift".** `apps/web/e2e/helpers/motion-check.ts:18` (`MOTION_BUDGETS.layoutShift`) uses the old name. Everywhere else now says total layout shift, which is what is measured. Rename it to match.
7. **Minor (DRY): two near-identical repository walkers.** `scripts/check-compositor-only.mjs:18-30` (`SKIP_DIRS`, `listFiles`) and `packages/branding/tests/lax-motion.test.ts:144-158` (`SKIP`, `cssFiles`) each walk `apps/` and `packages/` with their own skip lists, and the lists already differ (`e2e`). Low cost today. A shared walker would stop the skip lists drifting further apart.

## What was verified

- **(1) Compositor lint parses whole declarations.** Passed.
  - CSS is parsed with postcss and walked as declarations and `@keyframes` at-rules. TS/TSX values are read whole: a quoted or template-literal string in full, otherwise up to `;`/`}` while ignoring separators inside parentheses.
  - The tests cover wrapped `transition`/`transition-property` values, shorthands with delay and `!important`, logical `margin-*` longhands, `-webkit-` prefixes, keyframes (including those nested in `@media` and those with a selector list), Tailwind `transition-all`, `transition-[...]`, `transition-shadow`, bare `transition`, `@apply`, and inline and template-literal styles.
  - Mutation check: each of these ten mutations makes `node --test scripts/compositor-rule.test.mjs` fail: read only the first line of a CSS value; skip the keyframes walk; drop Tailwind `transition-all`; drop the `margin-` prefix match; drop `-webkit-` normalisation; drop the bare-`transition` rule; drop the `all` check; stop stripping `//` comments; stop a script value at a newline; stop a string value at a newline.
  - Repository mutations in `packages/marketing-ui/src/marketing-header.css` and `packages/ui/src/components/ui/pagination-footer.tsx` each fail `pnpm lint:compositor`:
    - the wrapped `transition: opacity 1s, box-shadow 1s` from the first review;
    - `margin-inline-start 1s ease-in-out 0s`;
    - keyframes with `-webkit-backdrop-filter`;
    - `transition hover:shadow-lg`;
    - `md:hover:transition-all`;
    - a `cn(...)` call whose `transition-[height,opacity]` is on a second line.
  - The allowlist file is byte-identical to the one in `74e7246f`: 46 entries, 49 offences, 11 of them `transition-all`. The "repository matches its allowlist" test passes, and that test fails on any stale, too-high or missing count. So the allowlist is exactly today's offenders.
- **(2) `measureInteractionToPaint` measures inside the page.** Passed.
  - The input is stamped from `event.timeStamp` in a capture listener. The paint is stamped from `requestAnimationFrame` → `setTimeout(0)` inside that listener. Both are read back only after the stamp exists, so no protocol round trip is counted. The doc comment (`motion-check.ts:69-80`) matches the code.
  - `medianInteractionToPaint` takes the median of 5 presses. The 200 ms budget and its margin (about 10x a trivial page's roughly 15 ms at 4x) are documented in `MOTION_BUDGETS` and `docs/DESIGN_SYSTEM.md`.
  - Probe at 4x CPU throttle on Bid home, 3 runs of 9 presses each: samples ranged from 5.5 to 28.3 ms, with medians of about 10, 11.8 and 12.8 ms. That is far below 200 ms and stable across runs.
  - Smoke spec: 3 runs; see finding 4 for the environment-caused failures. The reduced-motion test passed in all 3 runs, and in 3 more targeted runs.
- **(3) Still no visible change.** Passed.
  - The token and alias diff in `lax-system.css`, `staff-ui/src/theme.css` and the Bid, Shop and lax.art CSS is the same as the first review, which confirmed the values with computed styles.
  - `lax-motion.test.ts` resolves every `--motion-*` alias to its pre-PR value. The new "declared once" test also passes.
  - Lenis: no Lenis file in the diff.
  - Route JS: the PR changes no route JavaScript. Its app source changes are CSS only; everything else is tests, scripts, docs and e2e.
  - No `route-js-budgets.json` or `route-js-baseline.json` change.
  - `pnpm lint:route-js-budget` passes.
  - Locally, `node scripts/check-route-js-budget.mjs` refuses to measure the dev `.next` (no Sentry DSN, exit 2), as designed. CI's `build` job runs `check:route-js-budget`; it was still running.
- **(4) SOLID/clean.**
  - The rule, the scanner and the allowlist comparison are separate modules. The helpers each answer one question. Budgets live once in `MOTION_BUDGETS`, and `RESTING_PARITY_MAX_DIFF_RATIO` is named.
  - No duplicated literals in code beyond intentional test pins. The token values in the `DESIGN_SYSTEM.md` table are documentation.
  - Minor items: findings 3, 6 and 7.
- **(5) Attribution: passed (blocking check).**
  - None of the three commits (`65a4967a`, `74e7246f`, `1f8fe4f8`) has `Co-Authored-By`, `Claude-Session` or generated-by lines in its message.
  - Neither does the PR title or body.
- **Local runs** (after `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build`):
  - `@auction/branding` vitest: 350/350 passed (`--maxWorkers=2`).
  - `@auction/staff-ui` vitest: 632/632 passed.
  - `pnpm lint:compositor`: passed, 15/15 node tests.
  - `pnpm exec biome check .`: clean.
  - `lint:route-js-budget`, `lint:e2e-tags`, `lint:e2e-portfolio`, `lint:ui-guardrails` and `lint:web-guardrails`: all passed.
  - Typecheck: branding and staff-ui are clean. `apps/web`, which includes `e2e/`, shows only the pre-existing `@auction/api/app` module error.
- **CI on `1f8fe4f8`** (REST check runs): 36 of 39 succeeded, including `static-checks` (which runs `lint:compositor`), `build-packages`, all 8 web vitest shards, `art-browser-gates`, `account-browser-gates` and the docker images. `build`, `test` and `browser-gates` were still in progress, with no failures so far.
