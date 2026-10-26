-- 'order_problem' stays on shop_general_enquiry_topic: PostgreSQL cannot drop an enum label.
-- Reports already sent keep it; an older shop-api only reads them back in the staff inbox.
-- The corrected shop_order_line.vat_pence values stay: they are the VAT each VAT-inclusive price
-- holds, and the overstated values the forward migration replaced are not restored.
ALTER TABLE "shop_order" DROP COLUMN IF EXISTS "fulfilment_vat_pence";

DROP TRIGGER IF EXISTS "shop_order_invoice_number_trg" ON "shop_order";

DROP FUNCTION IF EXISTS "shop_order_assign_invoice_number"();

DROP INDEX IF EXISTS "shop_order_invoice_number_uid";

ALTER TABLE "shop_order" DROP COLUMN IF EXISTS "invoice_number";

DROP TABLE IF EXISTS "shop_invoice_counter";

ALTER TABLE "shop_fulfilment" DROP COLUMN IF EXISTS "cancelled_at";

ALTER TABLE "shop_fulfilment" DROP COLUMN IF EXISTS "ready_for_collection_at";

ALTER TABLE "shop_fulfilment" DROP COLUMN IF EXISTS "dispatched_at";

ALTER TABLE "shop_fulfilment" DROP COLUMN IF EXISTS "production_started_at";

DROP INDEX IF EXISTS "shop_order_reference_uid";

ALTER TABLE "shop_order" DROP COLUMN IF EXISTS "reference";

DROP SEQUENCE IF EXISTS "shop_order_reference_seq";
