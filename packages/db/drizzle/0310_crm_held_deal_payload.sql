-- A paid purchase whose buyer has no converted Zoho Contact yet is held in crm_record_link until
-- an admin converts the lead; the deal fields wait in held_payload. Additive and nullable.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "crm_record_link" ADD COLUMN IF NOT EXISTS "held_payload" jsonb;
