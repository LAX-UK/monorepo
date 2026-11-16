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
