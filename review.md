Verdict: SHIP (needs owner route-JS waiver)

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

## Final recheck (round 2)

Rechecked head `c55d8d28` on 2026-11-16. It merges `main` at `dd81f7f2` and adds the notify-mock fix. `main` is now `a811c33b`. This is a review only. The PR branch was not changed.

**Verdict: FIX FIRST.** The unknown-outcome handling and the CI fix are done properly, and both are backed by mutation runs. The route-JS bar is still missed, and it is now missed by more than in the last round:
- The registrations tab is **+320 B** against `main`. The PR body says it is −8 B.
- The clerk console is **+482 B**.
- 185 other routes are +2 to +9 B.

The PR body's route-JS table does not reproduce.

### Item by item

**(1) Registrations start-up JS equal or lower than `main`, and no route higher: NOT MET.**
- **Method:**
  - `next build` of each commit in one worktree path, with `.next` removed before each build.
  - Workspace packages built through turbo, and the CI placeholder Sentry DSNs set.
  - `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` pinned to the same value for every build.
  - Per page route, the gzip start-up set from `scripts/route-js-startup-set.mjs`, summed per file with the same default gzip as `check-route-js-budget.mjs`.
- **Noise floor:** two pinned builds of `dd81f7f2` matched on 223 of 229 routes. The other 6 differed by at most 3 B; registrations differed by 2 B.
- **Results:**

  | Comparison | Lower | Same | Higher | Registrations | Clerk console |
  |---|---:|---:|---:|---:|---:|
  | Head `c55d8d28` vs its base `dd81f7f2` | 42 | 0 | 187 | 758,206 → 758,526 (**+320 B**) | 519,044 → 519,526 (**+482 B**) |
  | Head merged into current `main` vs `main` `a811c33b` | 42 | 0 | 187 | 758,209 → 758,529 (**+320 B**) | 519,045 → 519,528 (**+483 B**) |

  The other 185 higher routes are +2 to +9 B (most +5 to +8). The shared runtime grew: `webpack` +4 B, `84583` +3 B and `main-app` +2 B on every route. Each of those is above the noise floor. The lower routes are −6 to −28 B (head against base) and −16 to −36 B (merged), mostly through the page and record-tab error boundaries.
- **Where the registrations bytes come from:**
  - The registrations page chunk alone is +363 B gzip (19,131 → 19,494 B; raw 63,007 → 63,341 B).
  - It now inlines the BFF check-in client: the `/api/bff/admin/sales/…/registrations/` fetch, its JSON handling and the fallback strings ("Could not search clients", a third "Check-in failed").
  - That client replaces two `createServerReference` stubs (5 → 3 in the chunk).
  - The two error-boundary chunks save 23 B and 26 B. That is not enough to offset the growth.
- **Clerk console:** the page chunk is +648 B (29,945 → 30,593 B) and one shared chunk is −34 B. This matches the PR body's own explanation (recheck context, unknown-outcome helper, snapshot guard). The body asks for a waiver here.
- **No budget, ratchet or allowance was changed.** `git diff dd81f7f2 c55d8d28` touches no `route-js-*` or budget file.
- **The PR body's −8 B figure for registrations does not reproduce.** Neither does "228 lower, 0 identical, 1 higher". The cause of the difference is not known. The commits after the body's measured head `f9dce231` are a `main` merge and a test-only mock change, and the measured page chunk itself shows the growth.
- **Fix:**
  - Bring the registrations tab to `main`'s start-up JS or lower. For example, move the check-in client out of the page's start-up chunk: it is needed only on the first search or check-in. The body notes that a lazy chunk added +16 B to the runtime on every route, so that cost has to be measured too.
  - Or get an explicit waiver for the registrations tab (about 320 B) and the clerk console (about 480 B). The brief says no route may be higher, so a waiver has to cover the +2 to +9 B shared-runtime growth on 185 routes as well.

**(2) Unknown outcome on advance, bids, telephone lines and display: MET.**
- `settleUnknownOutcome` (`features/saleroom/lib/clerk-room-recheck.ts`) does three things in order:
  - Shows "Outcome unknown, checking the room…" as a loading toast.
  - Awaits the console's recheck (`router.refresh()` plus `resyncFromServer`, provided through `ClerkRoomRecheckContext`).
  - Then replaces the toast with the error.
