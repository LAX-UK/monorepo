ALTER TABLE "crm_record_link"
  ADD COLUMN IF NOT EXISTS "subject_id" text;

CREATE INDEX IF NOT EXISTS "crm_record_link_deal_subject_idx"
  ON "crm_record_link" ("subject_id")
  WHERE "entity_type" = 'deal' AND "erased_at" IS NULL;
