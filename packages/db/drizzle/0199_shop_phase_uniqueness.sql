SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DO $$
DECLARE
  dup_third_party int;
  dup_original int;
  dup_basket_line int;
BEGIN
  SELECT count(*) INTO dup_third_party FROM (
    SELECT "edition_id"
    FROM "shop_third_party_sale"
    WHERE "status" IN ('draft', 'recorded')
    GROUP BY "edition_id"
    HAVING count(*) > 1
  ) t;
  IF dup_third_party > 0 THEN
    RAISE EXCEPTION '0199_shop_phase_uniqueness: % duplicate open third_party_sale edition_id row(s) — resolve before migrating', dup_third_party;
  END IF;

  SELECT count(*) INTO dup_original FROM (
    SELECT "artwork_id"
    FROM "shop_original_sale"
    WHERE "status" NOT IN ('assigned', 'cancelled')
    GROUP BY "artwork_id"
    HAVING count(*) > 1
  ) t2;
  IF dup_original > 0 THEN
    RAISE EXCEPTION '0199_shop_phase_uniqueness: % duplicate open original_sale artwork_id row(s) — resolve before migrating', dup_original;
  END IF;

  SELECT count(*) INTO dup_basket_line FROM (
    SELECT "basket_id", "product_variant_id"
    FROM "shop_basket_line"
    WHERE "product_variant_id" IS NOT NULL
    GROUP BY "basket_id", "product_variant_id"
    HAVING count(*) > 1
  ) t3;
  IF dup_basket_line > 0 THEN
    RAISE EXCEPTION '0199_shop_phase_uniqueness: % duplicate basket_line (basket_id, product_variant_id) row(s) — resolve before migrating', dup_basket_line;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_third_party_sale_edition_open_uid"
  ON "shop_third_party_sale" ("edition_id")
  WHERE "status" IN ('draft', 'recorded');
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_original_sale_artwork_open_uid"
  ON "shop_original_sale" ("artwork_id")
  WHERE "status" NOT IN ('assigned', 'cancelled');
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_basket_line_variant_uid"
  ON "shop_basket_line" ("basket_id", "product_variant_id")
  WHERE "product_variant_id" IS NOT NULL;
