-- Rollback: voided lot columns.
-- PostgreSQL enum values cannot be safely dropped here without recreating the
-- type, so this rollback makes `voided` unreachable in data while the enum
-- label persists cosmetically in the type definition.
UPDATE "lot" SET "status" = 'cancelled' WHERE "status" = 'voided';
ALTER TABLE "lot" DROP COLUMN IF EXISTS "voided_reason";
ALTER TABLE "lot" DROP COLUMN IF EXISTS "archived_seller";
