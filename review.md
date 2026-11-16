Verdict: FIX FIRST

# Review of PR #1498: Clerk console: survive deploys and never show stale state after recovery

Reviewed head `f488f24e` against `main` (`618ab329`; merge base `46c9bdac`). This is a review only. The PR branch was not changed.

The core fix is sound. Every clerk-console command now goes through the same-origin BFF instead of a build-scoped server action. The API checks capability on every command. Paddle and telephone bids are deduplicated on the server. Try again now refetches, and reloads when the error is a stale server action. Two of the brief's acceptance criteria are not met, so the verdict is FIX FIRST.

## Blocking

1. **Saleroom check-in still uses server actions, so it still breaks across a deploy.** The brief lists check-in among the clerk mutations that must survive a deploy.
   - `apps/web/src/components/admin/saleroom-check-in-panel.tsx:3-6` still imports `adminSaleroomCheckInResultAction` and `adminSaleroomCheckInCandidatesResultAction` from the `"use server"` module `@/lib/actions/admin`. The calls are at `:87` and `:147`.
   - The second call runs inside `startTransition`. After a deploy it throws `UnrecognizedActionError` into the registrations tab's error boundary.
   - That boundary is `createStaffTabError` (`app/admin/(platform)/sales/[id]/(detail)/registrations/error.tsx`). Its retry is still a plain `reset` (`components/admin/staff/create-staff-tab-error.tsx:26`). It has no stale-action reload and no refresh.
   - Door staff checking people in during a live sale would hit the same crash and stale-retry pattern this PR fixes for the console.
   - **Fix:** move check-in and the candidate search to BFF calls, as `clerk-commands.client.ts` does. At minimum, give `createStaffTabError` the same `retryStaffPage` behaviour.

2. **Route JS is not equal to or lower than `main` on every route.**
   - **Method:** both builds were made locally (`next build`). For each route I measured the gzip size of the start-up script set, using `scripts/route-js-startup-set.mjs` and summing per-file gzip. That gives 229 page routes, 112 of them under `/admin`.
   - **Result:** 223 routes are identical, 0 are smaller and 6 are larger.
     - `/admin/(platform)/inbox/page`, `/admin/(platform)/inbox/[submissionId]/page`, `/admin/(platform)/inbox/saved-replies/page` and `/admin/(platform)/saleroom/page`: +342 B each. These use `createStaffPageError`, which now pulls in `useRouter`, `useTransition` and `isStaleServerActionError`.
     - `/admin/(platform)/saleroom/[saleId]/page` (the clerk console): +82 B (500,731 → 500,813 B).
     - `/admin/(platform)/sales/page`: +46 B.
   - The amounts are tiny, and the CI `check:route-js-budget` passes because admin routes are not in a budget group. The brief's bar is "equal or lower on every route", and that bar is not met.
   - **Fix:** remove the growth, for example by importing only what the boundary needs, or by moving the stale-action check behind the clerk route's own `error.tsx`. Otherwise the requirement needs an explicit waiver.

## Non-blocking

- **The hammer and pass commands do not name a lot.**
  - `clerkHammer` and `clerkNoSale` send only `saleId` (`apps/web/src/features/saleroom/lib/clerk-commands.client.ts:101-107`). The API hammers whatever `session.currentLotId` is at that moment (`apps/api/src/services/saleroom/saleroom-session-control.service.ts:161-226`).
  - A repeat on the same lot is safe: the lot is already closed and `currentLotId` is cleared, so the server rejects it.
  - A delayed or second-tab hammer that lands after another clerk has advanced would act on the next lot. This hazard existed before this PR and is not made worse by it.
  - Recommend sending the displayed `lotId` and having the API reject a mismatch.
- **A lost response tells the clerk to "try again" without re-reading the room.**
  - On a network failure, `sendClerkCommand` returns `CLERK_COMMAND_UNREACHABLE` (`clerk-commands.client.ts:63`). `LotOutcomeControls` only shows the message (`lot-outcome-controls.tsx:48-50`).
  - The hammer may in fact have landed. The doc comment says "the console re-reads the room from the server instead" (`clerk-commands.client.ts:15-16`), but that only happens for session-toolbar controls (`confirmFromServer`).
  - It is safe because a retry is refused server-side, but the clerk can briefly believe a hammer failed when it succeeded. Recommend calling `resyncFromServer` and `router.refresh()` on any non-2xx or unreachable result, and wording the message as "outcome unknown, checking…".
