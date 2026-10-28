-- Edition runs: a print run is described by its kind (limited or open), its size, who holds the
-- prints, and the facts staff confirm about it (signature, numbering, certificate). Additive:
-- every existing artwork with editions becomes the LAX standard run (24 prints, 10 buyer, 10
-- artist, 4 LAX) and every existing print keeps its number and its position in the sale order.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "shop_artwork"
  ADD COLUMN IF NOT EXISTS "run_kind" text,
  ADD COLUMN IF NOT EXISTS "run_role" text,
  ADD COLUMN IF NOT EXISTS "run_template" text,
  ADD COLUMN IF NOT EXISTS "run_size" integer,
  ADD COLUMN IF NOT EXISTS "alloc_buyer" integer,
  ADD COLUMN IF NOT EXISTS "alloc_artist" integer,
  ADD COLUMN IF NOT EXISTS "alloc_lax" integer,
  ADD COLUMN IF NOT EXISTS "open_default_artist_pct" integer,
  ADD COLUMN IF NOT EXISTS "main_run_artwork_id" uuid REFERENCES "shop_artwork"("id") ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS "proof_type" text,
  ADD COLUMN IF NOT EXISTS "proofs_kept_ap" integer,
  ADD COLUMN IF NOT EXISTS "proofs_kept_pp" integer,
  ADD COLUMN IF NOT EXISTS "proofs_kept_hc" integer,
  ADD COLUMN IF NOT EXISTS "proofs_kept_bat" integer;
--> statement-breakpoint
UPDATE "shop_artwork"
SET "run_kind" = 'limited',
    "run_role" = 'main',
    "run_template" = 'lax_standard',
    "run_size" = 24,
    "alloc_buyer" = 10,
    "alloc_artist" = 10,
    "alloc_lax" = 4,
    "proofs_kept_ap" = 0,
    "proofs_kept_pp" = 0,
    "proofs_kept_hc" = 0,
    "proofs_kept_bat" = 0
WHERE "eligible_for_edition_allocation" = true
  AND "run_kind" IS NULL;
