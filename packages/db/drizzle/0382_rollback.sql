-- Rollback for 0382_accounting_parked_documents. Roll back the release first, then this.
-- It restores 0379's requeue rule for api_app (which does not know parked documents; the domain
-- still refuses to requeue one). No data is changed. Also removes this migration's ledger row so
-- a later deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '5s';
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

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1811160000000;

COMMIT;