- **The mount resync refreshes the session, not lot prices.**
  - `saleroom-clerk-console.tsx:100` calls `resyncFromServer`, which reloads status and `currentLotId`.
  - Price and reserve come from `lots[].currentPrice` props plus socket `bidUpdate` events (`hooks/use-clerk-lot-live-price.ts:48-93`, `lot-on-block-panel.tsx:168`).
  - After Try again, prices are fresh because `router.refresh()` refetches the page (`create-staff-page-error.tsx:46-48`). The comment's bfcache claim does not hold for prices.
  - No test asserts that a fresh price or reserve is rendered after a reset; the tests only assert that `refresh` and `resync` are called. Consider a lot-snapshot read on mount and a render-level test.
- **Transitional deploy.** Consoles still open on the old build when this PR ships have the old boundary, which is reset-only. Reload every clerk console after this deploy and before the next sale.
- **No idempotency key on session controls** (go-live, pause, resume, close, advance, display, overlay, telephone lines). These are state-idempotent on the server (advancing to the same lot, pausing a paused room), so this is acceptable. Paddle and telephone bids could also send an explicit `Idempotency-Key`, although the server's deterministic default already covers retries and second tabs.
- The `revalidatePath(/admin/saleroom/:id)` done by the removed server actions is gone. The console compensates with `router.refresh()` after a successful command.

## Verified

- **(1) Deploy skew is handled for the console.** All console commands go to `/api/bff/admin/...` through `browserFetch` (`clerk-commands.client.ts:47-73`):
  - advance (`clerk-live-action-bar.tsx`, `lot-runway-panel.tsx`)
  - hammer and pass (`lot-outcome-controls.tsx:82`)
  - go live, pause, resume and close (`clerk-session-toolbar.tsx`)
  - paddle and telephone bids (`hooks/use-clerk-bid-entry.ts:49-58`)
  - start and complete line (`telephone-lines-panel.tsx`)
  - fair warning, announce and clear overlay (`display-overlay-actions.tsx`)
  - display approve and revoke (`display-control-panel.tsx`)

  No other `@/lib/actions` imports remain under `features/saleroom` (the remaining import is `_utils`, which is not a server action). The removed actions have no remaining callers. Nothing in the client retries.
- **No double-bid.**
  - Paddle bids get the server default key `paddle:<sale>:<paddle>:<lot>:<amount>` (`apps/api/src/routes/admin/saleroom.routes.ts:136-157`).
  - Telephone bids get `telephone-booking:<lot>:<booking>:<amount>` or a clerk/buyer-scoped key (`saleroom.routes.ts:97-120`).
  - A retry after a reload, a second tab or a slow duplicate is therefore replayed rather than placed twice.
- **No double-hammer on the same lot.** `resolveLotOutcome` requires a live session and a current lot, finalises only an active lot, and clears `currentLotId` (`saleroom-session-control.service.ts:205-245`).
- **(2) Try again refetches.** `retryStaffPage` runs `router.refresh()` and `reset()` in a single transition, and `window.location.reload()` for a stale-action error (`create-staff-page-error.tsx:36-50`). The Next 15.5.21 `UnrecognizedActionError` sets `name` explicitly, so detection survives minification (`lib/next/stale-server-action.ts`). The console also resyncs the session on mount.
- **(3) Authorisation is unchanged.**
  - Every target route keeps `requireSaleroomOperate` (`routes/admin/saleroom-session.routes.ts`, `routes/admin/saleroom.routes.ts:99,138`, and the telephone-booking guards in `routes/admin.ts`), behind `requireAuth` and `requirePlatformShell`.
  - No saleroom route is in the step-up registry before or after, so nothing changed there.
  - The BFF exchanges the same session for a `bid.write` token, which is the same principal the server-side admin client used (`lib/data/http/server-request-headers.ts:61`).
  - The removed web-side `denyUnlessAdminCapability(SALEROOM_ACCESS)` was a duplicate of the API check.
  - CSRF: unsafe BFF methods require `Origin === publicOrigin` and `Sec-Fetch-Site: same-origin` (`app/api/bff/[...path]/route.ts:34-40`). `admin` was already an approved proxy root, and the proxy forwards only the view-session cookie.
