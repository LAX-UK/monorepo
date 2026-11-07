-- Rollback for 0322_payment_group_received. Roll back the application release first: it writes
-- both columns from bank transfer events and reads them for the Pay page. Without them a part-funded
-- transfer shows nothing received, as before.
SET LOCAL lock_timeout = '5s';

ALTER TABLE "payment_group" DROP CONSTRAINT IF EXISTS "payment_group_amount_received_check";
ALTER TABLE "payment_group" DROP COLUMN IF EXISTS "received_event_at";
ALTER TABLE "payment_group" DROP COLUMN IF EXISTS "amount_received";
