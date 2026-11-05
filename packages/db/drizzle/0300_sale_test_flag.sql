-- A sale can be marked as a test sale: staff use it to rehearse a sale end to end. It is hidden
-- from every public surface and never announced. Adds one NOT NULL column with a constant default,
-- which Postgres applies without rewriting the table.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN IF NOT EXISTS "is_test" boolean DEFAULT false NOT NULL;
