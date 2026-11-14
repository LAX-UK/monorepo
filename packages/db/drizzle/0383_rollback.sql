-- Rollback for 0383_shop_invoices_books. Roll the release back first, then this; 0382 stays.
-- Parked Shop deliveries first: 0382's rule lets api_app release any parked document under its own
-- payload, and the earlier release knows nothing of `vat_on_outside_uk_delivery`, so a parked
-- outside-UK delivery (a draft with no VAT stated, which must never be sent) could be queued. So
-- every document parked for that reason is moved to `cancelled`, each with a `cancel` history row
-- saying why (`{"rollback":"0383","parked":"vat_on_outside_uk_delivery"}`), before 0382's rules are
-- restored. They were never sent, so nothing reaches Books. After the release is deployed again,
-- such an order's delivery is projected anew only by a person: a cancelled row keeps its reference.
-- It restores 0382's api_app rule (only a parked Bid delivery invoice may be rebuilt on release)
-- and 0382's history actions; the action CHECK is added back NOT VALID, so `apply_remainder` rows
-- already written stay (history is append-only) while the earlier release can write no new one.
-- Also removes this migration's ledger row so a later deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '5s';
WITH parked AS (
  SELECT "id", "attempts"
    FROM "accounting_document"
   WHERE "state" = 'needs_review'
     AND "needs_review_reason" = 'accounting_parked_vat_on_outside_uk_delivery'
   FOR UPDATE
), moved AS (
  UPDATE "accounting_document" d
     SET "state" = 'cancelled', "review_lookup" = NULL, "needs_review_reason" = NULL,
         "mismatch_field" = NULL, "mismatch_difference_pence" = NULL, "updated_at" = now()
    FROM parked p
   WHERE d."id" = p."id"
  RETURNING d."id"
)
INSERT INTO "accounting_document_event"
  ("document_id", "action", "from_state", "to_state", "attempts", "detail", "occurred_at")
SELECT p."id", 'cancel', 'needs_review', 'cancelled', p."attempts",
       jsonb_build_object('rollback', '0383', 'parked', 'vat_on_outside_uk_delivery'),
       now()
  FROM parked p
  JOIN moved m ON m."id" = p."id";
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

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1811246400000;

COMMIT;
