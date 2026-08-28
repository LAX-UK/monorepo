ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_cannot_merge_into_self";
--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_merged_into_subject_id_user_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "oauth_access_token_refresh_family_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "oauth_access_token_refresh_hash_uidx";
--> statement-breakpoint
ALTER TABLE "oauth_access_token"
  DROP COLUMN IF EXISTS "refresh_consumed_at",
  DROP COLUMN IF EXISTS "refresh_token_hash",
  DROP COLUMN IF EXISTS "refresh_family_id";
--> statement-breakpoint
DROP INDEX IF EXISTS "user_merged_into_subject_idx";
--> statement-breakpoint
ALTER TABLE "user"
  DROP COLUMN IF EXISTS "merged_into_subject_id",
  DROP COLUMN IF EXISTS "identity_disabled_reason",
  DROP COLUMN IF EXISTS "identity_disabled_at";
