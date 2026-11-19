# thelax.art → lax.art SEO migration

Moves the search equity of `thelax.art` / `www.thelax.art` to `https://lax.art` (the Art app,
`apps/art`). Every old URL answers **one permanent redirect (301)** straight to its final lax.art
URL. This runbook covers the redirect list, the Search Console move and three months of
monitoring. The earlier same-host cutover (legacy CMS → Art app on `www.thelax.art`) is in
[thelax-seo-migration.md](./thelax-seo-migration.md); its inventory and redirect map are the inputs
here.

## How the redirects work

| Piece | Where |
| --- | --- |
| Data file (single source) | `apps/art/src/lib/seo/thelax-art-redirects.json` |
| Resolver | `apps/art/src/lib/seo/thelax-art-redirects.ts` |
| Wiring | first rule in `apps/art/src/middleware.ts` |
| Tests | `apps/art/src/lib/seo/thelax-art-redirects.test.ts` |
| Generator | `scripts/seo/build-thelax-art-redirects.mjs` |

For a request whose public host (`X-Forwarded-Host`, then `Host`) is `thelax.art` or
`www.thelax.art`:

1. A URL listed in the data file goes to its `to` route on lax.art. `utm_*` and `gclid` are kept;
   old CMS parameters (`?word=`, `?page=`) are dropped. Matching ignores case and a trailing slash.
2. Otherwise an old media path (`/uds/…`) goes to its imported copy, using the legacy map.
3. Anything else keeps its path and query on lax.art (Art routes already served on
   `www.thelax.art`, shared links and so on).

A target that is itself a retired Art page (for example `/prints`, now LAX Shop) is followed in
the same hop, so there are no chains. Every other host (`lax.art`, `test.thelax.art`, preview and
App Platform hosts) is untouched.

**Safety gate:** the rule stays off while `LAX_ART_PUBLIC_URL` is itself a thelax.art host. It
only starts redirecting once production `art` has `LAX_ART_PUBLIC_URL=https://lax.art`, so a
deployment that has not moved can never redirect to itself. `lax.art` is in
`ART_PRODUCTION_HOSTS`, so the destination is indexable.

Paths that App Platform routes to `art-identity` on `www.thelax.art` (`/login`, `/logout`,
`/register`, `/auth`, `/api`, `/me`, `/commerce`) never reach this middleware; those are
sign-in endpoints, not indexed pages, and are covered by the edge rule in the cutover step.

### Data file rows

```json
{ "from": "/collection/4-utopia.html", "to": "/artworks/4-utopia",
  "type": "artwork", "title": "Utopia.. : Deborah Jones", "match": "exact" }
```

- `type`: `artwork`, `artist`, `post` (stories), `category` (artist series and
  style/technique/period pages), `page`. The old site had no exhibition, tag or indexed media URLs
  in its sitemap; media redirects come from the legacy map once the production import has run.
- `match`: `exact` (same content on lax.art), `best-match` (closest related page),
  `no-equivalent` (nearest section page; the home page only when nothing else fits).
- `title`: as crawled; `null` for policy aliases the old site answered but did not list.

### Regenerating

The rows are built from the committed crawl (`docs/seo/legacy-thelax-inventory.json`) and the
importer's map (`apps/art/src/lib/seo/legacy-redirects.json`). After a re-crawl or re-import:

```bash
node scripts/seo/build-thelax-art-redirects.mjs
pnpm exec biome format --write apps/art/src/lib/seo/thelax-art-redirects.json
pnpm --filter @auction/art test -- thelax-art-redirects
```

The tests fail if a row is malformed, a URL appears twice, the stated counts are wrong, a target
is not a live Art route, a redirect chains or loops, a row disagrees with the legacy map, an
inventory URL has no row, or anything other than `/site-map` lands on the home page.

To change one mapping, change it in `legacy-redirects.json` (or the importer's
`LEGACY_PATH_OVERRIDES`) and regenerate, so the two files agree.

## Redirect list stats

Source: crawl of 2026-10-12 (996 sitemap URLs plus nav-only pages), 1,007 rows.

| Type | Rows | Exact | Best match | No equivalent |
| --- | ---: | ---: | ---: | ---: |
| artwork | 598 | 598 | 0 | 0 |
| artist | 45 | 45 | 0 | 0 |
| post (story) | 116 | 116 | 0 | 0 |
| category (series, style, technique, period) | 178 | 0 | 155 | 23 |
| page | 70 | 34 | 35 | 1 |
| **Total** | **1,007** | **793** | **190** | **24** |

- **Best match:** artist series → the artist's page (73); style/technique/period pages →
  collector-hub guides (82); glossary letter pages → `/collector-hub/glossary` (26); old listings
  (`/all-collections`, `/collections`, `/art-prints`, `/artist`, `/art-news`…) → the matching
  catalogue or hub page; `/prints` → LAX Shop; `/prev-auction` → `https://lax.bid/archive`.
- **No equivalent:** 23 series with no known artist → `/artworks`; `/site-map` (the old HTML
  index) → `/`.

Check the counts with:

```bash
node -e 'console.log(require("./apps/art/src/lib/seo/thelax-art-redirects.json").counts)'
```