- **(4) The tests catch the regressions.** Mutation runs in a separate worktree:
  - Try again doing `reset` only: `create-staff-page-error.test.tsx` fails (2).
  - Reload branch disabled: fails (2).
  - Mount resync removed: `saleroom-clerk-console.test.tsx` fails (1).
  - `LotOutcomeControls` and the actions restored to `main` (server-action hammer): `lot-outcome-controls.deploy-skew.test.tsx` fails (2).
  - The skew test simulates the post-deploy 404 for `next-action` requests.
- **Suites:**
  - Web vitest, full run: 1531 files, 10,001 passed, 10 skipped, 0 failed.
  - Targeted saleroom, admin and BFF suites: 1508 passed.
  - API saleroom, paddle, telephone, display, auth-scope, capability and action-rule drift: 455 passed.
  - `tsc --noEmit` (apps/web): clean.
  - `next build` (apps/web): succeeds.
- **(5) CI is green.** `ci-result`, `build`, the web and api vitest shards and `browser-gates` all succeeded on the head commit.
- **(5) Visual change is minimal.** The telephone line buttons are no longer wrapped in `<form>` elements but stay flex items in the same `flex flex-wrap gap-2` row. The only other change is the Try again button showing a loading state while retrying. I did not run any visual snapshot tests locally.

## Final recheck

Rechecked head `c3de5b83` (it merges `main` at `14f44616`) on 2026-11-16. `main` has since moved to `697f2d8d`, so route JS was also measured on a local merge of the PR into that `main`. This is a review only. The PR branch was not changed.

**Verdict: FIX FIRST.** Most of the review is now addressed, with tests that fail without the change. One acceptance bar is still missed: the registrations tab, which is the door check-in page this round moved off server actions, ships about 197 B more start-up JS than `main`. The PR body says that page is 28 B smaller. Two smaller gaps are listed under item 4 and item 6.

### Item by item

**(1) Check-in off server actions: done.**
- The panel's candidate search and check-in go through the BFF via `lib/admin/saleroom/check-in.client.ts`. So do the registrations row's "Mark present" and the expected-guests check-in. `adminSaleroomCheckIn*ResultAction` are deleted, and no callers remain under `apps/web/src`.
- The server-side checks are at least as strong as before. The old actions checked `SALES_ACCESS` on the web, and the API checked `requireSaleroomOperate`. Both API routes now require both checks (`apps/api/src/routes/admin/saleroom.routes.ts:55,69`). A saleroom clerk without sales access gets 403 on both routes, and a test covers this.
- Body validation is unchanged on the API: `adminSaleroomCheckInBodySchema` with a uuid param.
- No other API caller of these routes exists.
- `createStaffTabError` now reloads on Try again (`create-staff-tab-error.tsx:24`). That refetches the page and lands on the current build. The review asked for the `retryStaffPage` behaviour; a full reload covers both of its cases.

**(2) Route JS equal to or lower than `main` on every route: NOT MET.** One route is larger.

- **Method:**
  - `next build` of each commit in the same worktree path, with `.next` removed before each build and workspace packages built through turbo.
  - Per page route, the gzip start-up set from `scripts/route-js-startup-set.mjs`, summed per file.
