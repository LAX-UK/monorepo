-- Sign-in lifetimes: idle and absolute ends, and the browser cap. The columns they read already
-- exist (0356): session.last_seen_at (last real use), session.signed_in_at (first sign-in on the
-- browser, carried across renewals), session.updated_at and session.created_at as fallbacks for
-- records made before those were written. Nothing is added to the table and nothing is backfilled.
--
-- The once-a-minute sweep ends records that have been idle or signed in too long, besides the ones
-- whose expires_at passed. Its candidates are found with the shortest limits any record can have
-- (staff: 12 hours idle, 24 hours absolute) and then checked against the record's own limits, so
-- each limit gets an index on the exact expression the sweep filters by:
--   idle      coalesce(last_seen_at, updated_at)
--   absolute  coalesce(signed_in_at, created_at)
-- Plain CREATE INDEX: the migration runner is transactional, so CONCURRENTLY is not available.
-- The builds block writes to session for the few seconds they take at current table sizes.
-- auth_app already holds table-level grants on session; indexes need none.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_last_active_idx"
  ON "session" ((coalesce("last_seen_at", "updated_at")));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_signed_in_idx"
  ON "session" ((coalesce("signed_in_at", "created_at")));
