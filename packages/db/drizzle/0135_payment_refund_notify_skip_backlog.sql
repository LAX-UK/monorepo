-- The refund notice projector stalled on its first event because worker_app could not read
-- `payment` (granted in migrate-roles.ts alongside this release). Refunds recorded while it was
-- stalled must not be announced late, so the projector starts after the last refund that exists
-- when this runs. Refunds recorded afterwards are announced as normal.
INSERT INTO "projector_state" ("projector_name", "last_processed_event_id", "updated_at", "last_error")
SELECT 'payment_refund_notify', COALESCE(MAX("id"), 0), now(), NULL
FROM "domain_events"
WHERE "event_type" = 'payment.refunded'
ON CONFLICT ("projector_name") DO UPDATE
SET
  "last_processed_event_id" = GREATEST(
    "projector_state"."last_processed_event_id",
    EXCLUDED."last_processed_event_id"
  ),
  "updated_at" = now(),
  "last_error" = NULL;
