-- Rollback for 0310_crm_held_deal_payload. Roll back the application release first.
-- Held deals that have not been released lose their stored fields.
SET LOCAL lock_timeout = '30s';

ALTER TABLE "crm_record_link" DROP COLUMN IF EXISTS "held_payload";
