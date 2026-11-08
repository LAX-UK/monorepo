-- Rollback for 0328_shop_delivery_regions. Both tables are dropped with what staff set in them;
-- nothing reads them yet, so the Shop and LAX Admin keep working (LAX Admin's Delivery regions
-- screen reports it cannot load).
BEGIN;

SET LOCAL lock_timeout = '5s';
DROP TABLE IF EXISTS "shop_delivery_restricted_country";
DROP TABLE IF EXISTS "shop_delivery_region";

COMMIT;
