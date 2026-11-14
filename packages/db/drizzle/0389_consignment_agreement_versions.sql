-- A signed consignment agreement is a record: a seller's sale is priced on its commission, and the
-- snapshot keeps pointing at the agreement row it was priced on. Until now a correction rewrote
-- that row in place, so the snapshot's agreement (and its signed PDF) could change under it. From
-- here an edit to a signed agreement adds the next version as a new row and marks the one it
-- replaces superseded (when, and by which row). A superseded version is frozen: the terms it was
-- signed on, its signed PDF and its place in the history never change again, for any role, the
-- owner included. Each consignment has exactly one current version, the one not superseded; reads
-- of "the agreement" select it. Snapshots and payouts keep their reference to the version they
-- were priced on (sale_seller_terms.agreement_id is unchanged).
-- Additive: existing rows become version 1 and stay current. An unsigned proposal is still
-- updated in place (nothing is priced on it), so only a signed row is ever superseded.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "consignment_agreement"
  ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS "superseded_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "superseded_by" uuid;
--> statement-breakpoint
DO $$
BEGIN
  -- Deferred: the superseded row names its successor in the same transaction that inserts it,
  -- before the successor can take the consignment's one current place.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consignment_agreement_superseded_by_fkey') THEN
    ALTER TABLE "consignment_agreement"
      ADD CONSTRAINT "consignment_agreement_superseded_by_fkey"
      FOREIGN KEY ("superseded_by") REFERENCES "consignment_agreement"("id")
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
  -- Superseded says when and by which other row, together; only a signed version is superseded.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consignment_agreement_superseded_ck') THEN
    ALTER TABLE "consignment_agreement"
      ADD CONSTRAINT "consignment_agreement_superseded_ck" CHECK (
        ("superseded_at" IS NULL AND "superseded_by" IS NULL)
        OR (
          "superseded_at" IS NOT NULL AND "superseded_by" IS NOT NULL
          AND "superseded_by" <> "id" AND "accepted_at" IS NOT NULL
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consignment_agreement_version_ck') THEN
    ALTER TABLE "consignment_agreement"
      ADD CONSTRAINT "consignment_agreement_version_ck" CHECK ("version" >= 1);
  END IF;
END $$;
--> statement-breakpoint
-- One current version per consignment (the index keeps its name, so a racing second insert is
-- still recognised by it), and each version number once.
DROP INDEX IF EXISTS "consignment_agreement_submission_id_uidx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "consignment_agreement_submission_id_uidx"
  ON "consignment_agreement" ("submission_id") WHERE "superseded_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "consignment_agreement_submission_version_uidx"
  ON "consignment_agreement" ("submission_id", "version");
--> statement-breakpoint
-- A superseded version keeps what was signed and priced, who signed and recorded it, and its place
-- in the history. Only what is not part of the agreement may still change on it: a user reference
-- cleared (ON DELETE SET NULL, never re-pointed), reminders and updated_at. It is not deleted
-- either, unless its consignment is: a consignment deleted takes its whole history.
CREATE OR REPLACE FUNCTION "consignment_agreement_superseded_frozen"() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- During the cascade from item_submission the parent row is already gone.
    IF OLD."superseded_at" IS NULL
      OR NOT EXISTS (SELECT 1 FROM "item_submission" WHERE "id" = OLD."submission_id") THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'consignment_agreement row % is superseded: a superseded version is never deleted', OLD."id"
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."superseded_at" IS NULL THEN
    RETURN NEW;
  END IF;
  IF (
    NEW."id", NEW."created_at", NEW."submission_id", NEW."legal_entity_id", NEW."terms_version",
    NEW."estimate_low", NEW."estimate_high", NEW."reserve_price", NEW."commission_percent",
    NEW."relist_reserve_floor", NEW."currency", NEW."proposed_at", NEW."accepted_at", NEW."source",
    NEW."signed_document_id", NEW."record_reason", NEW."replaces_agreement_id", NEW."version",
    NEW."superseded_at", NEW."superseded_by"
  ) IS NOT DISTINCT FROM (
    OLD."id", OLD."created_at", OLD."submission_id", OLD."legal_entity_id", OLD."terms_version",
    OLD."estimate_low", OLD."estimate_high", OLD."reserve_price", OLD."commission_percent",
    OLD."relist_reserve_floor", OLD."currency", OLD."proposed_at", OLD."accepted_at", OLD."source",
    OLD."signed_document_id", OLD."record_reason", OLD."replaces_agreement_id", OLD."version",
    OLD."superseded_at", OLD."superseded_by"
  )
  -- A user reference may be cleared, never changed to someone else.
  AND (NEW."proposed_by_user_id" IS NOT DISTINCT FROM OLD."proposed_by_user_id" OR NEW."proposed_by_user_id" IS NULL)
  AND (NEW."accepted_by_user_id" IS NOT DISTINCT FROM OLD."accepted_by_user_id" OR NEW."accepted_by_user_id" IS NULL)
  AND (NEW."recorded_by_user_id" IS NOT DISTINCT FROM OLD."recorded_by_user_id" OR NEW."recorded_by_user_id" IS NULL)
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'consignment_agreement row % is superseded: a superseded version never changes', OLD."id"
    USING ERRCODE = 'restrict_violation';
END;
$fn$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "consignment_agreement_superseded_frozen" ON "consignment_agreement";
--> statement-breakpoint
CREATE TRIGGER "consignment_agreement_superseded_frozen"
  BEFORE UPDATE OR DELETE ON "consignment_agreement"
  FOR EACH ROW EXECUTE FUNCTION "consignment_agreement_superseded_frozen"();
