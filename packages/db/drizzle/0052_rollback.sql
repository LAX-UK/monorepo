DROP TABLE IF EXISTS "lot_document";
ALTER TABLE "item_submission" DROP COLUMN IF EXISTS "assigned_to_user_id";
DROP TABLE IF EXISTS "lot_fulfilment";
DROP TYPE IF EXISTS "lot_fulfilment_method";
DROP TYPE IF EXISTS "lot_fulfilment_status";
