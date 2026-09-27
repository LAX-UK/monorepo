ALTER TABLE "crm_record_link"
  ADD COLUMN IF NOT EXISTS "deletion_requested_at" timestamp with time zone;

ALTER TABLE "crm_record_link"
  ADD COLUMN IF NOT EXISTS "recycle_purged_at" timestamp with time zone;
