# Public sale and lot page cache (LAX Bid)

How the public sale (`/sales/:slug/:id`) and lot (`/lot/:slug/:id`) pages cache, what drops the
cache, what has to be true of the deployment for that to work, and what to check when a page shows
something old.

## What is cached, and what is not

- **The HTML is not cached.** It is rendered per request: the root layout reads the visitor's
  session, cookies and CSP nonce into the same HTML. Never add a route-level `revalidate`,
  full-route caching or a CDN rule for `/sales/*` or `/lot/*`; one visitor's layout would be served
  to others. `apps/web/src/lib/cache/public-page-session-free.test.ts` fails if a route segment or
  a layout above it exports something that caches the HTML.
- **The session-free API reads behind the pages are shared** in the Next.js Data Cache
  (`apps/web/src/lib/data/http/public-catalogue.server.ts`), each under the tag of the lot or sale
  it shows (`public-lot:<id>`, `public-sale:<id>`), with a 60 s fallback window.
- **Live bid state is never drawn from those reads.** On the lot page, the current price, the next
  bid, the status badge, the close time and countdown, the bid history and the leading bidder are
  placeholders in the HTML (same size, no layout shift). They are filled in the browser from a
  no-store read (`/lots/:id`, `/lots/:id/bids`, `/lots/:id/bid-history`) and the socket. The bid
  button stays disabled, and no countdown or time announcement starts, until that first live read
  lands. If it fails, the placeholders stay and the read is retried; nothing falls back to the
  cache.
- **Sale catalogue cards** are drawn with placeholders for the price line, the status pill, the
  close and the bid action. On mount the browser repeats the same catalogue page reads
  (`/sales/:id/lots?limit&offset&sort`) no-store, fills the cards, and reads them again every
  minute while the page is visible. A bid therefore no longer needs to drop the sale's cached reads.
- **The lot page's "More from" rail** works the same way: its cards (estimate, title, image) come
  from the cache, but the price, its label and the close are placeholders at their final size. On
  mount the browser reads each card's sale catalogue (the first page, no-store, the read the sale
  cards use) and fills them. The rail's data carries no bid state. A card the read does not return
  (a lot beyond the first page of its sale) keeps its placeholder.
- **What is personal** (watching, your bids, registration, telephone booking) comes from
  `/api/sales/:id/me` and `/api/lots/:id/me` in the browser (`private, no-store`).

## What drops the cache

The API and the worker call `POST /api/revalidate` on web with the tags to drop
(`WEB_REVALIDATE_URL`, `WEB_REVALIDATE_SECRET`, the same secret on api, worker and web, at least 32
characters). Tag names and event lists live in `packages/domain/src/public-page-cache.ts`.

| Change | Sent by | Tags dropped |
| --- | --- | --- |
| Accepted bid, extension | API / worker bidding sender, after commit | `public-lot:<id>` only |
| Lot end (timed close, hammer, no sale) | same | `public-lot:<id>`, `public-sale:<sale>` |
| Lot events (created, published, unpublished, activated, ended, cancelled/withdrawn, voided, attached/detached, deleted, returned to inventory, re-awarded) | worker `web_public_cache` projector | the lot, its sale (and the sale it left), `catalogue-lots` |
| Sale events (published, unpublished, cancelled, rescheduled, ended, deleted, test flag, lot premiums reset) | worker projector | the sale, `catalogue-sales`, `catalogue-lots`; a premium reset also each reset lot |
| Staff edit of a lot (details, marketing details) | web server action | the lot and the sale(s) it was and is in |
| Staff edit of a sale | web server action | the sale |
| Staff attaches or removes a document | web server action | the lot or the sale |

A bid drops the lot alone: nothing a bid changes is drawn from the sale's cached reads, and
dropping the sale on every bid emptied a busy sale's catalogue at its peak.

The domain event list is the catalog's own (`WEB_PUBLIC_CACHE_EVENT_TYPES` in
`packages/types/src/domain-event-catalog/registry.ts`); add an event there and both the projector
routing and the tag mapping follow.

## Deployment requirements while this design is in place

