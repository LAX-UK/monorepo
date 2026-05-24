DROP INDEX IF EXISTS "lot_sale_id_not_deleted_idx";
DROP INDEX IF EXISTS "lot_not_deleted_idx";
DROP INDEX IF EXISTS "sale_not_deleted_idx";

ALTER TABLE "lot_document" DROP COLUMN IF EXISTS "deleted_at";
ALTER TABLE "sale_document" DROP COLUMN IF EXISTS "deleted_at";

ALTER TABLE "lot" DROP COLUMN IF EXISTS "deleted_by_user_id";
ALTER TABLE "lot" DROP COLUMN IF EXISTS "deleted_at";

ALTER TABLE "sale" DROP COLUMN IF EXISTS "deleted_by_user_id";
ALTER TABLE "sale" DROP COLUMN IF EXISTS "deleted_at";
