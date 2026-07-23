# Lot page views (analytics source)

**Decision (2026-07):** Lot overview **Views** KPI reads `pageViewCount` from `GET /admin/lots/:id/metrics`. Until a page-view pipeline ships, the API returns `null` and the UI shows **Analytics pending** — not a fabricated count.

## Preferred source (when scoped)

1. **Product analytics** — PostHog / Plausible / GA4 page-view events keyed by public lot URL (`/lots/:slug`).
2. **First-party aggregate** — nightly roll-up table `lot_page_views_daily { lot_id, date, count }` written by a worker consuming web access logs or client `page_view` beacons.
3. **Not acceptable** — bid counts, catalogue sync events, or admin page loads as a proxy for public views.

## Integration contract

```ts
// AdminLotDetailMetrics.pageViewCount
// null  → UI: "—" + compareHint "Analytics pending"
// number → UI: formatted count + compareHint "Page views"
```

Wire in `AdminLotDetailMetricsService.getMetrics` once the aggregate reader exists. Do not change the overview VM label ("Views") — only populate the metric.

## Status snapshot trends (related)

Live/Draft/Needs-attention list KPI sparklines are **out of scope** for page views. See `apps/api/src/services/admin/README-kpi-trend-snapshots.md` — ship flat compare hints until daily snapshot infra is justified.
