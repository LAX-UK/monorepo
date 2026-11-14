-- Rollback for 0383_shop_invoices_books. Roll the release back first, then this.
-- When 0382 (accounting_parked_documents) has run, the parked-document rules are its own and stay
-- exactly as they are: only this migration's ledger row goes. When it has not, 0379's requeue rule
-- for api_app and 0368's `provider_sent_ck` are restored, the CHECK NOT VALID so parked rows
-- already stored stay as they are (no data is changed) while the earlier release can write no new
-- one. Removing the ledger row lets a later deploy reapply this migration.
BEGIN;

SET LOCAL lock_timeout = '5s';
DO $rollback$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1811160000000
  ) THEN
    ALTER TABLE "accounting_document" DROP CONSTRAINT IF EXISTS "accounting_document_provider_sent_ck";
    ALTER TABLE "accounting_document" ADD CONSTRAINT "accounting_document_provider_sent_ck" CHECK (
      "provider" IS NOT NULL
      OR ("attempts" = 0 AND "state" IN ('pending', 'cancelled'))
    ) NOT VALID;
    CREATE OR REPLACE FUNCTION "accounting_document_api_requeue_only"() RETURNS trigger
    LANGUAGE plpgsql AS $fn$
    BEGIN
      IF current_user <> 'api_app' THEN
        RETURN NEW;
      END IF;
      IF NOT COALESCE((
        (OLD."state" = 'failed'
          OR (OLD."state" = 'needs_review' AND OLD."review_lookup" = 'clear' AND OLD."provider_id" IS NULL))
        AND NEW."state" = 'pending'
        AND NEW."attempts" = OLD."attempts"
        AND NEW."last_error_class" IS NOT DISTINCT FROM OLD."last_error_class"
        AND NEW."lease_token" IS NULL AND NEW."lease_expires_at" IS NULL
        AND NEW."settles_at" IS NULL
        AND NEW."review_lookup" IS NULL AND NEW."needs_review_reason" IS NULL
        AND NEW."provider_id" IS NULL AND NEW."provider_number" IS NULL AND NEW."pdf_ref" IS NULL
        AND NEW."mismatch_field" IS NULL AND NEW."mismatch_difference_pence" IS NULL
      ), false) THEN
        RAISE EXCEPTION 'api_app may only requeue a failed or cleared document to pending'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
      RETURN NEW;
    END;
    $fn$;
  END IF;
END;
$rollback$;

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1811246400000;

COMMIT;
