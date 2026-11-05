-- A sale made in the gallery is recorded in the artwork register with an explicit reference kind,
-- 'gallery_sale', whose id is the Zoho product that said so. Until now a sold artwork carried the
-- reference of the place that sold it, and a gallery sale had nowhere to say where it happened.
-- Additive: the check only widens what the reference kind may be, so the running services keep
-- working until they restart.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "artwork_register" DROP CONSTRAINT IF EXISTS "artwork_register_offer_ref_kind_check";
--> statement-breakpoint
ALTER TABLE "artwork_register" ADD CONSTRAINT "artwork_register_offer_ref_kind_check" CHECK (
  "offer_ref_kind" IS NULL
  OR "offer_ref_kind" IN ('shop_artwork', 'bid_lot', 'private_sale', 'gallery_sale')
);
