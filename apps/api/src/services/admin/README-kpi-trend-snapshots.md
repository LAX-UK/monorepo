# KPI trend snapshots (future initiative)

`AdminKpiTrendEngine` answers **event-timestamp** questions only: "how many records were created / ended / hammered per UTC day." Cheap trends wired today:

| Tile | Source |
|---|---|
| New lots / New sales | `createdAt` daily counts |
| Ended lots | `endTime` daily counts (ended status) |
| Total hammer value (list) | sum of ended-lot `currentPrice` by `endTime` day |
| Lot overview hammer/bids/bidders | bid `createdAt` aggregates per lot |

## What this engine cannot do

Point-in-time **status snapshot** metrics need historical state that we do not persist:

- Live lot count on each of the last N days
- Draft count per day
- Needs-attention count per day
- Published count per day

**Lot page views** are a separate metric — see `apps/web/src/lib/admin/README-lot-page-views.md`. Do not conflate view counts with status snapshots.

Those counts reflect *current* status filters, not creation events. Reconstructing them requires one of:

1. **Daily snapshot job** — scheduled writer that stores `{ date, liveCount, draftCount, … }` per entity scope.
2. **Status-transition event log** — domain events (`lot.published`, `lot.ended`, …) aggregated retroactively (only as complete as the log).
3. **Flat tiles (interim)** — show current value + text compare hint; no sparkline until (1) or (2) ships.

Do **not** approximate snapshot tiles with creation-event trends — that misstates the metric.

## Suggested snapshot schema (when scoped)

```ts
type AdminKpiDailySnapshot = {
  snapshotDate: string; // YYYY-MM-DD UTC
  scope: "lots" | "sales" | "submissions";
  metrics: Record<string, number>;
};
```

Writer: cron after midnight UTC. Reader: `AdminKpiSnapshotReader.getRange(scope, from, to)` consumed by list-page trend builders alongside existing event trends.
