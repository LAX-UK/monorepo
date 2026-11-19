Status: FIXED in #1569

# Art PR browser gates: viewer-chrome-stable.spec.ts:107 fails in the merge queue

## What fails
- `apps/art/e2e/viewer-chrome-stable.spec.ts:107`, all 4 cases (`/` and `/artworks` at 1440 and 375).
- Every attempt fails (3 of 3).
- The assertion that fails is at `:153`: the footer's "Your account" link is never drawn (received 0) once `/api/viewer` is released. At 1440 the header account slot check at `:155` follows from the same cause.

## When it started
- The spec was added in #1541 (45a27ec8, merged 2026-11-17 16:36 UTC).
- #1541's own PR run of this job already failed (run 44119856952), and so did its merge_group run (44127758894).
- Every merge_group run since has failed, including 44414943785, 44415517810, 44421142335 and 44422042726.
- The last green merge_group run was 44127754765 (#1537), just before #1541.

## Why PR runs looked green
- On `pull_request` the `art-browser-gates` job runs only when art paths change (`needs.changes.outputs.art`).
- The recent PR runs took about 20 to 60 s, so the browser job was skipped, not passed.
- merge_group always runs the job. No environment difference between the two events is involved.

## Root cause (test bug, not a product regression)
- The spec calls `signInArtBuyer(page, buyer, "/")`.
- The helper waited with `page.waitForURL(url => url.pathname.startsWith(returnTo))`.
- Playwright's `waitForURL` resolves at once if the current URL already matches (playwright-core 1.55 `client/frame.js`, `waitForURL`).
- With `returnTo = "/"` every URL matches, so the helper returned while the browser was still on the sign-in page.
- The spec's next `page.goto(path)` then aborted the sign-in redirect. Locally this shows as `page.goto: net::ERR_ABORTED at http://localhost:3050/`.
- The visitor stayed a guest, `/api/viewer` answered as a guest, and the footer showed "Sign in" instead of "Your account".
- No other caller passes `/` (`art-journeys` uses `/artworks` and `/account`), so only this spec was affected.

## Reproduction
- I set up a local stack with the workflow's env: Postgres 16 on 55432, Redis, migrate and seed, roles, OIDC client, catalogue and editorial seeds, and auth-app on 3003, shop-identity on 3051, shop-api on 3011 and art on 3050.
- On main all 4 cases fail exactly as in CI.
- With the fix, all 4 pass, as does the rest of the Art suite. The exception is `home-prerendered.spec.ts:65`, which failed only because my local art process was started without `ART_REVALIDATE_SECRET`.

## Fix (#1569)
- In `apps/art/e2e/helpers/art-e2e.ts`, `signInArtBuyer` now waits for a URL that meets all three conditions:
  - it is on the lax.art origin (`PLAYWRIGHT_BASE_URL`);
  - it is not `/login`;
  - it is at the return path (exactly `/` for the home page).
- Test-only change.

## Notes for the owner
- Aborted sign-ins count toward the per-email sign-in limit (5 per 15 min, `signInEmailMax`). Successful ones are removed. Before the fix, retries in a single run could build up those counts. After it, sign-ins complete and are cleared.
- The job is evidently not a required check, since #1541 and later PRs merged while it was red. Consider making `art-browser-gates` required, or alerting on red merge_group runs, so a red gate is noticed.
