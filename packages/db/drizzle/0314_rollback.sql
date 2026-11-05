-- Rollback for 0314_shop_order_created_id_idx. The order list still works, only slower on large tables.
SET LOCAL lock_timeout = '30s';
DROP INDEX IF EXISTS "shop_order_created_id_idx";
