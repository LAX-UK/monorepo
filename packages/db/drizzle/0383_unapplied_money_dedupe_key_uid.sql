-- At most one "unapplied money received" event per piece of money. The recorder already takes a
-- transaction advisory lock on the dedupe key and checks for an existing event before it writes;
-- this makes the database refuse a second one too, whoever writes it (a writer that skips the
-- recorder, or a future code path), so finance never sees the same money twice.
--
-- Partial unique index on the payload's dedupeKey, for that one event type only. It is small (one
-- entry per finance task), and its predicate matches the reader's lookups
-- (event_type = 'payment.unapplied_money_received' AND payload->>'dedupeKey' = $1).
--
-- Pre-check, run against the target database before deploying (must return no rows):
--   SELECT payload->>'dedupeKey' AS dedupe_key, count(*)
--     FROM domain_events
--    WHERE event_type = 'payment.unapplied_money_received' AND payload->>'dedupeKey' IS NOT NULL
--    GROUP BY 1 HAVING count(*) > 1;
-- The DO block below runs the same check and stops the migration with a clear message if it finds
-- any, rather than the bare unique-violation of the index build. Rows without a dedupeKey never
-- clash (NULLs are distinct in a unique index); the recorder has always written the key.
--
-- Table size. Plain CREATE UNIQUE INDEX: the migration runner is transactional, so CONCURRENTLY is
-- not available. The build reads all of domain_events once (the predicate is applied per row) and
-- holds a SHARE lock, blocking inserts into domain_events while it runs. Size check before
-- deploying:
--   SELECT pg_size_pretty(pg_relation_size('domain_events')), count(*) FROM domain_events;
-- Measured locally on PG 16 with 1M synthetic rows (372 MB heap, 1 in 2,000 of this type): the
-- build took 0.11 s with the table cached; a cold read is bound by disk, a few seconds at most at
-- that size. The duplicate check uses the existing event_type index. The retention runbook
-- (docs/runbooks/domain-events-retention.md) plans for partitioning only past 10M rows, so the
-- lock is expected to last seconds; run it at low traffic. lock_timeout stops it waiting behind a
-- long transaction instead of queueing every writer behind it. Grants are unchanged (indexes need
-- none).
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM "domain_events"
     WHERE "event_type" = 'payment.unapplied_money_received'
       AND "payload"->>'dedupeKey' IS NOT NULL
     GROUP BY "payload"->>'dedupeKey'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'domain_events holds duplicate payment.unapplied_money_received events for one dedupeKey; resolve them before adding domain_events_unapplied_money_dedupe_key_uid'
      USING ERRCODE = 'unique_violation';
  END IF;
END
$$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "domain_events_unapplied_money_dedupe_key_uid"
  ON "domain_events" (("payload"->>'dedupeKey'))
  WHERE "event_type" = 'payment.unapplied_money_received';
