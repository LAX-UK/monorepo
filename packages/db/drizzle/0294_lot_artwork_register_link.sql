-- A Bid lot can point at the artwork register record it offers, so one place at a time holds
-- across lax.art and LAX Bid. Nullable: a lot with no link behaves as before. The register is
-- neutral and keeps the offer state; the lot only stores which record it belongs to.
-- Additive: the running release does not read this column.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "lot" ADD COLUMN IF NOT EXISTS "artwork_register_id" uuid
  REFERENCES "artwork_register"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lot_artwork_register_id_idx"
  ON "lot" ("artwork_register_id")
  WHERE "artwork_register_id" IS NOT NULL;
