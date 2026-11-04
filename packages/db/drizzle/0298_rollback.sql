-- Rollback for 0298_private_sale_deal_payment. Roll back the application release first: the
-- previous release neither writes nor reads deal payments or deal payout lines. Every deal
-- payment is lost, and a payout line that settles a deal is deleted, which changes the payout's
-- lines, so reconcile any payout that contains one before rolling back.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DROP INDEX IF EXISTS "payout_line_sale_deal_uidx";
--> statement-breakpoint
ALTER TABLE "payout_line" DROP CONSTRAINT IF EXISTS "payout_line_one_subject";
--> statement-breakpoint
DELETE FROM "payout_line" WHERE "private_sale_deal_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "payout_line" DROP CONSTRAINT IF EXISTS "payout_line_payment_required";
--> statement-breakpoint
ALTER TABLE "payout_line" ADD CONSTRAINT "payout_line_payment_required" CHECK (
  "kind" = 'adjustment'
  OR "kind" IN ('refund', 'dispute', 'chargeback', 'reversal')
  OR "payment_id" IS NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payout_line" DROP CONSTRAINT IF EXISTS "payout_line_private_sale_deal_id_fk";
--> statement-breakpoint
ALTER TABLE "payout_line" DROP COLUMN IF EXISTS "private_sale_deal_id";
--> statement-breakpoint
DROP TABLE IF EXISTS "private_sale_deal_payment";
--> statement-breakpoint
ALTER TABLE "private_sale_deal" DROP COLUMN IF EXISTS "invoice_reference";
