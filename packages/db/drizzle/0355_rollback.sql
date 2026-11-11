-- Rollback for 0355_payment_transfer_reference. Roll back the application release first: the
-- previous release neither reads nor writes this table. Transfers applied to another invoice are
-- then no longer recognised once their payment has completed.
SET LOCAL lock_timeout = '5s';

DROP INDEX IF EXISTS "payment_transfer_reference_customer_idx";
DROP TABLE IF EXISTS "payment_transfer_reference";
