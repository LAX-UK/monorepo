ALTER TABLE "sale" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;
ALTER TABLE "sale" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL;

ALTER TABLE "lot" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;
ALTER TABLE "lot" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL;

ALTER TABLE "sale_document" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;
ALTER TABLE "lot_document" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;

CREATE INDEX IF NOT EXISTS "sale_not_deleted_idx" ON "sale" ("id") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "lot_not_deleted_idx" ON "lot" ("id") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "lot_sale_id_not_deleted_idx" ON "lot" ("sale_id") WHERE "deleted_at" IS NULL;
