# www.thelax.art SEO-safe migration

Moves www.thelax.art's search traffic from the legacy CMS to the new Art app
(`apps/art`) on the **same host**. Only URLs change, so the work is: import every
legacy page, 301 every legacy URL once to its closest new page, reach SEO parity, verify
before cutover, and monitor afterwards.

Owners: platform engineering (tooling, redirects, deploy) and the LAX marketing owner
(Search Console, GA4, Cloudflare, backlink outreach).

| Phase | What | Tooling |
| --- | --- | --- |
| 0 Baseline | Owner exports + crawl + gold list | `pnpm seo:crawl-legacy`, `pnpm seo:gold-list` |
| 1 Inventory | Every legacy URL with status and SEO surface | `docs/seo/legacy-thelax-inventory.json` |
| 2 Import | Content into shop-api, redirect map out | `pnpm --filter @auction/shop-api import:legacy-thelax` |
| 3 Parity | Redirect middleware, indexing gate, JSON-LD, GA4 | `apps/art` |
| 4 Verify | Redirect + parity checks against staging | `pnpm seo:verify-legacy-redirects` |
| 5 Cutover | DNS, sitemaps, monitoring, rollback | this runbook |

## Phase 0 — Baseline (before any code ships)

Do this while the legacy site is still live. Store exports in the shared drive folder
`SEO / thelax-migration / baseline-<date>`; **never commit raw exports** (they can contain
query data). Only the derived gold list is committed.

### 0.1 Search Console (needs owner access)

For both properties — `https://www.thelax.art/` (URL prefix) and `thelax.art` (Domain):

1. **Performance → Search results**, date range *Last 16 months*, tab **Pages** →
   Export → CSV. Save as `gsc-pages-<property>.csv`.
2. Same report, tab **Queries** → Export. Save as `gsc-queries-<property>.csv` (used to
   spot-check rankings after cutover; not an input to the gold list).
3. **Links → Top linked pages (external)** → Export. Save as `gsc-top-linked-pages.csv`.
4. **Indexing → Pages** → Export both *Indexed* and *Not indexed* lists.
5. **Settings → Crawl stats** → screenshot host status and average response time (the
   new app must match or beat it).

### 0.2 GA4 (needs owner access)

Property with measurement ID `G-YGZCF5FD67`: **Reports → Engagement → Landing page**,
filter *Session default channel group = Organic Search*, last 12 months → Share → Download
CSV. Save as `ga4-organic-landing-pages.csv`.

### 0.3 Backlinks (optional, recommended)

Ahrefs *Best by links* or Semrush *Indexed pages* for `thelax.art` → CSV
(`backlinks-best-by-links.csv`). Search Console's link report is sampled; a third-party
export catches more linked URLs.

### 0.4 Crawl and back up the legacy site

```bash
pnpm seo:crawl-legacy            # ~2 min; caches HTML in .tmp/seo/html
```

This fetches `https://www.thelax.art/sitemap.xml` (996 URLs at baseline) plus
nav-only pages, then writes:

- `docs/seo/legacy-thelax-inventory.json` (committed): status, title, description,
  canonical, robots, H1, `og:image` and content image URLs per legacy URL;
- `.tmp/seo/legacy-thelax-export.json` (not committed): normalised content for the
  importer (artists, artworks incl. sold, series, taxonomy pages, stories, pages).

Also save a copy of the raw `sitemap.xml` and, if the legacy host keeps them, 30 days of
access logs to the baseline folder. Re-run with `--refresh` to bypass the cache.

### 0.5 Gold list

```bash
pnpm seo:gold-list -- \
  --gsc-pages gsc-pages-www.csv --gsc-pages gsc-pages-domain.csv \
  --links gsc-top-linked-pages.csv --links backlinks-best-by-links.csv \
  --ga4-landing ga4-organic-landing-pages.csv
```

Writes `docs/seo/legacy-thelax-gold-list.json`: the top 200 URLs by clicks, the top 200 by
organic sessions, and every backlinked URL. Entries flagged `not-in-inventory` are legacy
URLs Google or other sites still know about but the sitemap no longer lists; add a mapping
for each (see Phase 2 overrides) before cutover. Commit the gold list.

