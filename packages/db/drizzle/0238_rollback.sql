-- Forgets who sent each submission. Roll back the application release first: without the column,
-- consignors would again see every submission of their organisation.
DROP INDEX IF EXISTS "item_submission_entity_submitted_by_idx";

ALTER TABLE "item_submission" DROP CONSTRAINT IF EXISTS "item_submission_submitted_by_user_id_user_id_fk";

ALTER TABLE "item_submission" DROP COLUMN IF EXISTS "submitted_by_user_id";
