-- The demo seeds (GAP-31) write invented people, sales and staff work items. Until now they kept
-- off production only by the look of the database address. This table lets a database say for
-- itself that it may receive them: the seeds refuse any database without its one row, whatever the
-- address looks like. Every database gets the table empty; an operator inserts the row once on
-- test and on a local database (docs/runbooks/demo-seed.md). Production never gets a row.
--
-- One row at most (the key is always true). The row names the database it was written in, so a
-- copy restored under another name does not carry the permission with it.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "demo_seed_target" (
  "id" boolean PRIMARY KEY DEFAULT true,
  "environment" text NOT NULL,
  "database_name" text NOT NULL,
  "marked_by" text NOT NULL,
  "marked_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "demo_seed_target_single_row_check" CHECK ("id"),
  CONSTRAINT "demo_seed_target_environment_check" CHECK ("environment" IN ('test', 'local'))
);
