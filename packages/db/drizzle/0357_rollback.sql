-- Rollback for 0357_private_sale_deal_artwork_unlinked_reason. Roll back the application release
-- first: the previous release neither reads nor writes the column. Deals that recorded a reason lose
-- it, and the deal desk then asks for the artwork again as before.
BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE "private_sale_deal" DROP CONSTRAINT IF EXISTS "private_sale_deal_artwork_unlinked_reason_check";
ALTER TABLE "private_sale_deal" DROP COLUMN IF EXISTS "artwork_unlinked_reason";

COMMIT;