- **Where it applies:**
  - `SaleroomPendingSubmit` uses it on every non-ok result. That covers advance (dock and runway), telephone line start and complete, display approve and revoke, overlays and the session controls. Outside the console the recheck falls back to `router.refresh()`.
  - Paddle and telephone bids (`use-clerk-bid-entry.ts`) use it as well.
  - Hammer and pass use it too. `lot_not_on_block` keeps its own message, followed by the recheck.
- **Success and resending:**
  - Success is shown only on `ok`.
  - Nothing resends. Each command is a single `browserFetch` with no retry, and bids keep the API's deterministic idempotency keys.
- **Suites on head:** the targeted web suites (`features/saleroom`, `saleroom-pending-form`, `saleroom-check-in-panel`) ran 35 files and 162 tests, all passed, with no unhandled errors.
- **Mutation runs:** each mutation was applied, the suites run, then the change reverted. Every one makes the suites fail.

  | Mutation | Failing tests |
  |---|---:|
  | No "Outcome unknown" message | 12 |
  | No recheck | 12 |
  | Error shown before the recheck | 12 |
  | `SaleroomPendingSubmit` back to `main`'s plain `notify.error` | 9 |
  | `SaleroomPendingSubmit` reports success on failure | 9 |
  | `SaleroomPendingSubmit` resends once on failure | 9 |
  | Bid entry back to a plain error | 2 |
  | Paddle bid resends once on failure | 1 |
  | Hammer/pass back to a plain error | 1 |

**(3) PR body accuracy and the E2E stabilization run: PARTLY MET.**
- **`@journey`:** accurate now. The body says the `@journey` tests run only in `E2E stabilization` (weekly cron and manual dispatch), not on PRs, and that the earlier wording was wrong.
- **E2E run:** reported honestly, and it matches the Actions record for run 43909231185 on `f9dce231`:
  - Attempt 1: `flags-off` 1 and 2 and `rollout` 2 passed.
  - `rollout` 1 was cancelled at the 45-minute timeout in "Install pinned Chromium", before any test ran.
  - Attempt 2 re-ran only that job, and it passed. That is one infrastructure re-run, with no test retried.
  - `PLAYWRIGHT_E2E=1` is set in that workflow, so the `saleroom-clerk` journeys are not skipped by their `e2eEnabled` guard.
  - Like the author, I could not confirm which shard ran them. The report artifacts could not be downloaded from here.
  - The run predates the `dd81f7f2` merge and the mock fix. Neither changes app code on the clerk path.
- **Route-JS paragraph:** still inaccurate. See item 1: registrations is +320 B, not −8 B, and 187 routes are higher, not 1.
- **Test evidence:** stale. It names head `f9dce231` and says the full web vitest run on it passed with "0 failed". CI on `f9dce231` failed: web vitest shard 7/8 reported 1 unhandled error and exited 1. The body does not mention that failure or the `c55d8d28` fix.

**(4) CI unhandled rejection `notify.loading is not a function`: FIXED AT ITS CAUSE.**
- **Cause:**
  - In CI run 43909239770 (on `f9dce231`), web vitest shard 7/8 failed: 1181 tests passed, but there was 1 unhandled rejection.
  - The failing call is `settleUnknownOutcome` (`clerk-room-recheck.ts:24`), called from `saleroom-pending-form.tsx:57`, in `clerk-session-toolbar.test.tsx`.
  - That test's `@/lib/ui/notify` mock had only `success` and `error`. The real `notify` has `loading` (`lib/ui/notify.ts:92`).
- **Fix:**
  - `c55d8d28` adds `loading` to the notify mock in the four console tests that now reach that path.
  - Production code is untouched, and the real `notify.loading` exists.
- **No suppression:**
  - No `.skip`, `.todo`, `.fixme`, `dangerouslyIgnoreUnhandledErrors` or unhandled-rejection handler was added anywhere in the PR diff.
  - No vitest config changed.
  - The one `catch` in `settleUnknownOutcome` covers only the recheck, and the error is still shown after it.
- **Other mocks:** two other saleroom tests still mock `notify` without `loading`: `use-clerk-bid-entry.test.ts` and `saleroom-check-in-panel.test.tsx`. Neither reaches a failed send, so neither can raise the rejection.
- **CI on `c55d8d28` is green:**
  - CI `ci-result`, `build` (with route budgets), all 8 web vitest shards, the api and shop-api shards, `static-checks` and `test`.
  - Web PR browser gates and Account PR browser gates.
  - Art browser gates skipped as not affected.

