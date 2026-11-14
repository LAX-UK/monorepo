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
--    the same LAX reference and for the same gross: exactly 0382's clause for a parked Bid
--    delivery invoice, now naming the Shop's reason too. Every other rule of 0382's function is
--    unchanged. While the booking is not set the application refuses the release (the stored rows
--    still park it) and nothing changes.
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
      -- Release: a parked review, never sent. Only a parked delivery invoice (Bid's courier quote,
      -- or a Shop delivery outside the UK) may be rebuilt, under the same LAX reference and for
      -- the same gross (what was charged).
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
