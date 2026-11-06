-- Rollback for 0316_shop_order_created_id_idx. The order list still works, only slower on large tables.
BEGIN;

SET LOCAL lock_timeout = '5s';
DROP INDEX IF EXISTS "shop_order_created_id_idx";

COMMIT;
