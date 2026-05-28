# Data exports runbook

Operational guide for the centralized CSV export system (`data_exports` table, API routes, BullMQ worker).

## Prerequisites

1. Apply migration [`packages/db/drizzle/0084_data_exports.sql`](../../packages/db/drizzle/0084_data_exports.sql):

   ```bash
   pnpm db:migrate
   ```

2. Ensure the worker process is running and registers the `data-export` queue.
3. Ensure the worker can import `@auction/api` exports (provider registry).

## Architecture

- **API:** `POST /exports` — sync CSV stream (small) or async job (large / `forceAsync`)
- **Preview:** `POST /exports/preview` — row count + sync threshold for confirm UI
- **Worker:** `data-export` queue generates CSV, uploads to object storage, sets presigned download
- **Purge:** daily cron on same queue marks stale in-flight exports failed and deletes expired S3 objects

## Rate limits

| Limit | Value |
|-------|-------|
| Concurrent in-flight exports per user | 5 |
| Daily exports per user (UTC) | 20 |
| Sync row threshold (`EXPORT_SYNC_MAX_ROWS`) | 5000 (default) |
| Stale in-flight TTL (`EXPORT_STALE_PROCESSING_MS`) | 30 min (default) |

Stale `pending` / `processing` rows older than the TTL are **not deduped** and are marked `failed` by the purge job.

## Supported entity types

`lots`, `sales`, `submissions`, `clients`, `payments`, `domain-events`, `payouts`, `analytics`

## Smoke test checklist

After deploy or config change:

1. **Sync export** — small lots list from `/admin/lots` → immediate CSV download
2. **Preview** — open export confirm sheet → row estimate appears
3. **Async export** — large dataset or `forceAsync` → 202 response, tray shows progress, download when complete
4. **Cancel** — cancel in-flight job from exports tray
5. **Dedup** — repeat same filters while async file is valid → returns existing job
6. **Finance** — payments export with status filters (clear search first)
7. **Seller payouts** — client dashboard export with `legalEntityId` scope
8. **Analytics** — platform admin revenue / lots / registrations series export

## Troubleshooting

### Stuck `processing` rows

Usually caused by client disconnect during sync stream. After 30 minutes:

- Dedup allows a new export automatically
- Purge job marks the row `failed` with `Export timed out`

Manual cancel: user can cancel from the exports tray (`DELETE /exports/:id`).

### Monitor export health

```sql
SELECT status, count(*) FROM data_exports GROUP BY status;
```

Watch for growing `processing` count beyond TTL window.

### Download 404

Async exports require `s3Key` and unexpired `expiresAt`. Sync exports have no stored file — re-export to download again.

### Worker not processing

- Check `data-export` queue in Bull Board / Redis
- Verify worker heartbeat for `data-export`
- Check worker logs for `data_export_completed` / job failures

## Domain events

Each new export (sync or async, not dedup `existing`) emits:

- `aggregateType`: `data_export`
- `eventType`: `export.requested`
- Payload: `entityType`, `format`, `filtersHash`, `mode`, `totalRows`

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `EXPORT_SYNC_MAX_ROWS` | 5000 | Sync vs async threshold |
| `EXPORT_STALE_PROCESSING_MS` | 1800000 | In-flight stale window (ms) |

## Known deferred items

- Payments text search (`q`) is not exported server-side; export is disabled while search is active
- Client-side analytics/payouts legacy buttons removed — all exports go through API
