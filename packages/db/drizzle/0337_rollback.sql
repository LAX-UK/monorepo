-- Rollback for 0337_shop_print_exception. Roll back the application release first: the previous
-- release does not know the "set_apart" role. Return every print set apart to its run before
-- running this; it stops if a listing of one print is still in use.
BEGIN;

SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "shop_artwork" WHERE "run_role" = 'set_apart') THEN
    RAISE EXCEPTION 'Prints are still set apart. Return them to their runs first.';
  END IF;
END $$;

DROP TABLE IF EXISTS "shop_print_exception";

ALTER TABLE "shop_artwork"
  DROP CONSTRAINT IF EXISTS "shop_artwork_run_link_ck",
  DROP CONSTRAINT IF EXISTS "shop_artwork_run_template_ck",
  DROP CONSTRAINT IF EXISTS "shop_artwork_run_size_ck",
  DROP CONSTRAINT IF EXISTS "shop_artwork_run_vocabulary_ck";

ALTER TABLE "shop_artwork"
  ADD CONSTRAINT "shop_artwork_run_vocabulary_ck" CHECK (
    ("run_kind" IS NULL OR "run_kind" IN ('limited', 'open'))
    AND ("run_role" IS NULL OR "run_role" IN ('main', 'proof', 'companion'))
    AND ("run_template" IS NULL OR "run_template" IN ('lax_standard', 'custom'))
    AND ("proof_type" IS NULL OR "proof_type" IN ('ap', 'pp', 'hc'))
  ),
  ADD CONSTRAINT "shop_artwork_run_size_ck" CHECK (
    "run_kind" IS DISTINCT FROM 'limited'
    OR ("run_size" IS NOT NULL
      AND "run_size" BETWEEN CASE WHEN "run_role" = 'proof' THEN 1 ELSE 2 END AND 500)
  ),
  ADD CONSTRAINT "shop_artwork_run_template_ck" CHECK (
    ("run_kind" IS DISTINCT FROM 'limited' OR "run_role" = 'proof' OR "run_template" IS NOT NULL)
    AND ("run_kind" IS DISTINCT FROM 'open' OR "run_template" IS NULL)
    AND ("run_role" IS DISTINCT FROM 'proof' OR "run_template" IS NULL)
  ),
  ADD CONSTRAINT "shop_artwork_run_link_ck" CHECK (
    (("run_role" IN ('proof', 'companion')) = ("main_run_artwork_id" IS NOT NULL))
    AND (("run_role" = 'proof') = ("proof_type" IS NOT NULL))
    AND ("main_run_artwork_id" IS NULL OR "main_run_artwork_id" <> "id")
  );

COMMIT;