**Hammer, pass and authorisation: unchanged since the last recheck.**
- The PR's diff under `apps/api` and `packages` is byte-for-byte the same as at `c3de5b83`:
  - Hammer and pass name the lot, with `409 lot_not_on_block` on a mismatch.
  - `requireSaleroomOperate` is on every saleroom route, plus `requireSalesAccess` on check-in.
  - The lot-snapshot route keeps its capability, its uuid param and its 404 for a lot outside the sale.
- No BFF or proxy file changed.
- Check-in still posts through the same-origin `/api/bff/...` with a plain `fetch`, so the BFF origin and same-origin checks apply.
- Nothing resends, so double hammer or double bid stays impossible from the client.

Non-blocking observation:
- `SaleroomPendingSubmit` runs its command inside `startTransition(() => { void (async () => …)() })`, so `pending` drops before the request settles. The button can therefore be pressed again while a request is in flight, despite its doc comment.
- This is the same on `main`, so it is not introduced here.
- The affected commands are state-idempotent on the server.
- Worth an `async` transition in a follow-up.

### To ship
1. Bring `/admin/(platform)/sales/[id]/(detail)/registrations` back to `main`'s start-up JS or lower. It is +320 B with the key pinned. Do the same for the clerk console (+482 B) and the +2 to +9 B shared-runtime growth on 185 other routes, or record an explicit waiver that covers them. Re-measure head against `main` in the same path with `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` pinned for both builds.
2. Correct the PR body:
   - Replace the route-JS table with figures that reproduce.
   - Update the test evidence to the current head, and mention the CI unhandled rejection on `f9dce231` and its fix.

## Final recheck (round 3)

