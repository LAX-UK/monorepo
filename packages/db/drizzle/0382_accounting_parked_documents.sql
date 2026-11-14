-- Parked accounting documents (Zoho Books payments). A projection may store a document straight
-- into `needs_review` with a reason starting `accounting_parked_` (a delivery invoice waiting for
-- the accountant's answer on VAT, a payment for a cancelled invoice). It must never be sent until
-- that is settled: staff release it once the reason is settled (below), or cancel it; they never
-- try it again (the domain's `requeue` answers `parked`). Whether the reason is settled is decided
-- by the application from the stored rows (`resolveParked`); this holds the table to the shape of
-- the move whatever the application does. Everything else in 0379's rule is unchanged. Other roles
-- are not affected. A refusal is `insufficient_privilege` (42501), as before.
--
-- A parked document was never sent, so it has no provider. 0368's `provider_sent_ck` allowed that
-- only for `pending` and `cancelled`; it now also allows a parked review: nothing tried
-- (`attempts` 0), nothing owed, no provider document, and a parked reason.
--
-- Release. Once a parked document's reason is settled (the accountant's booking for delivery is
-- set, or the cancelled invoice is reinstated), staff press Release in Accounting and api_app
-- queues it: parked `needs_review` to `pending`, the same rule otherwise as a requeue, in a clause
-- of its own. Only a parked delivery invoice may have its document replaced on release (the draft
-- rebuilt from the stored rows with the booking), under the same LAX reference; every other
-- update by api_app, a requeue included, must leave the document and its totals as they are
-- (api_app is granted those columns for the release alone). Its history row is a `release`
-- naming who asked. The worker may also park a queued payment (`park`) whose invoice was cancelled.
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
ALTER TABLE "accounting_document_event" DROP CONSTRAINT IF EXISTS "accounting_document_event_action_ck";
--> statement-breakpoint
ALTER TABLE "accounting_document_event" ADD CONSTRAINT "accounting_document_event_action_ck" CHECK (
  "action" IN ('created', 'start_sending', 'expire_lease', 'complete_sending', 'apply_lookup',
    'escalate', 'requeue', 'cancel', 'release', 'park')
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "accounting_document_api_requeue_only"() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  parked boolean := starts_with(OLD."needs_review_reason", 'accounting_parked_');
BEGIN
  IF current_user <> 'api_app' THEN
    RETURN NEW;
  END IF;
  IF NOT COALESCE((
    -- What a requeue and a release have in common: queued, nothing leased, owed or held.
    NEW."state" = 'pending'
    AND NEW."attempts" = OLD."attempts"
    AND NEW."last_error_class" IS NOT DISTINCT FROM OLD."last_error_class"
    AND NEW."lease_token" IS NULL AND NEW."lease_expires_at" IS NULL
    AND NEW."settles_at" IS NULL
    AND NEW."review_lookup" IS NULL AND NEW."needs_review_reason" IS NULL
    AND NEW."provider_id" IS NULL AND NEW."provider_number" IS NULL AND NEW."pdf_ref" IS NULL
    AND NEW."mismatch_field" IS NULL AND NEW."mismatch_difference_pence" IS NULL
    AND (
      -- Requeue: a failed document, or a cleared review that is not parked. Unchanged document.
      ((OLD."state" = 'failed'
          OR (OLD."state" = 'needs_review' AND OLD."review_lookup" = 'clear'
            AND OLD."provider_id" IS NULL AND NOT COALESCE(parked, false)))
        AND NEW."payload" = OLD."payload"
        AND NEW."net_pence" = OLD."net_pence" AND NEW."vat_pence" = OLD."vat_pence"
        AND NEW."gross_pence" = OLD."gross_pence")
      OR
      -- Release: a parked review, never sent. Only a parked delivery invoice may be rebuilt, under
      -- the same LAX reference and for the same gross (what was charged).
      (OLD."state" = 'needs_review' AND OLD."review_lookup" = 'clear' AND OLD."provider_id" IS NULL
        AND parked
        AND ((NEW."payload" = OLD."payload"
            AND NEW."net_pence" = OLD."net_pence" AND NEW."vat_pence" = OLD."vat_pence"
            AND NEW."gross_pence" = OLD."gross_pence")
          OR (OLD."needs_review_reason" = 'accounting_parked_vat_on_delivery'
            AND OLD."kind" = 'invoice'
            AND NEW."payload" ->> 'reference' = OLD."lax_reference"
            AND NEW."payload" ->> 'kind' = 'invoice'
            AND NEW."gross_pence" = OLD."gross_pence")))
    )
  ), false) THEN
    RAISE EXCEPTION 'api_app may only requeue a failed or cleared document, or release a parked one, to pending'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "accounting_document_event_api_requeue_only"() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF current_user <> 'api_app' THEN
    RETURN NEW;
  END IF;
  IF NOT COALESCE((
    NEW."to_state" = 'pending'
    AND jsonb_typeof(NEW."detail" -> 'requestedBy') = 'string'
    AND NEW."detail" ->> 'requestedBy' <> ''
    AND EXISTS (
      SELECT 1 FROM "accounting_document" d
       WHERE d."id" = NEW."document_id" AND d."state" = 'pending' AND d."attempts" = NEW."attempts"
    )
    AND (
      (NEW."action" = 'requeue'
        AND NEW."from_state" IN ('failed', 'needs_review')
        AND NEW."detail" - 'requestedBy' = '{}'::jsonb)
      OR
      (NEW."action" = 'release'
        AND NEW."from_state" = 'needs_review'
        AND jsonb_typeof(NEW."detail" -> 'parked') = 'string'
        AND jsonb_typeof(NEW."detail" -> 'rebuilt') = 'boolean'
        AND NEW."detail" - 'requestedBy' - 'parked' - 'rebuilt' = '{}'::jsonb)
    )
  ), false) THEN
    RAISE EXCEPTION 'api_app may only record a requeue or a release, with who asked for it'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$fn$;