## Cutover

Prerequisites (outside this repo, owned by platform engineering and the LAX marketing owner):

- Search Console: `lax.art` Domain property verified by DNS, alongside the existing
  `thelax.art` properties; same owner account on both.
- Production `art`: `LAX_ART_PUBLIC_URL=https://lax.art`; `shop-api`, `account` and `auth` origins,
  the `lax-art-web` OIDC redirect URIs and the Stripe branding URL moved to lax.art in the same
  release (see [lax-art-production-launch.md](./lax-art-production-launch.md)).
- Cloudflare: remove the `lax.art → www.thelax.art` edge rule **before** the app redirects
  `thelax.art → lax.art`, or the two hosts loop. Point `lax.art` at the `art` app.
- Keep `thelax.art` and `www.thelax.art` pointed at the `art` app (or an edge rule that forwards
  the full path), with valid TLS, for at least 12 months; never let the domain lapse.

Launch:

1. Deploy with the new env. Spot-check:
   `curl -sI https://www.thelax.art/collection/4-utopia.html` → `301` to
   `https://lax.art/artworks/4-utopia`;
   `curl -sI https://thelax.art/about-us` → `301` to `https://lax.art/collector-hub/about-us`;
   `curl -sI https://lax.art/` → `200`, no `X-Robots-Tag: noindex`.
2. Run every row through the live redirect and confirm one hop to a `200`:
   `pnpm seo:verify-legacy-redirects -- --base-url https://www.thelax.art --canonical-origin https://lax.art`
   (fix any failure before step 3).

### Search Console Change of Address

Do this on the day the redirects go live.

1. Open the **old** property (`thelax.art` Domain property, or `https://www.thelax.art/` if no
   Domain property) → **Settings → Change of address**.
2. Choose the new site, `lax.art`, from the list (it must be verified by the same owner).
3. Let the pre-move checks run: they test that the home page and a sample of pages 301 to the
   new site. Fix anything they flag, then **Validate & update**.
4. Repeat for the `https://www.thelax.art/` URL-prefix property if it is separate.
5. Leave the request in place; Google forwards signals for 180 days. Do not remove the old
   properties.

In Bing Webmaster Tools, use **Site Move** on the `thelax.art` site (if verified there) and
point it at `lax.art`.

### New sitemap submission

1. In the `lax.art` property, **Sitemaps** → submit `https://lax.art/sitemap.xml`.
2. Also submit `https://lax.art/legacy-sitemap.xml` (old-shaped URLs) so Google recrawls them
   and sees the redirects.
3. Keep the old property's sitemaps in place for a few weeks; once its URLs show as
   *Page with redirect*, remove them.
4. `https://lax.art/robots.txt` must list both sitemaps and allow crawling.
5. URL-inspect the top 20 old URLs by clicks (gold list) on the new host and **Request
   indexing**.
6. Submit `https://lax.art/sitemap.xml` in Bing Webmaster Tools.

## Monitoring (3 months)

Daily for the first two weeks, then weekly until three months after launch. Record each check in
the migration ticket.

| Check | Where | Watch for |
| --- | --- | --- |
| Clicks and impressions | Search Console → Performance, old and new property side by side | combined clicks below 60% of baseline for 7 days |
| Indexing | `lax.art` → Pages | rising *Not found (404)*, *Soft 404*, *Redirect error*, *Duplicate without user-selected canonical* |
| Old URLs | `thelax.art` → Pages | count of *Page with redirect* growing, indexed pages falling |
| Change of Address | old property → Settings | status still active, no warnings |
| Crawl health | `lax.art` → Settings → Crawl stats | 5xx, host problems, response time above the pre-move baseline |
| Misses | `art` runtime logs, `legacy_redirect_miss` | real old URLs not in the data file |
| Redirect health | `pnpm seo:verify-legacy-redirects` (weekly) | any non-301 or multi-hop answer |
| Backlinks | Search Console → Links on both properties | top linking sites still pointing at thelax.art |

When a real old URL is missing: add it to the legacy map (or importer override), regenerate
the data file, ship it in one PR. Scanner noise (`/wp-login.php`, random `.php`) needs no
mapping; it lands on a lax.art 404.

Ranking dips for a few weeks are normal. Fix forward. Escalate if combined Search Console clicks
stay more than 40% below baseline for 7 consecutive days with no mapping, 5xx or indexing cause.

After three months:

- Email the owners of the top linking domains with the new URLs.
- Keep the redirects and the `thelax.art` domain for at least a year (indefinitely if possible).
- Remove `legacy-sitemap.xml` from Search Console once its URLs show as *Page with redirect*.

## Limits of this list

- Built from the 2026-10-12 crawl. A fresh crawl was not possible from the build environment;
  run `pnpm seo:crawl-legacy --refresh` against the live site before cutover and regenerate if
  URLs changed.
- URLs only Google or other sites know about (not in the sitemap) need the gold list from
  [thelax-seo-migration.md](./thelax-seo-migration.md#05-gold-list); unknown paths still move
  host with their path kept, so they at worst reach a lax.art 404, never a chain.
