-- Collapse any pre-existing duplicate `user.email_verified` events (keep the earliest id)
-- so the partial unique index can be created cleanly.
DELETE FROM "domain_events" d
USING "domain_events" keep
WHERE d.event_type = 'user.email_verified'
  AND keep.event_type = 'user.email_verified'
  AND d.aggregate_type = keep.aggregate_type
  AND d.aggregate_id = keep.aggregate_id
  AND d.id > keep.id;

-- Hard idempotency guard: at most one `user.email_verified` per (aggregate_type, aggregate_id).
CREATE UNIQUE INDEX IF NOT EXISTS "domain_events_user_email_verified_uid"
  ON "domain_events" ("aggregate_type", "aggregate_id")
  WHERE event_type = 'user.email_verified';
