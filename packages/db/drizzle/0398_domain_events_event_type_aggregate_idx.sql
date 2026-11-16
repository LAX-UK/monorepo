-- BA-15. Look up one aggregate's events of one type: event_type = $1 AND aggregate_id = $2. Several
-- readers ask exactly that without naming the aggregate type (the email-block lift lookup, the bid
-- invoice email facts' payment.captured check), so domain_events_aggregate_idx, which leads with
-- aggregate_type, cannot seek on them: they read every event of the type, or walk that whole index.
-- The readers that also name the aggregate type use this index too, with the type as a filter.
--
-- Btree, not pg_trgm. Every reader of this pair compares with "="; the one LIKE over these columns
-- is the audit log's free-text search, which ORs them with the actor's name and email from joined
-- tables, so no index on domain_events can serve it (checked with a trial GIN (gin_trgm_ops) index
-- on 1M rows: the plan stays a sequential scan, and the equality lookups ran slower through the
-- GIN than through this btree).
--
-- Building it. The migration runner applies each migration inside a transaction, so CONCURRENTLY
-- is not available here (as in 0297, 0316, 0365, 0384). Plain CREATE INDEX takes a SHARE lock on
-- domain_events: reads carry on, inserts wait for the build. Never ACCESS EXCLUSIVE. Measured on
-- PG 16 with 1M synthetic rows (266 MB heap): the build took 1.3 s. lock_timeout stops it
-- queueing every writer behind a long transaction. To build it with no write pause at all, run
-- before deploying, outside a transaction (psql, autocommit):
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS "domain_events_event_type_aggregate_id_idx"
--     ON "domain_events" USING btree ("event_type", "aggregate_id");
-- then this migration finds it and does nothing. The DO block below refuses an INVALID index left
-- by a failed concurrent build (IF NOT EXISTS would otherwise keep it, and nothing would use it):
-- drop it and build again. Grants are unchanged (indexes need none).
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
     WHERE c.oid = to_regclass('public.domain_events_event_type_aggregate_id_idx')
       AND NOT i.indisvalid
  ) THEN
    RAISE EXCEPTION 'domain_events_event_type_aggregate_id_idx exists but is INVALID (a failed concurrent build); drop it and build it again'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;
END
$$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "domain_events_event_type_aggregate_id_idx"
  ON "domain_events" USING btree ("event_type", "aggregate_id");
