-- Rollback for 0278_enquiry_draft_uploads. Roll back the application release first: the previous
-- release assumes every upload belongs to a user. Files uploaded for a draft have no user to
-- hand them to, so their rows are removed; the stored objects are cleaned up with the rest of the
-- pending prefix.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DROP INDEX IF EXISTS "upload_object_enquiry_expiry_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "upload_object_enquiry_draft_idx";
--> statement-breakpoint
DELETE FROM "upload_object" WHERE "enquiry_draft_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "upload_object" DROP CONSTRAINT IF EXISTS "upload_object_single_owner_check";
--> statement-breakpoint
ALTER TABLE "upload_object" DROP COLUMN IF EXISTS "enquiry_draft_id";
--> statement-breakpoint
ALTER TABLE "upload_object" ALTER COLUMN "owner_user_id" SET NOT NULL;
