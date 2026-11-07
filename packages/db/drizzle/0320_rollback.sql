-- Rollback for 0320_pay_held_since. Roll back the application release first: it writes both
-- columns when a hold begins and reads them when it is released. Without them a release moves
-- every unpaid invoice of the buyer, as before.
SET LOCAL lock_timeout = '5s';

ALTER TABLE "bid_user_profile" DROP COLUMN IF EXISTS "identity_held_since";
ALTER TABLE "legal_entity" DROP COLUMN IF EXISTS "pay_held_since";
