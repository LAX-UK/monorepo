Verdict: FIX FIRST

# Review of PR #1470: motion system 1/8 (tokens, compositor-only check, motion-check helper)

Reviewed head `74e7246f` (branch `motion-tokens`) against `docs/design/motion.md` as shipped in the PR. The PR branch was not modified.

The token work is correct and leaves the products unchanged. The two blocking items are in the tooling that the seven later PRs will rely on. One is a lint false negative. The other is a bias in the timing measurement. Both are small fixes.

## Findings

1. **BLOCKING: the compositor lint misses banned properties on the second and later lines of a wrapped `transition:` declaration.** `scripts/compositor-rule.mjs:44` captures the value with `([^;}\n]+)`, so it stops at the first newline. The repository already wraps long transitions this way (`packages/marketing-ui/src/marketing-header.css:40-42`), so this is the normal format, not an edge case. Mutation check: adding
   ```css
   .zz { transition:
       opacity 1s,
       box-shadow 1s; }
   ```
   to `marketing-header.css` still passes `pnpm lint:compositor`. Fix: capture `([^;}]+)`. Add a test in `scripts/compositor-rule.test.mjs` with a wrapped declaration whose banned property is on a later line. Check that the allowlist counts still match afterwards. A scan today found no wrapped offenders, so the counts should not change.

2. **BLOCKING: `measureInteractionToPaint` counts the Playwright round trip, which its doc comment says it excludes.** At `apps/web/e2e/helpers/motion-check.ts:71`, the comment says "Playwright's round trip is not counted". The clock starts at the input's `timeStamp`, but the end is stamped only after `await action()` resolves and a new `page.evaluate` reaches the page, plus two rAFs (`:92-99`). So the result includes protocol latency and an extra frame. That latency grows when the main thread is busy, which is exactly the 4x-throttled case. Measured on a trivial page at 4x throttle, 15 presses each:
   - the helper's method gave about 30 ms (29–37);
   - stamping inside the page (pointerdown → rAF → `setTimeout(0)`) gave about 15 ms (12–18).

   The smoke spec then compares the result to the hard budget with no margin (`motion-check-smoke.spec.ts:34`). Every later motion PR inherits this helper as its proof, so a biased, load-dependent number is a blocking flaw for criterion 4 ("deterministic, no thresholds without margin"). Fix: in the capture listener, record the paint stamp in the page (`requestAnimationFrame(() => setTimeout(stamp, 0))`, or `MessageChannel`), then read it afterwards. Optionally take the median of N presses. Then document the measure, or add a small stated margin.

3. **Should fix: Tailwind's bare `transition` utility is not caught.** In Tailwind v4, `transition` transitions `box-shadow`, `filter` and `backdrop-filter` (among others). So `className="transition hover:shadow-lg"` animates box-shadow and still passes. Mutation-checked on `packages/ui/src/components/ui/pagination-footer.tsx`. Today nothing in `apps/` or `packages/` uses the bare utility, so banning it now (or requiring `transition-[…]`, `transition-colors`, `transition-opacity` or `transition-transform`) costs nothing and closes the gap.

4. **Should fix: the banned-property match is exact, but the comment says prefix.** `scripts/compositor-rule.mjs:16` says "Longhands are matched by prefix", but `BANNED_WORD` (`:46`) needs an exact name. `margin-inline-start`, `margin-block-end` and `-webkit-backdrop-filter` all pass (mutation-checked). Either match by prefix for the `margin` family and allow an optional `-webkit-` before `backdrop-filter`, or correct the comment and list the longhands.

5. **Should fix: `restingScreenshotParity` is brittle as written** (`motion-check.ts:159-183`):
   - It compares the two PNGs byte for byte (`motion-check-smoke.spec.ts:48`) right after `waitUntil: "load"`. Streamed Suspense content, countdowns, lazy images and late fonts can all make two healthy renders differ. Wait for `networkidle` and `document.fonts.ready`, freeze time (`page.clock`), and compare with a small pixel tolerance (for example `toMatchSnapshot`-style `maxDiffPixelRatio`) instead of `Buffer.equals`.
   - The new contexts drop the project's `use` options (`baseURL`, `storageState`, `locale`, `colorScheme`, `extraHTTPHeaders`). Pass them through, or take a context-options argument.
   - `new URL(path, undefined)` (`:165`) throws a raw `TypeError` for a relative path when the page has not navigated yet. Use the test's `baseURL`, or throw the same kind of guided error as `layoutShiftScore`.

