-- Consignor agreements for stock moves (register item ZI-5, option B of
-- docs/design/decision-pack-2026-11-17.md). Data only: no screen or route reads these yet.
--   consignor_agreement      what a consignor (a client, shop_party) agreed: the places LAX may
--                            offer their works (LAX Bid, lax.art, private sale), from and until
--                            when, an optional lowest price (pence) and commission (basis points),
--                            the signed file and a note. Replaced by a new version, never edited
--                            in place: a trigger lets a current row change only its status (to
--                            replaced or retired) and refuses deletes. `agreement_id` is the id of
--                            the first version and is shared by every version after it.
--   artwork_consignor_link   who consigned each original in the register: a client, or LAX itself.
--                            Append-only: the latest row is the consignor now. Every change after
--                            the first needs a reason (trigger).
-- Additive: the running release does not read these tables. Not Bid's consignment_agreement,
-- which belongs to a Bid submission and a legal entity (option C, rejected).
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consignor_agreement" (
  "id" uuid PRIMARY KEY NOT NULL,
  "agreement_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "party_id" uuid NOT NULL REFERENCES "shop_party"("id") ON DELETE RESTRICT,
  "replaces_id" uuid REFERENCES "consignor_agreement"("id") ON DELETE RESTRICT,
  "covers_lax_bid" boolean NOT NULL,
  "covers_lax_art" boolean NOT NULL,
  "covers_private_sale" boolean NOT NULL,
  "starts_on" date NOT NULL,
  "ends_on" date,
  "lowest_price_pence" integer,
  "commission_basis_points" integer,
  "signed_file_key" text NOT NULL,
  "note" text,
  "status" text DEFAULT 'current' NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "replaced_at" timestamp with time zone,
  "retired_at" timestamp with time zone,
  "retired_by" text,
  CONSTRAINT "consignor_agreement_version_check" CHECK ("version" >= 1),
  CONSTRAINT "consignor_agreement_lineage_check" CHECK (
    ("version" = 1) = ("replaces_id" IS NULL) AND ("version" = 1) = ("agreement_id" = "id")
  ),
  CONSTRAINT "consignor_agreement_places_check" CHECK (
    "covers_lax_bid" OR "covers_lax_art" OR "covers_private_sale"
  ),
  CONSTRAINT "consignor_agreement_dates_check" CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on"),
  CONSTRAINT "consignor_agreement_lowest_price_check" CHECK (
    "lowest_price_pence" IS NULL OR "lowest_price_pence" BETWEEN 1 AND 999999999
  ),
  CONSTRAINT "consignor_agreement_commission_check" CHECK (
    "commission_basis_points" IS NULL OR "commission_basis_points" BETWEEN 0 AND 10000
  ),
  CONSTRAINT "consignor_agreement_file_check" CHECK (
    char_length("signed_file_key") BETWEEN 1 AND 512
    AND "signed_file_key" ~ '^[A-Za-z0-9][A-Za-z0-9/._-]*$'
    AND "signed_file_key" !~ '(^|/)\.{0,2}(/|$)'
  ),
  CONSTRAINT "consignor_agreement_note_check" CHECK (
    "note" IS NULL OR (char_length("note") BETWEEN 1 AND 1000 AND "note" = btrim("note"))
  ),
  CONSTRAINT "consignor_agreement_status_check" CHECK ("status" IN ('current', 'replaced', 'retired')),
  CONSTRAINT "consignor_agreement_replaced_check" CHECK (("status" = 'replaced') = ("replaced_at" IS NOT NULL)),
  CONSTRAINT "consignor_agreement_retired_check" CHECK (
    ("status" = 'retired') = ("retired_at" IS NOT NULL)
    AND ("retired_at" IS NULL) = ("retired_by" IS NULL)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "consignor_agreement_version_uid"
  ON "consignor_agreement" ("agreement_id", "version");
--> statement-breakpoint
-- One current version per agreement; a version is replaced at most once.
CREATE UNIQUE INDEX IF NOT EXISTS "consignor_agreement_current_uid"
  ON "consignor_agreement" ("agreement_id") WHERE "status" = 'current';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "consignor_agreement_replaces_uid"
  ON "consignor_agreement" ("replaces_id") WHERE "replaces_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consignor_agreement_party_idx"
  ON "consignor_agreement" ("party_id", "status");
--> statement-breakpoint
-- A later version continues its agreement: same agreement and consignor, the next number, and it
-- replaces the current version.
CREATE OR REPLACE FUNCTION consignor_agreement_lineage() RETURNS trigger AS $$
DECLARE
  previous "consignor_agreement"%ROWTYPE;
BEGIN
  IF NEW."replaces_id" IS NOT NULL THEN
    SELECT * INTO previous FROM "consignor_agreement" WHERE "id" = NEW."replaces_id";
    IF previous."agreement_id" IS DISTINCT FROM NEW."agreement_id"
       OR previous."party_id" IS DISTINCT FROM NEW."party_id"
       OR previous."version" IS DISTINCT FROM NEW."version" - 1 THEN
      RAISE EXCEPTION 'consignor_agreement version % does not continue the version it replaces', NEW."version"
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "consignor_agreement_lineage" ON "consignor_agreement";
--> statement-breakpoint
CREATE TRIGGER "consignor_agreement_lineage"
  BEFORE INSERT ON "consignor_agreement"
  FOR EACH ROW EXECUTE FUNCTION consignor_agreement_lineage();
--> statement-breakpoint
-- Never edited in place, by any role: a current version may only become replaced or retired;
-- a replaced or retired one never changes again; nothing is deleted or truncated.
CREATE OR REPLACE FUNCTION consignor_agreement_frozen() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD."status" = 'current' AND NEW."status" IN ('replaced', 'retired')
       AND (NEW."id", NEW."agreement_id", NEW."version", NEW."party_id", NEW."replaces_id",
            NEW."covers_lax_bid", NEW."covers_lax_art", NEW."covers_private_sale",
            NEW."starts_on", NEW."ends_on", NEW."lowest_price_pence", NEW."commission_basis_points",
            NEW."signed_file_key", NEW."note", NEW."created_by", NEW."created_at")
           IS NOT DISTINCT FROM
           (OLD."id", OLD."agreement_id", OLD."version", OLD."party_id", OLD."replaces_id",
            OLD."covers_lax_bid", OLD."covers_lax_art", OLD."covers_private_sale",
            OLD."starts_on", OLD."ends_on", OLD."lowest_price_pence", OLD."commission_basis_points",
            OLD."signed_file_key", OLD."note", OLD."created_by", OLD."created_at") THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'consignor_agreement is replaced, never edited in place (% refused)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "consignor_agreement_frozen" ON "consignor_agreement";
--> statement-breakpoint
CREATE TRIGGER "consignor_agreement_frozen"
  BEFORE UPDATE OR DELETE ON "consignor_agreement"
  FOR EACH ROW EXECUTE FUNCTION consignor_agreement_frozen();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "consignor_agreement_no_truncate" ON "consignor_agreement";
--> statement-breakpoint
CREATE TRIGGER "consignor_agreement_no_truncate"
  BEFORE TRUNCATE ON "consignor_agreement"
  FOR EACH STATEMENT EXECUTE FUNCTION consignor_agreement_frozen();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "artwork_consignor_link" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "register_id" uuid NOT NULL REFERENCES "artwork_register"("id") ON DELETE RESTRICT,
  "consignor" text NOT NULL,
  "party_id" uuid REFERENCES "shop_party"("id") ON DELETE RESTRICT,
  "change_reason" text,
  "set_by" text NOT NULL,
  "set_at" timestamp with time zone NOT NULL,
  CONSTRAINT "artwork_consignor_link_consignor_check" CHECK ("consignor" IN ('client', 'lax')),
  CONSTRAINT "artwork_consignor_link_party_check" CHECK (("consignor" = 'client') = ("party_id" IS NOT NULL)),
  CONSTRAINT "artwork_consignor_link_reason_check" CHECK (
    "change_reason" IS NULL
    OR (char_length("change_reason") BETWEEN 1 AND 500 AND "change_reason" = btrim("change_reason"))
  )
);
--> statement-breakpoint
-- The latest row per artwork is its consignor now; a later change is stamped strictly after.
CREATE UNIQUE INDEX IF NOT EXISTS "artwork_consignor_link_register_uid"
  ON "artwork_consignor_link" ("register_id", "set_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artwork_consignor_link_party_idx"
  ON "artwork_consignor_link" ("party_id") WHERE "party_id" IS NOT NULL;
--> statement-breakpoint
-- The first consignor of a work needs no reason; every change after it does.
CREATE OR REPLACE FUNCTION artwork_consignor_link_reason() RETURNS trigger AS $$
BEGIN
  IF NEW."change_reason" IS NULL
     AND EXISTS (SELECT 1 FROM "artwork_consignor_link" WHERE "register_id" = NEW."register_id") THEN
    RAISE EXCEPTION 'artwork_consignor_link: a change of consignor needs a reason'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "artwork_consignor_link_reason" ON "artwork_consignor_link";
--> statement-breakpoint
CREATE TRIGGER "artwork_consignor_link_reason"
  BEFORE INSERT ON "artwork_consignor_link"
  FOR EACH ROW EXECUTE FUNCTION artwork_consignor_link_reason();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION artwork_consignor_link_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'artwork_consignor_link is append-only (% refused)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "artwork_consignor_link_append_only" ON "artwork_consignor_link";
--> statement-breakpoint
CREATE TRIGGER "artwork_consignor_link_append_only"
  BEFORE UPDATE OR DELETE ON "artwork_consignor_link"
  FOR EACH ROW EXECUTE FUNCTION artwork_consignor_link_append_only();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "artwork_consignor_link_no_truncate" ON "artwork_consignor_link";
--> statement-breakpoint
CREATE TRIGGER "artwork_consignor_link_no_truncate"
  BEFORE TRUNCATE ON "artwork_consignor_link"
  FOR EACH STATEMENT EXECUTE FUNCTION artwork_consignor_link_append_only();
