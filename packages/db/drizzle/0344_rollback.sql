-- Rollback for 0344_payment_refund. Roll back the application release first. The invoice document
-- goes back to the refund lines of the payout ledger, which this migration only copied from.
-- Refunds recorded since the migration are lost with the table.
BEGIN;

SET LOCAL lock_timeout = '5s';
DROP TABLE IF EXISTS "payment_refund";

COMMIT;
