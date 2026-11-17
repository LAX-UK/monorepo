Verdict: SHIP

# Review of PR #1525 (Load Stripe Connect only when payout setup opens, everywhere)

The code change is correct and small. The only blocker is a merge conflict, which also leaves a stale part of the PR description.

I reviewed head `9aa56f0d` and checked out the PR to run the tests and lint on it.

## Blocking

### 1. The PR does not merge cleanly into current main
- Location: `packages/shop-portal/src/react/payout-account-panel.client.tsx:7`.
- Failure scenario: #1524 already merged the `/pure` import for this file, together with an explanatory comment. This PR's base is `b3a5d708` and main is now `efcc59a6`. `git merge origin/claude/stripe-connect-pure-everywhere` into main produces a content conflict in this file (the comment block against its removal). GitHub reports `mergeable_state: dirty`. Merge is blocked until this is resolved.
- Fix: rebase onto main and keep main's comment. After the rebase this file drops out of the PR diff. The commit "Use the pure Stripe Connect entry in the shop-portal payout panel…" then becomes empty or redundant, so drop it. Update the PR body, which still lists `packages/shop-portal` as changed and has a "Changes after review" CI-fix section describing that file.

## Verified OK

- **No bare imports remain.**
  - `git grep '@stripe/connect-js'` on the head, excluding the lockfile, shows only `/pure` imports, the `package.json` dependency entries, the biome message, and the string fixture at `scripts/ci/verify-client-copy.test.mjs:69`. That fixture is test text and is not an import.
  - `apps/art/package.json:31` lists the dependency but nothing in that app imports it.
- **Call sites are unchanged apart from the import path.**
  - `apps/web/src/components/connect/use-stripe-connect-instance.ts:29` is the same.
    - `publishableKey`, `fetchClientSecret` via a ref, and `appearance` are all passed as before.
    - It runs in an effect keyed on `publishableKey`.
  - `apps/account/src/components/selling/payout-account-card.client.tsx:41` is the same.
    - The `loadConnectAndInitialize` call and its `appearance` are unchanged. The only change is the import.
    - It runs inside the `open` click handler.
  - The shop-portal panel at line 48 runs only on click.
  - `apps/web/.../connect-workspace.tsx:290` mounts the shell through `next/dynamic` (`connect-components-shell-lazy.tsx`).
  - There are no locale options at any site, before or after.
  - Bid seller payouts (onboarding and management), Shop artist payouts and Account all keep the same flow.
- **The component tests fail when the lazy behaviour is removed.** I built the workspace packages, ran the tests, and ran each mutation.
  - Baseline: both new test files pass.
  - Account card, bare import instead of `/pure`: the "loads with publishable key" test fails.
  - Account card, load on render through a `useEffect`: both tests fail.
  - Web shell, bare import: the test fails.
  - Web shell, wrong `publishableKey`: the test fails.
- **The lint guard works.**
  - In `apps/web` and in `packages/shop-portal` (`biome check .` is the package lint script), a bare `import { x } from "@stripe/connect-js"` fails with the custom message.
  - `import type …` and `import("@stripe/connect-js")` also fail.
  - `biome.json` has no `overrides` entry for this rule, so the later CI lint fix did not weaken it.
- **Nothing outside the stated scope changed.** The diff is 7 files and touches no CSP, timeouts, retries, route-JS budgets or baselines, allowances or Lenis.
- **Commits.** Both commits are authored and committed by `mahmoudamrspace` with no trailers. The PR body has no AI footer.

## Non-blocking

### 2. The web shell test does not cover the lazy boundary
- Location: `apps/web/src/components/connect/connect-components-shell.test.tsx:28`.
- It renders `ConnectComponentsShell` directly, so it proves "load on shell mount" and not "shell mounted only when opened". If `connect-components-shell-lazy.tsx` were replaced by a static import, or `canMountConnectShell` (`connect-workspace.tsx:213`) were loosened, no test would fail.
- Fix: add a `ConnectWorkspace` test, or a static check that `connect-components-shell` is imported only through the lazy file.

### 3. The PR body's measurements are plausible but cover only account
- The bare entry does inject the script at module evaluation, and `/pure` defers it to `loadConnectAndInitialize`. The static chunk analysis for account is therefore believable.
- It is stated as a static analysis, not a network log.
- It has no numbers for web, Bid or Shop. `/pure` is a strict improvement there, but those routes are unmeasured.
- On the web payouts page the shell mounts on page load whenever a Stripe account exists and embedded panels show, so "when payout setup opens" really means when the payouts page opens.
- Fix: soften that wording in the body.

### 4. Other gaps
- The PR checklist leaves "lint/typecheck/tests pass" and the E2E gates unchecked. Confirm CI is green after the rebase.
- No test covers the shop-portal panel. The body acknowledges this.


## Final recheck

Head `b9b53db2` (4 commits over main `efcc59a6`).

- **Finding 1 fixed.** The merge into `origin/main` is clean (`git merge-tree` reports no conflicts). `packages/shop-portal/src/react/payout-account-panel.client.tsx` is identical to main and not in the PR diff. The diff is 7 files and does not touch shop-portal. `a28be1bb` is a normal merge commit with parents `9aa56f0d` (the old head) and main, so history was appended and not force-pushed.
- **PR body is accurate.** It makes no shop-portal claim. The web payouts wording is softened ("the shell mounts when the page shows embedded panels"). The measurements are labelled static analysis for account only, and web, Bid and Shop are stated as not measured.
- **Lazy-boundary guard works.** I added a static import of `connect-components-shell` to `connect-workspace.tsx`. `connect-components-shell-lazy-boundary.test.ts` then failed ("is imported only through connect-components-shell-lazy.tsx"). I reverted the change.
- **Biome guard holds.** A bare `@stripe/connect-js` import in `apps/web` fails with the `/pure` message.
- **Local checks pass.**
  - `biome check` passes in `apps/web`, `packages/shop-portal` and `apps/account/src/components/selling`.
  - Vitest passes: web connect 5/5, account selling 12/12.
  - `tsc` in `apps/account` is clean.
  - `tsc` in `apps/web` reports only the unrelated `@auction/api/app` missing type module. That module is not touched by this PR, and the CI build job passed.
- **CI.** The completed jobs are green: build, static-checks, ui-chromium, web, api and shop-api vitest, account-browser-gates and the docker images. The `test` and `browser-gates` jobs were still in progress when I checked, so those two are unconfirmed. Nothing has failed. The two PR checklist boxes for lint/tests and E2E remain unticked in the body.
- **Commits.** All 4 are authored and committed by `mahmoudamrspace` with no trailers. The body has no AI footer.

The remaining risk is the two in-progress CI jobs. The change is small and mechanical, so I rate it SHIP.
