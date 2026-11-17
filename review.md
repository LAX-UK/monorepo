Verdict: SHIP

# Review of PR #1524 (lax.art: stop every page loading Stripe's Connect script)

Checked from the diff, the PR description, and the published npm packages. I could not run the art gate locally: the sandbox has no `node_modules`, Postgres or Redis. I also could not read the CI logs or run history, because `gh` GraphQL is blocked here. The root-cause evidence below is therefore taken from the PR text plus a code check, not reproduced.

## Root cause: plausible and consistent with the code
- `@stripe/connect-js@3.x` `dist/connect.esm.js:242` has `const stripePromise = Promise.resolve().then(() => loadScript())` at module scope. Evaluating the bare entry therefore injects `connect-js.stripe.com/v1.0/connect.js`.
- The pre-fix import of the bare entry was `packages/shop-portal/src/react/payout-account-panel.client.tsx:7`. That file is re-exported from `packages/shop-portal/src/react/index.ts`, the barrel the art root layout imports. So the script loaded on every lax.art page, which delays `load`.
- That matches the timeouts the PR describes: `page.goto(waitUntil: load)` in FLAKE-6 and `networkidle` in the loading-check for FLAKE-9.

## Fix location: correct
- `payout-account-panel.client.tsx:10` now imports from `@stripe/connect-js/pure`. I confirmed `dist/pure.esm.js:240` exports `loadConnectAndInitialize`, which loads the script only when called. In this panel that is inside the `open` callback (line ~51), so it runs only when a payee clicks to open payout setup.
- `@stripe/react-connect-js` (3.3.31 and the locked 3.4.3) has no import of `@stripe/connect-js` in its dist, so nothing else pulls the side-effecting entry into the barrel.
- The types (`StripeConnectInstance`) come from `/pure` as well. The lockfile has `@stripe/connect-js` at 3.4.5, which has the `/pure` export.
- The payout flow is unchanged in behaviour. The script still loads on demand, and the account app's CSP (`apps/account/src/lib/security-headers.ts`) already allows `connect-js.stripe.com` and is untouched.

## Constraints
- No timeouts, retries, skips, route-JS budgets, baselines or allowances changed. The PR touches two files (+19/-1) and doesn't touch Lenis.
- No CSP or security-header changes.
- The commit is by mahmoudamrspace, has no trailers, and the PR body has no AI footer.

## Findings (non-blocking)
1. `apps/art/e2e/art-chrome.spec.ts:72-86`: the new `@smoke` test covers only "not loaded on ordinary pages" (`/` and `/artworks`). Nothing asserts the positive half, that opening payout setup still loads Stripe Connect. A future change to the import could silently break onboarding. Failure scenario: someone replaces `loadConnectAndInitialize` with a lazy no-op and payout setup never loads. Fix: add a component test for `PayoutAccountPanel` that clicks "open" with a mocked `@stripe/connect-js/pure` and asserts `loadConnectAndInitialize` is called with the publishable key. It should also assert it is not called at render.
2. `apps/web/src/components/connect/use-stripe-connect-instance.ts:5` still imports the bare `@stripe/connect-js`. That is out of scope here, but any web page that statically imports it will have the same load-time side effect on that app's pages. Fix: consider the same `/pure` switch in a follow-up.
3. The test's `endsWith("stripe.com")` check is adequate. A guard against regressions from other barrel exports (for example a lint rule banning bare `@stripe/connect-js` imports in `packages/shop-portal`) would be sturdier. Optional.
4. The PR notes a separate pre-existing flake, `art-discovery.spec.ts:14` (grid/list toggle). It is not addressed here, and that is acceptable. FLAKE-6 and FLAKE-9 should still be watched after merge, since local runs 4 and 5 each had that one failure.

Merge-readiness: the PR is behind `origin/main` (a diff against current main shows unrelated files), but the PR's own change is minimal and clean.
