-- Rollback for 0332_shop_delivery_quote. The table is dropped with any quote requests in it. Run it
-- only after the code that writes quote requests is rolled back: an order that was held for a
-- quote then expires on its own checkout expiry, so no print stays reserved.
BEGIN;

SET LOCAL lock_timeout = '5s';
DROP TABLE IF EXISTS "shop_delivery_quote";

COMMIT;
