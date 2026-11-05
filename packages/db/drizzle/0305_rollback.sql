-- Rollback for 0305_purchase_problem_workflow. Roll back the application release first: the
-- previous release knows only open and resolved. Reports in progress go back to open, and
-- assignments, staff notes and resolver names are lost.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DROP TABLE IF EXISTS "purchase_problem_note";
--> statement-breakpoint
DROP INDEX IF EXISTS "purchase_problem_status_created_idx";
--> statement-breakpoint
UPDATE "purchase_problem" SET "status" = 'open' WHERE "status" = 'in_progress';
--> statement-breakpoint
ALTER TABLE "purchase_problem" DROP CONSTRAINT IF EXISTS "purchase_problem_status_check";
--> statement-breakpoint
ALTER TABLE "purchase_problem" ADD CONSTRAINT "purchase_problem_status_check"
  CHECK ("status" IN ('open', 'resolved'));
--> statement-breakpoint
DROP INDEX IF EXISTS "purchase_problem_open_uidx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_problem_open_uidx"
  ON "purchase_problem" ("lot_id", "buyer_legal_entity_id")
  WHERE "status" = 'open';
--> statement-breakpoint
DROP INDEX IF EXISTS "purchase_problem_open_created_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_problem_open_created_idx"
  ON "purchase_problem" ("created_at")
  WHERE "status" = 'open';
--> statement-breakpoint
ALTER TABLE "purchase_problem" DROP COLUMN IF EXISTS "version";
--> statement-breakpoint
ALTER TABLE "purchase_problem" DROP COLUMN IF EXISTS "resolved_by_user_id";
--> statement-breakpoint
ALTER TABLE "purchase_problem" DROP COLUMN IF EXISTS "assigned_to_user_id";
