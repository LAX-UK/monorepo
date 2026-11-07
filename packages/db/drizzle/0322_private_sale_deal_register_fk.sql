-- A private sale deal names the artwork register entry for its work. The column held text with no
-- constraint, so nothing stopped a value that is not a register entry. It becomes a uuid that
-- references artwork_register, like the lot's link, so a deal cannot point at a work that does not exist.
-- Nothing has written this column yet, but a value is never dropped silently: any value that is
-- not the id of a register entry stops the migration, so someone decides what it meant.
-- The conversion takes a brief lock on private_sale_deal; the table is small.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DO $$
DECLARE
  unconvertible integer;
BEGIN
  SELECT count(*) INTO unconvertible
  FROM "private_sale_deal" d
  WHERE d."artwork_register_id" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM "artwork_register" r
      WHERE r."id"::text = lower(btrim(d."artwork_register_id"))
    );
  IF unconvertible > 0 THEN
    RAISE EXCEPTION 'private_sale_deal.artwork_register_id has % value(s) that are not an artwork register id; resolve them before migrating', unconvertible;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "private_sale_deal"
  ALTER COLUMN "artwork_register_id" TYPE uuid USING lower(btrim("artwork_register_id"))::uuid;
--> statement-breakpoint
ALTER TABLE "private_sale_deal"
  ADD CONSTRAINT "private_sale_deal_artwork_register_id_fk"
  FOREIGN KEY ("artwork_register_id") REFERENCES "artwork_register" ("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "private_sale_deal_artwork_register_idx"
  ON "private_sale_deal" ("artwork_register_id")
  WHERE "artwork_register_id" IS NOT NULL;
