-- Rolls back 0260. Leads first seen through an enquiry are removed; erasures already applied stay
-- applied (the redacted values cannot be restored), only their dates are dropped.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DELETE FROM "shop_guest_customer" g
WHERE g."source" <> 'shop_checkout'
  AND NOT EXISTS (SELECT 1 FROM "shop_order" o WHERE o."guest_customer_id" = g."id");
--> statement-breakpoint
DROP INDEX IF EXISTS "shop_order_invoice_purge_due_idx";
--> statement-breakpoint
ALTER TABLE "shop_order" DROP COLUMN IF EXISTS "invoice_data_purged_at";
--> statement-breakpoint
ALTER TABLE "shop_order" DROP COLUMN IF EXISTS "personal_data_erased_at";
--> statement-breakpoint
ALTER TABLE "shop_guest_customer" DROP CONSTRAINT IF EXISTS "shop_guest_customer_erasure_pair_ck";
--> statement-breakpoint
ALTER TABLE "shop_guest_customer" DROP COLUMN IF EXISTS "erased_by_subject_id";
--> statement-breakpoint
ALTER TABLE "shop_guest_customer" DROP COLUMN IF EXISTS "erased_at";
--> statement-breakpoint
ALTER TABLE "shop_guest_customer" DROP CONSTRAINT IF EXISTS "shop_guest_customer_enquiry_count_ck";
--> statement-breakpoint
ALTER TABLE "shop_guest_customer" DROP COLUMN IF EXISTS "last_enquiry_at";
--> statement-breakpoint
ALTER TABLE "shop_guest_customer" DROP COLUMN IF EXISTS "enquiry_count";
--> statement-breakpoint
ALTER TABLE "shop_guest_customer" DROP COLUMN IF EXISTS "checkout_started_at";
--> statement-breakpoint
ALTER TABLE "shop_guest_customer" DROP CONSTRAINT IF EXISTS "shop_guest_customer_source_ck";
--> statement-breakpoint
ALTER TABLE "shop_guest_customer" DROP COLUMN IF EXISTS "source";
--> statement-breakpoint
DROP INDEX IF EXISTS "shop_general_enquiry_guest_email_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "shop_artwork_interest_guest_email_idx";
--> statement-breakpoint
ALTER TABLE "shop_artwork_interest" DROP CONSTRAINT IF EXISTS "shop_artwork_interest_reference_ck";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "shop_artwork_interest_reference_trg" ON "shop_artwork_interest";
--> statement-breakpoint
DROP FUNCTION IF EXISTS "shop_artwork_interest_assign_reference"();
--> statement-breakpoint
DROP INDEX IF EXISTS "shop_artwork_interest_reference_uid";
--> statement-breakpoint
DROP INDEX IF EXISTS "shop_general_enquiry_reference_uid";
--> statement-breakpoint
ALTER TABLE "shop_artwork_interest" DROP COLUMN IF EXISTS "reference";
--> statement-breakpoint
ALTER TABLE "shop_general_enquiry" DROP COLUMN IF EXISTS "reference";
--> statement-breakpoint
DROP SEQUENCE IF EXISTS "shop_enquiry_reference_seq";
