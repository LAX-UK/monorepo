-- Rolls back 0247. Run only after shop-api no longer offers more than 10 prints per owner: the
-- count checks are restored as they were and fail if a request or grant above 10 exists.
-- The stock reference default and its trigger come back for writers that omit stock_ref.
ALTER TABLE "shop_sale_authority_grant"
  DROP CONSTRAINT IF EXISTS "shop_sale_authority_grant_count_range";

ALTER TABLE "shop_sale_authority_grant"
  ADD CONSTRAINT "shop_sale_authority_grant_count_range"
  CHECK ("authorised_count" >= 0 AND "authorised_count" <= 10);

ALTER TABLE "shop_sale_authority_request"
  DROP CONSTRAINT IF EXISTS "shop_sale_authority_request_count_range";

ALTER TABLE "shop_sale_authority_request"
  ADD CONSTRAINT "shop_sale_authority_request_count_range"
  CHECK ("requested_count" >= 0 AND "requested_count" <= 10);

ALTER TABLE "shop_edition" ALTER COLUMN "stock_ref" SET DEFAULT 0;

CREATE OR REPLACE FUNCTION "shop_edition_default_stock_ref"() RETURNS trigger AS $$
BEGIN
  IF NEW."stock_ref" IS NULL OR NEW."stock_ref" = 0 THEN
    NEW."stock_ref" := COALESCE(NEW."edition_number", 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "shop_edition_default_stock_ref_trg" ON "shop_edition";

CREATE TRIGGER "shop_edition_default_stock_ref_trg"
  BEFORE INSERT ON "shop_edition"
  FOR EACH ROW EXECUTE FUNCTION "shop_edition_default_stock_ref"();
