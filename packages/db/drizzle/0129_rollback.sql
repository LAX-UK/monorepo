-- Rollback: onsite_event.sale_id link (0129_onsite_event_sale_link.sql)
DROP INDEX IF EXISTS "onsite_event_sale_id_idx";
ALTER TABLE "onsite_event" DROP CONSTRAINT IF EXISTS "onsite_event_sale_id_sale_id_fk";
ALTER TABLE "onsite_event" DROP COLUMN IF EXISTS "sale_id";
