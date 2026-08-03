# Staff dashboard performance baseline

Status: **captured (dev reference)** — compare post-redesign builds against these figures before marking `/admin` green.

Environment: Node 22, seeded dev stack (`pnpm --filter @auction/db db:seed:dev`), `apps/web` + `apps/api` running locally.

## Capture procedure

```bash
# Terminal 1 — API + web (production build recommended for stable timings)
pnpm --filter @auction/api build && pnpm --filter @auction/api start
pnpm --filter @auction/web build && pnpm --filter @auction/web start

# Terminal 2 — baseline script (requires staff session cookie or uses loader mocks in CI)
node apps/web/scripts/capture-admin-dashboard-baseline.mjs
```

Record output in PR evidence when hierarchy or loader boundaries change.

## Reference measurements (pre–queue-first completion, 2026-07-27)

| Role | Profile | Server TTFB (approx) | Critical readers | Optional readers | Radar HTTP |
|------|---------|-------------------|------------------|------------------|------------|
| `super_admin` | oversight | ~800–1200ms dev | metrics, nav, attention | trends, live, activity, finance | 0–1 batched |
| `catalogue_manager` | catalogue | ~700–1000ms dev | metrics, nav, attention | trends (submissions), activity | 0 (hidden) |
| `finance_ops` | finance | ~700–1000ms dev | metrics, nav, attention | trends (payments), finance issues | 0 |
| `staff_viewer` | read_only | ~600–900ms dev | metrics, nav, attention | trends (lots only) | 0 |

Notes:

- Dev `next start` timings vary ±30%; use CI Linux build for regression gates.
- Critical path now loads `loadDashboardMetricsSlice` (metrics + nav counts) before optional slices (`live`, `role-kpis`, `recent-activity`).
- Hidden widgets must emit **zero** reader calls (verified in unit tests).
- Batched saleroom radar: at most **one** `getOperationsRadar` call when `onsite-radar` is visible.

## Rollback criteria

- Critical-content regression **> 10%** vs baseline on same hardware
- Dashboard error rate increase
- Capability leakage in queue/KPI/customize paths
- Failed accessibility or role E2E gates
- Worse validated task outcomes (see prototype validation doc)
