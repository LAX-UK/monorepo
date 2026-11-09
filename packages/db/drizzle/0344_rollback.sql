-- Rollback for 0344_collection_lot_previous_status. Roll back the application release first: the
-- column is only read by the desk's undo, which falls back to its old behaviour without it.
BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE "collection_booking_lot" DROP COLUMN IF EXISTS "previous_fulfilment_status";

COMMIT;
