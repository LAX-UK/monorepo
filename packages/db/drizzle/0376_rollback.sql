-- Rollback for 0376_payment_transfer_received_intent. Roll back the application release first.
BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE "payment" DROP COLUMN IF EXISTS "transfer_received_payment_intent_id";

COMMIT;
