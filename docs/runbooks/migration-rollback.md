# Migration Rollback Runbook

This runbook covers legal-entity rollout migrations **0027 through 0035**. Use it
with code rollback plans; SQL rollback alone is not safe while old workers or API
instances can still write the newer schema.

## Pre-Rollback Checklist

1. Put the site into an admin-approved maintenance window if money movement,
   auction close, or identity/KYB writes are affected.
2. Pause queues in this order: `payout-settlement`, `payout-statements`,
   `archive-cascade`, `impersonation-sweeper`, `notification-fanout`, then
   lower-risk notification/email queues.
3. Wait for active jobs to finish, or fail stuck jobs after capturing job ids and
   payloads for replay.
4. Deploy rollback code that no longer references schema you plan to remove.
5. Apply rollback SQL in reverse migration order.
6. Resume queues only after code and database schema agree.

## BullMQ Pause And Drain

Preferred: use the BullMQ admin UI/API for the target environment:

```ts
await queue.pause();
await queue.whenCurrentJobsFinished();
```

Redis fallback for emergency operators:

```sh
redis-cli -u "$REDIS_URL" llen "bull:<queue>:wait"
redis-cli -u "$REDIS_URL" llen "bull:<queue>:active"
```

Do not delete BullMQ keys unless engineering and ops agree the jobs are
irrecoverable. For rollback, pausing and draining is safer than purging.

## Migration Matrix

| Migration | Forward change | Rollback effect | Data loss / boundary | Ordering and queues |
| --- | --- | --- | --- | --- |
| 0027 `legal_entity_foundation` | Adds legal entity foundation tables/columns for membership, buyer/seller scoping, and entity metadata. | `0027_rollback.sql` removes the foundation schema. | Destructive for legal-entity records and relationships created after rollout. | Roll back app code first. Pause all queues that read legal entities: `archive-cascade`, `notification-fanout`, payout queues. |
| 0028 `legal_entity_final_cutover` | Final cutover wiring for legal-entity fields and constraints. | No companion rollback file is present. | Treat as forward-only unless a bespoke DBA rollback is prepared from production schema diff. | Prefer code rollback while keeping DB forward. |
| 0030 `payout_statement_url` | Adds payout statement URL/error columns. | `0030_rollback.sql` drops `statement_url` and `statement_generation_error`. | DB pointers to generated PDFs/errors are lost; object-store files are retained. | Pause and drain `payout-statements` first. Deploy code that ignores statement columns before SQL. |
| 0031 `domain_events_impersonation_index` | Adds impersonation audit index. | `0031_rollback.sql` drops the index. | No application data loss; audit queries may slow. | Safe after code rollback; no queue drain required beyond normal deploy controls. |
| 0032 `payout_line_source_event_id` | Adds payout-line source event id for webhook idempotency and relaxes payout line checks for webhook adjustments. | `0032_rollback.sql` drops `source_event_id` and restores the old check. | Webhook idempotency history is lost; in-flight dispute/refund jobs can duplicate adjustment lines after rollback. | Pause Stripe webhook processing if available, and pause `payout-settlement` / `notification-fanout` before SQL. |
| 0033 `lot_voided_archived_seller` | Adds `lot.status='voided'`, `voided_reason`, and `archived_seller`. | `0033_rollback.sql` converts `voided` lots to `cancelled`, then drops the two columns. | `voided_reason`/`archived_seller` data is lost. PostgreSQL enum label `voided` persists cosmetically. | Roll back code that can emit/render `voided` first. Pause `archive-cascade` and auction close workers. |
| 0034 `impersonation_session` | Adds server-side impersonation session table. | `0034_rollback.sql` drops `impersonation_session`. | Active and historical impersonation session rows are lost; domain events remain. | End active sessions first. Pause `impersonation-sweeper`. Deploy code that does not require session table before SQL. |
| 0035 `payment_manual_review` | Adds `payment.status='requires_manual_review'` and includes it in the open-payment uniqueness rule. | No companion rollback file yet. | PostgreSQL enum values cannot be removed safely in-place; manual-review rows must be resolved before any bespoke rollback. | Resolve or convert manual-review payments, pause `notification-fanout`, then deploy code that does not create the status. |

## Deferred Manual Procedures

- Pending payouts for archived entities are handled manually by finance. Review
  `/admin/payouts`, confirm Connect status, and either complete payout, reverse,
  or document hold rationale.
- Expired impersonation sessions may show the sweeper time rather than exact
  expiry as audit end time. This is accepted behaviour.
- The 30-minute settlement Redis lock TTL is accepted with monitoring; if a job
  exceeds TTL, investigate before manually retriggering settlement.
