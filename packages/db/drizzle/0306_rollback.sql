-- Rollback for 0306_shop_print_fulfilment. Roll back the application release first: shop-api reads
-- and writes these columns. Certificate rows keep their earlier columns; only what 0306 added goes.
SET LOCAL lock_timeout = '30s';

ALTER TABLE "shop_order_line" DROP CONSTRAINT IF EXISTS "shop_order_line_pack_confirmed_ck";

DROP INDEX IF EXISTS "shop_certificate_pending_idx";

ALTER TABLE "shop_certificate"
  DROP COLUMN IF EXISTS "issued_by_subject_id",
  DROP COLUMN IF EXISTS "authority_reference",
  DROP COLUMN IF EXISTS "print_label";

ALTER TABLE "shop_edition_facts"
  DROP CONSTRAINT IF EXISTS "shop_edition_facts_certificate_authority_ck";

ALTER TABLE "shop_edition_facts"
  DROP COLUMN IF EXISTS "certificate_authority_recorded_at",
  DROP COLUMN IF EXISTS "certificate_authority_recorded_by",
  DROP COLUMN IF EXISTS "certificate_authority_reference";

ALTER TABLE "shop_artwork" DROP CONSTRAINT IF EXISTS "shop_artwork_hors_commerce_approval_ck";

ALTER TABLE "shop_artwork"
  DROP COLUMN IF EXISTS "hors_commerce_approved_at",
  DROP COLUMN IF EXISTS "hors_commerce_approved_by_subject_id";
