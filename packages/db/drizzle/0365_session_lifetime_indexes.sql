-- Sign-in lifetimes and the browser cap. The columns they read already exist (0356):
-- session.last_seen_at (last real use), session.signed_in_at (first sign-in on the browser, carried
-- across renewals), session.updated_at and session.created_at as fallbacks for records made before
-- those were written. Nothing is added to the table and nothing is backfilled.
--
-- One index. The once-a-minute sweep ends records in separate, selective scans: expires_at (the
-- existing index; the application now holds expires_at to the person's idle and absolute limits),
-- signed_in_at older than the client absolute limit (this index: over for every person, so few
-- rows match), and staff records, found through their markers. There is deliberately no index on
-- coalesce(last_seen_at, updated_at): last_seen_at is written on every touch and updated_at on every
-- Better Auth renewal, so such an index would make those updates non-HOT and add write
-- amplification and bloat for no read benefit. Idle ends need no index: see sweepScans.
-- Plain CREATE INDEX: the migration runner is transactional, so CONCURRENTLY is not available.
-- The build blocks writes to session while it runs (a SHARE lock); run it at low traffic.
-- auth_app already holds table-level grants on session; indexes need none.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_signed_in_idx"
  ON "session" ((coalesce("signed_in_at", "created_at")));
