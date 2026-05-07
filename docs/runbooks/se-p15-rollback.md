# Payout statements & impersonation index rollback

This runbook covers rolling back database changes shipped as migrations **0030** and **0031**, plus the related **payout statement** BullMQ work. For the later lot-voiding rollback in **0033**, see the note below until the unified migration rollback runbook replaces this file.

## What changed

### Migration 0030 (`0030_payout_statement_url.sql`)

- Adds nullable columns on `payout`:
  - `statement_url` — pointer to a generated PDF (e.g. Spaces object URL).
  - `statement_generation_error` — last terminal error from the statement pipeline after retries.

### Migration 0031 (`0031_domain_events_impersonation_index.sql`)

- Adds partial index `domain_events_impersonation_idx` on `domain_events (event_type)` where `event_type` is impersonation-related, for faster audit queries.

### Migration 0033 (`0033_lot_voided_archived_seller.sql`)

- Adds `voided_reason` and `archived_seller` columns to `lot`.
- Adds the `voided` label to the PostgreSQL `lot_status` enum.
- Rollback now converts any `lot.status='voided'` rows to `cancelled` before dropping the two columns.
- PostgreSQL cannot safely drop enum labels in this rollback; the `voided` enum value persists cosmetically in the type definition but becomes unreachable through application code after rollback.

### Application behaviour (not SQL)

- Worker queue **`payout-statements`** runs `generate-payout-statement` jobs that populate `statement_url` / `statement_generation_error`.

## Roll back code only (recommended first step)

Deploy a build that no longer reads or writes these columns and does not enqueue statement jobs.

- **Safe** while columns remain: unused columns and an extra index do not break reads/writes that ignore them.
- **Risk**: if old code is still running somewhere, it can still write URLs or enqueue jobs after you intended to stop.

## Roll back code + SQL

Use when you must remove schema surface area or the index.

1. **Stop writers**: deploy code that does not enqueue payout-statement jobs and does not reference `statement_url` / `statement_generation_error`.
2. **Drain BullMQ** (see below).
3. Apply SQL rollbacks in reverse order of concern:
   - `0031_rollback.sql` — drops `domain_events_impersonation_idx`.
   - `0030_rollback.sql` — drops `statement_url` and `statement_generation_error` from `payout`.

### Data loss when dropping 0030 columns

- Any **database values** in `statement_url` for payouts that already received a PDF link are **lost** on `DROP COLUMN`.
- **Objects in Spaces** (or your object store) are **not** deleted by this SQL; only the **DB pointer** is removed. Orphan objects may remain until lifecycle/cleanup policies remove them.

## In-flight `payout-statements` BullMQ jobs during rollback

Before deploying rollback builds or running destructive SQL:

1. **Pause or drain** the `payout-statements` queue so no job completes against a schema you are about to change.
2. Wait for **active** jobs to finish or move stuck jobs to failed after investigation.
3. Deploy the rollback build, then run SQL companions if required.

Skipping this risks jobs failing mid-flight, duplicate work after re-migration, or inconsistent `statement_url` / error columns relative to actual PDFs.

## Known boundaries

| Asset | Rollback impact |
| --- | --- |
| PDF blobs in Spaces | **Retained**; SQL does not delete objects. |
| `payout.statement_url` | **Destroyed** on 0030 rollback — UI and APIs lose the link. |
| `payout.statement_generation_error` | **Destroyed** on 0030 rollback — audit text in DB is lost. |
| Impersonation index | **Removed** on 0031 rollback — audit queries may slow until the index is recreated. |

## Re-apply after rollback

Run normal migrations from the journal (or re-apply `0030` / `0031` SQL) before shipping code that depends on the columns or index again.
