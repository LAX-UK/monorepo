-- Rollback: voided lot columns (`voided` enum value cannot be dropped in PostgreSQL without recreating the type)
ALTER TABLE "lot" DROP COLUMN IF EXISTS "voided_reason";
ALTER TABLE "lot" DROP COLUMN IF EXISTS "archived_seller";