Rechecked head `a848272d` against `main` `a811c33b` (the PR's base) on 2026-11-16. This is a review only. The PR branch was not changed.

**Verdict: SHIP (needs owner route-JS waiver).** All behaviour from rounds 1 and 2 is intact, tests catch regressions in this round's changes, CI is green, and no budget, baseline, ratchet or allowance file changed. One route is reliably above `main`: the registrations tab. The PR body already records the waiver it needs. The clerk console did not come out higher in my builds. The waiver figures should be stated as ranges (see item 1).

### (1) Route JS: the direction reproduces, the exact figures do not

**Method.** This is the same as rounds 1 and 2:
- `next build` in one worktree path (`/home/user/wt-measure`), with `.next` removed before each build.
- Workspace packages built through turbo (`--filter='@auction/web^...'`), and the CI placeholder Sentry DSNs set.
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` pinned.
- Per page route, the start-up set from `scripts/route-js-startup-set.mjs`, with each file gzipped by Node's default `gzipSync` and the sizes summed, as `check-route-js-budget.mjs` does.

**Builds:**
- `main` twice and the head once, all with key 1.
- An empty commit on `main` as the control, with key 1.
- `main` and the head again with a second pinned key (key 2), to check whether the figures depend on the key.

**Noise floor and control:**
- `main` against `main` (key 1): 20 routes the same, 209 lower by 1–5 B.
- `main` against the empty-commit control (key 1): every route lower by 4–9 B. The control confirms the round-2 finding that a new commit SHA alone moves every route by a few bytes, through `main-app`, `webpack` and `84583`.

**Results.** Head against `main`, 229 routes:

| Comparison | Lower | Same | Higher | Clerk console `saleroom/[saleId]` | Registrations | Typical other route |
|---|---:|---:|---:|---:|---:|---:|
| head vs `main` build 1 (key 1) | 228 | 0 | 1 | 519,373 → 519,286 (**−87**) | 758,172 → 758,327 (**+155**) | −16 to −21 |
| head vs `main` build 2 (key 1) | 228 | 0 | 1 | −82 | **+160** | −16 |
| head vs empty-commit control (key 1) | 228 | 0 | 1 | −78 | **+164** | **−12** on 182 routes |
| head vs `main` (key 2) | 228 | 0 | 1 | 519,389 → 519,335 (**−54**) | 758,385 → 758,668 (**+283**) | −15 |
| PR body (its key) | 227 | 0 | 2 | 518,961 → 519,315 (+354) | 758,217 → 758,363 (+146) | −12 |

What reproduces:
- **Registrations is higher, under every key and against every baseline.** It is the only route that is higher in any of my comparisons.
- **The shared-runtime saving reproduces exactly.** Against the empty-commit control, which isolates the commit-SHA effect as the PR does, 182 routes are −12 B, as the body says. The sale-form, inbox and record-tab savings reproduce in direction and size, within a few bytes.
- **No route other than these two grows.** The +2 to +9 B growth on 185 routes from round 2 is gone.

What does not reproduce:
- **The clerk console is lower in all four of my comparisons (−54 to −87 B), not +354 B.**
  - The head's console page chunk is identical under both keys, with the same content hash and 30,402 B gzip. It has no server-action ids left. That matches the body's 30,401 B.
  - The difference is on the `main` side. My `main` console page chunk is 30,296 B (key 1) and 30,269 B (key 2). The body's is 29,863 B.
  - `main`'s chunk holds 15 key-salted `createServerReference` ids (random hex that compresses badly), so it changes with the key. I could not reproduce a key that gives 29,863 B. The body's `main` figure for this chunk may come from a different key or build.
  - Either way, the console is at most +354 B and lower in every build I made.
- **Registrations is +146 to +283 B depending on the key, not a fixed +146 B.**
  - The head's registrations page still holds 3 server-action ids (`main` holds 5), so both sides move with the key.
  - Its page chunk grows by +227 B (key 1) or +349 B (key 2). Before gzip it grows by 331 B (63,010 → 63,341). The two record-tab boundary chunks save 24–27 B, and the shared runtime saves 13–17 B.

**Budget check:** `pnpm check:route-js-budget` passes on the head build (key 2). It prints only ratchet notices for routes below their ratchet.

### (2) Are the remaining bytes needed for the safety behaviour? Yes. No cheap cut is left.

- **Registrations.**
  - `lib/admin/saleroom/check-in.client.ts` is already minimal: one same-origin `fetch`, no shared helpers, no copy of its own, and a single `send` for both calls.
  - What remains is the BFF path, the JSON body, and the result/fallback mapping that the three callers (panel, "Mark present", expected guests) rely on.
  - It replaces two server-action stubs. Those stubs are exactly what crashes door staff after a deploy, so the bytes buy the fix.
  - I found no further reduction worth a fourth round. Any remaining cut would be tens of bytes and would not bring the route to `main` or below.
- **Clerk console.** In my builds it is already below `main`, so nothing needs to come out.
  - The page chunk's growth before gzip is about +1,006 B. That is the BFF transport, the unknown-outcome helper with its context, the lot check, the lot snapshot read with its stale-snapshot guard, and the remount refresh.
  - Each of these maps to an acceptance item from rounds 1 and 2.
  - This round's two cuts are behaviour-neutral and verified below: hammer and pass now get their recheck through the context, and the transport reads the API body inline.

**Lazy-loading the rarely-hit recheck or unknown-outcome path, or the check-in client: correctly rejected, and it would add risk mid-sale.**
- **The size cost is real.** Removing the one async chunk this round cut `webpack` by about 13 B on every route (−12 B net per route against the control). Adding a lazy chunk back would cost about the same on every route, which is more in total than the bytes it would move off the console.
- **The timing is the worst case.** The unknown-outcome path runs right after a command failed or went unanswered, which is when a deploy is most likely to have just landed.
  - A lazy chunk from the old build may then be gone. The `import()` throws a `ChunkLoadError` inside the hold button's async handler.
  - The clerk would then get no "Outcome unknown, checking the room…" message and no recheck, and possibly an error boundary, in the middle of a hammer.
  - That brings back the failure this PR exists to remove.
  - `lib/socket-chunk-recovery.client.ts` exists because this already happens with the socket chunk.
- **The same applies to door check-in.** The tab is open all sale, so the first search after a deploy would fetch a deleted chunk.
- Handling the failed import, by catching it and falling back to a reload, would add bytes and a path that is hard to test, to save about 100–300 B.
- **Recommendation:** keep everything in the start-up chunk and waive the bytes.

### (3) Behaviour from rounds 1 and 2: intact

- **Files unchanged since round 2.** Comparing the PR's diff against its base at `c55d8d28` and at `a848272d`, these are byte-identical:
  - `apps/api`
  - `packages/validators`
  - the BFF route and `lib/bff`
  - `lib/admin/saleroom`
  - `components/admin/staff` (the tab boundary's reload)
  - `clerk-room-recheck.ts`
  - `saleroom-pending-form.tsx`
  - the bid-entry hooks

  So these are unchanged: `lot_not_on_block`, `requireSaleroomOperate` and `requireSalesAccess`, the lot-snapshot route, unknown-outcome on every command, and check-in through the BFF.
- **This round's own commits** (`97916aa7`, `a848272d`; `dfa4363d` is the `main` merge) touch 8 files:
  - **Hammer and pass recheck now comes from `ClerkRoomRecheckContext`.**
    - The console's provider wraps the action bar (`saleroom-clerk-console.tsx:179-288`), and its `recheckRoom` is `router.refresh()` then `await resyncFromServer()`, the same as the removed inline closure.
    - Outside the console the fallback is `router.refresh()`, as for every other command.
  - **Transport body reading is equivalent to `readApiError`/`readApiErrorCode`.**
    - The string `error` and `code` are read the same way. `res.json().catch(() => null)` matches the removed `readJson`.
    - `errorCode: undefined` is now present as a key rather than omitted. No code in `apps/web/src` tests `"errorCode" in`.
  - **Static import of `adminUpdateLotResultAction` in the sale lot editor.**
    - It is the same action and call. It removes one lazily fetched chunk, which also removes one deploy-skew failure.
- **Mutation runs:** each change was applied in a separate worktree, the suites run, then reverted.
  - Hammer and pass ignoring the context, so they only refresh: `lot-outcome-controls.deploy-skew.test.tsx` fails (2).
  - Console recheck without `router.refresh()`: `saleroom-clerk-console.test.tsx` fails (1), through the new "gives its command controls a recheck…" test.
- **Tests:** no test or assertion was removed. The hammer/pass tests only lost the `resync` prop and now render inside the context. No `.skip`, `.todo`, `.fixme` or `dangerouslyIgnoreUnhandledErrors` appears in the PR diff.
- **Suites on head:** web vitest for `features/saleroom`, `saleroom-pending-form`, `saleroom-check-in-panel`, `components/admin/staff`, `lib/admin/saleroom`, `app/api/bff`, `lib/bff` and `components/admin/sale-form`: 71 files, 359 passed, 0 failed.

### (4) CI, budgets and PR body

- **CI on `a848272d` is green:**
  - CI: `ci-result`, `build` (with route budgets), all 8 web vitest shards, both api shards, the 4 shop-api shards, `static-checks` and `test`.
  - Web PR browser gates and Account PR browser gates.
  - Art browser gates and `shop-v1-phase-smoke` were skipped as not affected.
- **No budget, baseline, ratchet or allowance changed.** `git diff a811c33b a848272d` touches nothing under `scripts/` or `.github/`, and no `route-js-*`, `budgets.json` or baseline file. The body says the 1 KB allowance is not used.
- **PR body:**
  - It has "Changes after review" for every round and a "Waiver needed" section that explains why the bytes remain and why the lazy chunk was rejected.
  - It keeps the deploy note: reload every open clerk console and registrations tab once, before the next sale.
  - There is no AI footer or "Generated with" line, and no commit in the PR carries a Claude trailer.
- **E2E stabilization** last ran on `f9dce231`, as the body says. This round's app changes do not alter behaviour on the clerk path, and the unit and mutation coverage above pins them.

### For the owner's waiver

- **`/admin/(platform)/sales/[id]/(detail)/registrations`:** waive about **+150 to +290 B gzip**. The exact figure depends on the server-action key, because the page still holds 3 key-salted action ids. That is about 0.02–0.04 % of the route's 758 KB.
- **`/admin/(platform)/saleroom/[saleId]` (clerk console):** my pinned builds put it 54–87 B below `main`. The body's +354 B did not reproduce. If the owner wants to be safe, waive "up to +354 B". Otherwise no waiver is needed for this route.
- **Every other route is lower** in every comparison.

Optional, not blocking: before merge, reword the body's route-JS figures as ranges ("registrations +146 to +283 B depending on the pinned key; clerk console between −87 and +354 B"), so that the waiver matches what a re-measure will show.
