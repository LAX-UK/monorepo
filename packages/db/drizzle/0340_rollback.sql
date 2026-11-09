-- Rollback for 0340_shop_delivery_quote_carrier. The two columns are dropped with what staff wrote
-- in them. Run it only after the code that writes them is rolled back; a quote already sent keeps
-- its price, and the buyer still sees it, without the carrier's name.
BEGIN;

SET LOCAL lock_timeout = '5s';
ALTER TABLE "shop_delivery_quote" DROP CONSTRAINT IF EXISTS "shop_delivery_quote_carrier_check";
ALTER TABLE "shop_delivery_quote" DROP COLUMN IF EXISTS "decline_note";
ALTER TABLE "shop_delivery_quote" DROP COLUMN IF EXISTS "quoted_carrier";

COMMIT;
