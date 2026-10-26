-- 'order_problem' stays on shop_general_enquiry_topic: PostgreSQL cannot drop an enum label.
-- Reports already sent keep it; an older shop-api only reads them back in the staff inbox.
ALTER TABLE "shop_fulfilment" DROP COLUMN IF EXISTS "cancelled_at";

ALTER TABLE "shop_fulfilment" DROP COLUMN IF EXISTS "ready_for_collection_at";

ALTER TABLE "shop_fulfilment" DROP COLUMN IF EXISTS "dispatched_at";

ALTER TABLE "shop_fulfilment" DROP COLUMN IF EXISTS "production_started_at";

DROP INDEX IF EXISTS "shop_order_reference_uid";

ALTER TABLE "shop_order" DROP COLUMN IF EXISTS "reference";

DROP SEQUENCE IF EXISTS "shop_order_reference_seq";
