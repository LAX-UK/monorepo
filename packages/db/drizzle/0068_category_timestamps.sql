ALTER TABLE "category" ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now();
ALTER TABLE "category" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();
