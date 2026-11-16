Verdict: FIX FIRST

# Review of PR #1496: Live sale: leader label, closed-lot banner, signed-out saleroom status, live hero badge

Reviewed head `fbc15554` against base `46c9bdac` (main). Review only; the PR branch was not changed.

The security change is sound. The four fixes are correct, and each has a test that fails without it.
Two things block merge. Every tracked route ships more JS than main, because the new ended-lots
module goes into the shared frame. The before/after screenshots the PR says are needed are also
still missing.

## Blocking

1. **Route JS is higher than main on every tracked route.** CI `build` for this PR
   (job 133233246823) compared with main's merge-queue `build` at the same base `46c9bdac`
   (job 133192743466):

   | Route | main | PR | Δ |
   |---|---|---|---|
   | Home | 394.5 KB | 394.8 KB | +0.3 |
   | Sales list | 442.8 KB | 443.1 KB | +0.3 |
   | Sale page | 478.8 KB | 479.1 KB | +0.3 |
   | Lot page | 467.4 KB | 467.8 KB | +0.4 |
   | About | 344.9 KB | 345.2 KB | +0.3 |
   | Terms | 341.9 KB | 342.2 KB | +0.3 |
   | shared frame | 337.3 KB | 337.6 KB | +0.3 |

   The growth is in the frame, so every page pays it.
   Cause: `apps/web/src/hooks/use-bid-attention.ts:10` now imports
   `@/lib/navigation/ended-lots` (`useSyncExternalStore` store plus `withoutEndedLots`).
   `useBidAttention` is reached statically from the frame through `BidBottomTabBar`
   (`apps/web/src/components/layout/bid-bottom-tab-bar.tsx:4`, imported by `bid-site-chrome.tsx:2`).
   The ratchet still passes, but the bar for this review is equal to or lower than main.
   Possible fixes, smallest first:
   - Leave the frame alone. Filter ended lots only in the lazily loaded chip
     (`bid-attention-prompt-chip.tsx`, already dynamic via `bid-attention-prompt.tsx:14`) and in the
     lot page, which already loads `LotRealtimeProvider`.
   - Or, on `lotEnded`, invalidate or refetch the existing account-menu context instead of keeping a
     second store. That adds no module to the frame.

2. **Screenshots are missing.** The PR body says the 1440/375 light/dark before/after shots for
   (b), (c) and (d) were not taken. The only visual change is the hero badge (`Live now` replacing
   `Opens …`). It reuses the existing `active` badge tone, so a regression is unlikely. Still, it
   must be checked at 1440 and 375, in light and dark, on test before merge, along with the
   signed-out sale page with no warning banner and the lot page with the chip cleared after close.

## Non-blocking

- **The ended-lot mark ignores which lot the event names.** `apps/web/src/lib/context/lot-realtime-provider.tsx:54`
  calls `markLotEnded(lotId)` with the provider's own `lotId`, not `p.lotId` from the event. The socket
  is a per-tab singleton and the `lotEnded` listener (`lib/realtime/socket-adapter.ts:79`) is not
  scoped to a room. If anything else on the page joins another lot room, that lot's close would clear
  this lot's outbid prompt. Today the lot page joins only its own room, so this is latent. Use
  `markLotEnded(p.lotId)` (it is already parsed in `asLotEnded`), or check that `p.lotId === lotId`.
- **No test covers the provider wiring.** `use-bid-attention.test.tsx` calls `markLotEnded`
  directly. Reverting the `lot-realtime-provider.tsx` change on its own leaves every test green.
  Add a provider test: a `lotEnded` sent through a fake realtime port leads to `useEndedLotIds()`
  containing the lot.
- **The `outbidLots` trim drops the wrong entries.** `apps/web/src/lib/navigation/ended-lots.ts:53-55`
  keeps the first `n - closed` entries. The list is "soonest first", and the closed lot is usually
  the soonest, so the wrong labels survive. Today every consumer reads only `.length`
  (`client-attention.ts:67,109,132`, `bid-bottom-tabs.ts:30`), so nothing shows wrong yet. Either
  filter by lot, or document that only the count is meaningful.
- **Leader-label copy is inline.** `apps/web/src/hooks/use-clerk-lot-live-price.ts:28,37,46`
  (`"Online bidder"`, `` `${channel} bidder` ``) sits in the hook, not a copy file. The older
  `Paddle N` string there is pre-existing. This is a staff-only surface, so it is not blocking.
  Move it to a copy module alongside `formatBidChannelLabel` to match the rest of the PR, which put
  the hero copy in `saleroom-hero-copy.ts:85`.
