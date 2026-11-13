-- The Bid API (api_app) puts a refused accounting document back in the queue when staff press
-- "Try again", and records that in the document's history. Column grants cannot limit the values
-- written, and the requeue's UPDATE must be allowed to null the provider's document columns, so
-- these triggers hold api_app to that one move:
--   * a document it updates must go from `failed`, or from `needs_review` with nothing owed and no
--     provider document, to `pending`, keep its attempts and last error, and carry no lease, lookup,
--     review, provider document or mismatch. It cannot mark a document issued or give it a Books id;
--   * a history row it adds must be a `requeue` to `pending` from one of those states, name the
--     person who asked (`detail = {"requestedBy": "<id>"}` and nothing else), and match a document
--     that is now `pending` with the same attempts.
-- Other roles are not affected: the worker's transitions and the owner's maintenance run unchanged.
-- A refusal is `insufficient_privilege` (42501), the same as a missing grant. Each rule is wrapped in
-- COALESCE(..., false) so a NULL (a missing actor, say) refuses rather than slipping through.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
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
--> statement-breakpoint
DROP TRIGGER IF EXISTS "accounting_document_api_requeue_only" ON "accounting_document";
--> statement-breakpoint
CREATE TRIGGER "accounting_document_api_requeue_only"
  BEFORE UPDATE ON "accounting_document"
  FOR EACH ROW EXECUTE FUNCTION "accounting_document_api_requeue_only"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "accounting_document_event_api_requeue_only"() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF current_user <> 'api_app' THEN
    RETURN NEW;
  END IF;
  IF NOT COALESCE((
    NEW."action" = 'requeue'
    AND NEW."from_state" IN ('failed', 'needs_review')
    AND NEW."to_state" = 'pending'
    AND jsonb_typeof(NEW."detail" -> 'requestedBy') = 'string'
    AND NEW."detail" ->> 'requestedBy' <> ''
    AND NEW."detail" - 'requestedBy' = '{}'::jsonb
    AND EXISTS (
      SELECT 1 FROM "accounting_document" d
       WHERE d."id" = NEW."document_id" AND d."state" = 'pending' AND d."attempts" = NEW."attempts"
    )
  ), false) THEN
    RAISE EXCEPTION 'api_app may only record a requeue, with who asked for it'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$fn$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "accounting_document_event_api_requeue_only" ON "accounting_document_event";
--> statement-breakpoint
CREATE TRIGGER "accounting_document_event_api_requeue_only"
  BEFORE INSERT ON "accounting_document_event"
  FOR EACH ROW EXECUTE FUNCTION "accounting_document_event_api_requeue_only"();
