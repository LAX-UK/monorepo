CREATE INDEX IF NOT EXISTS "lot_attachable_idx"
  ON "lot" ("created_at" DESC)
  WHERE "status" = 'draft' AND "sale_id" IS NULL AND "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "lot_attachable_seller_idx"
  ON "lot" ("seller_legal_entity_id", "created_at" DESC)
  WHERE "status" = 'draft' AND "sale_id" IS NULL AND "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "lot_attachable_artist_idx"
  ON "lot" ("artist_id", "created_at" DESC)
  WHERE "status" = 'draft' AND "sale_id" IS NULL AND "deleted_at" IS NULL AND "artist_id" IS NOT NULL;
