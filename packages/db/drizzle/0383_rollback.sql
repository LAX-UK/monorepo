-- Rollback for 0383_shop_invoices_books. Roll the release back first, then this; 0382 stays.
-- Parked documents stay parked: nothing is cancelled, and nothing is lost. 0382's rule lets api_app
-- release a parked document under its own payload, and the earlier release knows nothing of
-- `vat_on_outside_uk_delivery`, so a parked outside-UK delivery (a draft with no VAT stated, which
-- must never be sent) could be queued. So 0382's api_app rule is restored with one extra refusal:
-- api_app may not move a document parked for outside-UK delivery at all. The worker of the earlier
-- release never claims a `needs_review` document. Once 0383 is applied again (and the release that
-- knows it is deployed), Release works on those documents as before.
-- It restores 0382's api_app rule otherwise word for word (only a parked Bid delivery invoice may
-- be rebuilt on release, without 0383's extra pins) and 0382's history actions; the action CHECK
-- is added back NOT VALID, so `apply_remainder` rows already written stay (history is append-only)
-- while the earlier release can write no new one. It drops the definer function that holds a Shop
-- order's delivery for a release (`accounting_release_shop_order_basis`); the earlier release does
-- not call it. Also removes this migration's ledger row so a later deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '5s';
ALTER TABLE "accounting_document_event" DROP CONSTRAINT IF EXISTS "accounting_document_event_action_ck";
ALTER TABLE "accounting_document_event" ADD CONSTRAINT "accounting_document_event_action_ck" CHECK (
  "action" IN ('created', 'start_sending', 'expire_lease', 'complete_sending', 'apply_lookup',
    'escalate', 'requeue', 'cancel', 'release', 'park')
) NOT VALID;
CREATE OR REPLACE FUNCTION "accounting_document_api_requeue_only"() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  parked boolean := starts_with(OLD."needs_review_reason", 'accounting_parked_');
BEGIN
  IF current_user <> 'api_app' THEN
    RETURN NEW;
  END IF;
  -- Kept parked: the earlier release knows nothing of outside-UK delivery, so api_app may not move
  -- a document parked for it at all (no requeue, no release) until 0383 is applied again.
  IF OLD."needs_review_reason" = 'accounting_parked_vat_on_outside_uk_delivery' THEN
    RAISE EXCEPTION 'api_app may not move a document parked for outside-UK delivery before 0383 is applied again'
      USING ERRCODE = 'insufficient_privilege';
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

DROP FUNCTION IF EXISTS "accounting_release_shop_order_basis"(uuid);

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1811246400000;

COMMIT;
