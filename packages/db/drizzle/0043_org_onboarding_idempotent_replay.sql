-- Idempotent replay of 0041 for databases that applied later migrations before 0041 was
-- registered in drizzle/meta/_journal.json. Safe to run on fresh databases (no-op if 0041 already ran).

ALTER TABLE "legal_entity_document" ADD COLUMN IF NOT EXISTS "label" text;

CREATE TABLE IF NOT EXISTS "legal_entity_onboarding_progress" (
  "legal_entity_id" uuid NOT NULL REFERENCES "legal_entity"("id") ON DELETE CASCADE,
  "step_key" text NOT NULL,
  "completed_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("legal_entity_id", "step_key")
);

CREATE INDEX IF NOT EXISTS "legal_entity_onboarding_progress_entity_idx"
  ON "legal_entity_onboarding_progress" ("legal_entity_id");
