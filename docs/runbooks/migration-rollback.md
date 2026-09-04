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
| 0137 `user_category_interests` | Adds nullable `user.category_interests_onboarding_completed_at`, backfills every **pre-existing** user as onboarding-complete (`created_at < transaction_timestamp()`), and creates `user_category_interest` with `ON DELETE CASCADE` (user) / `RESTRICT` (category). | `0137_rollback.sql` drops the interests table, then the onboarding column. | **Destructive:** all buyer interest rows and the completion marker are lost. Grandfathered completion timestamps cannot be reconstructed from SQL alone. | Deploy off-peak: the backfill is a single unbatched `UPDATE "user"`. Roll back app code that reads the table/column before SQL. |
| 0138 `buyer_interest_categories` | Seeds jewellery / antiques / memorabilia categories (`ON CONFLICT DO NOTHING`) and later rolled into 0139. | `0138_rollback.sql` deletes `user_category_interest` rows for those category IDs, then deletes the categories. | **Destructive** of real user preferences for those three slugs. Category `DELETE` can abort if lots/sales/submissions still reference them. | Prefer archive over delete if catalog rows are in use. Apply only after 0139 app code no longer requires those slugs, or skip 0138 rollback and archive instead. |
| 0139 `complete_buyer_interest_categories` | Completes the buyer-interest category seed set (`ON CONFLICT DO NOTHING`). | `0139_rollback.sql` is intentionally a no-op. | No data loss from 0139 rollback. Partial rollback leaves catalog rows with no app consumers. | Safe after code rollback. Do not assume 0138/0137 have also been reversed. |
| 0140–0142 Identity foundation | Creates and backfills Bid/Shop profiles, adds Shop lifecycle fields, then adds Identity lifecycle and refresh-family columns. | Reverse `0142`, `0141`, then `0140`; the final step drops both product profile tables. | **Destructive:** profile data and lifecycle/refresh-family evidence added after rollout are lost. | Stop profile/event writers and restore code that reads legacy `user` fields before reversing this foundation. |
| 0143–0145 compatibility and projection | Adds Bid-authoritative compatibility triggers/indexes, repairs the pre-existing sale hero schema, and copies Identity lifecycle state into `bid_user_profile`. | `0145` drops projected lifecycle columns, `0144` is intentionally a no-op repair rollback, and `0143` removes compatibility triggers/indexes. | `0145` loses copied lifecycle state; `0144` preserves the schema owned by `0136`. | Reverse before `0142`/`0140`. Do not remove compatibility support while code still relies on it. |
| 0146 `oauth_consent_client_user_unique` | Locks consent writes, merges duplicate scopes into the newest consent decision, removes duplicate rows, and enforces one row per client/user. | Drops the consent unique index and recreates the former `user.linked_external` domain-event unique index. | Duplicate consent row identities are irreversible. Rollback can fail if multiple linked-external events for one aggregate were emitted after forward. | Quiesce consent and linking writes; audit both duplicate sets before rollback. |
| 0147–0149 OIDC logout and SSF storage | Adds RP-session/MFA columns, logout/Shop session tables, and SSF transport/replay tables. | Reverse `0149`, `0148`, then `0147`, dropping the added tables and columns. | **Destructive:** active sessions, logout deliveries, SSF streams/deliveries, replay ledgers, and MFA/step-up timestamps are lost. | Disable SSF/logout workers and deploy code that no longer references the tables before SQL. |
| 0150 `remove_shop_session_id_token` | Drops stored Shop ID tokens. | Re-adds an empty nullable column. | Original ID-token values cannot be reconstructed. | Roll back Shop code first; expect affected local sessions to reauthenticate. |
| 0151–0152 outbox source cutover | Creates the Identity lifecycle outbox, then removes the SSF delivery foreign key to `domain_events`. | `0152` restores the FK; `0151` drops the outbox. | Dropping `0151` loses unrelayed lifecycle events. Restoring the FK fails if non-null source ids no longer reference `domain_events`. | Reverse `0155` first, stop outbox/SSF processing, drain relay work, then reverse `0152` and `0151`. |
| 0153 `contract_user_identity_only` | Copies the exact buyer-interest completion timestamp to `bid_user_profile`, repoints `user_category_interest.user_id` to the Bid profile, then removes the marker and other Bid-owned fields from Identity `user`. | `0153_rollback.sql` restores the Identity marker from the profile, repoints the FK to `user`, removes the profile marker, and recreates the compatibility fields/triggers. | The forward path preserves timestamps and preferences. Rolling back to old code reintroduces cross-boundary ownership and must remain temporary. | Roll back code first. Apply `0153_rollback.sql` before any earlier profile rollback and before deploying code that reads the marker from `user`; never run it while new API instances still write `bid_user_profile`. |
| 0154 `subject_id_expand` | Adds and backfills `bid.subject_id`, indexes it, and adds a `NOT VALID` FK that still enforces new writes. | Drops the FK, indexes, and column. | Subject snapshots written after rollout are lost. The FK remains intentionally unvalidated during expand. | Roll back code that writes/reads `subject_id` before SQL. |
| 0155 `ssf_reset_outbox_checkpoint` | Deletes settled SSF deliveries, detaches pending source ids, and moves stream checkpoints to the Identity outbox id space. | Moves checkpoints back to the current `domain_events` maximum only. | **Irreversible:** deleted deliveries and detached source ids are not reconstructed. | Disable SSF mapping/delivery and capture audit evidence before forward or rollback. |
| 0156 `repair_user_pii_purge` | Replaces the purge function with a body valid for the contracted Identity-only `user`. | Intentionally leaves that valid body in place. `0153_rollback.sql` restores legacy columns and the legacy purge body together. | No data change from rollback. Restoring the pre-0156 body alone would make purge fail on removed columns. | Reverse `0153` when reversing the contraction; do not hand-restore the legacy function first. |
| 0157–0158 auth grant contraction | Removes `auth_app` access to the product email pipeline, Bid profile, and external accounts. | Restores only the former narrow grants. | No row data changes; restoring grants reopens cross-boundary reads/writes. | Roll back the corresponding HTTP-boundary code and grants as one maintenance change. |
| 0159 `bid_identity_directory` | Creates/backfills the product-local Identity directory and grants worker DML/API read. | Revokes those grants and drops the directory. | Drops copied PII and projector ordering state; authoritative Identity data remains. | Restore every worker/API reader to its pre-directory source before dropping, and reverse `0161`/`0160` first. |
| 0160–0161 user-read revocation | Removes worker, then API `SELECT` on Identity `user`. Applied only when `PRODUCTION_MIGRATION_THROUGH` is `0160` then `0161`; a default `pnpm db:migrate:prod` stops at `0159`. | Restores the corresponding staged read grant. | No row data changes; code/grant skew causes immediate runtime failures. | Reverse `0161` before API code and `0160` before worker code. A role-script rerun is not a rollback. Lower or clear `PRODUCTION_MIGRATION_THROUGH` before the next production migrate so the Job does not re-apply the revoke. |

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
