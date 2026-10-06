SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DO $$
DECLARE
  violating int;
BEGIN
  SELECT count(*) INTO violating
  FROM "shop_product_variant"
  WHERE "reserved" > "on_hand";
  IF violating > 0 THEN
    RAISE EXCEPTION '0204_shop_product_variant_reserved_lte_on_hand: % variant(s) have reserved > on_hand — reconcile stock before migrating', violating;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "shop_product_variant"
  ADD CONSTRAINT "shop_product_variant_reserved_lte_on_hand"
  CHECK ("reserved" <= "on_hand");
