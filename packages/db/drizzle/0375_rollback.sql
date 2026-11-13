-- Rollback for 0375_payment_transfer_received. Roll back the application release first: it records
-- the column from partially-funded notices and reads it for the Pay page. Without it the previous
-- release shows no progress for a part-paid single-invoice transfer, as before.
BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE "payment" DROP CONSTRAINT IF EXISTS "payment_transfer_received_pence_check";
ALTER TABLE "payment" DROP COLUMN IF EXISTS "transfer_received_pence";

COMMIT;