--> statement-breakpoint
ALTER TABLE "shop_artwork"
  ADD CONSTRAINT "shop_artwork_run_vocabulary_ck" CHECK (
    ("run_kind" IS NULL OR "run_kind" IN ('limited', 'open'))
    AND ("run_role" IS NULL OR "run_role" IN ('main', 'proof', 'companion'))
    AND ("run_template" IS NULL OR "run_template" IN ('lax_standard', 'custom'))
    AND ("proof_type" IS NULL OR "proof_type" IN ('ap', 'pp', 'hc'))
  ),
  ADD CONSTRAINT "shop_artwork_run_presence_ck" CHECK (
    ("run_kind" IS NULL AND "run_role" IS NULL AND "run_template" IS NULL AND "run_size" IS NULL
      AND "alloc_buyer" IS NULL AND "alloc_artist" IS NULL AND "alloc_lax" IS NULL
      AND "open_default_artist_pct" IS NULL AND "main_run_artwork_id" IS NULL
      AND "proof_type" IS NULL AND "proofs_kept_ap" IS NULL AND "proofs_kept_pp" IS NULL
      AND "proofs_kept_hc" IS NULL AND "proofs_kept_bat" IS NULL)
    OR ("run_kind" IS NOT NULL AND "run_role" IS NOT NULL)
  ),
  -- Rule 1: a limited run holds 2 to 500 prints (a proof listing may hold 1); LAX standard is
  -- exactly 24 with 10 / 10 / 4.
  ADD CONSTRAINT "shop_artwork_run_size_ck" CHECK (
    "run_kind" IS DISTINCT FROM 'limited'
    OR ("run_size" IS NOT NULL
      AND "run_size" BETWEEN CASE WHEN "run_role" = 'proof' THEN 1 ELSE 2 END AND 500)
  ),
  ADD CONSTRAINT "shop_artwork_run_standard_ck" CHECK (
    "run_template" IS DISTINCT FROM 'lax_standard'
    OR ("run_kind" = 'limited' AND "run_role" <> 'proof' AND "run_size" = 24
      AND "alloc_buyer" = 10 AND "alloc_artist" = 10 AND "alloc_lax" = 4)
  ),
  ADD CONSTRAINT "shop_artwork_run_template_ck" CHECK (
    ("run_kind" IS DISTINCT FROM 'limited' OR "run_role" = 'proof' OR "run_template" IS NOT NULL)
    AND ("run_kind" IS DISTINCT FROM 'open' OR "run_template" IS NULL)
    AND ("run_role" IS DISTINCT FROM 'proof' OR "run_template" IS NULL)
  ),
  -- Rule 2: allocation counts are whole numbers, 0 or more, adding up to the size.
  ADD CONSTRAINT "shop_artwork_run_allocation_ck" CHECK (
    "run_kind" IS DISTINCT FROM 'limited'
    OR ("alloc_buyer" >= 0 AND "alloc_artist" >= 0 AND "alloc_lax" >= 0
      AND "alloc_buyer" + "alloc_artist" + "alloc_lax" = "run_size")
  ),
  -- Rule 3: buyer prints in a custom run need a linked original; a proof listing has none.
  ADD CONSTRAINT "shop_artwork_run_buyer_original_ck" CHECK (
    ("run_template" IS DISTINCT FROM 'custom' OR "alloc_buyer" = 0 OR "source_original_artwork_id" IS NOT NULL)
    AND ("run_role" IS DISTINCT FROM 'proof' OR "alloc_buyer" = 0)
  ),
  -- Rule 4: at least one print belongs to someone who can sell it.
  ADD CONSTRAINT "shop_artwork_run_sellable_owner_ck" CHECK (
    "run_kind" IS DISTINCT FROM 'limited' OR "alloc_artist" + "alloc_lax" >= 1
  ),
  -- Rule 5: an open run has no size, no allocation and no buyer prints; it carries a default split.
  ADD CONSTRAINT "shop_artwork_run_open_ck" CHECK (
    ("run_kind" IS DISTINCT FROM 'open'
      OR ("run_role" <> 'proof' AND "run_size" IS NULL AND "alloc_buyer" IS NULL
        AND "alloc_artist" IS NULL AND "alloc_lax" IS NULL
        AND "open_default_artist_pct" IS NOT NULL
        AND "open_default_artist_pct" BETWEEN 0 AND 100))
    AND ("run_kind" IS DISTINCT FROM 'limited' OR "open_default_artist_pct" IS NULL)
  ),
  -- Rules 9 and 10 (shape): proofs and companions link to a main run, proofs name their type,
  -- and no run links to itself. Same artist and same image are checked by the domain.
  ADD CONSTRAINT "shop_artwork_run_link_ck" CHECK (
    (("run_role" IN ('proof', 'companion')) = ("main_run_artwork_id" IS NOT NULL))
    AND (("run_role" = 'proof') = ("proof_type" IS NOT NULL))
    AND ("main_run_artwork_id" IS NULL OR "main_run_artwork_id" <> "id")
  ),
  ADD CONSTRAINT "shop_artwork_run_proofs_kept_ck" CHECK (
    ("proofs_kept_ap" IS NULL OR "proofs_kept_ap" >= 0)
    AND ("proofs_kept_pp" IS NULL OR "proofs_kept_pp" >= 0)
    AND ("proofs_kept_hc" IS NULL OR "proofs_kept_hc" >= 0)
    AND ("proofs_kept_bat" IS NULL OR "proofs_kept_bat" >= 0)
  );
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_artwork_main_run_idx" ON "shop_artwork" ("main_run_artwork_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_edition_facts" (
  "artwork_id" uuid PRIMARY KEY NOT NULL REFERENCES "shop_artwork"("id") ON DELETE RESTRICT,
  "numbering" text NOT NULL,
  "signature_kind" text NOT NULL,
  "signature_medium" text,
  "signature_place" text,
  "certificate_kind" text NOT NULL,
  "certificate_issuer" text,
  "certificate_form" text,
  "certificate_arrives" text,
  "certificate_within_weeks" integer,
  "certificate_numbered_to_match" boolean,
  "certificate_numbered_to_match_reason" text,
  "confirmed_by_subject_id" text,
  "confirmed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_edition_facts_vocabulary_ck" CHECK (
    "numbering" IN ('on_print', 'on_certificate', 'none')
    AND "signature_kind" IN ('hand_signed', 'plate_signed', 'estate_stamped', 'estate_signed', 'unsigned')
    AND ("signature_medium" IS NULL OR "signature_medium" IN ('pencil', 'ink'))
    AND ("signature_place" IS NULL OR "signature_place" IN ('front_lower_margin', 'back'))
    AND "certificate_kind" IN ('none', 'included')
    AND ("certificate_issuer" IS NULL OR "certificate_issuer" IN ('artist', 'publisher', 'lax'))
    AND ("certificate_form" IS NULL OR "certificate_form" IN ('paper', 'digital', 'both'))
    AND ("certificate_arrives" IS NULL OR "certificate_arrives" IN ('with_print', 'separately'))
  ),
  -- Rule 8: hand-signed needs a medium and a place; estate-signed needs a place; the rest take neither.
  CONSTRAINT "shop_edition_facts_signature_ck" CHECK (
    ("signature_kind" = 'hand_signed' AND "signature_medium" IS NOT NULL AND "signature_place" IS NOT NULL)
    OR ("signature_kind" = 'estate_signed' AND "signature_medium" IS NULL AND "signature_place" IS NOT NULL)
    OR ("signature_kind" IN ('plate_signed', 'estate_stamped', 'unsigned')
      AND "signature_medium" IS NULL AND "signature_place" IS NULL)
  ),
  CONSTRAINT "shop_edition_facts_certificate_ck" CHECK (
    ("certificate_kind" = 'none'
      AND "certificate_issuer" IS NULL AND "certificate_form" IS NULL
      AND "certificate_arrives" IS NULL AND "certificate_within_weeks" IS NULL
      AND "certificate_numbered_to_match" IS NULL AND "certificate_numbered_to_match_reason" IS NULL)
    OR ("certificate_kind" = 'included'
      AND "certificate_issuer" IS NOT NULL AND "certificate_form" IS NOT NULL
      AND "certificate_arrives" IS NOT NULL AND "certificate_numbered_to_match" IS NOT NULL
      AND (("certificate_arrives" = 'separately') = ("certificate_within_weeks" IS NOT NULL))
      AND ("certificate_within_weeks" IS NULL OR "certificate_within_weeks" BETWEEN 1 AND 52))
  ),
  -- Rule 6: numbering on the certificate needs a certificate numbered to match.
  CONSTRAINT "shop_edition_facts_numbering_certificate_ck" CHECK (
    "numbering" <> 'on_certificate'
    OR ("certificate_kind" = 'included' AND "certificate_numbered_to_match" = true)
  ),
  -- Rule 7: a numbered run with a certificate matches it, unless staff record why not.
  CONSTRAINT "shop_edition_facts_numbered_to_match_ck" CHECK (
    "numbering" = 'none'
    OR "certificate_kind" = 'none'
    OR "certificate_numbered_to_match" = true
    OR length(btrim(coalesce("certificate_numbered_to_match_reason", ''))) > 0
  ),
  CONSTRAINT "shop_edition_facts_confirmed_ck" CHECK (
    ("confirmed_by_subject_id" IS NULL) = ("confirmed_at" IS NULL)
  )
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_edition_stock_batch" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "artwork_id" uuid NOT NULL REFERENCES "shop_artwork"("id") ON DELETE RESTRICT,
  "first_stock_ref" integer NOT NULL,
  "quantity" integer NOT NULL,
  "artist_count" integer NOT NULL,
  "lax_count" integer NOT NULL,
  "custody_status" "shop_edition_custody_status" NOT NULL,
  "storage_location" text,
  "added_by_subject_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_edition_stock_batch_quantity_ck" CHECK ("quantity" > 0 AND "first_stock_ref" > 0),
  CONSTRAINT "shop_edition_stock_batch_split_ck" CHECK (
    "artist_count" >= 0 AND "lax_count" >= 0 AND "artist_count" + "lax_count" = "quantity"
  ),
  CONSTRAINT "shop_edition_stock_batch_custody_ck" CHECK ("custody_status" IN ('unprinted', 'stored'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_edition_stock_batch_artwork_first_uid"
  ON "shop_edition_stock_batch" ("artwork_id", "first_stock_ref");
--> statement-breakpoint
ALTER TABLE "shop_edition" ALTER COLUMN "edition_number" DROP NOT NULL;
--> statement-breakpoint
-- stock_ref identifies a print in its run and orders picking. It is 0 only while a row is being
-- inserted by a writer that predates it; the trigger below then takes the edition number.
ALTER TABLE "shop_edition"
  ADD COLUMN IF NOT EXISTS "stock_ref" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "proof_number" integer,
  ADD COLUMN IF NOT EXISTS "storage_location" text,
  ADD COLUMN IF NOT EXISTS "label_code" text;
--> statement-breakpoint
UPDATE "shop_edition" SET "stock_ref" = "edition_number" WHERE "stock_ref" = 0;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "shop_edition_default_stock_ref"() RETURNS trigger AS $$
BEGIN
  IF NEW."stock_ref" IS NULL OR NEW."stock_ref" = 0 THEN
    NEW."stock_ref" := COALESCE(NEW."edition_number", 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "shop_edition_default_stock_ref_trg" ON "shop_edition";
--> statement-breakpoint
CREATE TRIGGER "shop_edition_default_stock_ref_trg"
  BEFORE INSERT ON "shop_edition"
  FOR EACH ROW EXECUTE FUNCTION "shop_edition_default_stock_ref"();
--> statement-breakpoint
ALTER TABLE "shop_edition"
  ADD CONSTRAINT "shop_edition_stock_ref_positive_ck" CHECK ("stock_ref" > 0),
  ADD CONSTRAINT "shop_edition_numbers_ck" CHECK (
    ("edition_number" IS NULL OR "edition_number" > 0)
    AND ("proof_number" IS NULL OR "proof_number" > 0)
    AND ("edition_number" IS NULL OR "proof_number" IS NULL)
  );
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_edition_artwork_stock_ref_uid"
  ON "shop_edition" ("artwork_id", "stock_ref");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_edition_label_code_uid"
  ON "shop_edition" ("label_code") WHERE "label_code" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_edition_listing_sellable_stock_idx"
  ON "shop_edition" ("artwork_id", "listing_status", "sale_authorised_at", "stock_ref");
--> statement-breakpoint
ALTER TABLE "shop_order_line"
  ADD COLUMN IF NOT EXISTS "edition_facts_snapshot" jsonb,
  ADD COLUMN IF NOT EXISTS "print_label" text,
  ADD COLUMN IF NOT EXISTS "pack_confirmed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "pack_confirmed_by" text,
  ADD COLUMN IF NOT EXISTS "swapped_from_edition_id" uuid REFERENCES "shop_edition"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "shop_certificate"
  ADD COLUMN IF NOT EXISTS "certificate_reference" text,
  ADD COLUMN IF NOT EXISTS "issuer" text,
  ADD COLUMN IF NOT EXISTS "form" text;
--> statement-breakpoint
ALTER TABLE "shop_certificate"
  ADD CONSTRAINT "shop_certificate_vocabulary_ck" CHECK (
    ("issuer" IS NULL OR "issuer" IN ('artist', 'publisher', 'lax'))
    AND ("form" IS NULL OR "form" IN ('paper', 'digital', 'both'))
  );
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_certificate_reference_uid"
  ON "shop_certificate" ("certificate_reference") WHERE "certificate_reference" IS NOT NULL;
