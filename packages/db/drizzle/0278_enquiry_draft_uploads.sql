-- Visitors without an account can attach photos and documents to a private sale enquiry before
-- they send it. Those files belong to the draft they were uploaded for, not to a user, so the
-- owner becomes either a user or an enquiry draft, never both and never neither.
ALTER TABLE "upload_object" ALTER COLUMN "owner_user_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "upload_object" ADD COLUMN IF NOT EXISTS "enquiry_draft_id" uuid;
--> statement-breakpoint
ALTER TABLE "upload_object"
  ADD CONSTRAINT "upload_object_single_owner_check"
  CHECK (num_nonnulls("owner_user_id", "enquiry_draft_id") = 1);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upload_object_enquiry_draft_idx"
  ON "upload_object" ("enquiry_draft_id")
  WHERE "enquiry_draft_id" IS NOT NULL;
--> statement-breakpoint
-- Files that were never sent with an enquiry are found by the clean-up through this index.
CREATE INDEX IF NOT EXISTS "upload_object_enquiry_expiry_idx"
  ON "upload_object" ("expires_at")
  WHERE "kind" IN ('enquiry_image', 'enquiry_document');
