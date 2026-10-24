-- Records who created a sale fee, so the person who created it cannot also approve it.
-- Additive and nullable: fees created before this column exist have no recorded creator, and an
-- older shop-api keeps working.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "shop_sale_fee" ADD COLUMN IF NOT EXISTS "created_by_subject_id" text;