- **A paused saleroom reads "Live now".** `resolveSaleroomHeroBadge` (`saleroom-hero-copy.ts:96`)
  uses `isSaleroomSessionActive`, which covers live and paused. The live-trailing text in the same
  file uses `isSaleroomSessionLive` (live only, `saleroom-hero-copy.ts:29`), and the live lot banner
  has its own paused state (`saleroom-live-lot-banner.tsx:53`). Both read the same `liveSession`, so
  the data source matches as required. The wording differs, though: a paused sale shows a "Live now"
  badge next to a paused banner. Product should confirm this is intended.
- **The ended set never empties during a session.** If staff reopen a lot after `lotEnded` (for
  example a voided hammer), its outbid prompt stays hidden until a full reload. This is rare; a short
  comment would do.
- **One claim in the PR text is not accurate.** It says "Every other path is unchanged and still
  requires a session". In fact the BFF already forwards a request with no session cookie at all to
  the API with no credential (`bid-api-session.server.ts`, the `!sessionId` branch). The API's own
  auth middleware is the real gate, and that is unchanged by this PR. The new test
  `still requires a session for other sale reads` covers only the "stale or not-yet-authenticated
  session cookie" case. Reword it so nobody later relies on the BFF as the auth boundary. Separately,
  and pre-existing (not this PR): it is worth confirming the API intends to serve
  `GET /sales/:id/bidders` without auth (`apps/api/src/routes/sales/read.routes.ts`). It returns
  masked names only.

## Verified

**Security (BFF route, `apps/web/src/app/api/bff/[...path]/route.ts:53-82`, `lib/bff/proxy-policy.ts:46-51`)**

- **Exact allowlist.** The anonymous retry runs only when (a) the token exchange failed with
  `BidBffSessionRequiredError`, and (b) `isPublicSaleReadPath` matches GET/HEAD plus exactly
  `sales/<id>/lots` (3 segments) or `sales/<id>/saleroom/status` (4 segments). There are no prefix,
  suffix or regex matches, so `sales/x/lots/y`, `sales/x/bidders`, `sales/x/catalog-admin` and
  similar do not match.
