# Performance baselines

Investigation thresholds and instrumentation for the platform performance roadmap. Tune per environment once baselines exist.

## Web (Lighthouse CI)

Routes audited in [`lighthouserc.json`](../../lighthouserc.json):

| Route | Purpose |
|-------|---------|
| `/` | Home LCP / TTFB |
| `/sales` | Calendar hub |
| `/search` | Catalogue search hub |
| `/archive` | Archive hub |
| `/artists` | Artist directory |

**Saleroom / lot detail:** require seeded sale and lot IDs in the target environment. Add URLs manually when running local audits:

```bash
pnpm --filter @auction/web start -- -p 3030 -H 127.0.0.1
npx lighthouse http://127.0.0.1:3030/sales/{slug}/{id} --preset=desktop
npx lighthouse http://127.0.0.1:3030/lot/{slug}/{id} --preset=desktop
```

Gates: performance ≥ 0.8, LCP ≤ 2500ms, CLS ≤ 0.1 ([`budgets.json`](../../budgets.json)).

## Web Vitals (Sentry)

[`WebVitalsReporter`](../../apps/web/src/components/layout/web-vitals-reporter.tsx) forwards metrics with `pathname` attribute when available. Dashboard: filter `web_vitals.LCP` by route.

## API (Prometheus)

Histogram: `auction_api_http_request_duration_seconds` with labels `method`, `route`, `status`.

Hot-path route labels (see [`metrics.ts`](../../apps/api/src/middleware/metrics.ts)):

| Label | Endpoints |
|-------|-----------|
| `/lots/*` | Catalogue list, lot detail, bids |
| `/sales/*` | Sales list, saleroom lots page |
| `/bids/*` | Bid placement |

Suggested Grafana panels: p50/p95/p99 for `/lots/*`, `/sales/*`, `/bids/*`.

## Postgres

Enable slow-query logging in staging first:

```sql
ALTER SYSTEM SET log_min_duration_statement = '500ms';
```

## Redis

Alert when application command p99 > 50ms (see [`scale-monitoring.md`](./scale-monitoring.md)).

## Database migrations

Deploy catalogue performance indexes before measuring search/saleroom wins:

| Migration | Purpose |
|-----------|---------|
| `0113_catalogue_perf_indexes.sql` | Bid + watchlist recency indexes |
| `0115_lot_title_trgm.sql` | `pg_trgm` GIN on `lower(lot.title)` for `%term%` search |

Apply via standard Drizzle migrate flow; use `CREATE INDEX CONCURRENTLY` in production for `0115`.

## Target improvements (post-optimization)

| Signal | Target |
|--------|--------|
| Home LCP (anonymous desktop) | ≤ 2.0s |
| Saleroom TTFB p95 | ↓ 40% vs baseline |
| `GET /sales` p95 (cache miss) | ↓ 50% vs baseline |
| Bid placement p95 | No regression |
