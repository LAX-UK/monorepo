Status: FIXED

# LAX Admin browser gate ("Run LAX Admin accessibility and role checks"): findings

Date: 2026-11-19. Runs examined: merge_group 44526568089 (PR #1571, fix/zoho-artwork-audit) and
PR #1561's run 44414856521 (attempt 1 failed; attempt 2 passed). I compared them with recent green
runs, including main merge run 44433977902 and #1571's own PR run 44517705749.

## Root causes

### 1. Sign-in service per-address limit (429): independent of #1571

- The issuer's general `/api/auth/*` bucket is 30 requests a minute per client address
  (`AUTH_RATE_LIMIT_POLICY.authGeneralMax`, key `rl:auth-issuer:<ip>`). It covers authorize,
  consent, the code and Shop API token exchanges, and sign-out. Every LAX Admin check signs in from
  127.0.0.1.
- Measured on a local copy of the CI stack: the six `staff-roles.spec.ts` sign-ins and sign-outs
  alone raise `rl:auth-issuer:127.0.0.1` to 18. In run 44526568089, between 13:16:20 and 13:16:51,
  two workers ran staff-roles, the stock-location sessions, the release-alert retry and the
  zoho-mirror-badge sessions, which is more than 30. Result: `OIDC authorize JSON omitted a
  redirect (429)`.
- Not the per-email sign-in limit (5 per 15 min): the middleware removes successful sign-ins from
  that bucket (`zrem` when status < 400).
- The workflow already flushes `rl:*` between the Bid suites (run-pr-browser-gates.mjs), and the
  Bid and Account e2e helpers flush before sign-in. LAX Admin's suite never did.

### 2. "Nothing is order: Mirrored to Zoho" is a symptom of (1), not a seed problem

- `seed:zoho-mirror-badge` ran and printed all five orders and artworks. In the same failing run,
  "Mirrored to Zoho" passed for the order page (dark) and the artwork record (light and dark).
  Only the order/light suite failed, in 5 ms: its batched status read returned non-OK, so the map
  was empty. Its retry then hit the 429 at sign-in.
- How that happens: when the 429 lands on the OAuth callback, LAX Admin redirects to its own
  `/login?error=…`. The e2e helper counted any `localhost:3030` URL as signed in, so the next
  signed-out read failed and was reported as "nothing seeded".
- The same failure happened on #1561's attempt 1, before #1571, and on main merge 44433977902
  (passed on retry).

### 3. #1571's F1 rule does not affect the seed

- F1 (in `derive-zoho-mirror-state.ts` on #1571) stops a listing-consumer "already in sync" skip
  from proving live mode. The seed's "mirrored" fixtures are real live `succeeded` deliveries
  (`Order:LAX-S-SEED-1`, `Product:SEED-ZM-1`) on the order mirror and the artwork write-back
  consumers, not listing skips. No change is needed on #1571's branch, and none was pushed.

### 4. release-alert-sends.spec.ts:250: test race, independent of #1571

- It failed twice in a row in both failing runs: after `openStaffPage(?cursor=…&release=…)`, no
  h1 appeared within 30 s. It passes in other runs, including #1571's PR run and main.
- The `?release=` link opens the release's DetailPanel on load, and the panel is a modal Sheet.
  Once it is open, the page behind it, including the h1, is hidden from assistive tech, and
  `openStaffPage` waits for that h1. The test passed only when the check ran before the panel
  opened.

## What changed where

- **PR #1575** (new, from main, ready for review): https://github.com/LAX-UK/monorepo/pull/1575
  (branch `fix/lax-admin-e2e-issuer-rate-limit`). Test code only:
  - `apps/shop-admin/e2e/support/flush-auth-rate-limits.ts` (new): clears the test Redis `rl:*`
    keys before each staff sign-in. It runs only when the auth base URL is localhost and
    `REDIS_URL` is set, so deployed environments and production limits are untouched.
  - `apps/shop-admin/e2e/support/staff-sign-in.ts`: calls the flush, and fails at sign-in when
    the browser is back on LAX Admin's `/login`, naming the error code.
  - `apps/shop-admin/e2e/release-alert-sends.spec.ts`: the deep link waits for `#main-content` and
    then the panel, not the page heading.
- **PR #1571**: no change.

## Verification

- Local copy of the CI stack, built from e2e-pr.yml (migrate, seed, OIDC clients, auth-app, api,
  shop-api, start-lax-admin-stack.sh, both seeds). With the fix,
  `pnpm --filter @auction/shop-admin test:e2e:a11y` gave 114 passed (1.6m), 0 flaky, 0 retries.
- Main's helpers on the same stack: 113 passed, 1 flaky. The flaky test was stock-location:168,
  failing only because my earlier local run had already moved its fixture. The 429 did not
  reproduce on this faster machine, so the diagnosis rests on the CI logs and the measured budget
  (18 of 30 from staff-roles alone).
- CI on #1575 has not finished at the time of writing.

## Left open

- stock-location.spec.ts:239 (light) also fails on its first attempt in runs without a 429
  (main merge 44433977902 at line 89, `aria-current` on the Locations link; #1561 attempt 1 at
  line 88, page h1 missing). It passed on retry each time. The CI artifacts (traces) could not
  be downloaded from this environment (blob storage host blocked by the network policy), so its
  cause is not established.
