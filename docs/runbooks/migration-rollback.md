# Migration Rollback Runbook

This runbook covers legal-entity rollout migrations **0027 through 0037**. Use it
with code rollback plans; SQL rollback alone is not safe while old workers or API
instances can still write the newer schema.

## Pre-Rollback Checklist

1. Put the site into an admin-approved maintenance window if money movement,
   auction close, or identity/KYB writes are affected.
2. Pause BullMQ queues in this order: `payout-settlement`, `payout-statements`,
   `legal-entity-archive`, `impersonation-sweeper`, then `email` and other
   lower-risk queues. Pause the domain-events projector in the worker separately
   (not a BullMQ queue).
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
| 0027 `legal_entity_foundation` | Adds legal entity foundation tables/columns for membership, buyer/seller scoping, and entity metadata. | `0027_rollback.sql` removes the foundation schema. | Destructive for legal-entity records and relationships created after rollout. | Roll back app code first. Pause `legal-entity-archive`, payout queues, and the domain-events projector. |
| 0028 `legal_entity_final_cutover` | Drops legacy ownership columns: `lot.seller_id`, `item_submission.seller_id`, `payment.seller_id`, `sale.created_by`; sets `NOT NULL` on legal-entity ownership columns. | `0028_rollback.sql` recreates those columns as nullable `text`, backfills from `legal_entity.created_by_user_id` via `seller_legal_entity_id`, `legal_entity_id`, `seller_legal_entity_id`, and `created_by_legal_entity_id` respectively; recreates `lot_seller_id_idx`, `item_submission_seller_id_idx`, `sale_created_by_idx`. | **Approximate backfill:** uses entity creator user id, not `legal_entity_member`; multi-member entities and post-0028 rows may not match original `seller_id` / `created_by` values. Prefer backup restore for bit-identical history. | Roll back application to a build that still reads legacy columns before depending on backfill. SQL-only rollback while new code runs re-adds nullable columns the new code ignores; coordinate code + SQL. Pause auction close, payouts, and submissions if old code paths depend on these ids. |
| 0030 `payout_statement_url` | Adds payout statement URL/error columns. | `0030_rollback.sql` drops `statement_url` and `statement_generation_error`. | DB pointers to generated PDFs/errors are lost; object-store files are retained. | Pause and drain `payout-statements` first. Deploy code that ignores statement columns before SQL. |
| 0031 `domain_events_impersonation_index` | Adds impersonation audit index. | `0031_rollback.sql` drops the index. | No application data loss; audit queries may slow. | Safe after code rollback; no queue drain required beyond normal deploy controls. |
| 0032 `payout_line_source_event_id` | Adds payout-line source event id for webhook idempotency and relaxes payout line checks for webhook adjustments. | `0032_rollback.sql` drops `source_event_id` and restores the old check. | Webhook idempotency history is lost; in-flight dispute/refund jobs can duplicate adjustment lines after rollback. | Pause Stripe webhook processing if available, and pause `payout-settlement` before SQL. |
| 0033 `lot_voided_archived_seller` | Adds `lot.status='voided'`, `voided_reason`, and `archived_seller`. | `0033_rollback.sql` converts `voided` lots to `cancelled`, then drops the two columns. | `voided_reason`/`archived_seller` data is lost. PostgreSQL enum label `voided` persists cosmetically. | Roll back code that can emit/render `voided` first. Pause `legal-entity-archive` and `lot-lifecycle` workers. |
| 0034 `impersonation_session` | Adds server-side impersonation session table. | `0034_rollback.sql` drops `impersonation_session`. | Active and historical impersonation session rows are lost; domain events remain. | End active sessions first. Pause `impersonation-sweeper`. Deploy code that does not require session table before SQL. |
| 0035 `payment_manual_review` | Adds `payment.status='requires_manual_review'` and includes it in the open-payment uniqueness rule. | No companion rollback file yet. | PostgreSQL enum values cannot be removed safely in-place; manual-review rows must be resolved before any bespoke rollback. | Resolve or convert manual-review payments, pause domain-events projector, then deploy code that does not create the status. |
| 0036 `payment_manual_review_index` | Recreates `payment_lot_buyer_open_unique` to include `requires_manual_review` in the partial index predicate. | No checked-in companion; reverse by dropping the index and recreating it with the pre-0036 predicate (`pending`, `authorized`, `captured` only). | Brief uniqueness window risk if done wrong; review 0036 SQL before applying a hand-written reverse. | Apply only with code that matches the index predicate you restore. |
| 0037 `payment_stripe_refund_id` | Adds nullable `payment.stripe_refund_id`. | `0037_rollback.sql` drops `stripe_refund_id`. | Loses stored Stripe refund ids for rows populated after 0037; refunds already in Stripe are unchanged. | Deploy code that does not read `stripe_refund_id` before SQL. |
| 0083 `failed_jobs` | Adds BullMQ dead-letter audit table (`failed_jobs`) with replay metadata and full payload JSON for super_admin DLQ replay. | `0083_rollback.sql` drops `failed_jobs`. | Loses DLQ audit trail and replay payloads; Redis dead-letter jobs may remain until manually cleaned. | Pause high-criticality queues before rollback. Deploy code that does not write/read `failed_jobs` before SQL. |

## Deferred Manual Procedures

- Pending payouts for archived entities are handled manually by finance. Review
  `/admin/payouts`, confirm Connect status, and either complete payout, reverse,
  or document hold rationale.
- Expired impersonation sessions may show the sweeper time rather than exact
  expiry as audit end time. This is accepted behaviour.
- The 30-minute settlement Redis lock TTL is accepted with monitoring; if a job
  exceeds TTL, investigate before manually retriggering settlement.

## Optional CI roundtrip tests

`packages/db/src/migration-0028-roundtrip.test.ts` and
`packages/db/src/migration-0033-roundtrip.test.ts` exercise forward/rollback SQL
when `MIGRATION_TEST_DATABASE_URL` is set (see CI postgres service). They are
skipped locally unless that variable is exported.
