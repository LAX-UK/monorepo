-- Rollback for 0359_reminder_candidate_indexes. Safe at any time: the indexes only speed up reads.
SET LOCAL lock_timeout = '30s';

DROP INDEX IF EXISTS "payment_reminder_candidate_idx";
DROP INDEX IF EXISTS "private_sale_deal_payment_due_idx";
DROP INDEX IF EXISTS "private_sale_deal_collection_due_idx";
