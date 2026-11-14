-- Shop invoices to Zoho Books (plan v2, flows 18-20). A Shop order's delivery outside the UK is a
-- quote whose VAT waits for the accountant, so its document is stored parked: `needs_review` with a
-- reason starting `accounting_parked_`, nothing tried, nothing owed, no provider. It sits in
-- "Needs a person" and is never sent.
--
-- The rules for a parked document are the same ones migration 0382 (Bid payments, open in
-- parallel) brings for Bid: 0368's `provider_sent_ck` also allows a parked review, and api_app may
-- never requeue a parked document (staff can cancel it, not try it again). This migration states
-- them again, word for word, so the Shop can park whether or not 0382 has run: re-stating a CHECK
-- and replacing the function with the same body changes nothing when 0382 already did. A refusal
-- is `insufficient_privilege` (42501), as before.
--
-- No table or column is added. The Shop app's and the worker's reads for the Shop invoice (the
-- buyer's invoice card, the projection's facts) are column grants applied by db:roles.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "accounting_document" DROP CONSTRAINT IF EXISTS "accounting_document_provider_sent_ck";
--> statement-breakpoint
ALTER TABLE "accounting_document" ADD CONSTRAINT "accounting_document_provider_sent_ck" CHECK (
  "provider" IS NOT NULL
  OR ("attempts" = 0 AND (
    "state" IN ('pending', 'cancelled')
    OR ("state" = 'needs_review' AND "review_lookup" = 'clear' AND "provider_id" IS NULL
      AND starts_with("needs_review_reason", 'accounting_parked_'))
  ))
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "accounting_document_api_requeue_only"() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF current_user <> 'api_app' THEN
    RETURN NEW;
  END IF;
  IF NOT COALESCE((
    (OLD."state" = 'failed'
      OR (OLD."state" = 'needs_review' AND OLD."review_lookup" = 'clear' AND OLD."provider_id" IS NULL
        AND NOT starts_with(OLD."needs_review_reason", 'accounting_parked_')))
    AND NEW."state" = 'pending'
    AND NEW."attempts" = OLD."attempts"
    AND NEW."last_error_class" IS NOT DISTINCT FROM OLD."last_error_class"
    AND NEW."lease_token" IS NULL AND NEW."lease_expires_at" IS NULL
    AND NEW."settles_at" IS NULL
    AND NEW."review_lookup" IS NULL AND NEW."needs_review_reason" IS NULL
    AND NEW."provider_id" IS NULL AND NEW."provider_number" IS NULL AND NEW."pdf_ref" IS NULL
    AND NEW."mismatch_field" IS NULL AND NEW."mismatch_difference_pence" IS NULL
  ), false) THEN
    RAISE EXCEPTION 'api_app may only requeue a failed or cleared document to pending, never a parked one'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$fn$;
