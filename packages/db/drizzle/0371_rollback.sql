-- Rollback for 0371_reminder_candidate_indexes. Safe at any time: the indexes only speed up reads.
-- Also removes this migration's ledger row so a later deploy reapplies it.
SET LOCAL lock_timeout = '30s';

DROP INDEX IF EXISTS "payment_reminder_candidate_idx";
DROP INDEX IF EXISTS "private_sale_deal_payment_due_idx";
DROP INDEX IF EXISTS "private_sale_deal_collection_due_idx";

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1809777600000;
