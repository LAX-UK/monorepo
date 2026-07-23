# Async delivery (Phase 2) rollout and replay

This runbook covers domain-event delivery, Zoho/Xero projectors, inbound webhooks, and lot-lifecycle ownership after Phase 2 wiring.

## Preconditions

- Migrations applied: `0132_domain_event_delivery`, `0133_webhook_event_lease` (and partial unique indexes on `domain_events` for bid milestones / external linking).
- Worker and API deployed with **safe defaults** (no live external writes):
  - `ZOHO_CRM_SYNC_MODE=off`
  - `XERO_PROJECTOR_MODE=off`
  - `WEBHOOK_EVENTS_ENQUEUE=false` (API)
  - `WEBHOOK_EVENTS_PROCESS=false` (worker)
  - `LIFECYCLE_EXECUTION_OWNER=api`
  - `DOMAIN_EVENT_PUBLISH_VALIDATE=off` (use `observe` then `enforce` before Xero live)
  - `XERO_API_WRITES_DISABLED=false` (set `true` on API before projector live per operation)

## Staged cutover order

1. **Contracts only** — deploy catalog + delivery ledger; confirm `@auction/types` registry tests green (`pnpm --filter @auction/types test`, including `financial-contracts.test.ts`). Optionally set `DOMAIN_EVENT_PUBLISH_VALIDATE=observe` on API/worker and watch for contract violations before enforce.
2. **Shadow / dry-run** — set `ZOHO_CRM_SYNC_MODE=dry_run` and/or `XERO_PROJECTOR_MODE=shadow`; watch worker logs for mapped commands without provider writes.
3. **Webhooks** — enable `WEBHOOK_EVENTS_ENQUEUE` on API, then `WEBHOOK_EVENTS_PROCESS` on worker; monitor `webhook_event` oldest unprocessed age and drain job metrics.
4. **Canary event types** — narrow lists: `ZOHO_CRM_ENABLED_EVENT_TYPES`, `XERO_PROJECTOR_LIVE_OPERATIONS`.
5. **Single-owner live** — for each Xero operation, set `XERO_API_WRITES_DISABLED=true` on API **before** enabling matching live projector operations. Run `DOMAIN_EVENT_SMOKE_GATES` suites (`apps/worker/src/domain-event-smoke.test.ts`) and confirm zero new contract dead-letters in shadow/canary.
6. **Lifecycle** — after parity checks, set `LIFECYCLE_EXECUTION_OWNER=worker` on **both** API and worker in the same deploy window.

Finance cron and Xero ownership cutovers: [worker-runtime-cutover.md](./worker-runtime-cutover.md).

## Go / no-go gates (live writes)

- Zero duplicate provider objects in shadow/canary window.
- Oldest pending delivery age bounded (alert thresholds in `delivery-metrics`).
- No sustained retry or dead-letter growth for 24h after canary.
- Successful replay drill on a dead-lettered row (admin delivery ops or SQL `replay` port).
- Lifecycle: no overdue active/scheduled lots vs baseline when worker owns execution.

## Replay and recovery

### Domain event delivery (`domain_event_delivery`)

- Inspect dead-letter rows: admin `GET /admin/system/delivery/dead-letter` (capability-gated) or query `status = 'dead_lettered'`.
- Replay: admin replay endpoint or repository `replay(deliveryId)` — creates a new attempt, retains idempotency key.
- Stale leases: rows in `processing` with expired `lease_expires_at` are reclaimable on next claim batch.

### Webhook inbox (`webhook_event`)

- Failed rows: `processed_at IS NULL`, `last_error` set, `attempts` incremented.
- Retry: admin webhook retry or re-enqueue with stable `eventKey` (duplicate HTTP delivery remains safe).
- Drain job re-queues rows that never received a BullMQ job after insert.

### BullMQ

- See [redis-queue-replay.md](./redis-queue-replay.md) for queue-level replay; webhook jobs use `jobId=eventKey`.

## Rollback

| Component | Rollback action |
|-----------|-----------------|
| Zoho live | `ZOHO_CRM_SYNC_MODE=off` |
| Xero live | `XERO_PROJECTOR_MODE=off`, restore `XERO_API_WRITES_DISABLED=false` |
| Webhooks | `WEBHOOK_EVENTS_PROCESS=false`, then `WEBHOOK_EVENTS_ENQUEUE=false` |
| Lifecycle | `LIFECYCLE_EXECUTION_OWNER=api`, restart API lot-lifecycle worker |

Never run API and worker as simultaneous lifecycle owners — startup validation enforces a single owner when configured.

## Related docs

- [../architecture/04-domain-events.md](../architecture/04-domain-events.md) — catalog and delivery ledger
- [incident-zoho-outage.md](./incident-zoho-outage.md)
- [xero-token-loss.md](./xero-token-loss.md)
