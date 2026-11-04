-- Rollback for 0299_artwork_register_gallery_sale_ref. Roll back the application release first: the
-- previous release does not know the 'gallery_sale' reference. A gallery sale loses its reference
-- and reads as sold with no place; its Zoho status still says Sold.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
UPDATE "artwork_register"
  SET "offer_ref_kind" = NULL, "offer_ref_id" = NULL
  WHERE "offer_ref_kind" = 'gallery_sale';
--> statement-breakpoint
ALTER TABLE "artwork_register" DROP CONSTRAINT IF EXISTS "artwork_register_offer_ref_kind_check";
--> statement-breakpoint
ALTER TABLE "artwork_register" ADD CONSTRAINT "artwork_register_offer_ref_kind_check" CHECK (
  "offer_ref_kind" IS NULL OR "offer_ref_kind" IN ('shop_artwork', 'bid_lot', 'private_sale')
);
