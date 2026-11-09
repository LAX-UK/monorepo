-- Rollback for 0345_shop_order_reaper_deferrals. The count is dropped with the column; nothing
-- else reads it. Run it only after the code that writes it is rolled back.
BEGIN;

SET LOCAL lock_timeout = '5s';
ALTER TABLE "shop_order" DROP COLUMN IF EXISTS "reaper_deferrals";

COMMIT;
