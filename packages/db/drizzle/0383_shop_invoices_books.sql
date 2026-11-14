-- Shop invoices to Zoho Books (plan v2, flows 18-20). Applies after 0382 (Bid payments, parked
-- documents and Release), whose rules it extends; merge #1359 first.
--
-- A Shop order's delivery outside the UK is a quote whose VAT waits for the accountant, so its
-- invoice is stored parked: `needs_review` with the reason
-- `accounting_parked_vat_on_outside_uk_delivery`, nothing tried, nothing owed, no provider. 0382's
-- `provider_sent_ck` already allows a parked review, and 0382's api_app rule already refuses to
-- requeue one. This migration changes three things:
--
-- 1. Release. Once the accountant has said how outside-UK delivery is booked, staff press Release
--    and api_app queues the parked invoice, rebuilt from the stored order with the booking, under
--    the same LAX reference and for the same gross: 0382's clause for a parked Bid delivery
--    invoice, now naming the Shop's reason too, and for both products pinning more of the rebuilt
--    draft: only its lines and totals may change (same contact, currency, dates, number, entity),
--    with at least one line, net + VAT = gross, the lines adding up to the gross and the payload's
--    totals equal to the columns. Every other rule of 0382's function is unchanged. While the
--    booking is not set the application refuses the release (the stored rows still park it) and
--    nothing changes.
-- 2. History. The worker applies the order payment's unapplied rest to that delivery invoice once
--    the invoice is issued, and records it on the invoice's history as `apply_remainder` (issued to
--    issued). The action list gains it; nothing else about history changes.
-- 3. Release is atomic with the rows it was decided on. The move re-reads them in its own
--    transaction once the document is locked, held FOR SHARE, and refuses if they changed: Bid's
--    rows directly (api_app may lock them), a Shop order's stored delivery through the definer
--    function `accounting_release_shop_order_basis`, which reads and holds those columns only.
--
-- A refusal is `insufficient_privilege` (42501), as before. No table or column is added. The Shop
-- app's and the worker's reads for the Shop invoice (the buyer's invoice card, the projection's
-- facts) are column grants applied by db:roles.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "accounting_document_event" DROP CONSTRAINT IF EXISTS "accounting_document_event_action_ck";
--> statement-breakpoint
ALTER TABLE "accounting_document_event" ADD CONSTRAINT "accounting_document_event_action_ck" CHECK (
  "action" IN ('created', 'start_sending', 'expire_lease', 'complete_sending', 'apply_lookup',
    'escalate', 'requeue', 'cancel', 'release', 'park', 'apply_remainder')
);
--> statement-breakpoint
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
--> statement-breakpoint
-- What a release of a parked Shop delivery invoice is decided on: the order's stored delivery. The
-- release's move reads it again in its own transaction and holds the row FOR SHARE until it
-- commits, so the release is atomic with the row it was decided on. api_app may read these columns
-- but not lock a Shop row, so this definer function does it, for these columns only (granted to
-- api_app by db:roles).
CREATE OR REPLACE FUNCTION "accounting_release_shop_order_basis"(p_order_id uuid) RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
  SELECT jsonb_build_object(
           'id', o."id", 'status', o."status", 'fulfilment', o."fulfilment",
           'surcharge', o."fulfilment_surcharge_pence", 'vat', o."fulfilment_vat_pence")::text
    FROM public."shop_order" o
   WHERE o."id" = p_order_id
     FOR SHARE;
$fn$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public."accounting_release_shop_order_basis"(uuid) FROM PUBLIC;
