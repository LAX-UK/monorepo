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
