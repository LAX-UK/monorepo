# Redis / BullMQ queue replay

## Symptom

- Jobs stuck in `wait` or `delayed`; worker CPU idle; emails or payout PDFs not processing; settlement heartbeat missing from logs.

## Diagnosis

```sh
redis-cli -u "$REDIS_URL" LLEN "bull:payout-settlement:wait"
redis-cli -u "$REDIS_URL" LLEN "bull:payout-settlement:active"
redis-cli -u "$REDIS_URL" LLEN "bull:email:wait"
```

Inspect worker logs (`apps/worker`) for BullMQ `error` events. Confirm `CRON_INTERNAL_SECRET` matches API if heartbeat calls fail with 401.

## Engineering UI (super_admin)

When `ENABLE_BULL_BOARD=true`, open **Bull Board** at:

`/admin/system/job-queues`

Programmatic inspection (same auth — super_admin session):

- `GET /admin/system/job-queues/summary`
- `GET /admin/system/job-queues/:name/jobs?status=failed&limit=50`

Email payloads are hidden from Bull Board; use `GET /admin/email/outbox` for PII-safe email observability.

## Resolution

1. **Pause** the affected queue via BullMQ API/UI (`queue.pause()`).
2. **Drain** `active` jobs: fix root bug, then `job.retry()` failed jobs or move to failed with documented reason.
3. **Do not** `DEL bull:*` keys in production without engineering sign-off — risks duplicate side effects.
4. For **stuck locks** (settlement NX): see `apps/api/src/routes/internal-cron.settlement-lock.test.ts` behaviour; wait TTL or clear key only if no job holds the lock (coordinate with second engineer).

## Escalation

- Redis cluster unhealthy in DO → open DO ticket with cluster UUID.

## Related

- [Migration rollback](./migration-rollback.md) (queue ordering)
- [Scale monitoring](./scale-monitoring.md)