6. **Should fix: the smoke spec has not been shown to pass against Bid home, and nothing runs it.** The PR text says the helpers were exercised against a local page only. In this review I ran it 3 times against a local `apps/web` dev server with no API behind it. Each run: reduced-motion test passed; layout shift was 0.137 (> 0.1) and the JS-off/JS-on parity check failed, both because the skeleton was swapped for the error state. That is caused by my environment, so it is not evidence against the PR. But no one has a recorded green run against a real Bid home, and the spec is in no workflow, not even a manual one. Attach one passing run against the test environment, or add it to the planned MO14 manual workflow.

7. **Minor: the drift test guards the three product files, not "declared once".** `packages/branding/tests/lax-motion.test.ts` checks `lax-system.css`, the staff theme, and Bid/Shop/lax.art aliases. A second `--lax-motion-enter: 250ms` declared anywhere else (for example a new `:root` rule in `apps/web/src/app/globals.css` or `marketing-header.css`) passes (mutation-checked). Today the tokens really are declared only in `lax-system.css:146-158` and `staff-ui/src/theme.css:229-236`. A repo-wide check that `--lax-(motion|ease)-*` is declared only in those two files would enforce it. Related, for the later PRs: `marketing-header.css:40-42` still carries literal fallbacks (`var(--motion-duration-sm, 200ms)`).

8. **Minor: the docs should say the `--motion-*` aliases do not follow the staff overrides.** The aliases resolve at `:root`, so inside `[data-staff-ui]`, `--motion-duration-sm` stays 200ms while `--lax-motion-enter` is 150ms (confirmed with computed styles). That is right for "no visible change". But `docs/DESIGN_SYSTEM.md:309` should say that staff code must use `--lax-motion-*` directly, so nobody expects the old names to pick up staff timings.

9. **Minor: `observeLayoutShift` sums every shift.** At `motion-check.ts:32,43` the comment says "as in CLS", but CLS is the largest session window. The sum is stricter, which is acceptable for a guard, but name it ("total layout shift") or document the difference.

10. **Minor: line comments can trip the lint.** `stripComments` (`compositor-rule.mjs:49`) strips `/* */` only, so a `// … transition-all …` comment in TS/TSX counts as an offence (mutation-checked). Low impact, but it can confuse whoever lowers the allowlist later.

## What was verified

- **(1) No visible change.** Passed.
  - `lax-motion.test.ts` resolves every `--motion-*` alias in Bid, Shop and lax.art to its pre-PR value.
  - Mutations to a product alias, a shared value, a staff value, or the wrong alias target each fail it.
  - In a running Bid page (fresh `next dev`, main vs branch), the computed `:root` and `[data-staff-ui]` values of all eleven `--motion-*` tokens are identical. `--motion-ease-accelerate` is tree-shaken on both.
  - Shop and lax.art declare theirs in plain `:root` and import `lax-system.css`, so the alias test covers them. Their pages were not rendered.
  - Staff values match the spec table: press 0, hover 100, enter/exit 150/100, panel 200/150, page 100/150, easings shared.
- **(2) Tokens declared once.** Passed, with gap 7 above. Tokens are in `lax-system.css` only, with staff durations in `staff-ui/src/theme.css`. No other declarations exist today.
- **(3) Compositor check.** Partly passed; see findings 1, 3 and 4.
  - New `transition: all`, `transition-all`, `transition-[height]`, inline `transition: "all 1s"`, `width`/`backdrop-filter` transitions and `box-shadow`/`filter` keyframes all fail it (mutation-checked).
  - The allowlist has 46 entries covering 49 offences, including exactly the 11 `transition-all` the spec names. The repository matches it, and a stale or too-high count fails.
  - Wired into CI `static-checks` (`.github/workflows/ci.yml`) and `ci:verify`.
- **(4) Helper.** Documented and reusable in shape. See findings 2, 5, 6 and 9.
- **(5) Lenis, route JS, budgets.** Passed. No Lenis, budget or baseline file is in the diff. The PR adds no route JavaScript (CSS, tests, scripts, docs and e2e only). `pnpm lint:route-js-budget` passes (44/44).
- **(6) Docs.** Passed. `docs/DESIGN_SYSTEM.md` has a new motion section. `staff-design-standard.md` CRF-14 and open item 6 are updated.
- **(7) Attribution.** Passed. Neither commit message nor the PR title or body has any co-author, session or generated-by lines.
- **Local runs.**
  - `@auction/branding` vitest: 349/349 passed.
  - `@auction/staff-ui` vitest: 632/632 passed.
  - `pnpm lint:compositor` passed (8/8 node tests).
  - Biome clean.
  - `lint:e2e-tags`, `lint:e2e-portfolio`, `lint:ui-guardrails` and `lint:web-guardrails` all ok.
  - Branding and staff-ui typecheck clean. `apps/web` typecheck shows only the existing `@auction/api/app` module error.
- **CI on `74e7246f`.** 37 check runs succeeded, including `static-checks`, all web vitest shards and `build-packages`. `test` and `browser-gates` were still running when this review was written.
