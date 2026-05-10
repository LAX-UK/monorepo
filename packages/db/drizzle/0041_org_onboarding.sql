-- Phase D: organisation multi-step onboarding progress + optional document label for kind=other

ALTER TABLE "legal_entity_document"
  ADD COLUMN "label" text;

CREATE TABLE "legal_entity_onboarding_progress" (
  "legal_entity_id" uuid NOT NULL REFERENCES "legal_entity"("id") ON DELETE CASCADE,
  "step_key" text NOT NULL,
  "completed_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("legal_entity_id", "step_key")
);

CREATE INDEX "legal_entity_onboarding_progress_entity_idx"
  ON "legal_entity_onboarding_progress" ("legal_entity_id");
