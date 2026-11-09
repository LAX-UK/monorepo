-- Rollback for 0338_shop_framing_on_editions. Roll back the application release first. Baskets
-- keep their prints but lose the framing chosen for them; editions go back to selling unframed.
-- shop_artwork.print_frame was never changed, so the old descriptions are still there.
BEGIN;

SET LOCAL lock_timeout = '5s';
ALTER TABLE "shop_basket_line" DROP CONSTRAINT IF EXISTS "shop_basket_line_framing_on_print_ck";
ALTER TABLE "shop_basket_line" DROP CONSTRAINT IF EXISTS "shop_basket_line_framing_option_id_fk";
ALTER TABLE "shop_basket_line" DROP COLUMN IF EXISTS "framing_option_id";
DROP TABLE IF EXISTS "shop_edition_framing";

COMMIT;
