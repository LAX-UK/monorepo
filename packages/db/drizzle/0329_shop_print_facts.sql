-- Print facts for a run: a blind stamp, who printed it and who published it, and the authority a
-- London Art Exchange certificate stands on (who gave it and the date of the letter). The names
-- come from a short list staff keep, held in shop_print_party; the facts store the name itself, so
-- renaming or removing a list entry never changes what a buyer was told.
-- Additive: new nullable columns and one defaulted column on shop_edition_facts, and one new
-- table, so running services keep working. Existing runs read as "no stamp", with no parties.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "shop_edition_facts"
  ADD COLUMN IF NOT EXISTS "stamp" text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "printed_by" text,
  ADD COLUMN IF NOT EXISTS "published_by_kind" text,
  ADD COLUMN IF NOT EXISTS "published_by_name" text,
  ADD COLUMN IF NOT EXISTS "certificate_authority_given_by" text,
  ADD COLUMN IF NOT EXISTS "certificate_authority_dated_on" date;
--> statement-breakpoint
ALTER TABLE "shop_edition_facts"
  ADD CONSTRAINT "shop_edition_facts_stamp_ck"
    CHECK ("stamp" IN ('none', 'publisher_blind', 'printer_blind', 'estate_back')),
  ADD CONSTRAINT "shop_edition_facts_printed_by_ck"
    CHECK ("printed_by" IS NULL OR ("printed_by" = btrim("printed_by") AND length("printed_by") BETWEEN 1 AND 80)),
  ADD CONSTRAINT "shop_edition_facts_published_by_ck"
    CHECK (
      ("published_by_kind" IS NULL AND "published_by_name" IS NULL)
      OR ("published_by_kind" IN ('artist', 'lax') AND "published_by_name" IS NULL)
      OR (
        "published_by_kind" = 'named'
        AND "published_by_name" = btrim("published_by_name")
        AND length("published_by_name") BETWEEN 1 AND 80
      )
    ),
  ADD CONSTRAINT "shop_edition_facts_authority_giver_ck"
    CHECK (
      ("certificate_authority_given_by" IS NULL) = ("certificate_authority_dated_on" IS NULL)
      AND ("certificate_authority_given_by" IS NULL OR "certificate_authority_given_by" IN ('artist', 'estate'))
      AND ("certificate_authority_given_by" IS NULL OR "certificate_issuer" = 'lax')
    );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_print_party" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_by" text,
  CONSTRAINT "shop_print_party_name_ck"
    CHECK ("name" = btrim("name") AND length("name") BETWEEN 1 AND 80)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_print_party_name_uid" ON "shop_print_party" (lower("name"));
