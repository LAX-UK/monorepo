-- Rollback for 0385_accounting_credit_note_refunds. Roll the release back first, then this.
-- Restores 0383's history actions. The CHECK is added back NOT VALID, so `refund_credit_note` and
-- `hold` rows already written stay (history is append-only) while the earlier release can
-- write no new one. Parked documents stay parked: 0383's api_app rule is restored word for word
-- with 0385's one refusal kept (as 0383's own rollback kept outside-UK delivery parked), so the
-- buyer default, cancelled-invoice and courier refund credit notes are never moved by api_app
-- while the earlier release, which knows nothing of them, runs.
-- Credit notes are not touched. Also removes this migration's ledger row so a later deploy
-- reapplies it.
BEGIN;

SET LOCAL lock_timeout = '5s';
ALTER TABLE "accounting_document_event" DROP CONSTRAINT IF EXISTS "accounting_document_event_action_ck";
ALTER TABLE "accounting_document_event" ADD CONSTRAINT "accounting_document_event_action_ck" CHECK (
  "action" IN ('created', 'start_sending', 'expire_lease', 'complete_sending', 'apply_lookup',
    'escalate', 'requeue', 'cancel', 'release', 'park', 'apply_remainder')
) NOT VALID;
CREATE OR REPLACE FUNCTION "accounting_document_api_requeue_only"() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  parked boolean := starts_with(OLD."needs_review_reason", 'accounting_parked_');
  -- The rebuilt payload's line total (quantity x unit net + VAT, each line), or null when its
  -- lines are missing or empty, or any line is not an object with numeric fields.
  lines_gross numeric;
BEGIN
  IF current_user <> 'api_app' THEN
    RETURN NEW;
  END IF;
  -- Kept parked while the accountant's answer is not set (0385): api_app may not move a credit
  -- note parked for a buyer default's treatment, one whose invoice was cancelled in the books, or
  -- a courier refund's credit note parked with its delivery invoice. The migration that ships the
  -- answer lifts the matching line.
  IF OLD."needs_review_reason" IN ('accounting_parked_buyer_default_treatment',
       'accounting_parked_credited_invoice_cancelled')
     OR (OLD."kind" = 'credit_note' AND OLD."needs_review_reason" = 'accounting_parked_vat_on_delivery') THEN
    RAISE EXCEPTION 'api_app may not move this parked credit note until the accountant''s answer is set'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF jsonb_typeof(NEW."payload" -> 'lines') = 'array'
     AND jsonb_array_length(NEW."payload" -> 'lines') > 0 THEN
    -- Total over every element: a line that is not an object, or lacks a numeric field, makes
    -- the whole check false (never NULL, which bool_and and sum would skip).
    SELECT CASE WHEN bool_and(COALESCE(jsonb_typeof(l) = 'object'
                                       AND jsonb_typeof(l -> 'quantity') = 'number'
                                       AND jsonb_typeof(l -> 'unitNetPence') = 'number'
                                       AND jsonb_typeof(l -> 'vatPence') = 'number', false))
             -- The aggregate runs even when the CASE is false, so its casts are guarded too; it
             -- only counts when every line passed above, so no line is skipped.
             THEN sum(CASE WHEN jsonb_typeof(l) = 'object'
                                AND jsonb_typeof(l -> 'quantity') = 'number'
                                AND jsonb_typeof(l -> 'unitNetPence') = 'number'
                                AND jsonb_typeof(l -> 'vatPence') = 'number'
                           THEN (l ->> 'quantity')::numeric * (l ->> 'unitNetPence')::numeric
                                + (l ->> 'vatPence')::numeric END) END
      INTO lines_gross
      FROM jsonb_array_elements(NEW."payload" -> 'lines') AS l;
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
      -- Release: a parked review, never sent. Only a parked delivery invoice (Bid's courier quote,
      -- or a Shop delivery outside the UK) may be rebuilt, under the same LAX reference and for
      -- the same gross (what was charged). The rebuild changes only its lines and totals (the
      -- booking): the same contact, currency, dates, number and entity (everything else in the
      -- payload is unchanged), at least one line, net + VAT = gross, the lines adding up to the
      -- gross, and the payload's totals equal to the columns.
      (OLD."state" = 'needs_review' AND OLD."review_lookup" = 'clear' AND OLD."provider_id" IS NULL
        AND parked
        AND ((NEW."payload" = OLD."payload"
            AND NEW."net_pence" = OLD."net_pence" AND NEW."vat_pence" = OLD."vat_pence"
            AND NEW."gross_pence" = OLD."gross_pence")
          OR (OLD."needs_review_reason" IN ('accounting_parked_vat_on_delivery',
                'accounting_parked_vat_on_outside_uk_delivery')
            AND OLD."kind" = 'invoice'
            AND NEW."payload" ->> 'reference' = OLD."lax_reference"
            AND NEW."payload" ->> 'kind' = 'invoice'
            AND NEW."gross_pence" = OLD."gross_pence"
            AND NEW."payload" -> 'contactReference' = OLD."payload" -> 'contactReference'
            AND NEW."payload" -> 'currency' = OLD."payload" -> 'currency'
            AND NEW."payload" -> 'issuedOn' IS NOT DISTINCT FROM OLD."payload" -> 'issuedOn'
            AND NEW."payload" -> 'dueOn' IS NOT DISTINCT FROM OLD."payload" -> 'dueOn'
            AND (NEW."payload" - 'lines' - 'totals') = (OLD."payload" - 'lines' - 'totals')
            AND NEW."net_pence" + NEW."vat_pence" = NEW."gross_pence"
            AND lines_gross = NEW."gross_pence"
            AND CASE WHEN jsonb_typeof(NEW."payload" #> '{totals,netPence}') = 'number'
                       AND jsonb_typeof(NEW."payload" #> '{totals,vatPence}') = 'number'
                       AND jsonb_typeof(NEW."payload" #> '{totals,grossPence}') = 'number'
                  THEN (NEW."payload" #>> '{totals,netPence}')::numeric = NEW."net_pence"
                    AND (NEW."payload" #>> '{totals,vatPence}')::numeric = NEW."vat_pence"
                    AND (NEW."payload" #>> '{totals,grossPence}')::numeric = NEW."gross_pence"
                  ELSE false END)))
    )
  ), false) THEN
    RAISE EXCEPTION 'api_app may only requeue a failed or cleared document, or release a parked one, to pending'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$fn$;

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1811419200000;

COMMIT;
