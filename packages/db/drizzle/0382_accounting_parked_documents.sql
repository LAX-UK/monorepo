-- Parked accounting documents (Zoho Books payments). A projection may store a document straight
-- into `needs_review` with a reason starting `accounting_parked_` (a delivery invoice waiting for
-- the accountant's answer on VAT, a payment for a cancelled invoice). It must never be sent until
-- that is settled, so the Bid API (api_app) may not requeue it: staff can cancel it, not try it
-- again. The domain refuses the requeue too (`requeue` answers `parked`); this holds the table to
-- it whatever the application does. Everything else in 0379's rule is unchanged. Other roles are
-- not affected. A refusal is `insufficient_privilege` (42501), as before.
--
-- A parked document was never sent, so it has no provider. 0368's `provider_sent_ck` allowed that
-- only for `pending` and `cancelled`; it now also allows a parked review: nothing tried
-- (`attempts` 0), nothing owed, no provider document, and a parked reason.
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
