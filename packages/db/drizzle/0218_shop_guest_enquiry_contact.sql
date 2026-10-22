-- Guest enquiries from lax.art: a row is linked to an account (identity_subject_id) or carries
-- the contact details the visitor typed. Signed-in rows may also carry edited contact details.
ALTER TABLE "shop_artwork_interest" ALTER COLUMN "identity_subject_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_artwork_interest"
  ADD COLUMN IF NOT EXISTS "contact_name" text,
  ADD COLUMN IF NOT EXISTS "contact_email" text;
--> statement-breakpoint
ALTER TABLE "shop_artwork_interest"
  ADD CONSTRAINT "shop_artwork_interest_subject_or_contact_ck"
  CHECK ("identity_subject_id" IS NOT NULL OR "contact_email" IS NOT NULL);
--> statement-breakpoint
ALTER TABLE "shop_general_enquiry" ALTER COLUMN "identity_subject_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_general_enquiry"
  ADD COLUMN IF NOT EXISTS "contact_name" text,
  ADD COLUMN IF NOT EXISTS "contact_email" text;
--> statement-breakpoint
ALTER TABLE "shop_general_enquiry"
  ADD CONSTRAINT "shop_general_enquiry_subject_or_contact_ck"
  CHECK ("identity_subject_id" IS NOT NULL OR "contact_email" IS NOT NULL);
