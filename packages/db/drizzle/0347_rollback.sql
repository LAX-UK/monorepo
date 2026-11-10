-- Rollback for 0347_collection_storage_reminders. Roll back the application release first: the
-- worker's reminder sweep and the settings screen read these columns.
BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE "collection_place" DROP CONSTRAINT IF EXISTS "collection_place_storage_charge_check";
ALTER TABLE "collection_place" DROP COLUMN IF EXISTS "storage_charge_pence";
DROP INDEX IF EXISTS "lot_fulfilment_payment_cleared_at_idx";
ALTER TABLE "lot_fulfilment" DROP COLUMN IF EXISTS "payment_cleared_at";

COMMIT;
