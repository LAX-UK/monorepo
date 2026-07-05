ALTER TABLE "legal_entity"
  ADD COLUMN IF NOT EXISTS "stripe_connect_requirements_errors" jsonb NOT NULL DEFAULT '[]'::jsonb;