1. **Web runs as a single instance.** Each Next.js instance keeps its own Data Cache, and
   `revalidateTag` (from `POST /api/revalidate` or a staff server action) drops tags only on the
   instance that handled it. With two or more web replicas behind the load balancer, the others
   keep serving the old reads until their window runs out. Before scaling web out, do one of the
   follow-ups below first. Scaling web out without one of them is a regression in how fresh public
   pages are, not just a performance change.
2. **`INTERNAL_API_URL` is set in production**, pointing at the API directly (not through the CDN).
   The refetch after a purge must reach the API. The API also sends `Cache-Control: public,
   no-cache` for single lot and sale reads (`/lots/:id…`, `/sales/:id…`), so a CDN may store them
   but must check each time; the catalogue lists keep `s-maxage=30, stale-while-revalidate=60`.
3. **`WEB_REVALIDATE_SECRET` is the same on api, worker and web.** Unset on web, the route answers
   404 and the projector reports each batch as refused (see below).

## How stale can a page be

- **Bidding fields** (price, next bid, status, close time, history, leader): never from the cache.
  The page corrects them as soon as the live read lands.
- **Catalogue text** (title, images, estimate, description, documents, schedule shown on cards):
  normally as fresh as the purge, which is sent right after the change commits. When a purge is
  missed (web unreachable past the worker's retries, a second web instance, a refused batch), the
  fallback is Next's time-based revalidation, which is stale-while-revalidate: the first request
  after the 60 s window still gets the stale entry and triggers a background refresh; the request
  after that gets the new one. So the bound on a missed purge is **60 s after the first request
  that follows it**, not 60 s of wall-clock time. A page nobody opened for hours shows the old text
  once, to its next visitor.

## The worker projector (`web_public_cache`)

- A batch of up to 200 events is sent as one request (split into requests of 50 tags).
- A tag the web route would refuse (an id outside `[A-Za-z0-9_-]{1,64}`) is dropped before sending
  and logged as `web_public_cache_tags_dropped` (error level).
- **Transient failure** (web unreachable, 5xx, 408, 429): the cursor stays and the batch is sent
  again next tick; log `web_public_cache_invalidate_failed` (warn). Once the batch's oldest event is
  15 minutes old, each failure is also reported to Sentry (`projector=web_public_cache`,
  `outcome=cursor_lagging`).
- **Permanent refusal** (any other 4xx: a refused tag, a wrong secret, the route not configured):
  log `web_public_cache_batch_rejected` (error), report to Sentry (`outcome=batch_rejected`),
  record `Skipped events <from>..<to>` in `projector_state.last_error`, and move past the batch.
  It never blocks the purges after it. The reads it would have dropped expire on their own window.

### When a Sentry `batch_rejected` or `cursor_lagging` fires

1. Check the web logs for `POST /api/revalidate` answers around that time. 404: the secret is unset
   on web. 401: the secrets differ. 400: a tag the route refused (look at the event ids in the
   report). 429: the per-caller limit was reached.
2. Fix the configuration. Nothing needs replaying: pages refresh on their window, and a staff edit
   or the next event for the item drops it again. To refresh one item at once, make and undo a
   harmless staff edit on it.

## Known limits of the "no bid state in the page" rule

These still render from the cached sale reads and are dropped by lot-end and sale events, not by
bids:

- The sale hero's count of live lots, and the catalogue's status filter chips and counts (which
  lots are listed under "live", "upcoming" or "ended").
- The highlights of an ended sale (sold works and their prices). These are results, dropped when
  each lot ends.
- An ATG-owned sale's cards, which show where to bid or the ATG result (not LAX bid state).
- The room-only (onsite) lot layout's hero, which has no web bidding.

## Follow-ups

- **Purge every web instance** before web runs more than one replica: either a shared Next.js
  `cacheHandler` (for example on Redis) so `revalidateTag` applies everywhere, or a fan-out of each
  purge to every instance. Until then, requirement 1 above stands.
- Coalesce bid purges in the invalidator (collect tags for 1-2 s, send one request) if a closing
  burst ever approaches the web route's per-caller limit.
