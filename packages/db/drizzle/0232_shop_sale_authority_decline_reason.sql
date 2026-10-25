-- Keeps LAX's reason for declining a sale limit request apart from the seller's own note, so the
-- seller sees why it was declined and their note is not overwritten.
-- Additive and nullable: requests declined before this column exist have no recorded reason, and an
-- older shop-api keeps working.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "shop_sale_authority_request" ADD COLUMN IF NOT EXISTS "decline_reason" text;
