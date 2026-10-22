DROP TABLE IF EXISTS "shop_enquiry_note";

DROP INDEX IF EXISTS "shop_artwork_interest_inbox_idx";

DROP INDEX IF EXISTS "shop_general_enquiry_inbox_idx";

ALTER TABLE "shop_artwork_interest" DROP CONSTRAINT IF EXISTS "shop_artwork_interest_closed_at_ck";

ALTER TABLE "shop_general_enquiry" DROP CONSTRAINT IF EXISTS "shop_general_enquiry_closed_at_ck";

ALTER TABLE "shop_artwork_interest"
  DROP COLUMN IF EXISTS "updated_at",
  DROP COLUMN IF EXISTS "closed_at",
  DROP COLUMN IF EXISTS "assignee_subject",
  DROP COLUMN IF EXISTS "status";

ALTER TABLE "shop_general_enquiry"
  DROP COLUMN IF EXISTS "updated_at",
  DROP COLUMN IF EXISTS "closed_at",
  DROP COLUMN IF EXISTS "assignee_subject",
  DROP COLUMN IF EXISTS "status";

DROP TYPE IF EXISTS "public"."shop_enquiry_status";
