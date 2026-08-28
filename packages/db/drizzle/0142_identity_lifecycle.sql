ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "identity_disabled_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "identity_disabled_reason" text,
  ADD COLUMN IF NOT EXISTS "merged_into_subject_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_merged_into_subject_idx"
  ON "user" ("merged_into_subject_id");
--> statement-breakpoint
ALTER TABLE "user"
  ADD CONSTRAINT "user_merged_into_subject_id_user_id_fk"
  FOREIGN KEY ("merged_into_subject_id") REFERENCES "user"("id")
  ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "user"
  ADD CONSTRAINT "user_cannot_merge_into_self"
  CHECK ("merged_into_subject_id" IS NULL OR "merged_into_subject_id" <> "id");
--> statement-breakpoint
ALTER TABLE "oauth_access_token"
  ADD COLUMN IF NOT EXISTS "refresh_family_id" text,
  ADD COLUMN IF NOT EXISTS "refresh_token_hash" text,
  ADD COLUMN IF NOT EXISTS "refresh_consumed_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_access_token_refresh_family_idx"
  ON "oauth_access_token" ("refresh_family_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_access_token_refresh_hash_uidx"
  ON "oauth_access_token" ("refresh_token_hash")
  WHERE "refresh_token_hash" IS NOT NULL;
