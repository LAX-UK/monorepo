ALTER TABLE "item_submission"
  ADD COLUMN IF NOT EXISTS "year_of_work" text,
  ADD COLUMN IF NOT EXISTS "is_signed" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "signature_note" text,
  ADD COLUMN IF NOT EXISTS "edition" text,
  ADD COLUMN IF NOT EXISTS "condition_self_report" text,
  ADD COLUMN IF NOT EXISTS "provenance" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "exhibitions" jsonb NOT NULL DEFAULT '[]'::jsonb;