- **Order of checks.** `isApprovedProxyPath` runs first (`route.ts:30`) and rejects empty, `.`,
  `..`, and segments holding `/` or `\`. Encoded slashes and traversal therefore never reach the
  public-path check. The target URL re-encodes each segment (`encodeURIComponent`).
- **Methods.** POST/PUT/PATCH/DELETE never match. Identity outages (`BidBffIdentityUnavailableError`,
  Redis, refresh lock) still return 503, not anonymous. OPTIONS is not exported. Method-override
  headers are not in the forwarded request-header allowlist.
- **No credential on the retry.** `send(null)` makes `fetchBidApiAsSession` send without an
  `authorization` header (the `!sessionId` branch). The test asserts no `authorization` header.
- **Nothing new reachable.** A visitor with no cookie could already reach both endpoints without a
  credential before this PR. The change only treats a stale or not-yet-authenticated session the
  same way on these two paths.
- **Upstream is public by design.** `GET /sales/:id/saleroom/status` has no auth middleware and
  returns `getPublicSessionStatus` (`apps/api/src/routes/sales/read.routes.ts:33`).
  `GET /sales/:id/lots` uses `optionalAuth`. Its result depends only on role and staff roles, never
  on user id (`catalog-sale-read-http-application.service.ts:207-222`, `listSaleLotsPageForPublicApi`).
  An anonymous caller therefore gets the public catalogue view, with no reserve, bidder identity or
  user id beyond what a cookieless visitor already gets.
- **Caching.** The API sets `public, no-cache` only when no user is on the request
  (`apps/api/src/middleware/public-cache-control.ts`), so anonymous copies must be revalidated. The
  BFF fetches upstream with `cache: "no-store"` and forwards only allowlisted response headers. The
  anonymous and signed-in bodies for these two paths differ only for staff (unpublished lots), and a
  revalidation against a different ETag returns a fresh 200. There is no new path by which a
  signed-in response could be served to an anonymous caller.

**Fixes and tests.** Each new test was run against main's source, keeping only the new
`ended-lots.ts` so imports resolve, and then against the PR's source.

| Fix | Test | main source | PR source |
|---|---|---|---|
| (c) anon saleroom status / lots | `route.test.ts` 2 new cases | fail (401) | pass |
| (b) chip clears on `lotEnded` | `use-bid-attention.test.tsx` "clears the outbid prompt…" | fail | pass |
| (d) hero badge `Live now` (live, paused) | `saleroom-hero-meta-row.test.tsx` | fail | pass |
| (a) leader label | `use-clerk-lot-live-price.test.ts` | fail (helper missing; old code rendered the 8-char id prefix) | pass |

- **(a)** With no roster match, the label is the channel name or `Online bidder`. The raw-id slice is
  removed. The test asserts the id prefix never appears. `resolveLeaderLabel` is used only by the
  clerk panel (`useClerkLotLiveBidState`). The public display (`/display/[saleId]`) does not use it,
  so the public display gains no bidder name or paddle data.
- **(b)** The ws bridge emits `lotEnded` alongside `lot.closed` for every `lot_ended` message
  (`apps/ws/src/services/redis-bridge.ts:134-140`). The clerk hammer and no-sale paths finalize
  through the lot lifecycle, which publishes `lot_ended`. The web listens on `lotEnded`, so both
  closing paths are covered.
- **(d)** The badge and the live-trailing text use the same `liveSession`
  (`saleroom-hero-editorial.tsx:47`: live-socket value, falling back to the server-read session).
  Copy is in `saleroom-hero-copy.ts:85`.
- **Local test runs.** Web unit tests over the affected areas (`src/hooks`, `src/lib/navigation`,
  `src/lib/bff`, `src/app/api/bff`, `src/components/sections/saleroom`, `src/lib/context`,
  `src/lib/saleroom`, `src/components/layout`, `src/lib/realtime`, `src/components/marketing`):
  194 files, 1260 passed, 10 skipped, 0 failed. The full web suite did not finish within the
  10-minute local limit.
- **CI.** All 38 checks on the head are green or skipped, including web vitest 1-8/8, api vitest,
  static-checks, build (route-JS ratchet ok) and browser-gates.

## Final recheck

Rechecked head `0f151520` (7 commits; base `618ab329`, which adds only a docs commit to `46c9bdac`).
Review only. The PR branch was not changed.

**Still FIX FIRST.** The code is ready. Every code item from the first review is fixed, route JS
is back to main or below, and CI is green. Two of the required items are still open: no
screenshots are committed, and the PR body has not been updated (no "Changes after review"
section, and the inaccurate claim is still there).

### Blocking items

1. **Route JS: fixed.** CI `build` on `0f151520` (job 133297233596) compared with main's build at
   `46c9bdac` (job 133192743466). `618ab329` is a docs-only commit, so the comparison holds.

   | Route | main | PR now | Δ |
   |---|---|---|---|
   | Home | 394.5 KB | 394.5 KB | 0 |
   | Sales list | 442.8 KB | 439.1 KB | −3.7 (from main changes merged in, not this PR) |
   | Sale page | 478.8 KB | 478.8 KB | 0 |
   | Lot page | 467.4 KB | 467.3 KB | −0.1 |
   | About | 344.9 KB | 344.9 KB | 0 |
   | Terms | 341.9 KB | 341.9 KB | 0 |
   | shared frame | 337.3 KB | 337.3 KB | 0 |

   The +0.3 KB frame growth is gone. `hooks/use-bid-attention.ts` is no longer changed.
   `ended-lots.ts` is now imported only by the lazily loaded `bid-attention-prompt-chip.tsx` and by
   `bid-header-signed-in-account.tsx`. The lot page signals a close with a plain window event
   (`lax:lotEnded`) and does not import the store. No budget or ratchet file is in the diff.
2. **Screenshots: NOT fixed.** No image files are in the diff, and the PR body still says the
   1440/375 light/dark before/after shots were "not attached" and asks for them "before merge". Still
   required: the hero `Live now` badge (live, and paused), the signed-out sale page with no "Could not
   refresh saleroom status" banner, and the lot page with the outbid chip cleared after close. Each
   at 375 and 1440, in light and dark, committed or attached to the PR.

### Non-blocking items

- **Event lot id: fixed.** `lot-realtime-provider.tsx` now announces `p.lotId` from the event, not
  the provider's own `lotId`. Mutation M2 below catches a regression.
- **Provider wiring test: fixed.** The new `lot-realtime-provider.test.tsx` sends `lotEnded` through
  a fake realtime port. It also checks that the hard-coded event name matches `LOT_ENDED_SIGNAL`.
- **`outbidLots` trim: fixed.** It now filters by `outbidLotIds`, so the remaining labels stay with
  their lots. Payloads without ids fall back to a count-only trim, and a comment says so.
  `ended-lots.test.ts` covers this (M7).
- **Leader-label copy: fixed.** It moved to `lib/bid/bid-channel-label.ts`
  (`formatChannelBidderLabel`, `formatPaddleBidderLabel`), with tests.
- **Paused reads "Live now": addressed.** This is now deliberate and documented on
  `isSaleroomHeroLiveNow` (the live lot banner shows the paused state). Product sign-off would still
  be good, but it does not block.
- **Ended set never empties: addressed.** There is a comment in `ended-lots.ts`.
- **Inaccurate PR text: NOT fixed.** The body still says "Every other path is unchanged and still
  requires a session". It also still lists `hooks/use-bid-attention.ts` under (b), but that file is
  no longer changed, and it does not mention `ended-lots.ts` moving out of the frame or
  `lib/realtime/lot-ended-signal.ts`. There is no "Changes after review" section.

### Security (re-verified on the new head)

- `proxy-policy.ts` and `route.ts` are byte-for-byte the same as at `fbc15554`. The anonymous retry
  is still limited to GET/HEAD and exactly `sales/<id>/lots` or `sales/<id>/saleroom/status`. It
  runs only after a session-required token-exchange failure, after `isApprovedProxyPath`, with no
  `authorization` header. Identity outages still return 503. The allowlist has not been widened.
- Both upstream endpoints serve public data with no per-user fields (see "Verified" above). The
  API's `public, no-cache` only applies when no user is attached, and the BFF uses `no-store`.
- The new window event carries only a lot id, and the store ignores anything that is not a string.
  A page script sending a fake event can only hide this browser's own outbid prompt until reload.
  No data or request goes anywhere.

### Tests and mutation checks

Run locally on `0f151520`:

- Touched web suites (`src/app/api/bff`, `src/lib/bff`, `src/lib/navigation`, `src/lib/context`
  provider test, `src/lib/realtime`, `src/components/sections/saleroom/hero`,
  `src/components/sections/lot-page`, `bid-attention-prompt-chip.test.tsx`,
  `use-clerk-lot-live-price.test.ts`, `bid-channel-label.test.ts`): 56 files, 533 passed, 0 failed.
- `tsc -p apps/web/tsconfig.json --noEmit` passes (after building `@auction/api` so that
  `@auction/api/app` types resolve).

| # | Mutation | Suite | Result |
|---|---|---|---|
| M1 | provider stops sending `lax:lotEnded` | `lot-realtime-provider.test.tsx` | 2 fail |
| M2 | provider announces its own `lotId` | `lot-realtime-provider.test.tsx` | 1 fail |
| M3 | chip uses unfiltered `useBidAttention()` | `bid-attention-prompt-chip.test.tsx` | 1 fail |
| M4 | `route.ts` reverted to main | `src/app/api/bff` | 2 fail |
| M5 | hero copy, meta row and editorial reverted to main | `saleroom/hero` | 2 fail |
| M6 | `use-clerk-lot-live-price.ts` reverted to main | `use-clerk-lot-live-price.test.ts` | 4 fail |
| M7 | `outbidLots` trimmed by index, not by id | `ended-lots.test.ts` | 1 fail |
| M8 | account dot uses unfiltered `useBidAttention()` | `src/components/layout` | **all pass** |

M8 is a small gap that does not block. Nothing tests that the header account dot clears when a
lot closes. A one-case test in the signed-in account suite would close it.

### CI

38 checks on `0f151520`: all success or skipped. That includes `ci-result`, web vitest 1–8/8,
api vitest, `static-checks`, `build` (route-JS check ok) and `browser-gates`.

### To ship

1. Commit or attach the screenshots listed in blocking item 2.
2. Add a "Changes after review" section to the PR body. Correct the "still requires a session"
   sentence (the API's auth middleware is the real gate; the BFF forwards cookieless requests
   without a credential), and update the file list for (b).
3. Optional: add the M8 test.
