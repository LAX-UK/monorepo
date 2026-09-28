DROP INDEX IF EXISTS "crm_record_link_deal_subject_idx";
ALTER TABLE "crm_record_link" DROP COLUMN IF EXISTS "subject_id";
