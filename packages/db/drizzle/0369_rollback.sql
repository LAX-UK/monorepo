-- Rollback for 0369_sale_seller_terms. Roll the release back first: nothing may still write seller
-- terms. The snapshots, the recorded-agreement columns and the finance setting are deleted with
-- their tables and columns; snapshots can be rebuilt from the invoices and agreements.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DROP TABLE IF EXISTS "bid_finance_setting";
--> statement-breakpoint
DROP TABLE IF EXISTS "sale_seller_terms";
--> statement-breakpoint
ALTER TABLE "consignment_agreement" DROP CONSTRAINT IF EXISTS "consignment_agreement_source_ck";
--> statement-breakpoint
ALTER TABLE "consignment_agreement"
  DROP COLUMN IF EXISTS "replaces_agreement_id",
  DROP COLUMN IF EXISTS "record_reason",
  DROP COLUMN IF EXISTS "signed_document_id",
  DROP COLUMN IF EXISTS "recorded_by_user_id",
  DROP COLUMN IF EXISTS "source";
