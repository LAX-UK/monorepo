-- Phase D rollback: org onboarding progress + document label

DROP INDEX IF EXISTS "legal_entity_onboarding_progress_entity_idx";

DROP TABLE IF EXISTS "legal_entity_onboarding_progress";

ALTER TABLE "legal_entity_document"
  DROP COLUMN IF EXISTS "label";
