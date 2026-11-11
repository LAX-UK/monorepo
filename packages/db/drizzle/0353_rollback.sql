-- Rollback for 0353_payment_group_refund_state. Roll back the application release first: it
-- writes both columns from refund events and reads them to announce a refund once. Without them
-- the previous release announces a courier refund and an unattributed excess on every refund event
-- of the group, as before.
SET LOCAL lock_timeout = '5s';

ALTER TABLE "payment_group" DROP CONSTRAINT IF EXISTS "payment_group_refund_unattributed_check";
ALTER TABLE "payment_group_delivery" DROP CONSTRAINT IF EXISTS "payment_group_delivery_refunded_pence_check";
ALTER TABLE "payment_group" DROP COLUMN IF EXISTS "refund_unattributed_pence";
ALTER TABLE "payment_group_delivery" DROP COLUMN IF EXISTS "refunded_pence";