- **Measurement caveat:**
  - Unpinned builds are not reproducible. Building `14f44616` twice gave a different size on all 229 routes, by up to ±523 B.
  - The cause is that Next 15.5 salts server-action ids with the per-build encryption key (`serverReferenceHashSalt` = `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, or a random key cached in `.next/cache`). The changed action ids then reshuffle webpack's deterministic module ids. For example, the same module was `86517` in one build and `53660` in the next.
  - With the key pinned through `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, two builds of `14f44616` matched on 228 of 229 routes. The one exception, `/(client)/purchases/pay`, differed by 8 B.
  - Byte-level claims made from unpinned builds should not be trusted. That includes the PR's "+10/+9/+1 B from module-id reassignment" and possibly some of my first review's figures. The +342 B boundary growth in the first review was structural and is now gone (see below).
- **PR head against its base `14f44616`, pinned key:**
  - 229 routes: 184 identical, 44 lower, **1 higher**.
  - **`/admin/(platform)/sales/[id]/(detail)/registrations/page`: 737,976 → 738,174 B (+198 B).**
  - The three marketing/client routes the PR names (`/(marketing)/search`, `/(marketing)/(home)`, `/(client)/selling/consignments/[id]`) are identical once the key is pinned.
- **Merge into current `main` (`697f2d8d`), pinned key:**
  - 185 identical, 43 lower, **1 higher**: the same registrations route, 737,841 → 738,037 B (+196 B).
- **The routes the first review flagged** (pinned, head against base):

  | Route | Change |
  |---|---|
  | `saleroom/[saleId]` | −8 B |
  | `inbox` | −33 B |
  | `inbox/[submissionId]` | −33 B |
  | `inbox/saved-replies` | −33 B |
  | `saleroom` | −33 B |
  | `sales` | 0 |

  Against current `main` the figures are −10, −33, −33, −33, −33 and 0. All of these are fine.
- **Why the registrations tab grew:**
  - Comparing the normalised module contents shows the `SaleRegistrationsTab` module is about 635 B larger before compression. It now inlines the check-in fetch, its error mapping and the transport copy, where it used to hold small `createServerReference` stubs.
  - The tab boundary's removed `useEffect` saves a little, but not enough to offset this.
  - No budget or ratchet was changed.
- **Fix:** cut about 200 B from the registrations tab, or get an explicit waiver for it. Options:
  - Load the check-in client lazily, on the first search or check-in.
  - Slim `check-in.client.ts`, for example by sharing the transport strings already in the chunk.
  - Correct the PR body's route-JS paragraph either way.

**(3) Hammer and pass name the lot: done.**
- `clerkHammer` and `clerkNoSale` send `{ lotId }` (`clerk-commands.client.ts`).
- `resolveLotOutcome` refuses a mismatch before touching anything, with `409 { code: "lot_not_on_block", error: "This lot is no longer on the block" }` (`saleroom-session-control.service.ts:222`). A non-uuid lot id returns 400.
- The body stays optional, so consoles still on the old build keep working. Those consoles get no lot check until they are reloaded, which the deploy note covers.
- On `lot_not_on_block`, the clerk sees "This lot is no longer on the block", and the console calls `resyncFromServer` and `router.refresh()`.
- Tests cover the service, the route and the component.

**(4) Unknown outcome, no double hammer or double bid: met for hammer and pass, not for every command.**

What is met:
- **Hammer and pass:** on any non-2xx or unreachable result, the clerk sees "Outcome unknown, checking the room…". The console then refreshes and resyncs, and only after that shows the error (`lot-outcome-controls.tsx:61-72`). It never shows success on failure, and nothing is resent.
- **Two tabs and retry after reload:** the full seeded stack, with its database, auth and WebSocket sidecar, was not available here. Docker is not running, so I could not run the real two-browser journey. Instead I ran the real `SaleroomService` with a stateful in-memory room. Its finalize step models the production guard, which is `findByIdForUpdate` plus `status === "active"` in `packages/lot-lifecycle-app/src/clerk-lot-outcome.service.ts`. All four cases passed:
  - Two tabs hammering the same lot at once: exactly one ends it.
  - Hammer in one tab and pass in another at once: only one outcome is recorded.
  - Retrying a hammer that already landed, after a reload: refused, and nothing else ends.
  - A stale tab after the room has advanced: 409 `lot_not_on_block`, and the new lot is untouched.
- **Bids:** paddle and telephone bids keep the API's deterministic default idempotency keys (`saleroom.routes.ts:109-114,147-150`), so a retry or a second tab replays rather than placing a second bid.

What is not met:
- Only hammer and pass follow the brief's "any non-2xx or unreachable command result resyncs … and shows an honest unknown-outcome message". The other commands only toast the error and do not re-read the room:
  - advance, through `SaleroomPendingSubmit` (`saleroom-pending-form.tsx:47`)
  - paddle and telephone bids (`use-clerk-bid-entry.ts:50,56`)
  - start and complete line
  - display approve and revoke, and the overlays
- Session controls do re-read the room through `confirmFromServer`, but without the unknown-outcome wording.
- On a lost response the clerk reads "The saleroom could not be reached. Check the connection, then try again." for an advance or bid that may in fact have landed.
- None of these can double-act: advance is state-idempotent and bids are idempotency-keyed. But this is not the wording the brief asks for. **Fix:** give `SaleroomPendingSubmit` and the bid entry the same pattern as `OutcomeHold`: show "Outcome unknown, checking the room…", then refresh and resync, then show the error.

Non-blocking observations:
- The lot snapshot is applied whenever it arrives (`saleroom-clerk-console.tsx:121`). If a socket `bidUpdate` lands between the snapshot read and its response, the older snapshot price can briefly overwrite the newer one, until the next bid or server render. Consider ignoring a snapshot that is older than the last applied live price.
- Pre-existing and not introduced here: `resolveLotOutcome` clears the session's current lot unconditionally after finalising (`saleroom-session-control.service.ts:264`). An advance that commits between a hammer's finalise and that clear can be wiped. Worth a conditional clear (only if the current lot is still the hammered one) in a follow-up.

**(5) Authorisation, step-up and CSRF: unchanged or stronger.**
- New `GET /admin/sales/:saleId/saleroom/lots/:lotId`: requires `requireSaleroomOperate` and a uuid param, returns 404 for a lot outside the sale, and returns 403 without saleroom access (tested).
- The check-in routes gained `requireSalesAccess`.
- No saleroom route is in the step-up registry, before or after.
- Clerk commands use `browserFetch`. Check-in uses a plain same-origin `fetch`, so the browser still sends cookies, `Origin` and `Sec-Fetch-Site`. The BFF's unsafe-method origin/same-origin check therefore applies to the check-in POST.
- `admin` is an existing approved proxy root.

**(6) Tests, CI, visuals and PR body: mostly met.**
- **Mutation runs:** each mutation was applied locally, run against the named suites, then reverted. Every one makes the suites fail:

  | Mutation | Result |
  |---|---|
  | Service lot check removed | 2 failures |
  | `requireSalesAccess` removed | 1 failure |
  | Route drops the body `lotId` | 1 failure |
  | Client hammer sends no lot | 1 failure |
  | Outcome: no resync | 2 failures |
  | Outcome: no refresh on failure | 2 failures |
  | Failure treated as success | 3 failures |
  | No "no longer on the block" message | 1 failure |
  | Tab boundary back to `reset` | 2 failures |
  | Check-in posted outside the BFF | 2 failures |

- **Suites on the head:**
  - Web vitest for `features/saleroom`, `components/admin`, `lib/admin/saleroom`, `app/api/bff` and `lib/bff`: 207 files, 1527 passed, 0 failed.
  - API vitest for saleroom, paddle, telephone, display, check-in, capability, auth-scope and action-rule: 26 files passed (1 skipped), 527 passed, 2 skipped.
  - `tsc --noEmit`: clean for `apps/web`, `apps/api` and `packages/validators`.
- **CI:** CI, Web PR browser gates, Account PR browser gates and Art PR browser gates all passed on `c3de5b83`.
  - The new Playwright test in `e2e/saleroom-clerk.spec.ts`, which covers a console left open across a deploy, is tagged `@journey`. `@journey` runs only in `E2E stabilization` (weekly cron and manual dispatch), not on PRs.
  - The PR body says these tests "run in the `@journey` CI job". They have not run for this PR. Run `E2E stabilization` with `workflow_dispatch` on the branch before merging, or reword the body.
- **Visuals:** no class, label or aria changes in the touched TSX. The only markup change is the removed `<form>` wrappers around the telephone line buttons, which stay flex items in the same row. The new text is limited to the two hammer/pass messages. I did not run visual snapshots.
- **PR body:** it has an honest "Changes after review" section and the deploy note: "reload every open clerk console (and any open registrations tab) once after this deploy, before the next sale". Two claims are inaccurate: the route-JS paragraph (registrations tab −28 B, three routes +1–10 B) and the `@journey` CI claim.

### To ship
1. Bring `/admin/(platform)/sales/[id]/(detail)/registrations` back to `main`'s start-up JS or lower, or record an explicit waiver for about 197 B. Measure with `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` pinned.
2. Give advance, bids, telephone lines and display commands the same unknown-outcome, refresh and resync handling as hammer and pass.
3. Correct the PR body's route-JS and `@journey` statements, and run `E2E stabilization` on the branch.
