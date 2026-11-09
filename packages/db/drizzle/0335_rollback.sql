-- Rollback for 0335_private_sale_deal_follow_ups. The record of which reminders were sent is lost,
-- so the next run may send a reminder again. A bank transfer recorded by finance stays a paid
-- payment, but who recorded it and the bank's reference are lost: copy them out first if they
-- are needed. Roll back the application release first.
SET LOCAL lock_timeout = '5s';
DROP TABLE IF EXISTS "private_sale_deal_reminder";
ALTER TABLE "private_sale_deal_payment" DROP CONSTRAINT IF EXISTS "private_sale_deal_payment_recorded_check";
ALTER TABLE "private_sale_deal_payment" DROP COLUMN IF EXISTS "bank_reference";
ALTER TABLE "private_sale_deal_payment" DROP COLUMN IF EXISTS "recorded_by_user_id";
