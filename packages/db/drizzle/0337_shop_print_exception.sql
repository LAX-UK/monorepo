-- A print that differs from the rest of its run (a remarque, a dedication, a different signature,
-- a condition note) is sold on its own. It moves to a listing of its own, which is a run of one
-- print with the new role "set_apart"; shop_print_exception keeps where the print came from and
-- what differs, so it can go back to the run while it is unsold.
-- Additive: one new table, and four run rules on shop_artwork widened to allow the new role. No
-- existing row changes, so running services keep working.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "shop_artwork"
  DROP CONSTRAINT IF EXISTS "shop_artwork_run_vocabulary_ck",
  DROP CONSTRAINT IF EXISTS "shop_artwork_run_size_ck",
  DROP CONSTRAINT IF EXISTS "shop_artwork_run_template_ck",
  DROP CONSTRAINT IF EXISTS "shop_artwork_run_link_ck";
--> statement-breakpoint
ALTER TABLE "shop_artwork"
  ADD CONSTRAINT "shop_artwork_run_vocabulary_ck" CHECK (
    ("run_kind" IS NULL OR "run_kind" IN ('limited', 'open'))
    AND ("run_role" IS NULL OR "run_role" IN ('main', 'proof', 'companion', 'set_apart'))
    AND ("run_template" IS NULL OR "run_template" IN ('lax_standard', 'custom'))
    AND ("proof_type" IS NULL OR "proof_type" IN ('ap', 'pp', 'hc'))
  ),
  -- A proof listing or a print set apart may hold a single print.
  ADD CONSTRAINT "shop_artwork_run_size_ck" CHECK (
    "run_kind" IS DISTINCT FROM 'limited'
    OR ("run_size" IS NOT NULL
      AND "run_size" BETWEEN CASE WHEN "run_role" IN ('proof', 'set_apart') THEN 1 ELSE 2 END AND 500)
  ),
  ADD CONSTRAINT "shop_artwork_run_template_ck" CHECK (
    ("run_kind" IS DISTINCT FROM 'limited' OR "run_role" IN ('proof', 'set_apart') OR "run_template" IS NOT NULL)
    AND ("run_kind" IS DISTINCT FROM 'open' OR "run_template" IS NULL)
    AND ("run_role" NOT IN ('proof', 'set_apart') OR "run_template" IS NULL)
  ),
  ADD CONSTRAINT "shop_artwork_run_link_ck" CHECK (
    (("run_role" IN ('proof', 'companion', 'set_apart')) = ("main_run_artwork_id" IS NOT NULL))
    AND (("run_role" = 'proof') = ("proof_type" IS NOT NULL))
    AND ("main_run_artwork_id" IS NULL OR "main_run_artwork_id" <> "id")
  );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_print_exception" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "edition_id" uuid NOT NULL REFERENCES "shop_edition"("id") ON DELETE RESTRICT,
  "run_artwork_id" uuid NOT NULL REFERENCES "shop_artwork"("id") ON DELETE RESTRICT,
  "listing_artwork_id" uuid NOT NULL REFERENCES "shop_artwork"("id") ON DELETE RESTRICT,
  "remarque_medium" text,
  "remarque_place" text,
  "dedicated" boolean NOT NULL DEFAULT false,
  "signature_kind" text,
  "signature_medium" text,
  "signature_place" text,
  "condition_note" text,
  "set_apart_by_subject_id" text NOT NULL,
  "set_apart_at" timestamp with time zone NOT NULL DEFAULT now(),
  "returned_by_subject_id" text,
  "returned_at" timestamp with time zone,
  CONSTRAINT "shop_print_exception_remarque_ck" CHECK (
    ("remarque_medium" IS NULL) = ("remarque_place" IS NULL)
    AND ("remarque_medium" IS NULL OR "remarque_medium" IN ('pencil', 'ink', 'coloured_pencil'))
    AND ("remarque_place" IS NULL OR "remarque_place" IN ('lower_margin', 'upper_margin', 'side_margin'))
  ),
  CONSTRAINT "shop_print_exception_signature_ck" CHECK (
    ("signature_kind" IS NULL AND "signature_medium" IS NULL AND "signature_place" IS NULL)
    OR ("signature_kind" IN ('plate_signed', 'estate_stamped', 'unsigned')
      AND "signature_medium" IS NULL AND "signature_place" IS NULL)
    OR ("signature_kind" = 'hand_signed'
      AND "signature_medium" IN ('pencil', 'ink') AND "signature_place" IN ('front_lower_margin', 'back'))
    OR ("signature_kind" = 'estate_signed'
      AND "signature_medium" IS NULL AND "signature_place" IN ('front_lower_margin', 'back'))
  ),
  CONSTRAINT "shop_print_exception_condition_ck" CHECK (
    "condition_note" IS NULL
    OR "condition_note" IN ('light_handling_marks', 'margin_toning', 'small_crease_in_margin')
  ),
  CONSTRAINT "shop_print_exception_difference_ck" CHECK (
    "remarque_medium" IS NOT NULL OR "dedicated" OR "signature_kind" IS NOT NULL
    OR "condition_note" IS NOT NULL
  ),
  CONSTRAINT "shop_print_exception_return_ck" CHECK (
    ("returned_at" IS NULL) = ("returned_by_subject_id" IS NULL)
  ),
  CONSTRAINT "shop_print_exception_listing_distinct_ck" CHECK ("listing_artwork_id" <> "run_artwork_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_print_exception_open_edition_uid"
  ON "shop_print_exception" ("edition_id") WHERE "returned_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_print_exception_listing_uid"
  ON "shop_print_exception" ("listing_artwork_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_print_exception_run_idx"
  ON "shop_print_exception" ("run_artwork_id");
