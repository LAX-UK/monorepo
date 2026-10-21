-- Guest rows have no account to fall back to, so they cannot survive the NOT NULL restore.
ALTER TABLE "shop_general_enquiry" DROP CONSTRAINT IF EXISTS "shop_general_enquiry_subject_or_contact_ck";
--> statement-breakpoint
DELETE FROM "shop_general_enquiry" WHERE "identity_subject_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "shop_general_enquiry" ALTER COLUMN "identity_subject_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_general_enquiry" DROP COLUMN IF EXISTS "contact_email";
--> statement-breakpoint
ALTER TABLE "shop_general_enquiry" DROP COLUMN IF EXISTS "contact_name";
--> statement-breakpoint
ALTER TABLE "shop_artwork_interest" DROP CONSTRAINT IF EXISTS "shop_artwork_interest_subject_or_contact_ck";
--> statement-breakpoint
DELETE FROM "shop_artwork_interest" WHERE "identity_subject_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "shop_artwork_interest" ALTER COLUMN "identity_subject_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_artwork_interest" DROP COLUMN IF EXISTS "contact_email";
--> statement-breakpoint
ALTER TABLE "shop_artwork_interest" DROP COLUMN IF EXISTS "contact_name";
