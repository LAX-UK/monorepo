-- Rollback: payout statement columns
ALTER TABLE "payout" DROP COLUMN IF EXISTS "statement_url";
ALTER TABLE "payout" DROP COLUMN IF EXISTS "statement_generation_error";
