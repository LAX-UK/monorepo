-- A private sale deal can record why it has no register artwork: it is the seller's own work (not
-- gallery stock), or it is in Zoho but not linked to the register yet. Agreeing the deal needs one
-- or the other, or a linked artwork. Additive and nullable: existing deals stay as they are and
-- every running service keeps working.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "private_sale_deal" ADD COLUMN IF NOT EXISTS "artwork_unlinked_reason" text;
--> statement-breakpoint
ALTER TABLE "private_sale_deal"
  ADD CONSTRAINT "private_sale_deal_artwork_unlinked_reason_check"
  CHECK ("artwork_unlinked_reason" IS NULL OR "artwork_unlinked_reason" IN ('sellers_own_work', 'in_zoho_not_linked')) NOT VALID;
--> statement-breakpoint
ALTER TABLE "private_sale_deal" VALIDATE CONSTRAINT "private_sale_deal_artwork_unlinked_reason_check";