## Phase 1 — Inventory and URL map

Legacy URL families and where they go (rules live in
`apps/shop-api/src/application/legacy-thelax/legacy-thelax-url-map.ts`):

| Legacy URL | Count | New URL |
| --- | --- | --- |
| `/collection/<slug>.html` (incl. `sold-*`) | 531 | `/artworks/<slug>` (sold works keep their page) |
| `/print/<slug>.html` | 61 | `/artworks/<slug>-print` (prints share the original's slug) |
| `/sculpture/<slug>.html` | 6 | `/artworks/<slug>` |
| `/collections/<artist>.html` | 45 | `/artists/<artist>` |
| `/art-collection/<series>.html` | 96 | owning artist's page; `/artworks` when no artist is known |
| `/news/<slug>.html` | 116 | `/stories/<slug>` |
| `/art-style\|art-technique\|art-period/<slug>.html` | 82 | `/collector-hub/<style\|technique\|period>-<slug>` |
| `/paintings`, `/prints`, `/sculptures` | 3 | same URL (real Art routes) |
| policy pages | 6 | `/legal/<privacy\|cookies\|terms\|returns\|shipping\|modern-slavery>` |
| content pages (`/about-us`, `/faq`, `/glossary`, guides…) | ~15 | `/collector-hub/<slug>` |
| listings (`/all-*`, `/collections`, `/art-prints`, `/artist`, `/art-news`) | 8 | matching catalogue / hub route |
| `/contact-us` | 1 | `/contact` |
| `/glossary?word=<A-Z>` | 26 | `/collector-hub/glossary` |
| `/prev-auction` | 1 | `https://lax.bid/archive` |
| `/uds/stock/*`, `/uds/articles/*` images | ~1,300 | the imported media URL |
| anything else | — | honest 404 (never the homepage) |

`/site-map` (the legacy HTML sitemap) has no equivalent and is retired as an honest 404.
Add a rule for anything new in `LEGACY_PAGE_RULES` (single-segment pages) or
`LEGACY_PATH_OVERRIDES` (any other path) in the same file — overrides are applied last and
survive every re-import.

## Phase 2 — Import

The importer creates or refreshes artists, artworks (sold works included), stories,
collector-hub/legal pages and images, keyed by `thelax:<legacy path>` with actor
`legacy-thelax-import`. Re-runs are idempotent: importer-owned rows are refreshed, rows a
member of staff has edited since are left alone (`kept_staff_edit` in the report).

Run from an operator workstation with the **target environment's** credentials
(`DATABASE_URL_OWNER`/`DATABASE_URL_SHOP`, Spaces `S3_*`, `SHOP_MEDIA_PUBLIC_BASE_URL`); add
your IP to the managed database's trusted sources for the session and remove it afterwards.

```bash
pnpm seo:crawl-legacy --refresh            # fresh export immediately before importing
pnpm --filter @auction/shop-api import:legacy-thelax -- --plan-only \
  --redirects-out .tmp/seo/planned-redirects.json   # dry run: counts only, no writes
pnpm --filter @auction/shop-api import:legacy-thelax -- \
  --report-out .tmp/seo/import-report-<env>.json
```

The real run rewrites `apps/art/src/lib/seo/legacy-redirects.json`, now including the
`/uds/…` image entries. Check the report: `errors` must be empty; re-run for any
`media.failed` entries (transient fetch failures) before committing.

**The committed map must come from the production import.** Test and production builds
share the file and image targets are absolute media-CDN URLs, so: import on test, sign off,
import on production, commit the production map in a PR (CI checks one hop, no
self-redirects, no shadowed routes), deploy. Test then redirects legacy images to the
production CDN, which is harmless. Until the production map ships, legacy image URLs 404.

## Phase 3 — Parity configuration

Production `art` env (see [lax-art-production-launch.md](./lax-art-production-launch.md)):

| Variable | Value |
| --- | --- |
| `LAX_ART_PUBLIC_URL` | `https://www.thelax.art` (canonicals, sitemap, redirect targets) |
| `ART_GA_MEASUREMENT_ID` | `G-YGZCF5FD67` (the legacy property, so history continues) |
| `ART_GOOGLE_SITE_VERIFICATION` | Search Console HTML-tag token (DNS verification preferred) |
| `ART_ALLOW_INDEXING` | unset in production; `false` on test |

What the app guarantees, each covered by tests in `apps/art/src/lib/seo/`:

- Legacy paths 301 once to the final URL (middleware); misses log `legacy_redirect_miss`.
- Only `www.thelax.art` is indexable; every other host gets `noindex` and `Disallow: /`.
- `/sitemap.xml` (catalogue, editorial, `lastmod`) and `/legacy-sitemap.xml` (legacy URLs).
- JSON-LD: Organization, ArtGallery, VisualArtwork + Offer, Person, Article,
  BreadcrumbList.
- Missing records answer a real **404** and upstream outages a **500** (crawlers retry and
  keep the page). This needs slug routes outside every `loading.tsx` boundary; list
  skeletons live in `(index)`/`(home)` route groups and a test fails if one wraps a slug
  route.
- GA4 loads only after consent (UK PECR). **GA4 organic sessions will read lower than the
  legacy site's** for that reason alone — judge traffic on Search Console clicks.

## Phase 4 — Verify

### 4.1 Redirect checker

`pnpm seo:verify-legacy-redirects` requests every inventory and gold-list URL without
following redirects and fails unless each answers **one 301 to its mapped URL** whose
destination is **200, self-canonical, indexable, with a title and meta description**.
Unmapped URLs that 404 are reported as *retired* (expected, e.g. `/site-map`) but fail if
they are on the gold list. Listing landings and shared destinations are reported as
non-blocking parity gaps. The JSON report lands in `.tmp/seo/verify-legacy-redirects.json`.

| Where | Command |
| --- | --- |
| Test (CI) | `art-legacy-redirects` job in `app-deploy-test.yml` after every `art` deploy. Hop checks always; set repo variable `ART_LEGACY_IMPORT_ON_TEST=true` once test has the import to add destination checks. |
| Test (manual, full) | `pnpm seo:verify-legacy-redirects -- --base-url https://test-art.lax.bid --allow-noindex` |
| Production origin before DNS | `… --base-url https://<prod-app>.ondigitalocean.app --canonical-origin https://www.thelax.art --allow-noindex` |
| Production after DNS | `… --base-url https://www.thelax.art` (no overrides: indexability is checked too) |
| Local production simulation | build Art, run `next start` with `LAX_ART_PUBLIC_URL=https://www.thelax.art`, then `… --base-url http://localhost:3050 --host www.thelax.art` |

`--destinations gold` limits destination checks to gold-list URLs; `--host` sends that
Host header (and TLS SNI) to `--base-url`.

### 4.2 Staging crawl

Crawl `https://test-art.lax.bid` with Screaming Frog (Configuration → robots.txt → *Ignore
robots.txt*; Spider → *Ignore noindex* off) from `/` and in list mode over the inventory
paths. Fix before cutover: internal 4xx/5xx, any redirect chain, internal links still
pointing at `*.html` legacy URLs, missing or duplicate titles and descriptions, canonicals
that are not self-referencing.

### 4.3 Core Web Vitals

Legacy lab baseline, captured 2026-10-13 with Lighthouse 13 (mobile preset, headless
Chromium, one run each) — the legacy site will not exist to re-measure after cutover:

| Template | Legacy URL | Perf | LCP | CLS | TBT |
| --- | --- | --- | --- | --- | --- |
| Home | `/` | 34 | 19.8 s | 0.352 | 270 ms |
| Listing | `/all-collections` | 55 | 9.6 s | 0.153 | 70 ms |
| Artwork | `/collection/4-utopia.html` | 49 | 118.6 s* | 0.194 | 160 ms |
| Artist | `/collections/2-salvador-dal.html` | 65 | 4.3 s | 0.153 | 30 ms |
| Story | `/news/abstract-art.html` | 44 | 5.8 s | 0.495 | 20 ms |

\* An unoptimised hero image; treat as "very poor" rather than a precise figure.

After the test import, run the same templates on test-art from the same machine and record
them next to this table:

```bash
CHROME_PATH=<chromium> npx lighthouse@13 <url> --only-categories=performance \
  --output=json --output-path=.tmp/seo/lh-<template>.json --chrome-flags="--headless=new"
```

Gate: every template at or above its legacy score, CLS ≤ 0.1, LCP ≤ 2.5 s on the artwork
and home templates. After launch, track field data in Search Console → Core Web Vitals and
PageSpeed Insights (CrUX keeps the same origin, so history continues).

## Phase 5 — Cutover and monitoring

### 5.1 Before the window (T-7 days → T-0)

- Gold list committed; the production-origin run of 4.1 passes with zero gold failures.
- Production import done and its `legacy-redirects.json` deployed (Phase 2).
- Phase 3 env set on production `art`; Search Console Domain property verified by DNS.
- DNS TTLs on `www.thelax.art` and `thelax.art` lowered to 300 s (48 h ahead).
- Legacy server kept reachable at a private hostname (e.g. `legacy.thelax.art` behind
  Cloudflare Access, plus `X-Robots-Tag: noindex`) for rollback and content checks.
- Pick a low-traffic window from GA4 hourly organic sessions (usually an early weekday
  morning UK time); avoid Fridays.

### 5.2 Launch

1. Point `www.thelax.art` at App Platform and enable the apex / `lax.art` 301 rules
   ([lax-art-production-launch.md](./lax-art-production-launch.md#3-dns)).
2. Run 4.1 against `https://www.thelax.art`; spot-check
   `curl -sI https://thelax.art/about-us` → `301 https://www.thelax.art/about-us` →
   `301 /collector-hub/about-us`.
3. Search Console: submit `https://www.thelax.art/sitemap.xml` **and**
   `https://www.thelax.art/legacy-sitemap.xml` (old URLs, so Google recrawls them and sees
   the 301s); URL-inspect the top 10 gold URLs and request indexing.
4. GA4 Realtime: accept the consent banner and confirm a page view arrives.

### 5.3 Monitoring

Daily for the first two weeks, then weekly for three months:

- Search Console → Pages (*Not found (404)*, *Page with redirect*, *Soft 404*), Crawl
  stats (response time, host status), Performance clicks for gold-list URLs vs baseline.
- `legacy_redirect_miss` lines in the `art` App Platform runtime logs. A real legacy URL →
  add it to `LEGACY_PATH_OVERRIDES` **and** `legacy-redirects.json` in one PR; scanner
  noise (`/wp-login.php`, random `.html`) → ignore.
- GA4 organic landing pages (directional only, see the consent caveat in Phase 3).

Expect ranking fluctuation for a few weeks. **Fix forward first.** Roll DNS back to the
legacy server only if gold-list Search Console clicks are down more than 40% against the
baseline for 7 consecutive days and no cause (missing mapping, 5xx, indexing gate,
robots) can be found; rollback is repointing `www.thelax.art` at the legacy origin.

### 5.4 After launch

- Backlinks: email the owners of the top linking domains (gold list `backlinked`) with the
  new URL for their link; redirects keep working either way, a direct link is stronger.
- Keep the redirects indefinitely. Drop `/legacy-sitemap.xml` from Search Console after
  about three months, once its URLs show as *Page with redirect*.
- Moving to `lax.art` is a separate project after at least three stable months: host-level
  301s preserving path, Search Console **Change of Address**, `ART_PRODUCTION_HOSTS`,
  `LAX_ART_PUBLIC_URL`, OIDC URIs and the Cloudflare rules all change together.

## Owner inputs still needed

- Search Console and GA4 exports (Phase 0) to build the gold list.
- Cloudflare access for the `thelax.art` and `lax.art` zones (Phase 5 DNS and redirects).
- Confirmation that `/corporate`, `/podcast` and `/event-gallery` should stay as
  collector-hub pages.
