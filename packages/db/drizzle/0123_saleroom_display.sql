DO $$ BEGIN
  CREATE TYPE "saleroom_display_pairing_status" AS ENUM ('pending', 'paired', 'revoked', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "saleroom_session"
  ADD COLUMN IF NOT EXISTS "display_overlay" jsonb,
  ADD COLUMN IF NOT EXISTS "display_overlay_at" timestamptz;

CREATE TABLE IF NOT EXISTS "saleroom_display_pairing" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sale_id" uuid REFERENCES "sale"("id") ON DELETE CASCADE,
  "device_code_hash" text NOT NULL,
  "user_code" text NOT NULL,
  "display_token_hash" text,
  "status" "saleroom_display_pairing_status" NOT NULL DEFAULT 'pending',
  "expires_at" timestamptz NOT NULL,
  "paired_at" timestamptz,
  "last_seen_at" timestamptz,
  "approved_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "saleroom_display_pairing_device_code_hash_idx"
  ON "saleroom_display_pairing" ("device_code_hash");

CREATE INDEX IF NOT EXISTS "saleroom_display_pairing_user_code_pending_idx"
  ON "saleroom_display_pairing" ("user_code")
  WHERE "status" = 'pending';

CREATE INDEX IF NOT EXISTS "saleroom_display_pairing_sale_id_idx"
  ON "saleroom_display_pairing" ("sale_id")
  WHERE "sale_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "saleroom_display_pairing_display_token_hash_idx"
  ON "saleroom_display_pairing" ("display_token_hash")
  WHERE "display_token_hash" IS NOT NULL;
